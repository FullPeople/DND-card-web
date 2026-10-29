import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import evidence from '../src/core/automation/nonunitItemChargeEvidence.json' with {type:'json'};
import prior from '../src/core/automation/attunedItemChargeDebitEvidence.json' with {type:'json'};
import forms from '../src/core/automation/itemChargeCatalogFormsEvidence.json' with {type:'json'};
import {itemChargeRule} from '../src/core/automation/itemChargeDebitSource';
import {sourceTextSha256} from '../src/core/automation/sourceTextSha256';
import {nonunitItemChargeInputPins,nonunitItemChargeEntries,nonunitItemChargeFind,nonunitItemChargeSnapshot} from './helpers/nonunitItemChargeSourceFixture';

// Closed reviewed technical policy, independent of the new evidence import.
// Names/identity/hash/context codes only: no original entries or rule prose.
const expectedPolicies=[{"id":"kiwee:item:tce:baba%20yaga's%20pestle::::::","policySha256":"d33e07c1288e3372ab6e775790aa8ffc996e6ecdf8624b2defa9e0e87349e1f2"},{"id":"kiwee:item:toa:devlin's%20staff%20of%20striking::::::","policySha256":"72800688c2dc14e4b485ff868f9b8a0a8533723e635d3c5c9072334fc08b7363"},{"id":"kiwee:item:dmg:ring%20of%20the%20ram::::::","policySha256":"618cebf40c41a203a72c47127788e8cd7a5ad1a2b406ee12a98228b97f6a586d"},{"id":"kiwee:item:xdmg:ring%20of%20the%20ram::::::","policySha256":"290a3da1c626fe7b3e1092849dd8ce8ac6a742be60bf75e98972e280f734273f"},{"id":"kiwee:item:dmg:staff%20of%20striking::::::","policySha256":"e010c5da923ffa38f94ce22b47d599694330e1bdf4908e3bc4d717037ddbc1b5"},{"id":"kiwee:item:xdmg:staff%20of%20striking::::::","policySha256":"6543214a6f103a2cae5f4cde6821924239b8eab896400e650dfd0207ffbbd6d9"},{"id":"kiwee-homebrew:item:sterlingvermin:club%20of%20unconsciousness::::::","policySha256":"2c7a2f573dae06f8b962b3c91d858e710759f54bd0908a2d9e7f0bc7475a0d46"},{"id":"kiwee-homebrew:item:taldoreicampaignsettingreborn:cabal's%20ruin%20(awakened)::::::","policySha256":"b1b03213edf6444b5f7b1b6caa87309fe94b0d5c8d15cb5ebc888ddbbb365df1"},{"id":"kiwee-homebrew:item:taldoreicampaignsettingreborn:cabal's%20ruin%20(dormant)::::::","policySha256":"1351a60de29af89ae3872a57f42b4a0344b3049bb1cd5b34efaa5ee25c1b4dff"},{"id":"kiwee-homebrew:item:taldoreicampaignsettingreborn:cabal's%20ruin%20(exalted)::::::","policySha256":"4e2a53a62a1506cb5b4a306c4b252bec13d8b0fcaa86ef0533739fb59914ce68"},{"id":"kiwee-homebrew:item:griffonssaddlebag2:helm%20of%20the%20justicars::::::","policySha256":"c5b9b3e28724389554fd624a6b750ddb7b49cd5e5f25b7aed1d50e1f71e63373"},{"id":"kiwee-homebrew:item:griffonssaddlebag2:mageplate%20ring::::::","policySha256":"bf7dcb43e5d7ff65a559bfff3b3fd42d7961295391ca6e673478fe1b847f45d5"},{"id":"kiwee-homebrew:item:griffonssaddlebag2:phoenix%20rocket%20sword::::::","policySha256":"ac911dfc4408a8d9051735b8eb49c5f5b5e04c2cd9f4d6a3fa5d8e6ce5c7ad02"},{"id":"kiwee-homebrew:item:griffonssaddlebag2:wraps%20of%20the%20restless::::::","policySha256":"a2f9a9b926f8dacdf48e356f057333262d6c4a25d46a60782de5e53cd88ea607"},{"id":"kiwee-homebrew:item:humblewoodtales:fangs%20of%20guile::::::","policySha256":"df2c7289e9050286b6d15914101695972f8d4afc2964f3f5b0a2bac8c1387176"},{"id":"kiwee-homebrew:item:humblewoodtales:ring%20of%20the%20sky%20hunter::::::","policySha256":"ae742bce815392883e6ffa1c72070692f4a47c5c151f3080ed5c9fb5d8c621d9"}];
const expectedHolds=[{"id":"kiwee:item:dmg:pipes%20of%20the%20sewers::::::","holdReason":"wind-proficiency-playing-and-dm-availability-not-admitted"},{"id":"kiwee:item:xdmg:pipes%20of%20the%20sewers::::::","holdReason":"playing-and-dm-availability-not-admitted"},{"id":"kiwee:item:oota:stonespeaker%20crystal::::::","holdReason":"spellcasting-and-material-substitution-not-admitted"}];
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
const header=(entry:any)=>Object.fromEntries(['id','kind','name','english','source','edition','packId','page'].map(key=>[key,key==='page'?(entry[key]??null):entry[key]]));
const at=(entry:any,path:string)=>path.replace(/\[(\d+)\]/g,'.$1').split('.').reduce((value,key)=>value?.[key],entry);
const canonicalRows=()=>[...evidence.owners,...evidence.holds];

