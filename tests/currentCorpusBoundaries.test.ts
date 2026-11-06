import {expect,it} from 'vitest';
import {newCharacter,type Character,type Edition,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {syncSourceEquipment} from '../src/core/automation/sourceEquipment';
import {claimStartingEquipment,sheetChoices} from '../src/core/automation/choices';
import {sourceSpellFilter} from '../src/core/automation/sourceSpellFilter';
import {planSourceSpells,setSourceSpellChoices,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {performSpellAction,spellActionRequest} from '../src/core/automation/actions';
import {specialSpellResource} from '../src/core/specialSpells';
import {readCharacter} from '../src/core/validation';
import {inventoryState} from '../src/core/characterDetails';
import {syncFeatures} from '../src/core/sheet';

const entry=(name:string,kind:Entry['kind'],source:string,edition:Entry['edition'],raw:Entry['raw']={}):Entry=>({
 id:JSON.stringify([source,name,kind]),name,english:name,kind,source,edition,raw,packId:'authored-boundaries',revision:'1',entries:[],
});
function equipmentFixture(edition:Edition,kind:Entry['kind']='background'){
 const c=newCharacter(edition);c.automation=newAutomationState();c.profile.enabledSources=['OWNER','OTHER','SAME'];
 c.inventory={...structuredClone(inventoryState(c)),capacityAdjustment:'10'};c.inventory.coins.gp=11;
 c.runtime.resources.manual={max:7,current:2};c.notes='保留手工角色备注';
 const raw={startingEquipment:{defaultData:[{A:[{item:'Authored Rope|SAME',quantity:2},{value:700},{item:'Authored Blade|OTHER',quantity:5}],B:[{item:'Authored Rope|SAME',quantity:3}]}]}};
 const owner={id:'owner',entry:entry('Authored kit',kind,'OWNER',edition,raw),quantity:1,level:1,equipped:false};
 const rope=entry('Authored Rope','item','SAME',edition),blade=entry('Authored Blade','item','OTHER',edition==='2014'?'2024':'2014'),sameName=entry('Authored Blade','item','SAME',edition);
 c.selections=[owner];return {c,owner,rope,blade,catalog:[rope,blade,sameName]};
}
const equipmentChoice=(c:Character,catalog:Entry[])=>sheetChoices(c,catalog).find(choice=>choice.channel==='equipment')!;

it.each(['2014','2024'] as const)('automatic %s kits retain the whole pending package without taking incompatible items or coins',edition=>{
 const f=equipmentFixture(edition);delete f.owner.entry.raw.startingEquipment.defaultData[0].B;
 const before=structuredClone(f.c);expect(syncSourceEquipment(f.c,f.catalog)).toBe(false);expect(f.c).toEqual(before);
 expect(equipmentChoice(f.c,f.catalog)).toBeDefined();expect(equipmentChoice(f.c,f.catalog).complete).toBe(false);
});

it.each(['2014','2024'] as const)('explicit %s class-kit claims reject incompatible references before any inventory or choice mutation',edition=>{
 const f=equipmentFixture(edition,'class'),choice=equipmentChoice(f.c,f.catalog),before=structuredClone(f.c);
 expect(()=>claimStartingEquipment(f.c,choice.id,'A',f.catalog)).toThrow(/另一版|版本|版规则/);expect(f.c).toEqual(before);
 claimStartingEquipment(f.c,choice.id,'B',f.catalog);
 expect(f.c.selections.filter(row=>row.entry.kind==='item').map(row=>[row.entry.id,row.quantity])).toEqual([[f.rope.id,3]]);
 expect(f.c.inventory!.coins.gp).toBe(11);expect(f.c.runtime.resources.manual).toEqual({max:7,current:2});
});

it('core source references remain edition-qualified even when their item data is not loaded',()=>{
 const f=equipmentFixture('2014','class');f.owner.entry.raw.startingEquipment.defaultData[0].A=[{item:'Authored Unknown|XPHB',quantity:2}];
 const before=structuredClone(f.c),choice=equipmentChoice(f.c,[]);
 expect(()=>claimStartingEquipment(f.c,choice.id,'A',[])).toThrow(/另一版|版本|版规则/);expect(f.c).toEqual(before);
});

it('legacy-source consent keeps the source kit edition rather than converting its items to the character edition',()=>{
 const f=equipmentFixture('2014','class');f.c.edition='2024';f.c.profile.optional.legacy=true;
 const before=structuredClone(f.c),choice=equipmentChoice(f.c,f.catalog);expect(choice).toBeDefined();
 expect(()=>claimStartingEquipment(f.c,choice.id,'A',f.catalog)).toThrow(/另一版|版本|版规则/);expect(f.c).toEqual(before);
});

it('a declared both-edition extension keeps separate source-qualified kit items without combining their identities',()=>{
 const f=equipmentFixture('2014');f.owner.entry.edition='both';delete f.owner.entry.raw.startingEquipment.defaultData[0].B;
 expect(syncSourceEquipment(f.c,f.catalog)).toBe(true);
 expect(f.c.selections.filter(row=>row.entry.kind==='item').map(row=>[row.entry.id,row.entry.edition,row.quantity])).toEqual([[f.rope.id,'2014',2],[f.blade.id,'2024',5]]);
 expect(f.c.inventory!.coins.gp).toBe(18);expect(readCharacter(JSON.parse(JSON.stringify(f.c))).character.inventory).toEqual(f.c.inventory);
});

it('compatible kits survive reopen and source refresh without reissuing spent possessions or replacing original snapshots',()=>{
 const f=equipmentFixture('2014');delete f.owner.entry.raw.startingEquipment.defaultData[0].B;f.blade.edition='both';
 expect(syncSourceEquipment(f.c,f.catalog)).toBe(true);expect(f.c.inventory!.coins.gp).toBe(18);
 const rows=f.c.selections.filter(row=>row.entry.kind==='item');expect(rows.map(row=>row.quantity)).toEqual([2,5]);
 f.c.selections=f.c.selections.filter(row=>row.id!==rows[1].id);f.c.inventory!.coins.gp=3;
 const restored=readCharacter(JSON.parse(JSON.stringify(f.c))).character,before=structuredClone(restored);
 const replacement=f.catalog.map(row=>({...row,edition:'2024' as const,revision:'2'}));
 syncSourceEquipment(restored,replacement);syncSourceEquipment(restored,replacement);expect(restored).toEqual(before);
 expect(restored.runtime.resources.manual).toEqual({max:7,current:2});expect(restored.inventory!.capacityAdjustment).toBe('10');expect(restored.notes).toBe('保留手工角色备注');
});

it('late resolution of a claimed unloaded item fills only its source snapshot and preserves spent quantity, money and receipt through reopen',()=>{
 const f=equipmentFixture('2014','class');f.owner.entry.raw.startingEquipment.defaultData[0].B=[{item:'Authored Rope|PHB',quantity:3}];f.rope.source='PHB';
 claimStartingEquipment(f.c,equipmentChoice(f.c,[]).id,'B',[]);
 const row=f.c.selections.find(value=>value.entry.kind==='item')!;expect(row.entry.raw._equipmentRef).toBe('Authored Rope|PHB');
 row.quantity=1;f.c.inventory!.coins.gp=3;
 const expected=structuredClone(f.c);expected.selections.find(value=>value.id===row.id)!.entry=structuredClone(f.rope);
 syncFeatures(f.c,[f.rope]);expect(f.c).toEqual(expected);syncFeatures(f.c,[f.rope]);expect(f.c).toEqual(expected);
 const reopened=readCharacter(JSON.parse(JSON.stringify(f.c))).character;syncFeatures(reopened,[f.rope]);expect(reopened).toEqual(expected);
});

it('filtered source-qualified spell UIDs preserve canonical spaces and ampersands without combining distinct sources',()=>{
 const sources=['2024 PHB Backgrounds with Fluff','Selerim Homebrew Backgrounds','Generic Oversized Longbow','Psions Primer','dragoon revisited','Psions Primer-UAClassFeatureVariants','5EPotion Making','FT&S','Authored & One','Authored One','Authored-One','Authored_One','Legacy.Code'];
 const catalog=sources.map(source=>entry('Authored spell','spell',source,'2014',{level:1,school:'N'})),before=structuredClone(catalog);
 const result=sourceSpellFilter('level=1|school=N',catalog,'2014');
 expect(result.supported).toBe(true);if(!result.supported)return;
 expect(result.ambiguous).toBe(false);expect(new Set(result.references)).toEqual(new Set(sources.map(source=>`Authored spell|${source}`)));expect(catalog).toEqual(before);
 const invalid=['BOOK|PHB','BOOK#1','BOOK/PHB','BOOK\\PHB','BOOK%7CPHB','BOOK"PHB','BOOK\nPHB','BOOK\tPHB','BOOK  ONE','BOOK ',' BOOK','BOOK\u00a0ONE'];
 const rejected=sourceSpellFilter('level=1',invalid.map(source=>entry('Authored invalid spell','spell',source,'2014',{level:1})),'2014');
 expect(rejected).toEqual({supported:true,references:[],ambiguous:true});
});

it('an ampersand-source spell choice casts, saves and reopens without refreshing consumed uses or manual data',()=>{
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB','FT&S'];c.runtime.resources.manual={max:7,current:2};
 const owner=entry('Authored spell owner','feat','PHB','2014',{additionalSpells:[{ability:'wis',innate:{'_':{daily:{'1e':[{choose:'level=1|school=N'}]}}}}]});
 c.selections=[{id:'owner',entry:owner,quantity:1,level:1,equipped:false}];const catalog=[entry('Authored gift','spell','FT&S','2014',{level:1,school:'N'})];
 const choice=planSourceSpells(c,catalog).choices.find(choice=>choice.spells)!;expect(choice.spells).toEqual(['Authored gift|FT&S']);
 setSourceSpellChoices(c,choice.key,['Authored gift|FT&S'],catalog);syncSourceSpells(c,catalog);const granted=c.selections.find(row=>row.entry.kind==='spell')!;
 expect(performSpellAction(c,spellActionRequest(c,granted.id,'source','authored-spaced-source-cast')).status).toBe('applied');const key=specialSpellResource(granted.id,c);expect(c.runtime.resources[key].current).toBe(0);
 c.profile.enabledSources=[];syncSourceSpells(c,catalog);expect(c.spellSettings!.special![granted.id].sourceGrant!.active).toBe(false);
 const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;restored.profile.enabledSources=['PHB','FT&S'];syncSourceSpells(restored,catalog);syncSourceSpells(restored,catalog);
 expect(restored.automation!.spellChoices![choice.key]).toEqual(['Authored gift|FT&S']);expect(restored.spellSettings!.special![granted.id].sourceGrant!.active).toBe(true);
 expect(restored.runtime.resources[key].current).toBe(0);expect(restored.runtime.resources.manual).toEqual({max:7,current:2});
});
