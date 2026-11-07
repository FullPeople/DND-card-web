import {expect,it} from 'vitest';
import {radiantRefuelingFixture} from './fixtures/radiantRefuelingFixture';
import {setInfusionTarget} from '../src/core/automation/infusions';
import {refuelingRingOffer,refuelingRingActionRequest,performRefuelingRingAction} from '../src/core/automation/refuelingRing';
import {syncAutoResources} from '../src/core/resources';
import {restResources,resourceRestRecovery} from '../src/core/automation/featureResources';
import {currentSlotCapacityReview,slotBalanceHeld} from '../src/core/automation/slotCapacityReview';
import {validateCharacter} from '../src/core/validation';

function ring(){
 const f=radiantRefuelingFixture('Spell-Refueling Ring');
 setInfusionTarget(f.c,f.choiceId,f.entry.id,'ring-a');
 f.c.spellSettings={mode:'prepared',ability:'int',capacity:3,attackBonus:0,dcBonus:0,prepared:[],slots:{'1':{max:4,used:2},'2':{max:2,used:1}}};
 Object.assign(f.c.runtime.resources,{'spell-slot:1':{automatic:true,max:4,current:2},'spell-slot:2':{automatic:true,max:2,current:1}});
 syncAutoResources(f.c);
 expect(currentSlotCapacityReview(f.c)?.balances?.['spell-slot:1']).toEqual({spent:2,max:4,current:2});
 expect(performRefuelingRingAction(f.c,refuelingRingActionRequest(f.c,f.choiceId,f.entry.id,'acquire',{kind:'initialize',initial:1})).status).toBe('applied');
 return f;
}
const use={kind:'use',slotKey:'spell-slot:1',actionConfirmed:true} as const;
it('a real ring credit updates known ordinary balance in the same transaction and survives normalization and native reopen',()=>{
 const f=ring(),manual=structuredClone(f.c.runtime.resources['manual-ring']);
 expect(performRefuelingRingAction(f.c,refuelingRingActionRequest(f.c,f.choiceId,f.entry.id,'credit',use)).status).toBe('applied');
 expect(currentSlotCapacityReview(f.c)?.balances?.['spell-slot:1']).toEqual({spent:1,max:4,current:3});
 expect(slotBalanceHeld(f.c,'spell-slot:1')).toBe(false);
 syncAutoResources(f.c);const restored=validateCharacter(JSON.parse(JSON.stringify(f.c)));syncAutoResources(restored);
 expect(restored.runtime.resources['spell-slot:1']).toMatchObject({max:4,current:3});expect(slotBalanceHeld(restored,'spell-slot:1')).toBe(false);
 expect(restored.runtime.resources['manual-ring']).toEqual(manual);
});
it.each(['pending','future','mismatched'] as const)('a ring never credits a %s ordinary balance or consumes its own use',mode=>{
 const f=ring();
 if(mode==='pending')currentSlotCapacityReview(f.c)!.pending['spell-slot:1']={max:4};
 if(mode==='future')f.c.runtime.slotCapacityReview={version:2,authoredFuture:{value:true}};
 if(mode==='mismatched'){f.c.runtime.resources['spell-slot:1'].current=1;f.c.spellSettings!.slots['1'].used=3;}
 const before=structuredClone(f.c),offer=refuelingRingOffer(f.c,f.choiceId,f.entry.id);
 expect(offer.slots.some(row=>row.key==='spell-slot:1')).toBe(false);
 expect(performRefuelingRingAction(f.c,refuelingRingActionRequest(f.c,f.choiceId,f.entry.id,'held-credit',use)).status).toBe('rejected');expect(f.c).toEqual(before);
});
it('a previously offered ring action is stale when the saved ordinary capacity review changes',()=>{
 const f=ring(),request=refuelingRingActionRequest(f.c,f.choiceId,f.entry.id,'stale-credit',use);
 currentSlotCapacityReview(f.c)!.previous['spell-slot:9']=1;const before=structuredClone(f.c);
 expect(performRefuelingRingAction(f.c,request).status).toBe('rejected');expect(f.c).toEqual(before);
});
it('explicit long rest records the known recovered balance and leaves independent ring debt and manual data intact',()=>{
 const f=ring(),history=structuredClone(f.c.runtime.refuelingRing),manual=structuredClone(f.c.runtime.resources['manual-ring']);
 restResources(f.c,'long');
 expect(currentSlotCapacityReview(f.c)?.balances?.['spell-slot:1']).toEqual({spent:0,max:4,current:4});
 const restored=validateCharacter(JSON.parse(JSON.stringify(f.c)));syncAutoResources(restored);
 expect(slotBalanceHeld(restored,'spell-slot:1')).toBe(false);expect(restored.runtime.resources['spell-slot:1']).toMatchObject({max:4,current:4});
 expect(restored.runtime.refuelingRing).toEqual(history);expect(restored.runtime.resources['manual-ring']).toEqual(manual);
});
it.each(['pending','future','mismatched'] as const)('rest cannot resolve or silently refill a %s ordinary balance',mode=>{
 const f=ring();
 if(mode==='pending')currentSlotCapacityReview(f.c)!.pending['spell-slot:1']={max:4};
 if(mode==='future')f.c.runtime.slotCapacityReview={version:2,authoredFuture:{value:true}};
 if(mode==='mismatched'){f.c.runtime.resources['spell-slot:1'].current=1;f.c.spellSettings!.slots['1'].used=3;}
 const pool=structuredClone(f.c.runtime.resources['spell-slot:1']),mirror=structuredClone(f.c.spellSettings!.slots['1']),state=structuredClone(f.c.runtime.slotCapacityReview);
 // The other, known pool still legitimately recovers during the same rest.
 if(state?.version===1)(state as ReturnType<typeof currentSlotCapacityReview>)!.balances!['spell-slot:2']={spent:0,max:2,current:2};
 expect(resourceRestRecovery(f.c,'spell-slot:1','long')).toBeUndefined();
 restResources(f.c,'long');
 expect(f.c.runtime.resources['spell-slot:1']).toEqual(pool);expect(f.c.spellSettings!.slots['1']).toEqual(mirror);expect(f.c.runtime.slotCapacityReview).toEqual(state);
});
