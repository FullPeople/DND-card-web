import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {newCharacter,type Entry,type Character} from '../src/core/model';
import {normalizeData} from '../src/data/catalog';
import {sheetChoices,chooseSheetOption,setSheetChoiceSlot} from '../src/core/automation/choices';
import {newAutomationState} from '../src/core/automation/state';
import {cantripGroups,clearCantrip,spellIsReady} from '../src/core/spellWorkspace';
import {prepareSpellEntry} from '../src/core/spells';
import {syncFeatures,removeSelection} from '../src/core/sheet';
import {syncAutoResources} from '../src/core/resources';
import {spellState} from '../src/core/characterDetails';
import {setSpecialSpell,changeSpecialSpellUses,specialSpellResource} from '../src/core/specialSpells';
import {validateCharacter} from '../src/core/validation';

const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>({id,name:id,english:id,kind,raw,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:['原创法术选择验收。']});
const spells=(cls='Renamed book caster')=>Array.from({length:12},(_,i)=>entry(`法术 ${i}`,'spell',{level:i<4?0:1,classes:{fromClassList:[{name:cls,source:'XPHB'}]}}));
function setup(raw:Entry['raw']={casterProgression:'full',spellcastingAbility:'int',cantripProgression:[3],spellsKnownProgressionFixed:[6],preparedSpellsProgression:[4]},name='Renamed book caster'){
 const c=newCharacter();c.automation=newAutomationState();c.selections=[{id:'owner',entry:entry(name,'class',raw),level:1,quantity:1,equipped:false}];return c;
}
const choice=(c:Character,kind:string,catalog:Entry[])=>sheetChoices(c,catalog).find(r=>r.spellKind===kind)!;
it('drag slots preserve holes, allow full replacement and deletion without forgetting learned spells',()=>{
 const c=setup(),catalog=spells();setSheetChoiceSlot(c,choice(c,'cantrips',catalog).id,2,catalog[0].id,catalog);expect(choice(c,'cantrips',catalog).slots).toEqual(['','',catalog[0].id]);
 const book=choice(c,'book',catalog);setSheetChoiceSlot(c,book.id,5,catalog[4].id,catalog);expect(choice(c,'book',catalog).slots).toEqual(['','','','','',catalog[4].id]);for(let i=0;i<5;i++)setSheetChoiceSlot(c,book.id,i,catalog[5+i].id,catalog);expect(choice(c,'book',catalog).complete).toBe(true);
 const prep=choice(c,'prepared',catalog);setSheetChoiceSlot(c,prep.id,3,catalog[4].id,catalog);expect(choice(c,'prepared',catalog).slots).toEqual(['','','',catalog[4].id]);setSheetChoiceSlot(c,prep.id,0,catalog[5].id,catalog);setSheetChoiceSlot(c,prep.id,1,catalog[6].id,catalog);setSheetChoiceSlot(c,prep.id,2,catalog[7].id,catalog);setSheetChoiceSlot(c,prep.id,0,catalog[8].id,catalog);expect(choice(c,'prepared',catalog).selected).not.toContain(catalog[5].id);expect(c.selections.some(s=>s.entry.id===catalog[5].id)).toBe(true);
 setSheetChoiceSlot(c,book.id,5,catalog[10].id,catalog);expect(choice(c,'book',catalog).selected).toContain(catalog[10].id);expect(choice(c,'prepared',catalog).slots?.[3]).toBe('');expect(c.selections.some(s=>s.entry.id===catalog[4].id)).toBe(true);setSheetChoiceSlot(c,book.id,1,undefined,catalog);expect(choice(c,'book',catalog).slots?.[1]).toBe('');expect(validateCharacter(JSON.parse(JSON.stringify(c))).spellSettings).toEqual(c.spellSettings);
});
it('reads source-shaped cantrip, book and prepared choices without creating spells or saved answers',()=>{
 const c=setup(),catalog=spells(),before=JSON.stringify(c);
 expect(sheetChoices(c,catalog).map(r=>[r.label,r.count])).toEqual([['戏法',3],['法术书',6],['预备法术',4]]);
 expect(choice(c,'prepared',catalog).options).toEqual([]);expect(choice(c,'cantrips',catalog).options).toHaveLength(4);expect(JSON.stringify(c)).toBe(before);
 c.automation!.enabled=false;expect(sheetChoices(c,catalog)).toEqual([]);
});
it('fills the existing workspace, filters preparation to the book and preserves consumed slots through refresh/import',()=>{
 const c=setup(),catalog=spells();syncAutoResources(c);c.runtime.resources['spell-slot:1'].current=0;
 for(const e of catalog.slice(0,3))chooseSheetOption(c,choice(c,'cantrips',catalog).id,e.id,catalog);
 for(const e of catalog.slice(4,10))chooseSheetOption(c,choice(c,'book',catalog).id,e.id,catalog);
 expect(choice(c,'book',catalog).complete).toBe(true);expect(choice(c,'prepared',catalog).options).toHaveLength(6);
 for(const e of catalog.slice(4,8))chooseSheetOption(c,choice(c,'prepared',catalog).id,e.id,catalog);
 expect(spellState(c).prepared.filter(Boolean)).toHaveLength(4);expect(cantripGroups(c)[0].slots.filter(Boolean)).toHaveLength(3);
 const rows=c.selections.filter(s=>s.entry.kind==='spell');expect(rows).toHaveLength(9);expect(Object.values(c.answers)).toHaveLength(0);
 for(let i=0;i<3;i++){syncFeatures(c,catalog);syncAutoResources(c);sheetChoices(c,catalog);}
 const restored=validateCharacter(JSON.parse(JSON.stringify(c)));expect(restored.spellSettings).toEqual(c.spellSettings);expect(restored.runtime.resources['spell-slot:1'].current).toBe(0);expect(restored.selections.filter(s=>s.entry.kind==='spell')).toHaveLength(9);
});
it('rejects non-book, wrong-list, disabled and over-quota candidates before changing durable state',()=>{
 const c=setup(),catalog=spells(),other=spells('Other caster')[4];other.id='wrong-list';catalog.push(other);
 const before=JSON.stringify(c);expect(()=>chooseSheetOption(c,choice(c,'prepared',catalog).id,catalog[4].id,catalog)).toThrow();expect(JSON.stringify(c)).toBe(before);
 expect(()=>chooseSheetOption(c,choice(c,'book',catalog).id,other.id,catalog)).toThrow();
 for(const e of catalog.slice(0,3))chooseSheetOption(c,choice(c,'cantrips',catalog).id,e.id,catalog);
 const full=JSON.stringify(c);expect(()=>chooseSheetOption(c,choice(c,'cantrips',catalog).id,catalog[3].id,catalog)).toThrow(/最多/);expect(JSON.stringify(c)).toBe(full);
});
it('shows changes made in the spell page immediately, and replacing selections never duplicates learned rows',()=>{
 const c=setup(),catalog=spells();chooseSheetOption(c,choice(c,'cantrips',catalog).id,catalog[0].id,catalog);clearCantrip(c,'owner',0);expect(choice(c,'cantrips',catalog).selected).toEqual([]);
 chooseSheetOption(c,choice(c,'book',catalog).id,catalog[4].id,catalog);prepareSpellEntry(c,catalog[4]);expect(choice(c,'prepared',catalog).selected).toEqual([catalog[4].id]);
 chooseSheetOption(c,choice(c,'prepared',catalog).id,catalog[4].id,catalog);expect(c.selections.some(s=>s.entry.id===catalog[4].id)).toBe(true);
 chooseSheetOption(c,choice(c,'book',catalog).id,catalog[4].id,catalog);chooseSheetOption(c,choice(c,'book',catalog).id,catalog[4].id,catalog);expect(c.selections.filter(s=>s.entry.id===catalog[4].id)).toHaveLength(1);
});
it('keeps learned caster and multiclass allocations separate while retaining inactive learned records',()=>{
 const c=setup({casterProgression:'full',spellcastingAbility:'cha',spellsKnownProgression:[2]},'First');
 c.selections.push({id:'second',entry:entry('Second','class',{casterProgression:'full',spellcastingAbility:'cha',preparedSpellsProgression:[2],preparedSpellsChange:'level'}),level:1,quantity:1,equipped:false});
 const a=spells('First')[4],b=spells('Second')[5],catalog=[a,b];
 let choices=sheetChoices(c,catalog);chooseSheetOption(c,choices.find(r=>r.ownerId==='owner')!.id,a.id,catalog);chooseSheetOption(c,choices.find(r=>r.ownerId==='second')!.id,b.id,catalog);
 choices=sheetChoices(c,catalog);expect(choices.map(r=>r.selected)).toEqual([[a.id],[b.id]]);
 const row=c.selections.find(s=>s.entry.id===a.id)!;expect(spellIsReady(c,row)).toBe(true);chooseSheetOption(c,choices[0].id,a.id,catalog);expect(spellIsReady(c,row)).toBe(false);expect(c.selections.includes(row)).toBe(true);
 const restored=validateCharacter(JSON.parse(JSON.stringify(c)));expect(restored.spellSettings!.classSpells).toEqual(c.spellSettings!.classSpells);
 removeSelection(c,'second');expect(c.spellSettings!.classSpells!.second).toBeUndefined();expect(c.selections.some(s=>s.entry.id===b.id)).toBe(true);
 c.spellSettings!.classSpells!.bad=[row.id,row.id];expect(()=>validateCharacter(c)).toThrow(/法术归属/);
});
it('does not count source-granted spells as ordinary choices or restore their free uses',()=>{
 const c=setup({casterProgression:'full',spellcastingAbility:'wis',cantripProgression:[3],preparedSpellsProgression:[4],preparedSpellsChange:'restLong'}),catalog=spells();
 const row={id:'gift',entry:catalog[4],quantity:1,level:1,equipped:false};c.selections.push(row);setSpecialSpell(c,row.id,{mode:'uses',max:1,recovery:'long'});changeSpecialSpellUses(c,row.id,0);
 expect(choice(c,'prepared',catalog).selected).toEqual([]);chooseSheetOption(c,choice(c,'prepared',catalog).id,row.entry.id,catalog);expect(c.selections.filter(s=>s.entry.id===row.entry.id)).toHaveLength(2);expect(c.runtime.resources[specialSpellResource('gift',c)].current).toBe(0);
});
it('applies explicit extra-cantrip clauses from selected features and ignores unselected branches',()=>{
 const c=setup(),catalog=spells(),f=entry('Original extra choice','feature');f.entries=['你从{@filter 职业法术|spells|class=Renamed book caster}中额外学会一道戏法。'];
 c.selections.push({id:'extra',entry:f,quantity:1,level:1,equipped:false,parentId:'owner'});expect(choice(c,'cantrips',catalog).count).toBe(4);
 f.entries=[{type:'options',entries:[{entries:['你学会一个额外的{@filter 法术|spells|class=Renamed book caster}中的戏法。']}]}];expect(choice(c,'cantrips',catalog).count).toBe(3);
});

