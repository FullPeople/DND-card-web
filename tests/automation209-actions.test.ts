import {irFixture} from './helpers/irFixture';
import {irCharacter as newCharacter} from './helpers/irFixture';
import {describe,it,expect} from 'vitest';
import {type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {planSourceSpells,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {sourceSpellResourceEnabled} from '../src/core/automation/sourceSpellState';
import {spellPayments,spellActionRequest,performSpellAction} from '../src/core/automation/actions';
import {specialSpellResource,changeSpecialSpellUses} from '../src/core/specialSpells';
import {readCharacter} from '../src/core/validation';
import {removeSelection} from '../src/core/sheet';

const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']):Entry=>(irFixture({id,kind,name:id,english:id,source:'XPHB',edition:'2024',packId:'fixture',revision:'1',raw,entries:['原创软件验收条目。']}));
const catalog=[entry('spell-a','spell',{level:1}),entry('spell-b','spell',{level:2})];
function setup({each=false,kind='prepared',known=true}:{each?:boolean;kind?:'prepared'|'innate';known?:boolean}={}){
 const c=newCharacter();c.automation=newAutomationState();c.selections=[{id:'owner',entry:entry('owner','race',{additionalSpells:[{ability:'cha',[kind]:{'_':{daily:{[each?'2e':'2']:['spell-a|XPHB','spell-b|XPHB']}}}}]}),quantity:1,level:1,equipped:false}];const choice=planSourceSpells(c,catalog).choices.find(choice=>choice.usageModes);if(choice)c.automation.spellUsageModes={[choice.key]:'shared'};syncSourceSpells(c,known?catalog:[catalog[0]]);return c;
}
const spells=(c:ReturnType<typeof setup>)=>c.selections.filter(s=>s.entry.kind==='spell');
const remaining=(c:ReturnType<typeof setup>,id=spells(c)[0].id)=>c.runtime.resources[specialSpellResource(id,c)].current;
const request=(c:ReturnType<typeof setup>,id:string,payment='source',action='action')=>spellActionRequest(c,id,payment,action);
describe('shared spell resources and explicit local transactions',()=>{
 it('spends from one shared pool and refuses overdraw without changing any state',()=>{
  const c=setup(),[a,b]=spells(c);expect(Object.keys(c.runtime.resources)).toHaveLength(1);expect(specialSpellResource(a.id,c)).toBe(specialSpellResource(b.id,c));
  expect(performSpellAction(c,request(c,a.id)).status).toBe('applied');expect(remaining(c,b.id)).toBe(1);
  expect(performSpellAction(c,request(c,b.id,'source','second')).status).toBe('applied');expect(remaining(c,a.id)).toBe(0);
  const before=JSON.stringify(c);expect(performSpellAction(c,request(c,a.id,'source','third')).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);
 });
 it('keeps each-suffixed spell counters independent',()=>{
  const c=setup({each:true}),[a,b]=spells(c);expect(Object.keys(c.runtime.resources)).toHaveLength(2);performSpellAction(c,request(c,a.id));expect(remaining(c,a.id)).toBe(1);expect(remaining(c,b.id)).toBe(2);
 });
 it('requires an explicit usage policy for ambiguous lists and never refills when changing that policy',()=>{
  const c=setup(),[a,b]=spells(c),choice=planSourceSpells(c,catalog).choices.find(choice=>choice.usageModes)!;
  changeSpecialSpellUses(c,a.id,1);c.automation!.spellUsageModes![choice.key]='each';syncSourceSpells(c,catalog);
  expect(remaining(c,a.id)).toBe(1);expect(remaining(c,b.id)).toBe(1);
  c.automation!.spellUsageModes![choice.key]='shared';syncSourceSpells(c,catalog);expect(remaining(c,a.id)).toBe(0);
  delete c.automation!.spellUsageModes![choice.key];syncSourceSpells(c,catalog);expect(spellPayments(c,a.id).options).toEqual([]);expect(planSourceSpells(c,catalog).issues.some(i=>i.message.includes('次数归属未明确'))).toBe(true);
 });
 it('does not double-spend on repeated, stale or concurrent requests, including after JSON restore',()=>{
  const c=setup(),id=spells(c)[0].id,first=request(c,id),parallel=request(c,id,'source','parallel');performSpellAction(c,first);c.revision++;
  const restored=readCharacter(JSON.parse(JSON.stringify(c))).character;expect(performSpellAction(restored,first).status).toBe('duplicate');expect(remaining(restored)).toBe(1);
  expect(performSpellAction(restored,parallel).status).toBe('rejected');expect(performSpellAction(restored,request(restored,id,'source','next')).status).toBe('applied');
  const before=JSON.stringify(restored);expect(performSpellAction(restored,first).status).toBe('rejected');expect(JSON.stringify(restored)).toBe(before);
 });
 it('never silently chooses a slot when free uses are exhausted, and records explicit upcasting atomically',()=>{
  const c=setup(),id=spells(c)[0].id;changeSpecialSpellUses(c,id,0);c.runtime.resources['spell-slot:1']={current:2,max:2};c.runtime.resources['spell-slot:3']={current:1,max:2};
  const before=JSON.stringify(c),offer=spellPayments(c,id);expect(offer.options.map(p=>p.available)).toEqual([false,true,true]);expect(JSON.stringify(c)).toBe(before);
  expect(performSpellAction(c,request(c,id)).status).toBe('rejected');const result=performSpellAction(c,request(c,id,'slot:spell-slot:3'));
  expect(result.status).toBe('applied');if(result.status!=='rejected')expect(result.receipt).toMatchObject({level:3,before:1,after:0,resourceId:'spell-slot:3'});
  expect(c.spellSettings!.slots['3']).toEqual({max:2,used:2});expect(c.runtime.resources['spell-slot:1'].current).toBe(2);expect(remaining(c)).toBe(0);
 });
 it('does not invent spell-slot rights for innate-only grants or use an undersized slot',()=>{
  const c=setup({kind:'innate'}),id=spells(c)[1].id;c.runtime.resources['spell-slot:3']={current:2,max:2};expect(spellPayments(c,id).options.map(p=>p.id)).toEqual(['source']);expect(performSpellAction(c,request(c,id,'slot:spell-slot:3')).status).toBe('rejected');
  const prepared=setup(),second=spells(prepared)[1].id;prepared.runtime.resources['spell-slot:1']={current:2,max:2};expect(spellPayments(prepared,second).options.map(p=>p.id)).toEqual(['source']);
 });
 it('restores a shared pool once, with stale protection and no change to spell slots',()=>{
  const c=setup(),[a,b]=spells(c);changeSpecialSpellUses(c,a.id,0);c.runtime.resources['spell-slot:2']={current:0,max:2};
  const restore=spellActionRequest(c,b.id,'source','restore','restore');expect(performSpellAction(c,restore).status).toBe('applied');expect(remaining(c,a.id)).toBe(2);expect(performSpellAction(c,restore).status).toBe('duplicate');expect(c.runtime.resources['spell-slot:2'].current).toBe(0);
 });
 it('rejects a request after an unrelated card edit and while a source is disabled',()=>{
  const c=setup(),id=spells(c)[0].id,old=request(c,id);c.revision++;const before=JSON.stringify(c);expect(performSpellAction(c,old).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);
  c.profile.enabledSources=[];expect(performSpellAction(c,request(c,id)).status).toBe('rejected');expect(sourceSpellResourceEnabled(c,specialSpellResource(id,c))).toBe(false);
 });
 it('keeps the pool for remaining owners and removes it only after the last grant is removed',()=>{
  const c=setup(),[a,b]=spells(c),key=specialSpellResource(a.id,c);performSpellAction(c,request(c,a.id));removeSelection(c,a.id,false);expect(c.runtime.resources[key].current).toBe(1);expect(sourceSpellResourceEnabled(c,key)).toBe(true);
  removeSelection(c,b.id,false);expect(c.runtime.resources[key]).toBeUndefined();syncSourceSpells(c,catalog);expect(remaining(c)).toBe(1);
 });
 it('adding a late-loaded member never replenishes the already-spent shared pool',()=>{
  const c=setup({known:false}),id=spells(c)[0].id;performSpellAction(c,request(c,id));expect(spells(c)).toHaveLength(1);syncSourceSpells(c,catalog);expect(spells(c)).toHaveLength(2);expect(Object.values(c.runtime.resources).map(r=>r.current)).toEqual([1]);
 });
 it('rejects altered retries and unsupported action ledgers without mutating resources',()=>{
  const c=setup(),id=spells(c)[0].id,first=request(c,id);performSpellAction(c,first);const before=JSON.stringify(c);expect(performSpellAction(c,{...first,mode:'restore'}).status).toBe('rejected');expect(JSON.stringify(c)).toBe(before);
  c.runtime.automationActions={version:99,sequence:1};const preserved=readCharacter(c).character;expect(performSpellAction(preserved,request(preserved,id)).status).toBe('rejected');expect(remaining(preserved)).toBe(1);
  c.runtime.automationActions={version:1,sequence:-1};expect(()=>readCharacter(c)).toThrow(/动作序号/);
 });
});
