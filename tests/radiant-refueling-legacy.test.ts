import 'fake-indexeddb/auto';
import {IDBFactory} from 'fake-indexeddb';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {frozenRefuelingLegacy,refuelingLegacyUnavailable,REFUELING_LEGACY_COMMIT,REFUELING_LEGACY_SOURCE_TREE,type FrozenRefuelingLegacy} from './helpers/frozenRefuelingLegacy';
import {infusionChargesFixture} from './helpers/infusionChargesFixture';
import {validateCharacter} from '../src/core/validation';
import {radiantRefuelingFixture as actualFixture} from './fixtures/radiantRefuelingFixture';
import {normalizeData} from '../src/data/catalog';
import {setInfusionTarget,setInfusionHeld} from '../src/core/automation/infusions';
import {infusionChargeOffer,infusionChargeActionRequest,performInfusionChargeAction} from '../src/core/automation/infusionCharges';
import {refuelingRingOffer,refuelingRingActionRequest,performRefuelingRingAction} from '../src/core/automation/refuelingRing';
import {setResource} from '../src/core/resources';

// Actual verified v1 consumer, not a recreated parser. These cases establish
// rollback data preservation, not execution support for unrecognized versions.
describe.skipIf(!!refuelingLegacyUnavailable)('exact charge-v1 consumer preserves bounded successor state',()=>{
 let old:FrozenRefuelingLegacy;
 beforeAll(async()=>{vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('location',{search:'',hash:''});vi.stubGlobal('window',new EventTarget());vi.stubGlobal('BroadcastChannel',undefined);old=await frozenRefuelingLegacy();},30000);
 afterAll(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
 function original(){
  const f=infusionChargesFixture();const {c,choiceId,infusion,targetId}=f;
  c.runtime.resources.manual={name:'Unowned hand-written counter',max:7,current:2};
  old.infusions.setInfusionTarget(c,choiceId,infusion.id,targetId);old.infusions.setInfusionHeld(c,choiceId,infusion.id,true);
  for(const [id,action] of [['old-init',{kind:'initialize',initial:3}],['old-use',{kind:'use',triggerConfirmed:true,reactionConfirmed:true}]] as const){const request=old.charges.infusionChargeActionRequest(c,choiceId,infusion.id,id,action);expect(old.charges.performInfusionChargeAction(c,request).status).toBe('applied');}
  expect(c.runtime.infusionCharges!.version).toBe(1);return f;
 }
 it('executes the immutable accepted v1 graph with actual charge APIs',()=>{
  expect(REFUELING_LEGACY_COMMIT).toBe('2f8bb8938c55a0f1a937efe95bdbf30222680f86');expect(REFUELING_LEGACY_SOURCE_TREE).toBe('48ac56b4d80be04303dcdf80f75b138a1da10fe0');
  expect(old.sourceFiles).toContain('src/core/automation/infusionCharges.ts');expect(old.source('src/core/automation/infusionCharges.ts')).toContain('version!==1');
  const {c,choiceId,infusion}=original();expect(old.charges.infusionChargeOffer(c,choiceId,infusion.id)).toMatchObject({current:2,canUse:true,canInitialize:false});
 });
 it('new read of actual v1 spent data performs no implicit migration or refill',()=>{
  const {c}=original(),before=structuredClone(c);const read=validateCharacter(old.exports.exportCharacter(c));expect(c).toEqual(before);expect(read.runtime.infusionCharges).toEqual(c.runtime.infusionCharges);expect(read.runtime.infusionCharges!.version).toBe(1);
 });
 it.each([2,77])('old native and linked transfer preserve opaque charge version %s, refusing all charge operations',version=>{
  const {c,choiceId,infusion}=original();c.runtime.infusionCharges!.version=version;const store=structuredClone(c.runtime.infusionCharges),before=structuredClone(c);
  const native=old.exports.exportCharacter(c),linked=old.exports.exportLinkedOwlbear(c,old.engine.evaluate(c));
  const cards=[old.validation.validateCharacter(native),old.validation.readCharacter(native).character,old.validation.importOwlbear(linked),...old.transfer.readCharacterTransfer([JSON.stringify(native)]),...old.transfer.readCharacterTransfer([JSON.stringify(linked)])];
  for(const card of cards){expect(card.runtime.infusionCharges).toEqual(store);expect(old.charges.infusionChargeOffer(card,choiceId,infusion.id)).toMatchObject({canInitialize:false,canUse:false,canDawn:false});for(const action of [{kind:'initialize',initial:4},{kind:'use',triggerConfirmed:true,reactionConfirmed:true},{kind:'dawn',dawnConfirmed:true,roll:4}] as const){const saved=structuredClone(card);expect(old.charges.performInfusionChargeAction(card,old.charges.infusionChargeActionRequest(card,choiceId,infusion.id,`old-reject-${action.kind}`,action)).status).toBe('rejected');expect(card).toEqual(saved);}}
  expect(c).toEqual(before);
 });
 it('old ordinary edits and forget/relearn preserve opaque v2 debt without reinitializing it',()=>{
  const {c,choiceId,infusion,entries}=original();c.runtime.infusionCharges!.version=2;const store=structuredClone(c.runtime.infusionCharges);
  c.notes='Edited using verified older consumer';old.resources.setResource(c,'manual',1);old.choices.setSheetChoiceSlot(c,choiceId,0,undefined,entries);expect(c.infusions!.bindings).toEqual([]);old.choices.setSheetChoiceSlot(c,choiceId,0,infusion.id,entries);
  const read=old.validation.readCharacter(old.exports.exportCharacter(c)).character;expect(read.runtime.infusionCharges).toEqual(store);expect(read.runtime.resources.manual.current).toBe(1);expect(old.charges.infusionChargeOffer(read,choiceId,infusion.id).canInitialize).toBe(false);
 });
 it('old v1 storage and backup save preserve opaque versioned state without discarding a card',async()=>{
  const {c}=original();c.runtime.infusionCharges!.version=2;const first={schemaVersion:1 as const,characters:[c],activeId:c.id,packs:[]};await old.storage.saveWorkspace(first);
  const edited=structuredClone(first);edited.characters[0].notes='Old consumer persisted note';await old.storage.saveWorkspace(edited);expect(await old.storage.loadWorkspace()).toEqual(edited);expect(await old.storage.restoreBackup()).toEqual(first);
 });

 it('an explicit Radiant v2 transition keeps the actual old v1 spent store through old edits and new reopening',()=>{
  const {c,choiceId,entries}=original(),v1=structuredClone(c.runtime.infusionCharges!);
  const radiant=normalizeData({optionalfeature:[{name:'Radiant Weapon',ENG_name:'Radiant Weapon',source:'TCE',featureType:['AI'],entries:[]}]},'legacy-radiant')[0];
  const sword=normalizeData({item:[{name:'Longsword',ENG_name:'Longsword',source:'PHB',type:'M',weaponCategory:'martial',rarity:'none',dmg1:'1d8',dmg2:'1d10',property:['V']}]},'legacy-radiant')[0];
  c.selections.push({id:'radiant-target',entry:sword,level:1,quantity:1,equipped:true,attuned:true});old.choices.setSheetChoiceSlot(c,choiceId,1,radiant.id,[...entries,radiant]);
  setInfusionTarget(c,choiceId,radiant.id,'radiant-target');setInfusionHeld(c,choiceId,radiant.id,true);
  const before=structuredClone(c);expect(performInfusionChargeAction(c,infusionChargeActionRequest(c,choiceId,radiant.id,'no-upgrade',{kind:'initialize',initial:3})).status).toBe('rejected');expect(c).toEqual(before);
  expect(performInfusionChargeAction(c,infusionChargeActionRequest(c,choiceId,radiant.id,'explicit-upgrade',{kind:'initialize',initial:3,upgradeConfirmed:true})).status).toBe('applied');
  expect(c.runtime.infusionCharges).toMatchObject({version:2,v1History:v1});for(const [key,value] of Object.entries(v1.records))expect(c.runtime.infusionCharges!.records[key]).toEqual(value);
  expect(performInfusionChargeAction(c,infusionChargeActionRequest(c,choiceId,radiant.id,'radiant-use',{kind:'use',triggerConfirmed:true,reactionConfirmed:true})).status).toBe('applied');
  const state=structuredClone(c.runtime.infusionCharges),read=old.validation.readCharacter(old.exports.exportCharacter(c)).character;
  expect(old.charges.infusionChargeOffer(read,choiceId,radiant.id).canUse).toBe(false);read.notes='Old client edit after newer use';old.resources.setResource(read,'manual',1);
  const reopened=validateCharacter(old.exports.exportCharacter(read));expect(reopened.runtime.infusionCharges).toEqual(state);expect(infusionChargeOffer(reopened,choiceId,radiant.id)).toMatchObject({current:2,canInitialize:false,canUse:true});expect(reopened.runtime.resources.manual.current).toBe(1);
 });
 it.each([0,5])('actual Ring restored slot remains spent after later ordinary consumption and old/new roundtrip (Warlock %s)',warlockLevel=>{
  const {c,choiceId,entry}=actualFixture('Spell-Refueling Ring',warlockLevel);
  c.spellSettings={mode:'prepared',ability:'int',capacity:3,attackBonus:0,dcBonus:0,prepared:[],slots:{'1':{max:4,used:1},'2':{max:2,used:1}}};
  c.runtime.resources['spell-slot:1']={name:'Source-owned first-level slots',automatic:true,max:4,current:3};c.runtime.resources['spell-slot:2']={name:'Source-owned second-level slots',automatic:true,max:2,current:1};
  if(warlockLevel)c.runtime.resources['pact-slot:3']={name:'Source-owned pact slots',automatic:true,max:2,current:1};
  setInfusionTarget(c,choiceId,entry.id,'ring-a');
  expect(performRefuelingRingAction(c,refuelingRingActionRequest(c,choiceId,entry.id,'ring-initialize',{kind:'initialize',initial:1})).status).toBe('applied');
  const key=warlockLevel?'pact-slot:3':'spell-slot:2';expect(refuelingRingOffer(c,choiceId,entry.id).slots.some(slot=>slot.key===key)).toBe(true);
  expect(performRefuelingRingAction(c,refuelingRingActionRequest(c,choiceId,entry.id,'ring-use',{kind:'use',slotKey:key,actionConfirmed:true})).status).toBe('applied');
  expect(c.runtime.resources[key].current).toBe(2);const store=structuredClone(c.runtime.refuelingRing);setResource(c,key,1);expect(c.runtime.refuelingRing).toEqual(store);
  const oldRead=old.validation.readCharacter(old.exports.exportCharacter(c)).character;expect(oldRead.runtime.refuelingRing).toEqual(store);oldRead.notes='Old note after Ring and later slot use';
  const native=old.exports.exportCharacter(oldRead),linked=old.exports.exportLinkedOwlbear(oldRead,old.engine.evaluate(oldRead));
  for(const value of [old.validation.validateCharacter(native),old.validation.importOwlbear(linked),...old.transfer.readCharacterTransfer([JSON.stringify(native)])]){
   const reopened=validateCharacter(value);expect(reopened.runtime.refuelingRing).toEqual(store);expect(reopened.runtime.resources[key].current).toBe(1);expect(refuelingRingOffer(reopened,choiceId,entry.id)).toMatchObject({current:0,canInitialize:false,canUse:false,canDawn:true});
   expect(reopened.runtime.resources['manual-ring']).toEqual(c.runtime.resources['manual-ring']);
  }
 });

 it.each(['Repulsion Shield','Mind Sharpener'])('does not write a new upgrade field into legacy v1 receipts for %s',name=>{
  const {c,choiceId,infusion,targetId}=infusionChargesFixture(name);setInfusionTarget(c,choiceId,infusion.id,targetId);if(name==='Repulsion Shield')setInfusionHeld(c,choiceId,infusion.id,true);
  const before=structuredClone(c);expect(performInfusionChargeAction(c,infusionChargeActionRequest(c,choiceId,infusion.id,'invalid-old-upgrade',{kind:'initialize',initial:2,upgradeConfirmed:true})).status).toBe('rejected');expect(c).toEqual(before);
  expect(performInfusionChargeAction(c,infusionChargeActionRequest(c,choiceId,infusion.id,'valid-v1-init',{kind:'initialize',initial:2})).status).toBe('applied');
  const oldRead=old.validation.readCharacter(old.exports.exportCharacter(c));expect(oldRead.repaired).toEqual([]);expect(oldRead.character.runtime.infusionCharges).toEqual(c.runtime.infusionCharges);expect(old.charges.infusionChargeOffer(oldRead.character,choiceId,infusion.id).current).toBe(2);
 });

 function spentRing(){
  const f=actualFixture('Spell-Refueling Ring'),{c,entry,choiceId}=f;
  c.spellSettings={mode:'prepared',ability:'int',capacity:3,attackBonus:0,dcBonus:0,prepared:[],slots:{'1':{max:4,used:1},'2':{max:2,used:1}}};
  c.runtime.resources['spell-slot:1']={automatic:true,max:4,current:3};c.runtime.resources['spell-slot:2']={automatic:true,max:2,current:1};setInfusionTarget(c,choiceId,entry.id,'ring-a');
  for(const [id,action] of [['start',{kind:'initialize',initial:1}],['use',{kind:'use',slotKey:'spell-slot:2',actionConfirmed:true}]] as const)expect(performRefuelingRingAction(c,refuelingRingActionRequest(c,choiceId,entry.id,id,action)).status).toBe('applied');return f;
 }
 it('actual Ring history survives old forget/relearn and requires new explicit rebind without resetting availability',()=>{
  const {c,entry,entries,choiceId}=spentRing(),store=structuredClone(c.runtime.refuelingRing),slots=structuredClone(c.runtime.resources);
  expect(old.infusions.infusionRule(entry)).toBeUndefined();old.choices.setSheetChoiceSlot(c,choiceId,0,undefined,entries);expect(c.infusions!.bindings).toEqual([]);expect(c.runtime.refuelingRing).toEqual(store);
  old.choices.setSheetChoiceSlot(c,choiceId,0,entry.id,entries);expect(c.infusions!.bindings).toEqual([]);const reopened=validateCharacter(old.exports.exportCharacter(c));setInfusionTarget(reopened,choiceId,entry.id,'ring-a');
  expect(refuelingRingOffer(reopened,choiceId,entry.id)).toMatchObject({current:0,canInitialize:false,canUse:false,canDawn:true});expect(reopened.runtime.refuelingRing).toEqual(store);expect(reopened.runtime.resources).toEqual(slots);
 });
 it('actual Ring state survives old complete workspace save and backup with its slot credit',async()=>{
  const {c,entry,choiceId}=spentRing(),book={schemaVersion:1 as const,characters:[c],activeId:c.id,packs:[]};await old.storage.saveWorkspace(book);const edited=structuredClone(book);edited.characters[0].notes='Older workspace editor';await old.storage.saveWorkspace(edited);
  const loaded=(await old.storage.loadWorkspace())!;expect(loaded).toEqual(edited);expect(await old.storage.restoreBackup()).toEqual(book);const read=validateCharacter(loaded.characters[0]);expect(refuelingRingOffer(read,choiceId,entry.id).current).toBe(0);expect(read.runtime.resources['spell-slot:2'].current).toBe(2);
 });
 it('old compact runtime edits keep current Ring history while preserving independent manual values',()=>{
  const {c,entry,choiceId}=spentRing(),store=structuredClone(c.runtime.refuelingRing);
  const hp=old.runtime.applyRuntimeCharacterEdit(c,old.runtime.runtimeValueEdit('hp',5))!,edited=old.runtime.applyRuntimeCharacterEdit(hp,old.runtime.resourceBalanceEdit('manual-ring',1))!;
  const read=validateCharacter(old.exports.exportCharacter(edited));expect(read.runtime.refuelingRing).toEqual(store);expect(read.runtime.hp).toBe(5);expect(read.runtime.resources['manual-ring'].current).toBe(1);expect(refuelingRingOffer(read,choiceId,entry.id).current).toBe(0);
 });
 it('old plain Owlbear export remains explicitly lossy for Ring history, never a native rollback backup',()=>{
  const {c}=spentRing(),plain=old.exports.exportOwlbear(c,old.engine.evaluate(c)),read=old.validation.importOwlbear(plain);expect(plain.export_warnings.join(' ')).toContain('原生角色备份');expect(read.runtime.refuelingRing).toBeUndefined();expect(c.runtime.refuelingRing).toBeDefined();
 });

 it('records the older automatic-sync ownership limitation without refilling spent Ring eligibility',()=>{
  const {c,entry,choiceId}=spentRing();c.runtime.resources['spell-slot:2']={name:'Manual second-level pool',automatic:false,current:1,max:2};c.spellSettings!.slots['2']={max:2,used:1};
  const ring=structuredClone(c.runtime.refuelingRing),manual=structuredClone(c.runtime.resources['spell-slot:2']);old.resources.syncAutoResources(c);
  // This is an explicit OLD-client limitation, not a new-client acceptance goal.
  // Do not claim old native preservation makes old automatic reconciliation safe.
  expect(c.runtime.resources['spell-slot:2']).not.toEqual(manual);expect(c.runtime.resources['spell-slot:2'].automatic).toBe(true);expect(c.runtime.refuelingRing).toEqual(ring);
  const read=validateCharacter(old.exports.exportCharacter(c));expect(refuelingRingOffer(read,choiceId,entry.id)).toMatchObject({current:0,canInitialize:false,canUse:false});
 });
});
