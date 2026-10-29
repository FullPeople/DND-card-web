import {beforeAll,it,expect} from 'vitest';
import evidence from '../src/core/automation/attunedItemChargeDebitEvidence.json';
import {attunedItemChargeEntries,attunedItemChargeFixtureForId,attunedItemChargeSnapshot as snapshot} from './helpers/attunedItemChargeDebitFixture';
import {itemChargeRule,itemChargeOffers,itemChargeRequest,performItemChargeAction} from '../src/core/automation/itemChargeDebits';
import {readCharacter} from '../src/core/validation';
import {restResources} from '../src/core/automation/featureResources';
beforeAll(()=>{attunedItemChargeEntries();});
for(const rule of evidence.rules)it(`actual attuned ${rule.supported?'fixed1 route':'source hold'} ${rule.id}`,()=>{
 const f=attunedItemChargeFixtureForId(rule.id);f.owner.equipped=true;f.owner.attuned=true;expect(itemChargeRule(f.entry)?.id).toBe(rule.id);const offer=itemChargeOffers(f.c)[0];expect(offer.canAcquire).toBe(rule.supported);
 const before=snapshot(f.c),initial=1+(rule.action?.minAfter||0),q=itemChargeRequest(f.c,f.owner.id,'acquire',{kind:'acquire',knownRemaining:initial,confirmedGenuineItem:true,confirmedKnownBalance:true});
 if(!rule.supported){expect(performItemChargeAction(f.c,q).status).toBe('rejected');expect(snapshot(f.c)).toBe(before);return;}
 expect(offer.requiresAttunement).toBe(true);expect(performItemChargeAction(f.c,q).status).toBe('applied');const spend=itemChargeRequest(f.c,f.owner.id,'fixed1',{kind:'debit',actionKey:offer.actionKey!});expect(performItemChargeAction(f.c,spend).status).toBe('applied');expect(performItemChargeAction(f.c,spend).status).toBe('duplicate');expect(f.c.runtime.resources[offer.key].current).toBe(rule.action!.minAfter);
 const boundary=snapshot(f.c);expect(performItemChargeAction(f.c,itemChargeRequest(f.c,f.owner.id,'boundary',{kind:'debit',actionKey:offer.actionKey!})).status).toBe('rejected');expect(snapshot(f.c)).toBe(boundary);restResources(f.c,'long');expect(f.c.runtime.resources[offer.key].current).toBe(rule.action!.minAfter);expect(readCharacter(JSON.parse(JSON.stringify(f.c))).character.runtime.itemChargeDebits).toEqual(f.c.runtime.itemChargeDebits);expect(f.c.runtime.itemChargeDebits?.sequence).toBe(2);expect(f.c.runtime.resources.manual.current).toBe(2);expect(f.c.runtime.hp).toBe(7);expect(f.c.selections).toHaveLength(1);
});
