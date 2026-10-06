import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import type {ProgressManifest} from '../src/platform/automationProgress.ts';
export const RUNTIME_COVERAGE='docs/data/automation-runtime-coverage.json';
export const RUNTIME_LOCK='docs/data/automation-runtime-coverage.lock.json';
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const sha=(s:unknown,n=64)=>typeof s==='string'&&new RegExp(`^[a-f0-9]{${n}}$`).test(s);
export function runtimeCoverage(root:string,snapshotBytes:Buffer){
 const bytes=readFileSync(join(root,RUNTIME_COVERAGE)),report=JSON.parse(bytes.toString()),lock=JSON.parse(readFileSync(join(root,RUNTIME_LOCK),'utf8'));
 if(lock.schemaVersion!==1||lock.repository!=='FullPeople/dnd5e-automation-data'||lock.path!=='reports/progress/runtime-coverage.json'||!sha(lock.revision,40)||!sha(lock.sha256)||lock.sha256!==hash(bytes))throw Error('Runtime coverage does not match the Data version lock');
 if(report.schemaVersion!==1||report.definition!=='at least one current calculation or usable choice; remaining effects are manual'||!sha(report.consumer?.revision,40)||report.consumer.repository!=='FullPeople/DND-card-web'||report.snapshotSha256!==hash(snapshotBytes)||!Number.isFinite(Date.parse(report.updatedAt))||!Array.isArray(report.records)||!Array.isArray(report.consumer.modules)||!report.consumer.modules.length)throw Error('Invalid runtime coverage identity');
 const snapshot=JSON.parse(snapshotBytes.toString()),rows=new Map(snapshot.records.map((r:any)=>[r.id,r]));
 if(report.total!==rows.size||report.records.length!==rows.size||new Set(report.records.map((r:any)=>r.id)).size!==rows.size)throw Error('Runtime coverage identities differ from the pinned inventory');
 for(const r of report.records){const original:any=rows.get(r.id);if(!original||original.source!==r.source||original.reviewed!==r.reviewed||!['implemented','manual','unavailable','unresolved'].includes(r.status))throw Error('Runtime coverage changed a rule identity/review');if(r.status==='implemented'&&(!r.witness||JSON.stringify(r.witness.before)===JSON.stringify(r.witness.after)))throw Error('Runtime coverage has no observed calculation or choice');}
 if(report.implemented!==report.records.filter((r:any)=>r.status==='implemented').length||report.reviewed!==report.records.filter((r:any)=>r.reviewed).length)throw Error('Runtime count is not derived from observed identities');
 const seen=new Set();for(const module of report.consumer.modules){if(!/^src\/[\w./-]+\.(tsx?|json)$/.test(module.path)||module.path.split('/').includes('..')||seen.has(module.path)||!sha(module.sha256)||hash(readFileSync(join(root,module.path)))!==module.sha256)throw Error('Runtime coverage is stale for current consumer code');seen.add(module.path);}
 const sources=new Map<string,number|null>();for(const s of report.sources){const records=report.records.filter((r:any)=>r.source===s.id);if(s.total!==records.length||s.implemented!==records.filter((r:any)=>r.status==='implemented').length||s.reviewed!==records.filter((r:any)=>r.reviewed).length||sources.has(s.id))throw Error('Runtime source counts differ from observed identities');sources.set(s.id,s.unresolved?null:s.implemented);}
 if(report.sources.reduce((n:number,s:any)=>n+s.total,0)!==report.total||report.sources.reduce((n:number,s:any)=>n+s.implemented,0)!==report.implemented)throw Error('Runtime sources do not partition the inventory');
 const summary:ProgressManifest['runtimeAudit']={revision:lock.revision,sha256:lock.sha256,consumerRevision:report.consumer.revision,updatedAt:report.updatedAt,total:report.total,implemented:report.implemented};
 return {bytes,lock,summary,sources};
}
