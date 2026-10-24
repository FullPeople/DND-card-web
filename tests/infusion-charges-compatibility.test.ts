import 'fake-indexeddb/auto';
import {IDBFactory} from 'fake-indexeddb';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {frozenInfusionLegacy,infusionLegacyUnavailable,INFUSION_LEGACY_COMMIT,INFUSION_LEGACY_SOURCE_TREE,type FrozenInfusionLegacy} from './helpers/frozenInfusionLegacy';
import {infusionChargesFixture} from './helpers/infusionChargesFixture';
import {infusionChargeActionRequest,infusionChargeOffer,performInfusionChargeAction,type InfusionChargeAction} from '../src/core/automation/infusionCharges';
import {setInfusionHeld,setInfusionTarget} from '../src/core/automation/infusions';
import {readCharacter,validateCharacter} from '../src/core/validation';
import type {Character} from '../src/core/model';
import type {Workspace} from '../src/platform/storage';

function charge(c:Character,choiceId:string,entryId:string,id:string,action:InfusionChargeAction){
 const request=infusionChargeActionRequest(c,choiceId,entryId,id,action);
 expect(performInfusionChargeAction(c,request).status).toBe('applied');return request;
}
function spentFixture(name='Repulsion Shield'){
 const f=infusionChargesFixture(name),{c,choiceId,infusion,targetId}=f;
 c.runtime.resources.manual={name:'Unaffiliated manual counter',current:2,max:7};
 setInfusionTarget(c,choiceId,infusion.id,targetId);
 if(name==='Repulsion Shield')setInfusionHeld(c,choiceId,infusion.id,true);
 charge(c,choiceId,infusion.id,'initialize-explicit-three',{kind:'initialize',initial:3});
 charge(c,choiceId,infusion.id,'spend-one',{kind:'use',triggerConfirmed:true,reactionConfirmed:true});
 expect(infusionChargeOffer(c,choiceId,infusion.id).current).toBe(2);
 return {...f,store:structuredClone(c.runtime.infusionCharges!)};
}
function workspace(c:Character,...others:Character[]):Workspace{return {schemaVersion:1,characters:[c,...others],activeId:c.id,packs:[]};}

