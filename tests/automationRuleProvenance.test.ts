import {describe,it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyCommittedRuleSnapshot} from '../tools/automationRuleProvenance';
import {RULE_AUTHORITY,RULE_STATUS_PATH,RULE_STATUS_LOCK,type SnapshotLock} from '../tools/automationRuleSnapshot';

function fixture(){
 const root=mkdtempSync(join(tmpdir(),'authored-source-')),bytes=Buffer.from('{"authored":"public status"}\n');
 const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git('init','-q');git('config','user.name','Authored verification');git('config','user.email','fixture@example.invalid');
 git('config','core.autocrlf','false');git('remote','add','origin',`https://github.com/${RULE_AUTHORITY}.git`);
 const path='reports/progress/automation-rule-status.json';mkdirSync(join(root,'reports/progress'),{recursive:true});writeFileSync(join(root,path),bytes);
 git('add','.');git('commit','-qm','Original public artifact');
 const lock:SnapshotLock={schemaVersion:1,repository:RULE_AUTHORITY,branch:'authored',revision:git('rev-parse','HEAD'),path,sha256:createHash('sha256').update(bytes).digest('hex'),sourceRevision:'a'.repeat(40),irSha256:'b'.repeat(64)};
 return {root,bytes,git,lock};
}
function check(run:(f:ReturnType<typeof fixture>)=>void){const f=fixture();try{run(f);}finally{rmSync(f.root,{recursive:true,force:true});}}
describe('export commit artifact provenance',()=>{
 it('verifies the exact committed bytes without claiming replay of an unavailable original review chain',()=>check(f=>{
  expect(verifyCommittedRuleSnapshot(f.root,f.lock,f.bytes)).toMatchObject({exportRevision:f.lock.revision,artifactSha256:f.lock.sha256,artifactBytes:f.bytes.length,scope:'export-commit-blob-only',originalReviewChain:'not-replayed',retrieval:'local-git'});
 }));
 it('ignores altered or CRLF converted checkout bytes and moving branch HEAD',()=>check(f=>{
  writeFileSync(join(f.root,f.lock.path),f.bytes.toString().replaceAll('\n','\r\n'));
  f.git('add','.');f.git('commit','-qm','Later checkout version');
  expect(verifyCommittedRuleSnapshot(f.root,f.lock,f.bytes).exportRevision).toBe(f.lock.revision);
 }));
 it('rejects rehashed replacement bytes absent from the locked commit',()=>check(f=>{
  const changed=Buffer.from('{"authored":"altered status"}\n');
  expect(()=>verifyCommittedRuleSnapshot(f.root,{...f.lock,sha256:createHash('sha256').update(changed).digest('hex')},changed)).toThrow('no matching committed blob');
 }));
 it('rejects an unavailable revision rather than silently falling back to HEAD',()=>check(f=>{
  expect(()=>verifyCommittedRuleSnapshot(f.root,{...f.lock,revision:'0'.repeat(40)},f.bytes)).toThrow('no matching committed blob');
 }));
 it('rejects an unrelated authority checkout even if its commit and bytes match',()=>check(f=>{
  f.git('remote','set-url','origin','https://github.com/authored/unrelated.git');
  expect(()=>verifyCommittedRuleSnapshot(f.root,f.lock,f.bytes)).toThrow('declared authority');
 }));
 it('rejects a forged hash or executable/symlink artifact',()=>check(f=>{
  expect(()=>verifyCommittedRuleSnapshot(f.root,{...f.lock,sha256:'0'.repeat(64)},f.bytes)).toThrow('version lock');
  f.git('update-index','--chmod=+x',f.lock.path);f.git('commit','-qm','Invalid mode');
  expect(()=>verifyCommittedRuleSnapshot(f.root,{...f.lock,revision:f.git('rev-parse','HEAD')},f.bytes)).toThrow('no matching committed blob');
 }));
 it('refuses an import before writing either generated destination when commit verification fails',()=>check(f=>{
  const root=process.cwd(),before=[RULE_STATUS_PATH,RULE_STATUS_LOCK].map(p=>readFileSync(join(root,p)));
  expect(()=>execFileSync(process.execPath,['tools/importAutomationRuleStatus.mjs','--input',RULE_STATUS_PATH,'--revision','0'.repeat(40),'--branch','authored','--data-repository',f.root],{cwd:root,stdio:['ignore','pipe','pipe']})).toThrow();
  [RULE_STATUS_PATH,RULE_STATUS_LOCK].forEach((p,i)=>expect(readFileSync(join(root,p)).equals(before[i])).toBe(true));
 }));
 it('reports missing remote verification and refuses import without changing either destination when fetch is unavailable',()=>check(f=>{
  const bin=join(f.root,'bin');mkdirSync(bin);const git=join(bin,'git');
  writeFileSync(git,'#!/bin/sh\ncase "$1" in\ninit|remote) exit 0;;\nfetch) echo "Authored unavailable network" >&2; exit 128;;\nesac\nexit 128\n');chmodSync(git,0o755);
  const root=process.cwd(),before=[RULE_STATUS_PATH,RULE_STATUS_LOCK].map(p=>readFileSync(join(root,p)));
  const result=spawnSync(process.execPath,['tools/importAutomationRuleStatus.mjs','--input',RULE_STATUS_PATH,'--revision',f.lock.revision,'--branch','authored'],{cwd:root,env:{...process.env,PATH:bin},encoding:'utf8'});
  expect(result.status).not.toBe(0);expect(result.stderr).toContain('verification is missing');
  [RULE_STATUS_PATH,RULE_STATUS_LOCK].forEach((p,i)=>expect(readFileSync(join(root,p)).equals(before[i])).toBe(true));
 }));
});