it('closes exactly seven pinned inputs, sixteen owners, nineteen branches and three non-bypassable held identities',()=>{
 expect(Object.keys(evidence).sort()).toEqual(['schemaVersion','inputs','owners','holds'].sort());expect(evidence.schemaVersion).toBe(1);
 expect(evidence.inputs).toEqual(nonunitItemChargeInputPins);expect(evidence.inputs).toHaveLength(7);expect(evidence.inputs.reduce((n,row)=>n+row.bytes,0)).toBe(7864110);
 expect(evidence.owners).toHaveLength(16);expect(evidence.owners.reduce((n,row)=>n+row.branches.length,0)).toBe(19);expect(evidence.holds).toHaveLength(3);
 expect(evidence.owners.map(row=>row.id).sort()).toEqual(expectedPolicies.map(row=>row.id).sort());expect(evidence.holds.map(row=>({id:row.id,holdReason:row.holdReason}))).toEqual(expectedHolds);
 const rows=canonicalRows(),ids=rows.map(row=>row.id);expect(new Set(ids).size).toBe(19);expect(nonunitItemChargeEntries().map(row=>row.id).sort()).toEqual(ids.slice().sort());
 expect(nonunitItemChargeEntries('merged').map(row=>row.id).sort()).toEqual(ids.slice().sort());
});
it('reconstructs all nineteen exact original owners and actual merged forms under unchanged complete-source guard proofs',()=>{
 for(const record of canonicalRows()){
  const old=prior.rules.find(row=>row.id===record.id)!;expect(old!==undefined).toBe(true);
  for(const key of ['id','kind','name','english','source','edition','packId','revision','page','sourceDataId','input','fullNormalizedSnapshotSha256','normalizedRawSha256','normalizedEntriesSha256','capacity','requiresAttunement'] as const)expect(record[key]).toEqual(old[key]);
  const canonical=nonunitItemChargeFind(record.id);expect(header(canonical)).toEqual(header(record));expect(canonical.revision).toBe(record.revision);expect(nonunitItemChargeSnapshot(canonical)).toBe(record.fullNormalizedSnapshotSha256);
  expect(nonunitItemChargeSnapshot(canonical.raw)).toBe(record.normalizedRawSha256);expect(nonunitItemChargeSnapshot(canonical.entries)).toBe(record.normalizedEntriesSha256);
  expect(evidence.inputs.some(pin=>pin.url===record.input.url&&pin.sha256===record.input.sha256)).toBe(true);
  for(const form of ['canonical','merged'] as const){
   const entry=nonunitItemChargeFind(record.id,form),normalized={...entry,id:old.id,revision:old.revision},snapshot=nonunitItemChargeSnapshot(normalized),compatible=forms.rules.find(row=>row.id===record.id);
   expect(header(entry)).toEqual(header(record));expect(itemChargeRule(entry)?.id).toBe(record.id);expect(itemChargeRule(entry)?.fullNormalizedSnapshotSha256).toBe(old.fullNormalizedSnapshotSha256);
   if(compatible)expect(compatible.canonicalProofAnchorSha256).toBe(old.fullNormalizedSnapshotSha256);
   expect([old.fullNormalizedSnapshotSha256,...(compatible?.compatibleFullSnapshotForms.map(row=>row.sha256)||[])]).toContain(snapshot);
   const matching=compatible?.compatibleFullSnapshotForms.find(row=>row.sha256===snapshot) as {rawSha256?:string;entriesSha256?:string}|undefined;
   expect(nonunitItemChargeSnapshot(entry.raw)).toBe(matching?.rawSha256||old.normalizedRawSha256);expect(nonunitItemChargeSnapshot(entry.entries)).toBe(matching?.entriesSha256||old.normalizedEntriesSha256);
   expect(entry.raw.charges).toBe(record.capacity);expect(entry.raw.reqAttune).toBe(true);expect(entry.raw._copy!==undefined||entry.raw._unresolvedParent!==undefined||entry.raw._variantIdentity!==undefined).toBe(false);
   for(const clause of old.clauses)expect(nonunitItemChargeSnapshot(at(entry,clause.path))).toBe(clause.sha256);
  }
 }
});
it('binds every reviewed positive cost, minimum balance, exact contextual attestation and source clause without granting effects or activation',()=>{
 for(const owner of evidence.owners){
  const expected=expectedPolicies.find(row=>row.id===owner.id)!;expect(owner.policySha256).toBe(expected.policySha256);
  expect(new Set(owner.branches.map(branch=>branch.key)).size).toBe(owner.branches.length);
  expect(owner.manualBoundaries).toContain('no-activation-permission');expect(owner.manualBoundaries).toContain('no-stage-transition');expect(owner.manualBoundaries).toContain('no-recovery');expect(owner.manualBoundaries).toContain('source-enumerated-positive-fee-accounting-only');expect(owner.manualBoundaries).not.toContain('only-named-fixed-one-charge-bookkeeping-branch');
  const {policySha256,...policy}=owner;expect(sourceTextSha256(JSON.stringify(sorted(policy)))).toBe(policySha256);
  for(const branch of owner.branches){
   expect(new Set(branch.allowedCosts).size).toBe(branch.allowedCosts.length);expect(branch.allowedCosts.every(cost=>Number.isSafeInteger(cost)&&cost>0&&cost<=owner.capacity)).toBe(true);expect([0,1]).toContain(branch.minAfter);
   expect(branch.requiredContext).toContain('accounting-only');expect(new Set(branch.requiredContext).size).toBe(branch.requiredContext.length);expect(branch.clauses.length).toBeGreaterThan(0);
   for(const form of ['canonical','merged'] as const)for(const clause of branch.clauses)expect(nonunitItemChargeSnapshot(at(nonunitItemChargeFind(owner.id,form),clause.path))).toBe(clause.sha256);
  }
 }
 for(const held of evidence.holds)expect(evidence.owners.some(owner=>owner.id===held.id)).toBe(false);
});
it('keeps whole-entry fingerprints sensitive to arbitrary additions and the pure fixture free of actor/state/new-evidence cycles or public source bodies',()=>{
 const entry=nonunitItemChargeEntries()[0],before=nonunitItemChargeSnapshot(entry),changed=structuredClone(entry);(changed as any).authoredUnexpectedSourceField=true;expect(nonunitItemChargeSnapshot(changed)).not.toBe(before);
 const fixture=readFileSync('tests/helpers/nonunitItemChargeSourceFixture.ts','utf8'),imports=fixture.split('\n').filter(line=>line.startsWith('import '));expect(imports).toHaveLength(5);expect(imports.filter(line=>line.includes('model')).every(line=>line.startsWith('import type '))).toBe(true);expect(imports.some(line=>/engine|automation\/state|nonunitItemChargeEvidence|Fixture/.test(line))).toBe(false);
 const forbidden=new Set(['raw','entries','body','text','character','cards','policyText']);let bad=0;const walk=(value:unknown)=>{if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){if(forbidden.has(key))bad++;walk(child);}};walk(evidence);expect(bad).toBe(0);expect(/\/workspace\/|\.local-evidence|\.private\.json/.test(JSON.stringify(evidence))).toBe(false);
});