// Missing immutable history is reported as a conditional skip, never a compatibility pass.
// The dedicated CI gate fetches the pinned object and sets INFUSION_LEGACY_REQUIRED=1.
describe.skipIf(!!infusionLegacyUnavailable)(`exact pre-charge consumer ${INFUSION_LEGACY_COMMIT.slice(0,8)}`,()=>{
 let old:FrozenInfusionLegacy;
 beforeAll(async()=>{
  vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('location',{search:'',hash:''});
  vi.stubGlobal('window',new EventTarget());vi.stubGlobal('BroadcastChannel',undefined);
  old=await frozenInfusionLegacy();
 },30000);
 afterAll(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

 it('runs the frozen old source graph, not a new-code substitute with charge support',()=>{
  expect(INFUSION_LEGACY_SOURCE_TREE).toBe('d46ba1f5e1bab07e5d434a7343a866ab8494b257');
  expect(old.sourceFiles).toContain('src/core/validation.ts');expect(old.sourceFiles).toContain('src/platform/storage.ts');
  expect(old.sourceFiles).not.toContain('src/core/automation/infusionCharges.ts');
  expect(old.source('src/core/validation.ts')).not.toContain('infusionCharges');
  const {infusion}=infusionChargesFixture('Mind Sharpener');expect(old.infusions.infusionRule(infusion)).toBeUndefined();
 });

 it.each(['Repulsion Shield','Mind Sharpener'])('old validate/read/native/linked/collection import preserves %s balances for new reopen',name=>{
  const {c,choiceId,infusion,store}=spentFixture(name),before=structuredClone(c),derived=old.engine.evaluate(c);
  const native=JSON.stringify(old.exports.exportCharacter(c)),linked=JSON.stringify(old.exports.exportLinkedOwlbear(c,derived));
  const results=[
   old.validation.validateCharacter(JSON.parse(native)),old.validation.readCharacter(JSON.parse(native)).character,
   old.validation.importOwlbear(JSON.parse(linked)),...old.transfer.readCharacterTransfer([native]),
   ...old.transfer.readCharacterTransfer([linked]),...old.transfer.readCharacterTransfer([JSON.stringify(old.exports.exportCharacters([c]))]),
  ];
  expect(old.validation.readCharacter(JSON.parse(native)).repaired).toEqual([]);
  for(const value of results){
   expect(value.schemaVersion).toBe(1);expect(value.infusions?.version).toBe(1);
   expect(value.runtime.infusionCharges).toEqual(store);
   expect(value.selections.map(row=>row.id)).toEqual(c.selections.map(row=>row.id));
   const reopened=readCharacter(value);expect(reopened.repaired).toEqual([]);
   expect(infusionChargeOffer(reopened.character,choiceId,infusion.id)).toMatchObject({current:2,canInitialize:false,canUse:true});
  }
  expect(c).toEqual(before);
 });

 it('an existing old binding with no store stays uninitialized through old native persistence and new reopen',()=>{
  const {c,choiceId,infusion,targetId}=infusionChargesFixture();
  old.infusions.setInfusionTarget(c,choiceId,infusion.id,targetId);old.infusions.setInfusionHeld(c,choiceId,infusion.id,true);
  expect(c.runtime.infusionCharges).toBeUndefined();
  const reopened=validateCharacter(old.validation.readCharacter(old.exports.exportCharacter(c)).character),before=structuredClone(reopened);
  expect(infusionChargeOffer(reopened,choiceId,infusion.id)).toMatchObject({canInitialize:true,canUse:false,canDawn:false});
  expect(reopened.runtime.infusionCharges).toBeUndefined();expect(reopened).toEqual(before);
 });

 it('old rebinding after a catalog reimport uses the same canonical-rule and physical-instance debt',()=>{
  const {c,choiceId,infusion,store}=spentFixture();
  old.infusions.setInfusionTarget(c,choiceId,infusion.id,null);
  const alias={...structuredClone(infusion),id:'reimported:repulsion',packId:'reimported',name:'Changed display label'};
  c.classChoiceSnapshots={[alias.id]:alias};c.answers[choiceId]=[alias.id];
  const owner=c.selections.find(row=>row.id==='owner')!;owner.entry={...owner.entry,id:'reimported:artificer',packId:'reimported'};
  old.infusions.setInfusionTarget(c,choiceId,alias.id,'shield');old.infusions.setInfusionHeld(c,choiceId,alias.id,true);
  const reopened=validateCharacter(old.exports.exportCharacter(c));
  expect(reopened.runtime.infusionCharges).toEqual(store);
  expect(infusionChargeOffer(reopened,choiceId,alias.id)).toMatchObject({key:JSON.stringify(['owner','Repulsion Shield|TCE','shield']),current:2,canInitialize:false,canUse:true});
 });

 it('old readers preserve an opaque future store without claiming to understand it; new actions remain blocked',()=>{
  const {c,choiceId,infusion}=spentFixture();
  c.runtime.infusionCharges={version:77,future:{opaque:['do not normalize']}} as unknown as NonNullable<Character['runtime']['infusionCharges']>;
  const [transferred]=old.transfer.readCharacterTransfer([JSON.stringify(old.exports.exportLinkedOwlbear(c,old.engine.evaluate(c)))]);
  expect(transferred.runtime.infusionCharges).toEqual(c.runtime.infusionCharges);
  const reopened=validateCharacter(old.validation.readCharacter(transferred).character),before=structuredClone(reopened);
  expect(infusionChargeOffer(reopened,choiceId,infusion.id)).toMatchObject({canInitialize:false,canUse:false,canDawn:false});
  expect(performInfusionChargeAction(reopened,infusionChargeActionRequest(reopened,choiceId,infusion.id,'unknown-version-use',{kind:'use',triggerConfirmed:true,reactionConfirmed:true})).status).toBe('rejected');
  expect(reopened).toEqual(before);
 });

 it('native transfer assigns a new card identity but keeps physical class/item ownership and debt',()=>{
  const {c,choiceId,infusion,store}=spentFixture(),[copy]=old.transfer.readCharacterTransfer([JSON.stringify(old.exports.exportCharacter(c))]);
  expect(copy.id).not.toBe(c.id);expect(copy.revision).toBe(1);expect(copy.runtime.infusionCharges).toEqual(store);
  expect(infusionChargeOffer(validateCharacter(copy),choiceId,infusion.id)).toMatchObject({key:Object.keys(store.records)[0],current:2,canInitialize:false});
 });

 it('old ordinary edits and optimized HP/resource edits preserve the independent store',()=>{
  const {c,choiceId,infusion,store}=spentFixture(),before=structuredClone(c),ordinary=old.validation.readCharacter(old.exports.exportCharacter(c)).character;
  ordinary.name='Edited using the old consumer';ordinary.notes='Ordinary old-editor content';ordinary.runtime.hp=9;
  old.resources.setResource(ordinary,'manual',1);old.resources.syncAutoResources(ordinary);
  expect(ordinary.runtime.infusionCharges).toEqual(store);expect(ordinary.runtime.resources.manual.current).toBe(1);
  const hp=old.runtime.applyRuntimeCharacterEdit(ordinary,old.runtime.runtimeValueEdit('hp',5))!;
  const temp=old.runtime.applyRuntimeCharacterEdit(hp,old.runtime.runtimeValueEdit('tempHp',3))!;
  const edited=old.runtime.applyRuntimeCharacterEdit(temp,old.runtime.resourceBalanceEdit('manual',0))!;
  expect(edited.runtime).toMatchObject({hp:5,tempHp:3,resources:{manual:{current:0}},infusionCharges:store});
  expect(ordinary.runtime.hp).toBe(9);expect(c).toEqual(before);
  expect(infusionChargeOffer(validateCharacter(old.exports.exportCharacter(edited)),choiceId,infusion.id).current).toBe(2);
 });

 it('old held cleanup still runs for v1 bindings without deleting or replenishing history',()=>{
  const {c,choiceId,infusion,store}=spentFixture(),unequipped=structuredClone(c);
  unequipped.selections.find(row=>row.id==='shield')!.equipped=false;
  old.infusions.reconcileInfusionHolding(c,unequipped);
  expect(unequipped.infusions!.bindings[0].held).toBeUndefined();expect(unequipped.runtime.infusionCharges).toEqual(store);
  const reopened=validateCharacter(old.exports.exportCharacter(unequipped));
  expect(infusionChargeOffer(reopened,choiceId,infusion.id)).toMatchObject({current:2,canUse:false,canDawn:true});
  reopened.selections.find(row=>row.id==='shield')!.equipped=true;
  expect(infusionChargeOffer(reopened,choiceId,infusion.id).canUse).toBe(false);
  old.infusions.setInfusionHeld(reopened,choiceId,infusion.id,true);
  expect(infusionChargeOffer(reopened,choiceId,infusion.id)).toMatchObject({current:2,canUse:true});
 });

 it.each(['Repulsion Shield','Mind Sharpener'])('old forget/relearn of %s clears v1 bindings only, never its spent record',name=>{
  const {c,choiceId,infusion,entries,targetId,store}=spentFixture(name);
  old.choices.setSheetChoiceSlot(c,choiceId,0,undefined,entries);
  expect(c.infusions!.bindings).toEqual([]);expect(c.runtime.infusionCharges).toEqual(store);
  expect(infusionChargeOffer(validateCharacter(c),choiceId,infusion.id).canInitialize).toBe(false);
  old.choices.setSheetChoiceSlot(c,choiceId,0,infusion.id,entries);
  expect(c.infusions!.bindings).toEqual([]);expect(c.runtime.infusionCharges).toEqual(store);
  // Mind Sharpener was not implemented by the frozen consumer. Rebind it only
  // with the newer consumer; old acceptance is data preservation, not rule support.
  if(name==='Repulsion Shield')old.infusions.setInfusionTarget(c,choiceId,infusion.id,targetId);
  else setInfusionTarget(c,choiceId,infusion.id,targetId);
  expect(infusionChargeOffer(validateCharacter(c),choiceId,infusion.id)).toMatchObject({current:2,canInitialize:false});
  expect(c.runtime.infusionCharges).toEqual(store);
 });

 it('old A → B → A rebind preserves class + canonical-rule + item ownership and never initializes B',()=>{
  const {c,choiceId,infusion,store}=spentFixture(),second=structuredClone(c.selections.find(row=>row.id==='shield')!);
  second.id='shield-B';second.equipped=false;c.selections.push(second);
  old.infusions.setInfusionTarget(c,choiceId,infusion.id,second.id);
  expect(c.runtime.infusionCharges).toEqual(store);
  expect(infusionChargeOffer(validateCharacter(c),choiceId,infusion.id)).toMatchObject({canInitialize:true,canUse:false});
  expect(infusionChargeOffer(c,choiceId,infusion.id).current).toBeUndefined();
  old.infusions.setInfusionTarget(c,choiceId,infusion.id,'shield');old.infusions.setInfusionHeld(c,choiceId,infusion.id,true);
  expect(c.runtime.infusionCharges).toEqual(store);
  expect(infusionChargeOffer(validateCharacter(c),choiceId,infusion.id)).toMatchObject({key:Object.keys(store.records)[0],current:2,canInitialize:false,canUse:true});
 });

 it('old source suspension and reopen retain debt rather than granting fresh charges',()=>{
  const {c,choiceId,infusion,store}=spentFixture(),enabled=[...c.profile.enabledSources];c.profile.enabledSources=[];
  old.engine.evaluate(c);const reopened=old.validation.readCharacter(old.exports.exportCharacter(c)).character;
  expect(reopened.runtime.infusionCharges).toEqual(store);expect(infusionChargeOffer(validateCharacter(reopened),choiceId,infusion.id).canUse).toBe(false);
  reopened.profile.enabledSources=enabled;
  expect(infusionChargeOffer(validateCharacter(reopened),choiceId,infusion.id)).toMatchObject({current:2,canInitialize:false,canUse:true});
 });

 it('plain non-linked Owlbear projection is explicitly lossy and is not a full charge backup',()=>{
  const {c,store}=spentFixture(),plain=old.exports.exportOwlbear(c,old.engine.evaluate(c));
  expect(plain).not.toHaveProperty('dnd_card_web');expect(plain).not.toHaveProperty('infusionCharges');
  expect(plain.web_resources).toEqual(c.runtime.resources);expect(plain.export_warnings.join(' ')).toContain('原生角色备份');
  const imported=old.validation.importOwlbear(JSON.parse(JSON.stringify(plain)));
  expect(imported.runtime.infusionCharges).toBeUndefined();expect(imported.infusions).toBeUndefined();
  expect(c.runtime.infusionCharges).toEqual(store);
 });

 it('new and old IndexedDB full-workspace writes cross-open with balance and receipt intact',async()=>{
  const {c,choiceId,infusion,store}=spentFixture(),other=spentFixture('Mind Sharpener').c,book=workspace(c,other);
  const newer=await import('../src/platform/storage');await newer.saveWorkspace(book);
  expect(await old.storage.loadWorkspace()).toEqual(book);
  const edited=old.validation.readCharacter(old.exports.exportCharacter(c)).character;edited.notes='Old native persistence';
  await old.storage.saveWorkspace(workspace(edited,other));
  const reopened=(await newer.loadWorkspace())!;
  expect(reopened.characters[0].runtime.infusionCharges).toEqual(store);expect(reopened.characters[1]).toEqual(other);
  expect(infusionChargeOffer(validateCharacter(reopened.characters[0]),choiceId,infusion.id).current).toBe(2);
  expect(await old.storage.restoreBackup()).toEqual(book);
 });

 it('old full-workspace backup and recovery retain both stores, native identities and active card',async()=>{
  const one=spentFixture(),two=spentFixture('Mind Sharpener'),book=workspace(one.c,two.c);book.activeId=two.c.id;
  const text=JSON.stringify(book),read=old.recovery.readWorkspaceRecovery(text);expect(read).toEqual(book);
  const restored=await old.recovery.recoverWorkspaceFromText('infusion-old-backup-recovery',text);expect(restored).toEqual(book);
  for(const [card,fixture] of [[restored.characters[0],one],[restored.characters[1],two]] as const){
   expect(validateCharacter(card).runtime.infusionCharges).toEqual(fixture.store);
   expect(infusionChargeOffer(card,fixture.choiceId,fixture.infusion.id).current).toBe(2);
  }
  const {readWorkspaceRecovery}=await import('../src/platform/workspaceRecovery');expect(readWorkspaceRecovery(text)).toEqual(book);
 });

 it.each(['old','new'] as const)('aborted %s IndexedDB commit preserves the earlier workspace AND backup, including balances and receipts',async consumer=>{
  const storage=consumer==='old'?old.storage:await import('../src/platform/storage');
  const f=spentFixture(),first=workspace(structuredClone(f.c));first.characters[0].notes='Earlier backup';
  await storage.saveWorkspace(first);const saved=workspace(structuredClone(f.c));saved.characters[0].notes='Current saved';await storage.saveWorkspace(saved);
  const draft=structuredClone(saved);charge(draft.characters[0],f.choiceId,f.infusion.id,'not-committed-use',{kind:'use',triggerConfirmed:true,reactionConfirmed:true});
  const put=IDBObjectStore.prototype.put;let aborted=false;
  const fault=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value:unknown,key?:IDBValidKey){
   const request=put.call(this,value,key);
   if(key==='workspace'&&!aborted){aborted=true;request.addEventListener('success',()=>this.transaction.abort(),{once:true});}
   return request;
  });
  try{await expect(storage.saveWorkspace(draft)).rejects.toMatchObject({name:'AbortError'});}finally{fault.mockRestore();}
  expect(aborted).toBe(true);expect(await storage.loadWorkspace()).toEqual(saved);expect(await storage.restoreBackup()).toEqual(first);
  expect(saved.characters[0].runtime.infusionCharges).toEqual(f.store);
  await storage.saveWorkspace(draft);const reopened=(await storage.loadWorkspace())!;
  expect(infusionChargeOffer(validateCharacter(reopened.characters[0]),f.choiceId,f.infusion.id).current).toBe(1);
  expect(reopened.characters[0].runtime.infusionCharges!.last!.id).toBe('not-committed-use');expect(await storage.restoreBackup()).toEqual(saved);
 });

 it('old undo/redo engine restores persisted full snapshots including the matching charge receipt (not a browser UI test)',async()=>{
  const f=spentFixture(),before=workspace(structuredClone(f.c)),after=structuredClone(before);
  charge(after.characters[0],f.choiceId,f.infusion.id,'undoable-use',{kind:'use',triggerConfirmed:true,reactionConfirmed:true});
  await old.storage.saveWorkspace(after);
  old.history.recordAction({label:'Full native charge snapshot',undo:()=>old.storage.saveWorkspace(before),redo:()=>old.storage.saveWorkspace(after)});
  await old.history.travelHistory();expect(await old.storage.loadWorkspace()).toEqual(before);
  expect(validateCharacter((await old.storage.loadWorkspace())!.characters[0]).runtime.infusionCharges).toEqual(before.characters[0].runtime.infusionCharges);
  await old.history.travelHistory(true);expect(await old.storage.loadWorkspace()).toEqual(after);
  const reopened=validateCharacter((await old.storage.loadWorkspace())!.characters[0]);
  expect(infusionChargeOffer(reopened,f.choiceId,f.infusion.id).current).toBe(1);expect(reopened.runtime.infusionCharges!.last!.id).toBe('undoable-use');
 });
});

