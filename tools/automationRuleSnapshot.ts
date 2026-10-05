// Build/import contract only: identities and statuses, never executable rules.
import {createHash} from 'node:crypto';
import type {ProgressCategory} from '../src/platform/automationProgress.ts';
export const RULE_STATUS_PATH='docs/data/automation-rule-status.json';
export const RULE_STATUS_LOCK='docs/data/automation-rule-status.lock.json';
export const RULE_AUTHORITY='FullPeople/dnd5e-automation-data';
export interface SnapshotRecord {
 id:string;source:string;category:ProgressCategory;reviewed:boolean;complete:boolean;tests:[];
 identity:Record<string,string|number|null>;verdict:'automated'|'noMechanics'|'unsupported'|'needsAnnotation';
 payloadFamilies:string[];gapFamilies:string[];gapCodes:string[];boundary:string;reviewRef:string|null;validationRefs:string[];
}
export interface RuleSnapshot {
 schemaVersion:2;scope:'local-snapshot';updatedAt:string;
 authority:{repository:string;sourceRevision:string;irSha256:string;irBytes:number;reviewsSha256:string;inputLock:string;upstreamVersion:string};
 boundaries:Record<string,string>;
 reviews:Record<string,{path:string;sha256:string;reviewedAt:string}>;
 validations:Record<string,{scope:string;sourceCommit:string;consumerCodeCommit:string;sdkProducerCommit:string;artifactSha256:string;nativeChecksPerNode:number;nodeRuns:number;completeAppCases:number;nativeArtifactHashes:string[];appArtifactHashes:string[];qualification:string}>;
 sources:{id:string;name:string;origin:'official'|'third-party'|'project'}[];records:SnapshotRecord[];
}
export interface SnapshotLock {schemaVersion:1;repository:string;branch:string;revision:string;path:string;sha256:string;sourceRevision:string;irSha256:string}
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const str=(v:unknown,n=512):v is string=>typeof v==='string'&&v.length>0&&v.length<=n;
const sha=(v:unknown,n=64):v is string=>typeof v==='string'&&new RegExp(`^[a-f0-9]{${n}}$`).test(v);
const date=(v:unknown)=>str(v,50)&&Number.isFinite(Date.parse(v));
const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const list=(v:unknown,n=512)=>Array.isArray(v)&&v.length<=100&&v.every(s=>str(s,n))&&new Set(v).size===v.length;
function keys(v:unknown,allowed:string[]){if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw Error('Rule snapshot contains non-public fields');}
function requireFact(ok:unknown,message:string):asserts ok {if(!ok)throw Error('Invalid rule snapshot: '+message);}
export function validateRuleSnapshot(value:unknown):RuleSnapshot {
 keys(value,['schemaVersion','scope','updatedAt','authority','boundaries','reviews','validations','sources','records']);
 const v=value as RuleSnapshot;
 requireFact(v.schemaVersion===2&&v.scope==='local-snapshot'&&date(v.updatedAt),'schema/scope/date');
 keys(v.authority,['repository','sourceRevision','irSha256','irBytes','reviewsSha256','inputLock','upstreamVersion']);
 requireFact(v.authority.repository===RULE_AUTHORITY&&sha(v.authority.sourceRevision,40)&&sha(v.authority.irSha256)&&integer(v.authority.irBytes)&&sha(v.authority.reviewsSha256)&&sha(v.authority.inputLock)&&str(v.authority.upstreamVersion,80),'authority');
 requireFact(object(v.boundaries)&&Object.keys(v.boundaries).length<=10&&Object.entries(v.boundaries).every(([k,s])=>str(k,80)&&str(s,1200)),'boundary dictionary');
 requireFact(object(v.reviews)&&Object.keys(v.reviews).length<=10000,'reviews');
 for(const [id,r] of Object.entries(v.reviews)){
  keys(r,['path','sha256','reviewedAt']);requireFact(str(id,180)&&str(r.path,300)&&/^overlay\/[A-Za-z0-9_./-]+\.json$/.test(r.path)&&!r.path.split('/').some(p=>!p||p==='.'||p==='..')&&sha(r.sha256)&&date(r.reviewedAt),'review reference');
 }
 requireFact(object(v.validations)&&Object.keys(v.validations).length<=10000,'validation index');
 for(const [id,r] of Object.entries(v.validations)){
  keys(r,['scope','sourceCommit','consumerCodeCommit','sdkProducerCommit','artifactSha256','nativeChecksPerNode','nodeRuns','completeAppCases','nativeArtifactHashes','appArtifactHashes','qualification']);
  // These receipts are explicitly historical and can never become current QA.
  requireFact(sha(id)&&r.scope==='historical-local-snapshot'&&sha(r.sourceCommit,40)&&sha(r.consumerCodeCommit,40)&&sha(r.sdkProducerCommit,40)&&sha(r.artifactSha256)&&integer(r.nativeChecksPerNode)&&integer(r.nodeRuns)&&integer(r.completeAppCases)&&Array.isArray(r.nativeArtifactHashes)&&r.nativeArtifactHashes.every(h=>sha(h))&&r.nativeArtifactHashes.length===r.nodeRuns&&Array.isArray(r.appArtifactHashes)&&r.appArtifactHashes.every(h=>sha(h))&&r.appArtifactHashes.length===r.completeAppCases&&r.qualification==='partial-or-held-behaviour-only; not whole-rule/current-consumer/publication proof','historical validation');
 }
 requireFact(Array.isArray(v.sources)&&v.sources.length<=500,'source metadata');
 const sources=new Map();for(const s of v.sources){keys(s,['id','name','origin']);requireFact(str(s.id,80)&&str(s.name,180)&&['official','third-party','project'].includes(s.origin)&&!sources.has(s.id),'source identity');sources.set(s.id,s);}
 requireFact(Array.isArray(v.records)&&v.records.length<=100000,'records');
 const identities=new Set();
 for(const r of v.records){
  keys(r,['id','source','category','reviewed','complete','tests','identity','verdict','payloadFamilies','gapFamilies','gapCodes','boundary','reviewRef','validationRefs']);
  keys(r.identity,['packId','kind','engName','classSource','classEngName','subclassSource','subclassEngShortName','level','raceSource','raceEngName','extra','edition']);
  requireFact(str(r.id,2000)&&str(r.source,80)&&sources.has(r.source)&&!identities.has(r.id)&&['values','equipment','training','spells','resources'].includes(r.category),'record identity/source/category');identities.add(r.id);
  requireFact(str(r.identity.packId,80)&&str(r.identity.kind,80)&&str(r.identity.engName)&&Object.entries(r.identity).every(([k,s])=>k==='edition'?[null,'2014','2024'].includes(s as any):k==='level'?integer(s):str(s)),'structured identity');
  const encoded=(s:unknown)=>encodeURIComponent(String(s??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase());
  requireFact(r.id.startsWith(`${encoded(r.identity.packId)}:${encoded(r.identity.kind)}:${encoded(r.source)}:`),'identity namespace');
  requireFact(['automated','noMechanics','unsupported','needsAnnotation'].includes(r.verdict)&&typeof r.reviewed==='boolean'&&r.reviewed===(r.verdict!=='needsAnnotation')&&typeof r.complete==='boolean'&&r.complete===(r.verdict==='automated')&&Array.isArray(r.tests)&&r.tests.length===0,'local verdict is not current implementation proof');
  requireFact(list(r.payloadFamilies,80)&&list(r.gapFamilies,160)&&list(r.gapCodes)&&str(r.boundary,80)&&Object.hasOwn(v.boundaries,r.boundary),'partial boundaries');
  const expectedBoundary=!r.reviewed?'unreviewed':r.verdict==='noMechanics'?'no-mechanics':r.complete?'local-complete':r.payloadFamilies.length?'partial-payload':'reviewed-held';
  requireFact(r.boundary===expectedBoundary&&(!r.reviewed?r.reviewRef===null&&r.payloadFamilies.length===0:typeof r.reviewRef==='string'&&Object.hasOwn(v.reviews,r.reviewRef)),'review/boundary association');
  requireFact(Array.isArray(r.validationRefs)&&r.validationRefs.every(id=>sha(id)&&Object.hasOwn(v.validations,id))&&new Set(r.validationRefs).size===r.validationRefs.length&&(r.reviewed||r.validationRefs.length===0),'validation association');
 }
 return v;
}
export function validateSnapshotLock(value:unknown,bytes:Buffer,snapshot:RuleSnapshot):SnapshotLock {
 keys(value,['schemaVersion','repository','branch','revision','path','sha256','sourceRevision','irSha256']);
 const v=value as SnapshotLock;
 requireFact(v.schemaVersion===1&&v.repository===RULE_AUTHORITY&&str(v.branch,180)&&!/[\s~^:?*\[\\]/.test(v.branch)&&sha(v.revision,40)&&v.path==='reports/progress/automation-rule-status.json'&&sha(v.sha256)&&v.sha256===createHash('sha256').update(bytes).digest('hex')&&v.sourceRevision===snapshot.authority.sourceRevision&&v.irSha256===snapshot.authority.irSha256,'source version lock');
 return v;
}
