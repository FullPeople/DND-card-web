import {afterAll,beforeAll,expect,it} from 'vitest';
import {itemChargeOffers,itemChargeRequest,performItemChargeAction} from '../src/core/automation/itemChargeDebits';
import {setChargedItemSpellIntent,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {spellPayments,spellActionRequest,performSpellAction} from '../src/core/automation/actions';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {chargedItemSpellSpecs,chargedItemSpellSnapshot as snapshot} from './helpers/chargedItemSpellSourceFixture';
import {chargedItemSpellFixture} from './helpers/chargedItemSpellFlowFixture';
import {loadChargedItemSpellOldReader,disposeChargedItemSpellOldReader} from './helpers/chargedItemSpellOldReader';

const authority={canEdit:true,gm:false},optionalSnapshot=(value:unknown)=>snapshot([value]);let old:any;
beforeAll(async()=>{old=await loadChargedItemSpellOldReader();});
afterAll(()=>disposeChargedItemSpellOldReader());
for(const spec of chargedItemSpellSpecs)it(`actual 406 cannot pay or cast new charged carrier ${spec.ownerId}`,()=>{
 const f=chargedItemSpellFixture(spec.ownerId),pool=itemChargeOffers(f.c,authority).find(row=>row.ownerId===f.owner.id)!;
 expect(performItemChargeAction(f.c,itemChargeRequest(f.c,f.owner.id,'known-old-proof',{kind:'acquire',knownRemaining:1+spec.minAfter,confirmedGenuineItem:true,confirmedKnownBalance:true}),authority).status).toBe('applied');
 setChargedItemSpellIntent(f.c,f.owner.id,{confirmedGenuineOwnedItem:true},f.entries,authority);syncSourceSpells(f.c,f.entries);
 const children=f.c.selections.filter(row=>row.parentId===f.owner.id&&row.grantKey?.startsWith('source-spell:item-charged/'));expect(children).toHaveLength(1);const child=children[0];
 const beforeCast=structuredClone(f.c),request=(spellActionRequest as any)(f.c,child.id,'item-charge','paid-for-old-reader','cast',undefined,undefined,{confirmedCurrentItemCastValid:true});
 expect(performSpellAction(f.c,request,authority).status).toBe('applied');expect(f.c.runtime.resources[pool.key].current).toBe(spec.minAfter);expect(f.c.runtime.itemChargeDebits?.version).toBe(1);
 for(const current of [beforeCast,f.c]){
  const card=old.readCharacter(JSON.parse(JSON.stringify(exportCharacter(current)))).character,whole=snapshot(card),ledger=snapshot(current.runtime.itemChargeDebits),resources=snapshot(current.runtime.resources),marker=snapshot((current.spellSettings!.special![child.id].sourceGrant as any).itemChargedSpell);
  expect(snapshot(card.runtime.itemChargeDebits)).toBe(ledger);expect(snapshot(card.runtime.resources)).toBe(resources);expect(optionalSnapshot(card.runtime.automationActions)).toBe(optionalSnapshot(current.runtime.automationActions));
  expect(snapshot(card.automation?.chargedItemSpells)).toBe(snapshot(current.automation?.chargedItemSpells));expect(snapshot(card.spellSettings.special[child.id].sourceGrant.itemChargedSpell)).toBe(marker);
  const enabled=old.sourceSpellEnabled(card,child.id);expect(typeof enabled).toBe('boolean');expect(snapshot(card)).toBe(whole);
  expect(old.spellPayments(card,child.id,authority).options).toHaveLength(0);expect(snapshot(card)).toBe(whole);
  for(const payment of ['free','source','resource','check','slot:spell-slot:9','ordinary:spell-slot:9','item-charge']){
   const attempt=old.spellActionRequest(card,child.id,payment,'old-denied-'+payment,'cast');expect(old.performSpellAction(card,attempt,authority).status).toBe('rejected');expect(snapshot(card)).toBe(whole);
  }
  for(const payment of ['source','item-charge']){
   const restore=old.spellActionRequest(card,child.id,payment,'old-restore-denied-'+payment,'restore');expect(old.performSpellAction(card,restore,authority).status).toBe('rejected');expect(snapshot(card)).toBe(whole);
  }
  const back=readCharacter(JSON.parse(JSON.stringify(old.exportCharacter(card)))).character;
  expect(snapshot(back.runtime.itemChargeDebits)).toBe(ledger);expect(snapshot(back.runtime.resources)).toBe(resources);expect(snapshot(back.automation?.chargedItemSpells)).toBe(snapshot(current.automation?.chargedItemSpells));expect(optionalSnapshot(back.runtime.automationActions)).toBe(optionalSnapshot(current.runtime.automationActions));
  expect(back.runtime.resources[pool.key].current).toBe(current.runtime.resources[pool.key].current);expect(spellPayments(back,child.id,authority).options.map(row=>row.id)).toEqual(['item-charge']);
  expect(spellPayments(back,child.id,authority).options[0].available).toBe(current===beforeCast);
 }
});