describe('new consumer fail-closed persistence boundaries',()=>{
 it('preserves opaque future versions on read but rejects every charge action without mutation',()=>{
  const f=spentFixture();f.c.runtime.infusionCharges={version:99,sequence:17,records:{},future:{opaque:'preserve'}} as unknown as NonNullable<Character['runtime']['infusionCharges']>;
  const before=structuredClone(f.c);expect(readCharacter(f.c).character).toEqual(before);
  for(const action of [{kind:'initialize',initial:4},{kind:'use',triggerConfirmed:true,reactionConfirmed:true},{kind:'dawn',dawnConfirmed:true,roll:4}] as InfusionChargeAction[]){
   const offer=infusionChargeOffer(f.c,f.choiceId,f.infusion.id);expect(offer).toMatchObject({canInitialize:false,canUse:false,canDawn:false});
   expect(performInfusionChargeAction(f.c,infusionChargeActionRequest(f.c,f.choiceId,f.infusion.id,'future-'+action.kind,action)).status).toBe('rejected');expect(f.c).toEqual(before);
  }
 });
 it.each(['negative','over-cap','wrong-cap','wrong-key','bad-owner','bad-sequence','bad-receipt'] as const)('rejects invalid v1 %s before reopening or action mutation',kind=>{
  const f=spentFixture(),state=f.c.runtime.infusionCharges!,key=Object.keys(state.records)[0],record=state.records[key];
  if(kind==='negative')record.current=-1;else if(kind==='over-cap')record.current=5;
  else if(kind==='wrong-cap')(record as {max:number}).max=9;
  else if(kind==='wrong-key'){state.records.wrong=record;delete state.records[key];}
  else if(kind==='bad-owner')record.ownerId='a-different-class-instance';
  else if(kind==='bad-sequence')state.sequence=-1;else state.last!.after=0;
  const before=structuredClone(f.c);expect(()=>validateCharacter(f.c)).toThrow();expect(f.c).toEqual(before);
  expect(performInfusionChargeAction(f.c,infusionChargeActionRequest(f.c,f.choiceId,f.infusion.id,'malformed-use',{kind:'use',triggerConfirmed:true,reactionConfirmed:true})).status).toBe('rejected');expect(f.c).toEqual(before);
 });
 it('invalid second card prevents full-workspace recovery before any IndexedDB write',async()=>{
  vi.stubGlobal('indexedDB',new IDBFactory());
  try{
   const one=spentFixture(),two=spentFixture('Mind Sharpener'),state=two.c.runtime.infusionCharges!;state.records[Object.keys(state.records)[0]].current=5;
   const book=workspace(one.c,two.c),before=structuredClone(book),open=vi.spyOn(indexedDB,'open');
   const {recoverWorkspaceFromText}=await import('../src/platform/workspaceRecovery');
   await expect(recoverWorkspaceFromText('invalid-charge-backup',JSON.stringify(book))).rejects.toThrow();
   expect(open).not.toHaveBeenCalled();expect(book).toEqual(before);open.mockRestore();
  }finally{vi.unstubAllGlobals();}
 });
});
