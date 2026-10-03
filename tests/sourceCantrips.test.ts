import {irFixture} from './helpers/irFixture';
import {irCharacter as newCharacter} from './helpers/irFixture';
import {describe,it,expect} from 'vitest';
import {type Character,type Entry} from '../src/core/model';
import {chooseCantrip,cantripGroups,spellIsReady} from '../src/core/spellWorkspace';
import {chooseSourceCantrip,sourceCantripRows} from '../src/core/sourceCantrips';
import {newAutomationState,setAutomationEnabled} from '../src/core/automation/state';
import {syncSourceSpells} from '../src/core/automation/sourceSpells';
import {removeSelection} from '../src/core/sheet';
import {validateCharacter} from '../src/core/validation';
import {setSpecialSpell} from '../src/core/specialSpells';
const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>(irFixture({id,name:id,english:id,kind,raw,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:['原创软件验收资料。']}));
const spell=(id:string)=>entry(id,'spell',{level:0,_spellClasses:{XPHB:{Mage:true}}});
const add=(c:Character,e:Entry)=>{c.selections.push({id:e.id,entry:e,quantity:1,level:1,equipped:false});};
function setup(){const c=newCharacter();add(c,entry('Mage','class',{casterProgression:'full',cantripProgression:[2],spellcastingAbility:'int'}));chooseCantrip(c,spell('One'));chooseCantrip(c,spell('Two'));add(c,entry('Feat','feat',{additionalSpells:[{known:{'_':[{choose:'level=0',count:1}]}}]}));return c;}
describe('explicit manual source cantrips',()=>{
 it('keeps ordinary capacity full while recording a bounded, persistent and removable feat gift',()=>{
  const c=setup(),before=JSON.stringify(c);expect(chooseSourceCantrip(c,spell('Three'),'Feat').error).toContain('已满');expect(JSON.stringify(c)).toBe(before);
  c.spellSettings!.sourceCantripCapacities={Feat:1};const slots=structuredClone(cantripGroups(c)[0].slots),id=chooseSourceCantrip(c,spell('Three'),'Feat').id!;
  expect(chooseSourceCantrip(c,spell('Three'),'Feat').id).toBe(id);expect(sourceCantripRows(c,'Feat')).toHaveLength(1);expect(chooseSourceCantrip(c,spell('Four'),'Feat').error).toContain('已满');expect(cantripGroups(c)[0].slots).toEqual(slots);expect(chooseCantrip(c,spell('Four')).error).toContain('已满');
  const restored=validateCharacter(JSON.parse(JSON.stringify(c)));syncSourceSpells(restored,[spell('Three')]);expect(sourceCantripRows(restored,'Feat')[0].parentId).toBe('Feat');expect(restored.spellSettings!.special![id].manualSource?.ownerId).toBe('Feat');
  removeSelection(restored,id);syncSourceSpells(restored,[spell('Three')]);expect(sourceCantripRows(restored,'Feat')).toEqual([]);expect(chooseSourceCantrip(restored,spell('Four'),'Feat').id).toBeTruthy();
 });
 it('retains independent ordinary and other-source copies and removes only children of a deleted source',()=>{
  const c=setup();add(c,entry('Race','race'));c.spellSettings!.sourceCantripCapacities={Feat:1,Race:1};const a=chooseSourceCantrip(c,spell('One'),'Feat').id!,b=chooseSourceCantrip(c,spell('One'),'Race').id!;
  expect(c.selections.filter(s=>s.entry.id==='One')).toHaveLength(3);expect(a).not.toBe(b);removeSelection(c,'Feat');expect(c.selections.some(s=>s.id===a)).toBe(false);expect(c.selections.some(s=>s.id===b)).toBe(true);expect(cantripGroups(c)[0].slots.filter(Boolean)).toHaveLength(2);expect(c.spellSettings!.sourceCantripCapacities).toEqual({Race:1});
 });
 it('preserves manual source identity through mode changes and disables it without removing data',()=>{
  const c=setup();c.automation=newAutomationState();c.spellSettings!.sourceCantripCapacities={Feat:1};const id=chooseSourceCantrip(c,spell('One'),'Feat').id!,row=c.selections.find(s=>s.id===id)!;
  setAutomationEnabled(c,false);expect(spellIsReady(c,row)).toBe(true);setSpecialSpell(c,id,{mode:'uses',max:1,recovery:'long'});expect(c.spellSettings!.special![id].manualSource?.ownerId).toBe('Feat');
  c.profile.disabledEntries=['Feat'];expect(spellIsReady(c,row)).toBe(false);const before=JSON.stringify(c);expect(chooseSourceCantrip(c,spell('Other'),'Feat').error).toContain('未启用');expect(JSON.stringify(c)).toBe(before);delete c.profile.disabledEntries;expect(spellIsReady(c,row)).toBe(true);
  setSpecialSpell(c,id);expect(row.parentId).toBeUndefined();removeSelection(c,'Feat');expect(c.selections.some(s=>s.id===id)).toBe(true);
 });
 it('preserves over-capacity records and rejects malformed numbers or orphaned source bindings on import',()=>{
  const c=setup();c.spellSettings!.sourceCantripCapacities={Feat:1};const id=chooseSourceCantrip(c,spell('Three'),'Feat').id!;c.spellSettings!.sourceCantripCapacities.Feat=0;
  expect(sourceCantripRows(validateCharacter(JSON.parse(JSON.stringify(c))),'Feat')).toHaveLength(1);expect(chooseSourceCantrip(c,spell('Four'),'Feat').error).toContain('已满');
  c.spellSettings!.sourceCantripCapacities.Feat=-1;expect(()=>validateCharacter(c)).toThrow(/戏法数量/);c.spellSettings!.sourceCantripCapacities.Feat=1;
  c.spellSettings!.cantripCapacityAdjustments={Mage:1.5};expect(()=>validateCharacter(c)).toThrow(/戏法数量/);delete c.spellSettings!.cantripCapacityAdjustments;
  c.spellSettings!.special![id].manualSource={ownerId:'missing'};expect(()=>validateCharacter(c)).toThrow(/来源记录/);
 });
 it('explicitly named automatic feat cantrips already bypass ordinary capacity and stay idempotent',()=>{
  const c=setup();c.automation=newAutomationState();add(c,entry('Explicit','feat',{additionalSpells:[{known:{'_':['Three|XPHB#c']}}]}));syncSourceSpells(c,[spell('Three')]);const gifts=c.selections.filter(s=>s.parentId==='Explicit');expect(gifts).toHaveLength(1);expect(c.spellSettings!.special![gifts[0].id].sourceGrant?.usage).toBe('free');expect(cantripGroups(c)[0].slots.filter(Boolean)).toHaveLength(2);expect(syncSourceSpells(c,[spell('Three')])).toBe(false);
 });
});
