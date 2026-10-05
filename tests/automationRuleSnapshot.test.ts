import {describe,it,expect} from 'vitest';
import {readFileSync,mkdtempSync,cpSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {generateProgress,progressInputs,VERIFICATION_PATH,VERIFICATION_SCHEMA} from '../tools/automationProgress';
import {RULE_STATUS_PATH,RULE_STATUS_LOCK,validateRuleSnapshot,validateSnapshotLock} from '../tools/automationRuleSnapshot';
import {sourceRuleCounts,validProgress,PROGRESS_LIMIT} from '../src/platform/automationProgress';
const root=process.cwd(),bytes=readFileSync(join(root,RULE_STATUS_PATH)),snapshot=validateRuleSnapshot(JSON.parse(bytes.toString())),lock=JSON.parse(readFileSync(join(root,RULE_STATUS_LOCK),'utf8'));
describe('source-bound public rule snapshots',()=>{
 it('preserves acquired identities, unreviewed rows, partial boundaries and historical evidence without raw prose',()=>{
  expect(snapshot.records).toHaveLength(18789);expect(snapshot.records.filter(r=>r.reviewed)).toHaveLength(4561);expect(snapshot.records.filter(r=>r.complete)).toHaveLength(162);
  expect(snapshot.records.filter(r=>r.identity.edition===null)).toHaveLength(3754);
  expect(new Set(snapshot.records.map(r=>r.id)).size).toBe(snapshot.records.length);
  const kit=snapshot.records.find(r=>r.identity.engName==='Community Almanac'&&r.source==='CROOKEDMOON24')!;
  expect(kit).toMatchObject({reviewed:true,complete:false,verdict:'unsupported',boundary:'partial-payload',tests:[]});expect(kit.identity).toMatchObject({classSource:'XPHB',classEngName:'Cleric',subclassEngShortName:'Harvest Domain',level:3});expect(kit.payloadFamilies).toContain('grants');expect(kit.gapFamilies).toContain('ownership-training');expect(kit.validationRefs).toHaveLength(1);
  const historical=snapshot.validations[kit.validationRefs[0]];expect(historical.scope).toBe('historical-local-snapshot');expect(historical.completeAppCases).toBe(6);expect(historical.consumerCodeCommit).not.toBe(generateProgress(root,'standalone').build.sourceCommit);
  expect(bytes.toString()).not.toMatch(/"(?:entries|raw|notes|reviewer|characters?|credentials|mechanics)"\s*:/);
 });
 it('recalculates the actual acquired matrix but never promotes local complete flags or historical App tests',()=>{
  const m=generateProgress(root,'standalone');expect(validProgress(m)).toBe(true);expect(m.audit.counts).toEqual({total:18789,reviewed:4561,implementedVerified:0});
  expect(m.audit.snapshot).toMatchObject({localMarkedComplete:162,noMechanics:274,acceptedIncomplete:4125,unreviewed:14228,partialPayloadRecords:3800,historicalEvidenceRecords:41,sourceCount:145,reviewBatchCount:161,byOrigin:{official:{total:13266,reviewed:4221,localMarkedComplete:137},'third-party':{total:5523,reviewed:340,localMarkedComplete:25}}});
  const cm=snapshot.records.filter(r=>r.source==='CROOKEDMOON24');expect(sourceRuleCounts(m,'CROOKEDMOON24','all')).toEqual({total:cm.length,reviewed:cm.filter(r=>r.reviewed).length,implementedVerified:0});
  expect(m.missingEvidence).toContain('与当前角色卡提交绑定的逐条整条验证');expect(m.missingEvidence).toContain('逐条规则的当前发布加载及验证证明');
  expect(Buffer.byteLength(JSON.stringify(m))).toBeLessThan(PROGRESS_LIMIT);expect(JSON.stringify(m)).not.toMatch(/"(?:identity|payloadFamilies|gapCodes|records|reviews|validations|tests)"\s*:/);
 });
 it('binds all public bytes and authority revisions rather than trusting a summary alone',()=>{
  expect(validateSnapshotLock(lock,bytes,snapshot).revision).toBe(lock.revision);
  expect(()=>validateSnapshotLock({...lock,sha256:'0'.repeat(64)},bytes,snapshot)).toThrow('version lock');
  expect(()=>validateSnapshotLock({...lock,sourceRevision:'0'.repeat(40)},bytes,snapshot)).toThrow('version lock');
  expect(()=>validateSnapshotLock(lock,Buffer.concat([bytes,Buffer.from('\n')]),snapshot)).toThrow('version lock');
 });
 it.each(['raw','entries','character','notes','credentials'])('rejects private/unexpected fields at every nested level: %s',field=>{
  for(const mutate of [(s:any)=>{s[field]='private';},(s:any)=>{s.records[0][field]='private';},(s:any)=>{s.records[0].identity[field]='private';},(s:any)=>{Object.values(s.validations)[0]![field as never]='private' as never;}]){
   const v=structuredClone(snapshot);mutate(v);expect(()=>validateRuleSnapshot(v)).toThrow('non-public');
  }
 });
 it('rejects duplicated identities, fabricated current tests, broken partial boundaries and missing validation references',()=>{
  const duplicate=structuredClone(snapshot);duplicate.records.push(duplicate.records[0]);expect(()=>validateRuleSnapshot(duplicate)).toThrow('identity/source/category');
  const tests=structuredClone(snapshot);(tests.records[0].tests as string[]).push('tests/core.test.ts');expect(()=>validateRuleSnapshot(tests)).toThrow('current implementation proof');
  const boundary=structuredClone(snapshot);boundary.records[0].boundary='local-complete';expect(()=>validateRuleSnapshot(boundary)).toThrow('boundary association');
  const proof=structuredClone(snapshot);proof.records[0].validationRefs=['0'.repeat(64)];expect(()=>validateRuleSnapshot(proof)).toThrow('validation association');
 });
 it('rejects a forged or current-scope historical receipt',()=>{
  const v=structuredClone(snapshot),proof=Object.values(v.validations)[0];proof.scope='current-production';expect(()=>validateRuleSnapshot(v)).toThrow('historical validation');
 });
 it('invalidates mechanism verification when only the external version lock changes',()=>{
  const temp=mkdtempSync(join(tmpdir(),'progress-external-lock-'));try{
   for(const p of ['src','tests','tools','prototype','.github','docs/data']){mkdirSync(join(temp,p.split('/')[0]),{recursive:true});cpSync(join(root,p),join(temp,p),{recursive:true});}
   for(const p of ['package.json','package-lock.json','index.html'])cpSync(join(root,p),join(temp,p));
   const before=progressInputs(temp).fingerprint;
   const revised={...lock,revision:'0'.repeat(40)};writeFileSync(join(temp,RULE_STATUS_LOCK),JSON.stringify(revised));
   expect(progressInputs(temp).fingerprint).not.toBe(before);
  }finally{rmSync(temp,{recursive:true,force:true});}
 });
});
