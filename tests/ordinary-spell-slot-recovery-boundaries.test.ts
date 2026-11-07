import {expect,it as privateSourceIt} from 'vitest';
import {slotBalanceRecoveryFixture} from './helpers/slotBalanceRecoveryFixture';
import {runMulticlassSourceCheck} from './helpers/multiclassSlotSources';
import {slotBalanceRecoveryRequest,performSlotBalanceRecovery} from '../src/core/automation/slotBalanceRecovery';
import {currentSlotCapacityReview,slotBalanceHeld} from '../src/core/automation/slotCapacityReview';
import {readCharacter,importOwlbear} from '../src/core/validation';
import {exportCharacter,exportLinkedOwlbear} from '../src/core/export';
import {evaluate} from '../src/core/engine';
import {syncAutoResources,setResource} from '../src/core/resources';
import {applyCharacterHistoryPatch} from '../src/ui/characterHistoryPatch';
import {createDashboardDraft,commitDashboardDraft} from '../src/core/dashboardDraft';
import {assertSlotBalanceHistoryTravel} from '../src/core/automation/slotBalanceHistory';
let index=0;
function it(name:string,run:()=>unknown){const n=++index;return privateSourceIt(name,()=>runMulticlassSourceCheck(n,run));}
function states(){const f=slotBalanceRecoveryFixture(),before=structuredClone(f.c);expect(performSlotBalanceRecovery(f.c,slotBalanceRecoveryRequest(f.c,f.key,0,'boundary-known-zero')).status).toBe('applied');return {...f,before,after:structuredClone(f.c)};}
it('native and complete linked exchange retain known zero, pending state, historical receipts and opaque future data',()=>{
 const f=states();
 for(const card of [f.before,f.after,{...structuredClone(f.after),runtime:{...structuredClone(f.after.runtime),slotCapacityReview:{version:2,authoredFuture:{data:[0,1]}}}}]){
  for(const restored of [readCharacter(exportCharacter(card)).character,importOwlbear(exportLinkedOwlbear(card,evaluate(card)))]){
   expect(restored.runtime).toEqual(card.runtime);expect(restored.spellSettings).toEqual(card.spellSettings);expect(restored.notes).toBe(card.notes);expect(restored.selections).toEqual(card.selections);
  }
 }
});
it('damaged current balance states fail native validation without mutating the caller input',()=>{
 for(const change of [(s:any)=>s.seen.push(s.seen[0]),(s:any)=>s.pending['spell-slot:2']={max:0},(s:any)=>s.balances['spell-slot:1'].current=99,(s:any)=>s.balances['spell-slot:1'].spent=-1,(s:any)=>s.extra=true,(s:any)=>s.lastConfirmation={id:'bad',fingerprint:'no',resourceId:'spell-slot:2',max:2,remaining:0}]){
  const f=slotBalanceRecoveryFixture();change(f.c.runtime.slotCapacityReview);const value=exportCharacter(f.c),before=structuredClone(value);expect(()=>readCharacter(value)).toThrow();expect(value).toEqual(before);
 }
});
it('known confirmation Undo and redo check current readonly and malformed authority before returning a candidate',()=>{
 const f=states();
 for(const authority of [{canEdit:false,gm:true},{canEdit:'true'},{gm:'true'},Object.create({gm:true})]){
  const live=structuredClone(f.after),before=structuredClone(live);expect(()=>applyCharacterHistoryPatch(live,f.after,f.before,()=>authority as any)).toThrow();expect(live).toEqual(before);
 }
});
it('current resource locks protect ordinary balance Undo and redo; an own live writable GM can reverse it',()=>{
 const f=states(),before=structuredClone(f.c);setResource(f.c,f.key,1);const after=structuredClone(f.c),live=structuredClone(after);live.runtime.resources[f.key].locked=true;
 expect(()=>applyCharacterHistoryPatch(live,after,before,()=>({canEdit:true,gm:false}))).toThrow();
 expect(()=>applyCharacterHistoryPatch(live,after,before,()=>({canEdit:false,gm:true}))).toThrow();
 const allowed=applyCharacterHistoryPatch(live,after,before,()=>({canEdit:true,gm:true}));expect(allowed.runtime.resources[f.key].current).toBe(0);expect(allowed.runtime.resources[f.key].locked).toBe(true);expect(allowed.runtime.slotCapacityReview).toEqual(before.runtime.slotCapacityReview);
});
it('authorized confirmation Undo and redo preserve unrelated later manual changes, remain coherent and do not refill',()=>{
 const f=states(),live=structuredClone(f.after);live.notes='Authored later history note';live.runtime.resources.manual.current=1;
 const undo=applyCharacterHistoryPatch(live,f.after,f.before,()=>({canEdit:true,gm:false}));expect(undo.runtime.resources[f.key]).toBeUndefined();expect(undo.notes).toBe(live.notes);expect(undo.runtime.resources.manual.current).toBe(1);
 const redo=applyCharacterHistoryPatch(undo,f.before,f.after,()=>({canEdit:true,gm:false}));const restored=readCharacter(exportCharacter(redo)).character;syncAutoResources(restored);
 expect(restored.runtime.resources[f.key].current).toBe(0);expect(slotBalanceHeld(restored,f.key)).toBe(false);expect(restored.notes).toBe(live.notes);expect(restored.runtime.resources.manual.current).toBe(1);
});
it('an ordinary history delta cannot restore torn accounting or rewrite an opaque future state even with GM',()=>{
 const f=states();
 for(const mode of ['counter','mirror','future'] as const){const live=structuredClone(f.after),target=structuredClone(live);
  if(mode==='counter')target.runtime.resources[f.key].current=1;
  if(mode==='mirror')target.spellSettings!.slots['2'].used=0;
  if(mode==='future'){live.runtime.slotCapacityReview={version:2,authoredOpaque:true};target.runtime.slotCapacityReview=structuredClone(live.runtime.slotCapacityReview);target.runtime.resources[f.key].current=1;}
  const before=structuredClone(live);expect(()=>applyCharacterHistoryPatch(live,live,target,()=>({canEdit:true,gm:true}))).toThrow();expect(live).toEqual(before);
 }
});
it('unrelated manual history and dashboard styling preserve opaque ordinary records without acquiring their balances',()=>{
 const f=states();f.c.runtime.slotCapacityReview={version:2,authoredOpaque:true};const from=structuredClone(f.c),to=structuredClone(f.c);to.notes='Authored manual-only change';
 expect(applyCharacterHistoryPatch(f.c,from,to,()=>({canEdit:false,gm:false})).notes).toBe(to.notes);
 const base=createDashboardDraft(f.c),draft=structuredClone(base);draft.quickbarLayout!.widgets!.manual.style='fraction';const saved=commitDashboardDraft(f.c,base,draft,{gm:false});expect(saved.runtime.slotCapacityReview).toEqual(f.c.runtime.slotCapacityReview);expect(saved.runtime.resources[f.key]).toEqual(f.c.runtime.resources[f.key]);
});
it('dashboard commit refuses pending or opaque automatic balance changes, including GM edits',()=>{
 for(const mode of ['pending','future'] as const){const f=states();if(mode==='pending')currentSlotCapacityReview(f.c)!.pending[f.key]={max:2};else f.c.runtime.slotCapacityReview={version:2,authoredOpaque:true};
  const base=createDashboardDraft(f.c),draft=structuredClone(base);draft.runtime.resources[f.key].current=1;const before=structuredClone(f.c);expect(()=>commitDashboardDraft(f.c,base,draft,{gm:true})).toThrow();expect(f.c).toEqual(before);
 }
});
it('a normal dashboard balance edit updates counter, mirror and known history together before persistence',()=>{
 const f=states(),base=createDashboardDraft(f.c),draft=structuredClone(base);draft.runtime.resources[f.key].current=1;
 const saved=commitDashboardDraft(f.c,base,draft,{gm:false});expect(saved.runtime.resources[f.key].current).toBe(1);expect(saved.spellSettings!.slots['2']).toEqual({max:2,used:1});expect(currentSlotCapacityReview(saved)?.balances?.[f.key]).toEqual({spent:1,max:2,current:1});expect(slotBalanceHeld(saved,f.key)).toBe(false);
});
it('a writable current GM can change only a pending automatic pool lock while preserving all unknown accounting, but cannot use that permission to change its balance',()=>{
 for(const locked of [false,true]){
  const {c,key}=slotBalanceRecoveryFixture();c.runtime.resources[key]={name:'Authored pending lock',max:3,current:1,automatic:true,locked};c.spellSettings!.slots['2']={max:3,used:2};
  const next=structuredClone(c);next.runtime.resources[key].locked=!locked;
  expect(()=>assertSlotBalanceHistoryTravel(c,next,{canEdit:true,gm:true})).not.toThrow();expect(next.runtime.slotCapacityReview).toEqual(c.runtime.slotCapacityReview);expect(next.spellSettings).toEqual(c.spellSettings);
  for(const authority of [{canEdit:false,gm:true},{canEdit:true,gm:false}])expect(()=>assertSlotBalanceHistoryTravel(c,next,authority)).toThrow();
  const changed=structuredClone(next);changed.runtime.resources[key].current=0;expect(()=>assertSlotBalanceHistoryTravel(c,changed,{canEdit:true,gm:true})).toThrow();
 }
});
