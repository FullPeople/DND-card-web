import {expect,it} from 'vitest';
import evidence from '../src/core/automation/nonunitItemChargeEvidence.json';
// Existing actor imports are deliberate: first RED must be actual held-family
// acquisition, not a missing new API/module or an invented runtime substitute.
import {itemChargeOffers,itemChargeRequest,performItemChargeAction,itemChargeRule} from '../src/core/automation/itemChargeDebits';
import {readCharacter} from '../src/core/validation';
import {nonunitItemChargeFixture} from './helpers/nonunitItemChargeFlowFixture';
import {nonunitItemChargeSnapshot as snapshot} from './helpers/nonunitItemChargeSourceFixture';

const authority={canEdit:true,gm:false};
for(const form of ['canonical','merged']as const)for(const policy of evidence.owners)for(const branch of policy.branches){
 it(`actual ${form} source accounting ${policy.id} / ${branch.key}`,()=>{
  const {c,entry,owner}=nonunitItemChargeFixture(policy.id,form),manual=snapshot([c.notes,c.runtime.hp,c.runtime.resources.manual,entry]);
  expect(itemChargeRule(entry)?.id).toBe(policy.id);
  const offer=itemChargeOffers(c,authority).find(row=>row.ownerId===owner.id)!;
  expect(offer.canAcquire).toBe(true);
  const acquire=itemChargeRequest(c,owner.id,'known-physical-balance',{kind:'acquire',knownRemaining:policy.capacity,confirmedGenuineItem:true,confirmedKnownBalance:true});
  expect(performItemChargeAction(c,acquire,authority).status).toBe('applied');
  expect(c.runtime.itemChargeDebits?.version).toBe(1);
  const originalEvents=snapshot(c.runtime.itemChargeDebits!.records[0].events),current=itemChargeOffers(c,authority).find(row=>row.ownerId===owner.id)!;
  const action=(current as any).variableActions?.find((row:any)=>row.key===branch.key);
  expect(action?.allowedCosts).toEqual(branch.allowedCosts);expect(action?.requiredContext).toEqual(branch.requiredContext);expect(action?.canDebit).toBe(true);
  const cost=Math.max(...branch.allowedCosts.filter(n=>n<=policy.capacity-branch.minAfter)),context=Object.fromEntries(branch.requiredContext.map(key=>[key,true]));
  const request=itemChargeRequest(c,owner.id,'source-branch-debit',{kind:'variable-debit',branchKey:branch.key,cost,context}as any);
  const result=performItemChargeAction(c,request,authority);expect(result.status).toBe('applied');
  const state=c.runtime.itemChargeDebits!,record=state.records[0],event=record.events.at(-1)as any;
  expect(state.version).toBe(2);expect(state.sequence).toBe(2);expect(record.snapshotSha256).toBe(policy.fullNormalizedSnapshotSha256);
  expect(record.spent).toBe(cost);expect(record.initial-record.spent).toBe(policy.capacity-cost);expect(c.runtime.resources[current.key].current).toBe(policy.capacity-cost);
  expect(snapshot(record.events.slice(0,1))).toBe(originalEvents);expect(event.units).toBe(cost);expect(event.branchKey).toBe(branch.key);expect(event.context).toEqual(context);expect(event.policySha256).toBe(policy.policySha256);
  const applied=snapshot(c);expect(performItemChargeAction(c,request,authority).status).toBe('duplicate');expect(snapshot(c)).toBe(applied);
  const over=itemChargeRequest(c,owner.id,'not-an-allowed-fee',{kind:'variable-debit',branchKey:branch.key,cost:Math.max(...branch.allowedCosts)+1,context}as any);
  expect(performItemChargeAction(c,over,authority).status).toBe('rejected');expect(snapshot(c)).toBe(applied);
  expect(snapshot(readCharacter(JSON.parse(JSON.stringify(c))).character)).toBe(applied);
  expect(snapshot([c.notes,c.runtime.hp,c.runtime.resources.manual,entry])).toBe(manual);
 });
}
for(const form of ['canonical','merged']as const)for(const policy of evidence.holds){
 it(`actual ${form} non-admitted source stays held ${policy.id}`,()=>{
  const {c,entry,owner}=nonunitItemChargeFixture(policy.id,form),before=snapshot(c);expect(itemChargeRule(entry)?.id).toBe(policy.id);
  const offer=itemChargeOffers(c,authority).find(row=>row.ownerId===owner.id)!;expect(offer.canAcquire).toBe(false);expect((offer as any).variableActions||[]).toHaveLength(0);
  const request=itemChargeRequest(c,owner.id,'no-prerequisite-bypass',{kind:'acquire',knownRemaining:1,confirmedGenuineItem:true,confirmedKnownBalance:true});
  expect(performItemChargeAction(c,request,authority).status).toBe('rejected');expect(snapshot(c)).toBe(before);
 });
}
