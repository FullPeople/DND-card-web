import {expect,it} from 'vitest';
// Existing actor/orchestrator imports only: baseline RED must be the real
// absent workflow, never a missing new module/export or replacement actor.
import {itemChargeOffers,itemChargeRequest,performItemChargeAction,itemChargeRule} from '../src/core/automation/itemChargeDebits';
import * as sourceSpells from '../src/core/automation/sourceSpells';
import {spellPayments,spellActionRequest,performSpellAction} from '../src/core/automation/actions';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {chargedItemSpellSpecs,chargedItemSpellSnapshot as snapshot} from './helpers/chargedItemSpellSourceFixture';
import {chargedItemSpellFixture} from './helpers/chargedItemSpellFlowFixture';

const authority={canEdit:true,gm:false};
for(const form of ['canonical','final']as const)for(const spec of chargedItemSpellSpecs){
 it(`actual ${form} item-owned delivery and paid cast ${spec.ownerId} / ${spec.branchKey}`,()=>{
  const f=chargedItemSpellFixture(spec.ownerId,form),{c,owner,rule,entries}=f;
  const manual=snapshot([c.notes,c.runtime.hp,c.runtime.resources.manual,c.runtime.resources['spell-slot:9'],c.runtime.resources[`innate-spell:${f.manual.id}`],f.manual,c.spellSettings!.special![f.manual.id],c.spellSettings!.prepared]);
  expect(itemChargeRule(owner.entry)?.id).toBe(spec.ownerId);const pool=itemChargeOffers(c,authority).find(row=>row.ownerId===owner.id)!;expect(pool.canAcquire).toBe(true);
  expect(performItemChargeAction(c,itemChargeRequest(c,owner.id,'known-physical-item-balance',{kind:'acquire',knownRemaining:1+spec.minAfter,confirmedGenuineItem:true,confirmedKnownBalance:true}),authority).status).toBe('applied');
  const originalPool=snapshot(c.runtime.itemChargeDebits),originalEvents=snapshot(c.runtime.itemChargeDebits!.records[0].events),resourceKeys=Object.keys(c.runtime.resources).sort();expect(c.runtime.itemChargeDebits?.version).toBe(1);
  const initialPlan=sourceSpells.planSourceSpells(c,entries);
  expect(initialPlan.choices.some(row=>(row as any).chargedItemSpell?.ownerId===owner.id)).toBe(true);
  // The new setter is reached only AFTER the real missing-choice assertion.
  // Reexport through the existing module keeps first RED import-independent.
  const activate=(sourceSpells as any).setChargedItemSpellIntent as (c:typeof f.c,id:string,intent:{confirmedGenuineOwnedItem:true}|null,entries:typeof f.entries,access:typeof authority)=>void;
  activate(c,owner.id,{confirmedGenuineOwnedItem:true},entries,authority);expect(snapshot(c.runtime.itemChargeDebits)).toBe(originalPool);
  sourceSpells.syncSourceSpells(c,entries);const children=c.selections.filter(row=>row.parentId===owner.id&&row.grantKey?.startsWith('source-spell:item-charged/'));expect(children).toHaveLength(1);const child=children[0];expect(child.entry.id).toBe(spec.targetId);
  const config=c.spellSettings!.special![child.id];expect(config.mode).toBe('locked');expect(config.max).toBeUndefined();expect(config.recovery).toBeUndefined();expect(config.sourceGrant?.ability).toBeUndefined();expect(config.sourceGrant?.usage).toBe('check');expect(config.sourceGrant?.canUseSlots).toBe(false);expect(config.sourceGrant?.resourceKey).toBeUndefined();expect(Object.keys(c.runtime.resources).sort()).toEqual(resourceKeys);
  const payments=spellPayments(c,child.id,authority);expect(payments.options.map(row=>row.id)).toEqual(['item-charge']);const payment=payments.options[0]as any;expect(payment.available).toBe(true);expect(payment.resourceId).toBe(pool.key);expect(payment.cost).toBe(1);expect(payment.level).toBe(spec.castLevel);expect(payment.targetEntryId).toBe(spec.targetId);expect(payment.targetScope).toBe(spec.targetScope);expect(payment.sourceActionTiming).toBe(spec.sourceActionTiming);expect(payment.statistics).toEqual(spec.statistics);
  const cast=(spellActionRequest as any)(c,child.id,'item-charge','actual-item-paid-cast','cast',undefined,undefined,{confirmedCurrentItemCastValid:true});const result=performSpellAction(c,cast,authority);expect(result.status).toBe('applied');
  expect(c.runtime.itemChargeDebits?.version).toBe(1);expect(c.runtime.itemChargeDebits?.sequence).toBe(2);expect(c.runtime.itemChargeDebits!.records[0].spent).toBe(1);expect(c.runtime.itemChargeDebits!.records[0].events.at(-1)?.units).toBeUndefined();expect(c.runtime.resources[pool.key].current).toBe(spec.minAfter);expect(c.runtime.automationActions?.sequence).toBe(1);expect((result as any).receipt.itemChargedSpell.statistics).toEqual(spec.statistics);expect(Object.keys(c.runtime.resources).sort()).toEqual(resourceKeys);
  const paid=snapshot(c);expect(performSpellAction(c,cast,authority).status).toBe('duplicate');expect(snapshot(c)).toBe(paid);
  const exhausted=(spellActionRequest as any)(c,child.id,'item-charge','exhausted-item-cast','cast',undefined,undefined,{confirmedCurrentItemCastValid:true});expect(performSpellAction(c,exhausted,authority).status).toBe('rejected');expect(snapshot(c)).toBe(paid);
  sourceSpells.syncSourceSpells(c,entries);expect(c.runtime.resources[pool.key].current).toBe(spec.minAfter);expect(snapshot(c.runtime.itemChargeDebits!.records[0].events.slice(0,1))).toBe(originalEvents);
  expect(snapshot([c.notes,c.runtime.hp,c.runtime.resources.manual,c.runtime.resources['spell-slot:9'],c.runtime.resources[`innate-spell:${f.manual.id}`],f.manual,c.spellSettings!.special![f.manual.id],c.spellSettings!.prepared])).toBe(manual);
  expect(snapshot(readCharacter(exportCharacter(c)).character)).toBe(snapshot(c));expect(rule.wholeEntryCompletionCredit).toBe(0);
 });
}
