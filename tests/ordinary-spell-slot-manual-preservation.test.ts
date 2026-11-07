import {expect,it as privateSourceIt} from 'vitest';
import {slotBalanceRecoveryFixture} from './helpers/slotBalanceRecoveryFixture';
import {runMulticlassSourceCheck} from './helpers/multiclassSlotSources';
import {slotBalanceRecoveryRequest,performSlotBalanceRecovery} from '../src/core/automation/slotBalanceRecovery';
import {syncAutoResources,setResource} from '../src/core/resources';
import {readCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
import {normalizeWidget,dashboardOverlaps,freeDashboardLayout,resourceModules,resourceCanvasRows} from '../src/core/resourceWidgets';
import {applyCharacterHistoryPatch} from '../src/ui/characterHistoryPatch';
import {ensureResourceWidget} from '../src/core/resourceWidgets';
let index=0;
function it(name:string,run:()=>unknown){const n=++index;return privateSourceIt(name,()=>runMulticlassSourceCheck(n,run));}
const destination='manual-slot:11111111-1111-4111-8111-111111111111';
function collision(){
 const f=slotBalanceRecoveryFixture();f.c.runtime.resources[f.key]={name:'Authored player reserve',max:9,current:2,type:'bar',icon:'bottle',automatic:false,order:3};f.c.spellSettings!.slots['2']={max:9,used:7};
 f.c.quickbarLayout={order:['resource:'+f.key,'resource:manual'],hidden:[],attacks:{...normalizeWidget(),resourceArea:true},widgets:{'spell-slot:1':normalizeWidget({x:0,y:0,w:6,h:3,style:'poolpips',icon:'shield',color:'#123456'}),manual:normalizeWidget({x:8,y:0,w:3,h:3,style:'diamond'})}};
 return f;
}
it('normalization discovers a manual collision even when the prior pending marker was absent, without altering the manual counter',()=>{
 const {c,key}=collision();delete (c.runtime.slotCapacityReview as any).pending[key];const before=structuredClone(c.runtime.resources[key]);syncAutoResources(c);expect(c.runtime.resources[key]).toEqual(before);expect((c.runtime.slotCapacityReview as any).pending[key]).toEqual({max:2});
});
it('explicitly preserving an unlocked manual record creates an independent identical counter and a separately confirmed automatic balance atomically',()=>{
 const {c,key}=collision(),before=structuredClone(c),q={...slotBalanceRecoveryRequest(c,key,0,'preserve-manual',true),preserveManualAs:destination};
 expect(performSlotBalanceRecovery(c,q).status).toBe('applied');expect(c.runtime.resources[destination]).toEqual(before.runtime.resources[key]);expect(c.runtime.resources[key]).toMatchObject({max:2,current:0,automatic:true});expect(c.runtime.resources[key].name).not.toBe(before.runtime.resources[key].name);
 expect(c.spellSettings!.slots['2']).toEqual({max:2,used:2});expect((c.runtime.slotCapacityReview as any).lastConfirmation.preservedManualAs).toBe(destination);expect(c.runtime.resources.manual).toEqual(before.runtime.resources.manual);expect(c.selections).toEqual(before.selections);expect(c.notes).toBe(before.notes);
 expect(c.quickbarLayout!.order).toEqual(['resource:'+destination,'resource:manual']);expect(c.quickbarLayout!.widgets!['spell-slot:1']).toEqual(before.quickbarLayout!.widgets!['spell-slot:1']);expect(c.quickbarLayout!.widgets!.manual).toEqual(before.quickbarLayout!.widgets!.manual);expect(c.quickbarLayout!.widgets![destination]).toMatchObject({style:'poolpips',icon:'shield',color:'#123456'});
 expect(dashboardOverlaps(freeDashboardLayout(resourceModules(resourceCanvasRows(c),c.quickbarLayout!.widgets,c.selections),c.quickbarLayout!.widgets,c.quickbarLayout!.attacks)).count).toBe(0);
 const applied=structuredClone(c);expect(performSlotBalanceRecovery(c,q).status).toBe('duplicate');expect(c).toEqual(applied);
 const restored=readCharacter(exportCharacter(c)).character;syncAutoResources(restored);expect(restored.runtime.resources[destination]).toEqual(before.runtime.resources[key]);expect(restored.runtime.resources[key].current).toBe(0);expect(restored.quickbarLayout).toEqual(c.quickbarLayout);
 setResource(restored,destination,1);expect(restored.runtime.resources[destination].current).toBe(1);expect(restored.runtime.resources[key].current).toBe(0);
});
it('moving a standalone manual slot preserves its actual position and hiding while allocating the new automatic group separately',()=>{
 const {c,key}=collision();delete c.runtime.resources['spell-slot:1'];delete c.spellSettings!.slots['1'];c.quickbarLayout!.widgets={[key]:normalizeWidget({x:0,y:0,w:4,h:3,style:'orbit',icon:'leaf'})};
 const old=structuredClone(c.quickbarLayout!.widgets![key]);expect(performSlotBalanceRecovery(c,{...slotBalanceRecoveryRequest(c,key,1,'standalone-preservation',true),preserveManualAs:destination}).status).toBe('applied');expect(c.quickbarLayout!.widgets![destination]).toEqual(old);
 const hidden=collision();hidden.c.quickbarLayout!.hidden=['resource:'+hidden.key];expect(performSlotBalanceRecovery(hidden.c,{...slotBalanceRecoveryRequest(hidden.c,hidden.key,0,'hidden-preservation',true),preserveManualAs:destination}).status).toBe('applied');expect(hidden.c.quickbarLayout!.hidden).toEqual(['resource:'+destination]);expect(hidden.c.runtime.resources[destination].current).toBe(2);
});
it('permission, lock, foreign ownership, opaque fields and occupied destinations reject before any counter or layout is moved',()=>{
 for(const mode of ['readonly','locked','foreign','opaque','occupied','parked','parked-member','no-ack','malformed','stale-layout'] as const){const {c,key}=collision();
  if(mode==='locked')c.runtime.resources[key].locked=true;if(mode==='foreign')c.runtime.resources[key].sourceSpellGrant={usageKey:'authored-other-owner'};if(mode==='opaque')(c.runtime.resources[key] as any).futureOwner={version:2};if(mode==='occupied')c.runtime.resources[destination]={max:1,current:1};if(mode==='parked')c.quickbarLayout!.widgets![destination]=normalizeWidget();
  if(mode==='parked-member')c.quickbarLayout!.widgets!.manual.members=['manual',destination];
  const q={...slotBalanceRecoveryRequest(c,key,0,'rejected-preservation',mode!=='no-ack'),preserveManualAs:mode==='malformed'?'__proto__':destination};if(mode==='stale-layout')c.quickbarLayout!.widgets!.manual.x=7;
  const before=structuredClone(c);expect(performSlotBalanceRecovery(c,q,{canEdit:mode!=='readonly',gm:true}).status).toBe('rejected');expect(c).toEqual(before);
 }
});
it('manual preservation Undo and redo retain later unrelated edits and refuse to discard a subsequently edited preserved counter',()=>{
 const {c,key}=collision(),before=structuredClone(c);expect(performSlotBalanceRecovery(c,{...slotBalanceRecoveryRequest(c,key,0,'history-preservation',true),preserveManualAs:destination}).status).toBe('applied');const after=structuredClone(c);c.notes='Authored later manual note';
 const undo=applyCharacterHistoryPatch(c,after,before,()=>({canEdit:true,gm:false}));expect(undo.runtime.resources[key]).toEqual(before.runtime.resources[key]);expect(undo.runtime.resources[destination]).toBeUndefined();expect(undo.notes).toBe(c.notes);
 const redo=applyCharacterHistoryPatch(undo,before,after,()=>({canEdit:true,gm:false}));expect(redo.runtime.resources[destination]).toEqual(before.runtime.resources[key]);expect(redo.runtime.resources[key].current).toBe(0);setResource(redo,destination,3);expect(()=>applyCharacterHistoryPatch(redo,after,before,()=>({canEdit:true,gm:true}))).toThrow();
});
it('confirming the lower ordinary rank after an existing higher-rank group retains its saved presentation and position without disturbing unrelated modules',()=>{
 const {c}=collision();delete c.runtime.resources['spell-slot:1'];delete c.spellSettings!.slots['1'];c.runtime.resources['spell-slot:2']={name:'Authored confirmed higher rank',max:2,current:1,automatic:true};
 const higher=normalizeWidget({x:4,y:2,w:6,h:3,page:1,style:'poolbars',color:'#123456',icon:'leaf',borderWidth:3,gap:2});c.quickbarLayout!.widgets={'spell-slot:2':higher,manual:normalizeWidget({x:0,y:0,w:3,h:3,page:0,style:'diamond'})};const unrelated=structuredClone(c.quickbarLayout!.widgets.manual);
 c.runtime.resources['spell-slot:1']={name:'Authored confirmed lower rank',max:4,current:0,automatic:true};ensureResourceWidget(c,'spell-slot:1');
 const module=resourceModules(resourceCanvasRows(c),c.quickbarLayout!.widgets,c.selections).find(m=>m.slots)!;expect(module.id).toBe('spell-slot:1');expect(c.quickbarLayout!.widgets![module.id]).toEqual(higher);expect(c.quickbarLayout!.widgets!.manual).toEqual(unrelated);expect(c.runtime.resources['spell-slot:2'].current).toBe(1);
});
it('the actual recovery actor keeps the saved group when a player confirms the higher rank first and the lower rank second',()=>{
 const {c,key}=slotBalanceRecoveryFixture();delete c.runtime.resources['spell-slot:1'];delete c.spellSettings!.slots['1'];(c.runtime.slotCapacityReview as any).pending['spell-slot:1']={max:4};
 const saved=normalizeWidget({x:4,y:2,w:6,h:3,page:1,style:'poolbars',color:'#123456',icon:'leaf',borderWidth:3,gap:2});c.quickbarLayout={order:[],hidden:[],widgets:{[key]:saved}};
 expect(performSlotBalanceRecovery(c,slotBalanceRecoveryRequest(c,key,1,'higher-first')).status).toBe('applied');expect(performSlotBalanceRecovery(c,slotBalanceRecoveryRequest(c,'spell-slot:1',0,'lower-second')).status).toBe('applied');
 expect(c.quickbarLayout!.widgets!['spell-slot:1']).toEqual(saved);expect(c.runtime.resources[key].current).toBe(1);expect(c.runtime.resources['spell-slot:1'].current).toBe(0);
});
