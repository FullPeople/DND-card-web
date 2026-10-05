import {describe,it,expect} from 'vitest';
import {mkdtempSync,cpSync,mkdirSync,writeFileSync,rmSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {generateProgress,progressInputs,verificationFiles,VERIFICATION_PATH,VERIFICATION_SCHEMA} from '../tools/automationProgress';
import {filterProgress,sourceRuleCounts,publicationFor,validProgress,loadProgress,PROGRESS_LIMIT} from '../src/platform/automationProgress';
const root=process.cwd();
const manifest=()=>generateProgress(root,'standalone');
function fixture(){const path=mkdtempSync(join(tmpdir(),'automation-progress-'));for(const p of ['src','tools','tests','prototype','docs/data','.github/workflows'])cpSync(join(root,p),join(path,p),{recursive:true});for(const p of readdirSync(root))if(/\.config\.[cm]?[jt]s$/.test(p)||/^tsconfig.*\.json$/.test(p)||['package.json','package-lock.json','index.html','.npmrc','.nvmrc','.node-version'].includes(p))cpSync(join(root,p),join(path,p));writeFileSync(join(path,'.git'),'gitdir: '+execFileSync('git',['rev-parse','--absolute-git-dir'],{cwd:root,encoding:'utf8'}));return path;}
function receipt(path:string,files=progressInputs(path).tests,completePassedFiles=files){mkdirSync(join(path,'.local-evidence/automation-progress'),{recursive:true});writeFileSync(join(path,VERIFICATION_PATH),JSON.stringify({schemaVersion:VERIFICATION_SCHEMA,fingerprint:progressInputs(path).fingerprint,success:true,testedAt:'2026-10-05T00:00:00Z',scope:'authored-unit-fixtures',passedFiles:files,completePassedFiles}));}
function verified(m=manifest()){for(const c of m.capabilities)c.verified=c.reviewed;return m;}
function proof(m=verified()){
 const identity={sourceCommit:m.build.sourceCommit,fingerprint:m.build.fingerprint,manifestSha256:'a'.repeat(64),mode:m.build.mode};
 const release={version:'standalone-1.0.999',sourceCommit:identity.sourceCommit,automationProgress:{schemaVersion:1,channel:'standalone',version:'standalone-1.0.999',sourceCommit:identity.sourceCommit,fingerprint:identity.fingerprint,manifestSha256:identity.manifestSha256,loadedAndVerified:true,verifiedAt:'2026-10-05T00:00:00Z',capabilityIds:['armor'],ruleAuditVerified:false}};
 return {m,identity,release};
}
describe('automation progress evidence boundary',()=>{
 it('generates allowlisted compact data with unknown counts when actual rule evidence is missing',()=>{
  const m=manifest();expect(validProgress(m)).toBe(true);expect(m.audit.counts).toBeNull();expect(m.missingEvidence).toContain('docs/AUTOMATION-IR-WRAPUP-4561-20261005.md');expect(m.missingEvidence).toContain('docs/data/automation-rule-status.json');expect(Buffer.byteLength(JSON.stringify(m))).toBeLessThan(PROGRESS_LIMIT);
  expect(JSON.stringify(m)).not.toMatch(/18789|4561[^-]|24\.3%|0\.86%|"entries"|"raw"|"characters"|"modules"|"tests"/);
 });
 it('unverified or stale receipts cannot mark implemented mechanics as verified',()=>{
  const path=fixture();try{receipt(path);const value=JSON.parse(readFileSync(join(path,VERIFICATION_PATH),'utf8'));writeFileSync(join(path,VERIFICATION_PATH),JSON.stringify({...value,fingerprint:'stale'}));expect(generateProgress(path,'standalone').capabilities.every(c=>!c.verified)).toBe(true);
  receipt(path);expect(generateProgress(path,'standalone').capabilities.filter(c=>c.verified&&c.playerAvailable)).toHaveLength(9);
  writeFileSync(join(path,'src/core/automation/state.ts'),readFileSync(join(path,'src/core/automation/state.ts'),'utf8')+'\n// changed\n');expect(generateProgress(path,'standalone').capabilities.every(c=>!c.verified)).toBe(true);
  }finally{rmSync(path,{recursive:true,force:true});}
 });
 it.each(['tests/fixtures/featureArmor.ts','tests/fixtures/originFeatChoice.ts','package-lock.json','package.json','vitest.config.ts','tsconfig.json','vite.config.ts','playwright.automation-progress.config.ts','tools/standalonePlugin.ts','.github/workflows/web.yml'])('invalidates old verification after a dependency/validation input changes: %s',file=>{
  const path=fixture();try{receipt(path);const before=progressInputs(path).fingerprint;expect(generateProgress(path,'standalone').capabilities.filter(c=>c.verified&&c.playerAvailable)).toHaveLength(9);writeFileSync(join(path,file),readFileSync(join(path,file),'utf8')+'\n');expect(progressInputs(path).fingerprint).not.toBe(before);const stale=generateProgress(path,'standalone');expect(stale.capabilities.every(c=>!c.verified)).toBe(true);expect(stale.verification.testedAt).toBeNull();expect(stale.missingEvidence).toContain('本次源码的自动化验证结果');}finally{rmSync(path,{recursive:true,force:true});}
 });
 it('invalidates old verification when a new dynamically read fixture is added',()=>{
  const path=fixture();try{receipt(path);writeFileSync(join(path,'tests/fixtures/new-runtime-input.json'),'{"authored":true}');expect(generateProgress(path,'standalone').capabilities.every(c=>!c.verified)).toBe(true);}finally{rmSync(path,{recursive:true,force:true});}
 });
 it('includes transitive test helpers across the repository validation input trees',()=>{
  const path=fixture();try{const helper='tools/authored-fingerprint-helper.ts';writeFileSync(join(path,helper),'export const authoredProbe=1;\n');const importing=join(path,'tests/fixtures/originFeatChoice.ts');writeFileSync(importing,readFileSync(importing,'utf8')+"\nexport {authoredProbe} from '../../tools/authored-fingerprint-helper';\n");receipt(path);expect(generateProgress(path,'standalone').capabilities.some(c=>c.verified)).toBe(true);writeFileSync(join(path,helper),'export const authoredProbe=2;\n');expect(generateProgress(path,'standalone').capabilities.every(c=>!c.verified)).toBe(true);}finally{rmSync(path,{recursive:true,force:true});}
 });
 it('does not count partially passed/skipped test files as whole-rule implementation evidence',()=>{
  const path=fixture();try{const testFile='tests/class-spell-choices.test.ts';const rows={schemaVersion:1,scope:'local-snapshot',updatedAt:'2026-10-05',records:[{id:'authored-whole-rule',source:'XPHB',category:'spells',reviewed:true,complete:true,tests:[testFile]}]};writeFileSync(join(path,'docs/data/automation-rule-status.json'),JSON.stringify(rows));const report={testResults:[{name:join(path,testFile),status:'passed',assertionResults:[{status:'passed'},{status:'pending'}]}]};let files=verificationFiles(path,report);expect(files.passedFiles).toEqual([testFile]);expect(files.completePassedFiles).toEqual([]);receipt(path,files.passedFiles,files.completePassedFiles);expect(generateProgress(path,'standalone').audit.counts).toEqual({total:1,reviewed:1,implementedVerified:0});report.testResults[0].assertionResults[1].status='passed';files=verificationFiles(path,report);receipt(path,files.passedFiles,files.completePassedFiles);expect(generateProgress(path,'standalone').audit.counts!.implementedVerified).toBe(1);}finally{rmSync(path,{recursive:true,force:true});}
 });
 it('keeps missing source/category row evidence unknown and accepts only explicitly represented zero',()=>{
  const path=fixture();try{writeFileSync(join(path,'docs/data/automation-rule-status.json'),JSON.stringify({schemaVersion:1,scope:'local-snapshot',updatedAt:'2026-10-05',records:[{id:'authored-armor',source:'PHB',category:'equipment',reviewed:true,complete:false,tests:[]}]}));const m=generateProgress(path,'standalone');expect(sourceRuleCounts(m,'PHB','equipment')).toEqual({total:1,reviewed:1,implementedVerified:0});expect(sourceRuleCounts(m,'PHB','all')!.total).toBe(1);expect(sourceRuleCounts(m,'PHB','spells')).toBeNull();expect(sourceRuleCounts(m,'XPHB','equipment')).toBeNull();const zero={total:0,reviewed:0,implementedVerified:0};m.sources.find(s=>s.id==='PHB')!.counts!.spells=zero;expect(sourceRuleCounts(m,'PHB','spells')).toEqual(zero);}finally{rmSync(path,{recursive:true,force:true});}
 });
 it('recalculates acquired status rows by source/category, rejects duplicate IDs and excludes partial rules',()=>{
  const path=fixture();try{const rows={schemaVersion:1,scope:'local-snapshot',updatedAt:'2026-10-05',records:[{id:'one',source:'PHB',category:'equipment',reviewed:true,complete:false,tests:[]},{id:'one',source:'XPHB',category:'equipment',reviewed:false,complete:false,tests:[]}]};writeFileSync(join(path,'docs/data/automation-rule-status.json'),JSON.stringify(rows));const m=generateProgress(path,'standalone');expect(m.audit.counts).toEqual({total:2,reviewed:1,implementedVerified:0});expect(m.sources.find(s=>s.id==='PHB')!.counts!.equipment!.reviewed).toBe(1);rows.records.push(rows.records[0]);writeFileSync(join(path,'docs/data/automation-rule-status.json'),JSON.stringify(rows));expect(()=>generateProgress(path,'standalone')).toThrow('Duplicate');
  rows.records.pop();Object.assign(rows.records[0],{raw:{entries:['private']}});writeFileSync(join(path,'docs/data/automation-rule-status.json'),JSON.stringify(rows));expect(()=>generateProgress(path,'standalone')).toThrow('non-public');
  }finally{rmSync(path,{recursive:true,force:true});}
 });
 it('keeps checked, unit-verified and published-verified facts separate; exact positive proof covers only its listed abilities',()=>{
  const {m,identity,release}=proof();expect(publicationFor(m,identity,release)).toMatchObject({matched:true,availableIds:['armor'],ruleAuditVerified:false});expect(publicationFor(m,identity,{version:'standalone-1.0.246'})).toMatchObject({matched:false,availableIds:[]});
  expect(publicationFor(m,identity,undefined).matched).toBe(false);expect(publicationFor(m,identity,{...release,sourceCommits:{web:identity.sourceCommit},sourceCommit:undefined}).matched).toBe(true);
 });
 it('does not promote whole-rule counts with a hand-written publication true boolean',()=>{
  const {m,identity,release}=proof();m.audit={scope:'local-snapshot',updatedAt:'2026-10-05',counts:{total:1,reviewed:1,implementedVerified:1}};release.automationProgress.ruleAuditVerified=true;expect(publicationFor(m,identity,release)).toMatchObject({matched:true,availableIds:['armor'],ruleAuditVerified:false});
 });
 it.each(['version','sourceCommit','fingerprint','manifestSha256','loadedAndVerified','channel','capabilityIds','verifiedAt'])('fails closed on missing/mismatched publication %s',field=>{
  const {m,identity,release}=proof();(release.automationProgress as Record<string,unknown>)[field]=field==='capabilityIds'?['rest','combat']:field==='loadedAndVerified'?false:'wrong';expect(publicationFor(m,identity,release)).toMatchObject({matched:false,availableIds:[]});
 });
 it('mismatched running build and development channel cannot masquerade as a published release',()=>{
  const {m,identity,release}=proof();expect(publicationFor(m,{...identity,sourceCommit:'b'.repeat(40)},release).matched).toBe(false);expect(publicationFor({...m,build:{...m.build,mode:'automation-standalone'}},{...identity,mode:'automation-standalone'},release).matched).toBe(false);
 });
 it('source/type/category filters are pure and do not broaden unsupported source coverage',()=>{
  const m=manifest(),before=JSON.stringify(m);expect(filterProgress(m,'equipment','PHB','official').every(c=>c.category==='equipment')).toBe(true);expect(filterProgress(m,'all','COS','official')).toEqual([]);expect(filterProgress(m,'all','all','third-party')).toEqual([]);expect(JSON.stringify(m)).toBe(before);
  expect(m.capabilities.filter(c=>!c.playerAvailable).every(c=>!c.trigger&&!c.does&&!!c.status)).toBe(true);
 });
 it('rejects malformed state and unsupported schema rather than inventing usable features',()=>{
  const m=manifest();expect(validProgress({...m,schemaVersion:999})).toBe(false);expect(validProgress({...m,audit:{...m.audit,counts:{total:1,reviewed:2,implementedVerified:2}}})).toBe(false);
  expect(validProgress({...m,capabilities:[{...m.capabilities[0],playerAvailable:true,state:'pending'}]})).toBe(false);
 });
 it('deduplicates successful manifest loads, checks digest, caps decoded bytes and allows recovery after failure',async()=>{
  const json=JSON.stringify(manifest()),hash=createHash('sha256').update(json).digest('hex');const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(json,{headers:{'Content-Type':'application/json'}});};
  try{const [a,b]=await Promise.all([loadProgress('fixture:cache',hash),loadProgress('fixture:cache',hash)]);expect(a).toBe(b);expect(calls).toBe(1);await loadProgress('fixture:cache',hash);expect(calls).toBe(1);
   await expect(loadProgress('fixture:digest','b'.repeat(64))).rejects.toThrow('不匹配');
   globalThis.fetch=async()=>new Response(' '.repeat(PROGRESS_LIMIT+1));await expect(loadProgress('fixture:large',hash)).rejects.toThrow('上限');
   globalThis.fetch=async()=>new Response(json);await expect(loadProgress('fixture:large',hash)).resolves.toHaveProperty('schemaVersion',1);
  }finally{globalThis.fetch=original;}
 });
});
