import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import type {ProgressManifest,ProgressCategory,ProgressCounts,ProgressCapability} from '../src/platform/automationProgress.ts';
import {RULE_STATUS_LOCK,validateRuleSnapshot,validateSnapshotLock} from './automationRuleSnapshot.ts';
import {RUNTIME_COVERAGE,RUNTIME_LOCK,runtimeCoverage} from './automationRuntimeCoverage.ts';
export const PROGRESS_SOURCE='docs/data/automation-progress.json';
export const VERIFICATION_PATH='.local-evidence/automation-progress/verification.json';
export const VERIFICATION_SCHEMA=2;
const categories=['values','equipment','training','spells','resources'];
const read=(root:string,path:string)=>JSON.parse(readFileSync(join(root,path),'utf8'));
const digest=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const safePath=(root:string,path:string)=>{if(!path||relative(root,resolve(root,path)).startsWith('..')||path.includes('\\'))throw Error('Evidence must be a repository-relative path');return join(root,path);};
export function progressInputs(root:string){
 const input=read(root,PROGRESS_SOURCE);if(input.schemaVersion!==1||!Array.isArray(input.capabilities))throw Error('Unsupported progress source');
 const tests=[...new Set<string>(input.capabilities.flatMap((c:{tests:string[]})=>c.tests))].sort();
 const files:string[]=[PROGRESS_SOURCE,'package.json','package-lock.json','index.html',...tests,...input.capabilities.flatMap((c:{browserTests:string[]})=>c.browserTests||[])];
 // Hash the entire authored input trees, conservatively including dynamically read
 // fixtures and helpers rather than assuming that a top-level test is self-contained.
 const visit=(path:string)=>{for(const entry of readdirSync(join(root,path),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const child=path+'/'+entry.name;if(entry.isDirectory())visit(child);else files.push(child);}};
 for(const tree of ['src','tests','tools','prototype','.github/workflows'])visit(tree);
 for(const entry of readdirSync(root,{withFileTypes:true}))if(entry.isFile()&&(/\.config\.[cm]?[jt]s$/.test(entry.name)||/^tsconfig.*\.json$/.test(entry.name)||['.npmrc','.nvmrc','.node-version'].includes(entry.name)))files.push(entry.name);
 if(existsSync(safePath(root,input.auditPath)))files.push(input.auditPath);
 if(existsSync(safePath(root,RULE_STATUS_LOCK)))files.push(RULE_STATUS_LOCK);
 for(const path of [RUNTIME_COVERAGE,RUNTIME_LOCK])if(existsSync(safePath(root,path)))files.push(path);
 const hash=createHash('sha256');for(const path of [...new Set(files)].sort())hash.update(path+'\0').update(readFileSync(safePath(root,path))).update('\0');
 return {input,tests,fingerprint:hash.digest('hex')};
}
/** Mechanism fixtures may have conditional skips; whole-rule evidence may not. */
export function verificationFiles(root:string,report:{testResults:{status:string;name:string;assertionResults:{status:string}[]}[]}){
 const passed=report.testResults.filter(t=>t.status==='passed'&&t.assertionResults.some(a=>a.status==='passed'));
 const paths=(rows:typeof passed)=>rows.map(t=>relative(root,t.name).replaceAll('\\','/')).sort();
 return {passedFiles:paths(passed),completePassedFiles:paths(passed.filter(t=>t.assertionResults.every(a=>a.status==='passed')))};
}
/** Only safe public summaries leave this build process; private evidence is reduced to booleans/counts. */
export function generateProgress(root:string,mode:string):ProgressManifest {
 const {input,tests,fingerprint}=progressInputs(root);
 const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 const sourceCommit=git('rev-parse','HEAD');const packageVersion=read(root,'package.json').version;
 const state=readFileSync(join(root,'src/core/automation/state.ts'),'utf8');
 const protocol=Number(state.match(/AUTOMATION_PROTOCOL=(\d+)/)?.[1]);const rulesVersion=state.match(/RULES_VERSION='([^']+)'/)?.[1];if(!protocol||!rulesVersion)throw Error('Automation identity could not be read');
 const missingEvidence=input.references.filter((p:string)=>!existsSync(safePath(root,p)));
 let receipt:any;try{receipt=read(root,VERIFICATION_PATH);}catch{/* Missing evidence is a displayed state. */}
 const validReceipt=receipt?.schemaVersion===VERIFICATION_SCHEMA&&receipt.fingerprint===fingerprint&&receipt.success===true&&Number.isFinite(Date.parse(receipt.testedAt))&&receipt.scope==='authored-unit-fixtures'&&Array.isArray(receipt.passedFiles)&&Array.isArray(receipt.completePassedFiles)&&receipt.completePassedFiles.every((p:string)=>receipt.passedFiles.includes(p));
 const verifiedTests=new Set<string>(validReceipt?receipt.passedFiles:[]);
 const completeVerifiedTests=new Set<string>(validReceipt?receipt.completePassedFiles:[]);
 if(!validReceipt)missingEvidence.push('本次源码的自动化验证结果');
 const used=new Set<string>();
 const capabilities:ProgressCapability[]=input.capabilities.map((c:any)=>{
  if(used.has(c.id)||!categories.includes(c.category)||!Array.isArray(c.modules)||!Array.isArray(c.tests))throw Error('Invalid capability');used.add(c.id);
  const reviewed=!!c.reviewedAt&&c.modules.length>0&&c.modules.every((p:string)=>existsSync(safePath(root,p)));
  const verified=reviewed&&c.tests.length>0&&c.tests.every((p:string)=>tests.includes(p)&&verifiedTests.has(p));
  const base={id:c.id,title:c.title,category:c.category,state:c.state,playerAvailable:c.playerAvailable,reviewed,verified,sampleSources:c.sampleSources};
  return c.playerAvailable?{...base,does:c.does,trigger:c.trigger,conditions:c.conditions,boundary:c.boundary}:{...base,status:c.status};
 });
 const registry=read(root,'src/data/sourceRegistry.json');
 const sources:ProgressManifest['sources']=Object.entries(registry).map(([id,m]:[string,any])=>({id,name:m.name,origin:id.startsWith('LOCAL-')?'project':m.category==='第三方'?'third-party':'official',counts:null})).sort((a,b)=>a.id.localeCompare(b.id)) as ProgressManifest['sources'];
 let audit:ProgressManifest['audit']={scope:null,updatedAt:null,counts:null};
 if(!existsSync(safePath(root,input.auditPath)))missingEvidence.push(input.auditPath);
 else{
  const value=read(root,input.auditPath);
  if(value.schemaVersion===2){
   const snapshot=validateRuleSnapshot(value),bytes=readFileSync(safePath(root,input.auditPath));
   const lock=validateSnapshotLock(read(root,RULE_STATUS_LOCK),bytes,snapshot);
   for(const meta of snapshot.sources){const registered=sources.find(s=>s.id===meta.id);if(registered){if(registered.origin!==meta.origin)throw Error('Snapshot source origin conflicts with registered public metadata');}else sources.push({...meta,counts:null});}
   sources.sort((a,b)=>a.id.localeCompare(b.id));
   const total:ProgressCounts={total:0,reviewed:0,implementedVerified:0};
   const byOrigin:Record<string,{total:number;reviewed:number;localMarkedComplete:number}>={};
   for(const row of snapshot.records){
    const source=sources.find(s=>s.id===row.source)!;source.counts??={};
    const counts=source.counts[row.category]??={total:0,reviewed:0,implementedVerified:0};
    for(const n of [total,counts]){n.total++;if(row.reviewed)n.reviewed++;}
    const origin=byOrigin[source.origin]??={total:0,reviewed:0,localMarkedComplete:0};origin.total++;if(row.reviewed)origin.reviewed++;if(row.complete)origin.localMarkedComplete++;
   }
   // Historical source flags/receipts are preserved, but deliberately do not
   // satisfy this consumer's authored-unit or production publication contract.
   audit={scope:snapshot.scope,updatedAt:snapshot.updatedAt,counts:total,snapshot:{repository:lock.repository,exportRevision:lock.revision,sourceRevision:lock.sourceRevision,artifactSha256:lock.sha256,irSha256:lock.irSha256,
    localMarkedComplete:snapshot.records.filter(r=>r.complete).length,noMechanics:snapshot.records.filter(r=>r.verdict==='noMechanics').length,acceptedIncomplete:snapshot.records.filter(r=>r.verdict==='unsupported').length,unreviewed:snapshot.records.filter(r=>!r.reviewed).length,
    partialPayloadRecords:snapshot.records.filter(r=>r.boundary==='partial-payload').length,historicalEvidenceRecords:snapshot.records.filter(r=>r.validationRefs.length>0).length,sourceCount:snapshot.sources.length,reviewBatchCount:Object.keys(snapshot.reviews).length,byOrigin}};
   missingEvidence.push('与当前角色卡提交绑定的逐条整条验证','逐条规则的当前发布加载及验证证明');
  }else{
  const keys=(v:object,allowed:string[])=>{if(Object.keys(v).some(k=>!allowed.includes(k)))throw Error('Rule status contains non-public fields');};
  keys(value,['schemaVersion','scope','updatedAt','records']);if(value.schemaVersion!==1||!['local-snapshot','catalog'].includes(value.scope)||!Array.isArray(value.records)||!Number.isFinite(Date.parse(value.updatedAt)))throw Error('Invalid rule status');
  const seen=new Set(),total:ProgressCounts={total:0,reviewed:0,implementedVerified:0};
  for(const r of value.records){keys(r,['id','source','category','reviewed','complete','tests']);
   if(typeof r.id!=='string'||typeof r.source!=='string'||!categories.includes(r.category)||typeof r.reviewed!=='boolean'||typeof r.complete!=='boolean'||!Array.isArray(r.tests)||r.tests.some((t:unknown)=>typeof t!=='string'||!tests.includes(t))||r.complete&&!r.reviewed)throw Error('Invalid rule status record');
   const key=JSON.stringify([r.source,r.id]);if(seen.has(key))throw Error('Duplicate rule identity');seen.add(key);
   const verified=r.complete&&r.tests.length>0&&r.tests.every((p:string)=>completeVerifiedTests.has(p));
   let source=sources.find(s=>s.id===r.source);if(!source)throw Error('Register the public source metadata before adding rule status');
   source.counts??={};const counts=source.counts[r.category as ProgressCategory]??={total:0,reviewed:0,implementedVerified:0};
   for(const n of [total,counts]){n.total++;if(r.reviewed)n.reviewed++;if(verified)n.implementedVerified++;}
  }
  audit={scope:value.scope,updatedAt:value.updatedAt,counts:total};
  }
 }
 const updatedAt=[...input.changes.map((c:any)=>c.date),...input.capabilities.map((c:any)=>c.reviewedAt).filter(Boolean),...(validReceipt?[receipt.testedAt]:[]),...(audit.updatedAt?[audit.updatedAt]:[])].sort().at(-1);
 const manifest:ProgressManifest={schemaVersion:1,updatedAt,build:{sourceCommit,fingerprint,packageVersion,mode,rulesVersion,protocol},notice:input.notice,sourcesNotice:input.sourcesNotice,changes:input.changes.slice(0,8).map((c:any)=>({date:c.date,summary:c.summary})),capabilities,verification:{testedAt:validReceipt?receipt.testedAt:null,scope:'原创单元夹具；不代表全库语义或真实玩家房间验收'},audit,missingEvidence,sources};
 if(audit.snapshot&&existsSync(safePath(root,RUNTIME_COVERAGE))){
  const runtime=runtimeCoverage(root,readFileSync(safePath(root,input.auditPath)));manifest.runtimeAudit=runtime.summary;
  for(const source of sources)source.runtimeImplemented=runtime.sources.get(source.id)??null;
  // Mechanism details no longer appear on the player page. Preserve qualification
  // metadata for receipts while keeping the lazy manifest below the existing limit.
  for(const c of capabilities){if(c.playerAvailable){c.does='';c.trigger='';c.conditions='';c.boundary='';}else c.status='待核实';}
  manifest.notice='';manifest.sourcesNotice='';manifest.changes=[];
 }
 // Validate public output separately from maintained source so extra fields can never leak.
 return manifest;
}
export const progressDigest=digest;