const external=process.env.DND_AUTOMATION_CORE_DATA;
const matrix:[string,string,[number,number,number,number]][]=[['wizard','PHB',[3,6,0,1]],['wizard','XPHB',[3,6,0,4]],['cleric','PHB',[3,0,0,1]],['cleric','XPHB',[3,0,0,4]],['druid','PHB',[2,0,0,1]],['druid','XPHB',[2,0,0,4]],['bard','PHB',[2,0,4,0]],['bard','XPHB',[2,0,4,0]],['sorcerer','PHB',[4,0,2,0]],['sorcerer','XPHB',[4,0,2,0]],['warlock','PHB',[2,0,2,0]],['warlock','XPHB',[2,0,2,0]],['paladin','PHB',[0,0,0,0]],['paladin','XPHB',[0,0,0,2]],['ranger','PHB',[0,0,0,0]],['ranger','XPHB',[0,0,0,2]],['artificer','TCE',[2,0,0,1]]];
it.skipIf(!external).each(matrix)('reads the external %s %s opening quotas from structure', (name,source,expected)=>{
 const catalog=normalizeData(JSON.parse(readFileSync(`${external}/data_class_class-${name}.json`,'utf8').replace(/^\uFEFF/,'')),'external'),owner=catalog.find(e=>e.kind==='class'&&e.source===source)!;
 const c:Character=setup();c.edition=source==='PHB'||source==='TCE'?'2014':'2024';if(source==='TCE')c.profile.enabledSources.push('TCE');c.selections[0].entry=owner;
 const choices=sheetChoices(c,catalog);expect(['cantrips','book','learned','prepared'].map(kind=>choices.find(r=>r.spellKind===kind)?.count||0)).toEqual(expected);
});
