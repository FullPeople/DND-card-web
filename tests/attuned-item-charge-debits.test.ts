import {it,expect} from 'vitest';
import {itemChargeFixture,itemChargeSnapshot} from './helpers/itemChargeDebitFixture';
import {itemChargeOffers,itemChargeRequest,performItemChargeAction} from '../src/core/automation/itemChargeDebits';
import {readCharacter} from '../src/core/validation';
import type {Selection} from '../src/core/model';
for(const english of ['Wand of Enemy Detection','Wand of Fear'])it(`actual ${english} requires live equipped+attuned ownership before fixed1 known2 to1 accounting`,()=>{
 const f=itemChargeFixture(english,'DMG'),owner=f.owner as Selection;owner.equipped=true;owner.attuned=false;
 let offer=itemChargeOffers(f.c).find(o=>o.ownerId===owner.id);expect(offer,'real authenticated attuned item must have an explicit held offer').toBeDefined();expect(offer!.canAcquire).toBe(false);expect(offer!.remaining).toBeUndefined();
 owner.attuned=true;offer=itemChargeOffers(f.c).find(o=>o.ownerId===owner.id)!;expect(offer.canAcquire).toBe(true);expect(offer.minAfter).toBe(1);
 const acquire=itemChargeRequest(f.c,owner.id,'known2',{kind:'acquire',knownRemaining:2,confirmedGenuineItem:true,confirmedKnownBalance:true});expect(performItemChargeAction(f.c,acquire).status).toBe('applied');
 const debit=itemChargeRequest(f.c,owner.id,'fixed1',{kind:'debit',actionKey:offer.actionKey!});expect(performItemChargeAction(f.c,debit).status).toBe('applied');expect(performItemChargeAction(f.c,debit).status).toBe('duplicate');expect(f.c.runtime.resources[offer.key].current).toBe(1);
 const boundary=itemChargeSnapshot(f.c);expect(performItemChargeAction(f.c,itemChargeRequest(f.c,owner.id,'last-held',{kind:'debit',actionKey:offer.actionKey!})).status).toBe('rejected');expect(itemChargeSnapshot(f.c)).toBe(boundary);
 const reopened=readCharacter(JSON.parse(JSON.stringify(f.c))).character;expect(reopened.runtime.itemChargeDebits).toEqual(f.c.runtime.itemChargeDebits);expect(reopened.runtime.resources.manual.current).toBe(2);expect(reopened.runtime.hp).toBe(7);expect(reopened.notes).toBe('Authored item charge sentinel');
});
