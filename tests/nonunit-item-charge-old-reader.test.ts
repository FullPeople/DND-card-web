import {afterAll,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import evidence from '../src/core/automation/nonunitItemChargeEvidence.json';
import {itemChargeOffers,itemChargeRequest,performItemChargeAction} from '../src/core/automation/itemChargeDebits';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {nonunitItemChargeFixture} from './helpers/nonunitItemChargeFlowFixture';
import {nonunitItemChargeSnapshot as snapshot} from './helpers/nonunitItemChargeSourceFixture';
import {nonunitReaderDependenciesMatch,loadNonunitOldReader,verifyNonunitOldReaderRoot} from './helpers/nonunitItemChargeOldReader';

it('retains the exact old reader lock and accepts only release metadata differences in current dependency verification',()=>{
 const root=verifyNonunitOldReaderRoot(),old=readFileSync(root+'/package-lock.json'),current=readFileSync(new URL('../package-lock.json',import.meta.url));
 expect(nonunitReaderDependenciesMatch(old,current)).toBe(true);
 const changed=JSON.parse(current.toString()),name=Object.keys(changed.packages).find(key=>key&&changed.packages[key].integrity)!;
 changed.packages[name].integrity='sha512-authored-tamper';expect(nonunitReaderDependenciesMatch(old,Buffer.from(JSON.stringify(changed)))).toBe(false);
 const moved=JSON.parse(current.toString());moved.packages[name].version='0.0.0-authored-tamper';expect(nonunitReaderDependenciesMatch(old,Buffer.from(JSON.stringify(moved)))).toBe(false);
});
afterAll(()=>{verifyNonunitOldReaderRoot();});
it('actual immutable 406 native reader preserves v2 opaquely, rejects old edits, and returns unchanged units to current reader',async()=>{
 const old=await loadNonunitOldReader(),p=evidence.owners[0],b=p.branches[0],f=nonunitItemChargeFixture(p.id),authority={canEdit:true,gm:false};
 expect(performItemChargeAction(f.c,itemChargeRequest(f.c,f.owner.id,'known-v1',{kind:'acquire',knownRemaining:4,confirmedGenuineItem:true,confirmedKnownBalance:true}),authority).status).toBe('applied');
 expect(performItemChargeAction(f.c,itemChargeRequest(f.c,f.owner.id,'first-v2',{kind:'variable-debit',branchKey:b.key,cost:2,context:Object.fromEntries(b.requiredContext.map(key=>[key,true]))}),authority).status).toBe('applied');
 const ledger=snapshot(f.c.runtime.itemChargeDebits),resources=snapshot(f.c.runtime.resources),card=old.readCharacter(JSON.parse(JSON.stringify(exportCharacter(f.c)))).character,whole=snapshot(card);
 expect(snapshot(card.runtime.itemChargeDebits)).toBe(ledger);expect(snapshot(card.runtime.resources)).toBe(resources);expect(old.itemChargeOffers(card,authority).every((row:any)=>!row.canAcquire&&!row.canDebit&&!row.canWithdraw)).toBe(true);expect(snapshot(card)).toBe(whole);
 for(const intent of [{kind:'acquire',knownRemaining:4,confirmedGenuineItem:true,confirmedKnownBalance:true},{kind:'debit',actionKey:b.key},{kind:'withdraw'}]){expect(old.performItemChargeAction(card,old.itemChargeRequest(card,f.owner.id,'old-not-authorized',intent),authority).status).toBe('rejected');expect(snapshot(card)).toBe(whole);}
 const key=itemChargeOffers(f.c,authority)[0].key,edited=structuredClone(card);edited.runtime.resources[key].current++;expect(()=>old.assertItemChargeResourcesPreserved(card,edited)).toThrow();expect(snapshot(card)).toBe(whole);
 const back=readCharacter(JSON.parse(JSON.stringify(old.exportCharacter(card)))).character;expect(snapshot(back.runtime.itemChargeDebits)).toBe(ledger);expect(snapshot(back.runtime.resources)).toBe(resources);expect(itemChargeOffers(back,authority)[0].remaining).toBe(2);expect(itemChargeOffers(back,authority)[0].variableActions![0].canDebit).toBe(true);
});
