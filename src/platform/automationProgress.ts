// Public display contract only. This module has no character, rule or storage dependency.
export const PROGRESS_LIMIT=48*1024;
export const PROGRESS_CATEGORIES={values:'角色数值',equipment:'装备与特性',training:'熟练项',spells:'法术',resources:'资源 / 休息'} as const;
export type ProgressCategory=keyof typeof PROGRESS_CATEGORIES;
export type ProgressCounts={total:number;reviewed:number;implementedVerified:number};
export interface ProgressCapability {
 id:string;title:string;category:ProgressCategory;state:'partial'|'unavailable'|'pending';playerAvailable:boolean;
 reviewed:boolean;verified:boolean;sampleSources:string[];does?:string;trigger?:string;conditions?:string;boundary?:string;status?:string;
}
export interface ProgressManifest {
 schemaVersion:1;updatedAt:string;build:{sourceCommit:string;fingerprint:string;packageVersion:string;mode:string;rulesVersion:string;protocol:number};
 notice:string;sourcesNotice:string;changes:{date:string;summary:string}[];
 capabilities:ProgressCapability[];verification:{testedAt:string|null;scope:string};
 audit:{scope:string|null;updatedAt:string|null;counts:ProgressCounts|null};missingEvidence:string[];
 sources:{id:string;name:string;origin:'official'|'third-party'|'project';counts:Partial<Record<ProgressCategory,ProgressCounts>>|null}[];
}
export interface ProgressIdentity {sourceCommit:string;fingerprint:string;manifestSha256:string;mode:string}
export interface ProgressPublication {matched:boolean;availableIds:string[];version:string;reason:string;ruleAuditVerified:boolean}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const bounded=(v:unknown,n=1200):v is string=>typeof v==='string'&&v.length<=n;
const sha=(v:unknown,n=40)=>typeof v==='string'&&new RegExp(`^[a-f0-9]{${n}}$`).test(v);
const counts=(v:unknown)=>object(v)&&['total','reviewed','implementedVerified'].every(k=>Number.isSafeInteger(v[k])&&Number(v[k])>=0)&&Number(v.implementedVerified)<=Number(v.reviewed)&&Number(v.reviewed)<=Number(v.total);
/** Fail closed before any network data can become a capability claim. */
export function validProgress(v:unknown):v is ProgressManifest {
 if(!object(v)||v.schemaVersion!==1||!bounded(v.updatedAt,50)||!Number.isFinite(Date.parse(v.updatedAt))||!object(v.build)||!sha(v.build.sourceCommit)||!sha(v.build.fingerprint,64)||!bounded(v.build.packageVersion,80)||!bounded(v.build.mode,80)||!bounded(v.build.rulesVersion,80)||!Number.isSafeInteger(v.build.protocol))return false;
 if(!bounded(v.notice)||!bounded(v.sourcesNotice)||!Array.isArray(v.changes)||v.changes.length>8||v.changes.some(c=>!object(c)||!bounded(c.date,30)||!bounded(c.summary)))return false;
 if(!object(v.verification)||!bounded(v.verification.scope,120)||v.verification.testedAt!==null&&(!bounded(v.verification.testedAt,50)||!Number.isFinite(Date.parse(v.verification.testedAt))))return false;
 if(!object(v.audit)||v.audit.scope!==null&&!bounded(v.audit.scope,80)||v.audit.updatedAt!==null&&!bounded(v.audit.updatedAt,50)||v.audit.counts!==null&&!counts(v.audit.counts))return false;
 if(!Array.isArray(v.missingEvidence)||v.missingEvidence.length>16||v.missingEvidence.some(p=>!bounded(p,180)))return false;
 if(!Array.isArray(v.capabilities)||v.capabilities.length>80||!Array.isArray(v.sources)||v.sources.length>500)return false;
 const ids=new Set();for(const c of v.capabilities){
  if(!object(c)||!bounded(c.id,80)||ids.has(c.id)||!bounded(c.title,120)||!Object.hasOwn(PROGRESS_CATEGORIES,String(c.category))||!['partial','unavailable','pending'].includes(String(c.state))||typeof c.playerAvailable!=='boolean'||typeof c.reviewed!=='boolean'||typeof c.verified!=='boolean'||c.verified&&!c.reviewed||c.playerAvailable&&c.state!=='partial'||!Array.isArray(c.sampleSources)||c.sampleSources.length>30||c.sampleSources.some(s=>!bounded(s,80)))return false;
  ids.add(c.id);if(c.playerAvailable){if(['does','trigger','conditions','boundary'].some(k=>!bounded(c[k])))return false;}else if(!bounded(c.status)||['does','trigger','conditions'].some(k=>c[k]!==undefined))return false;
 }
 const books=new Set();for(const s of v.sources){if(!object(s)||!bounded(s.id,80)||books.has(s.id)||!bounded(s.name,180)||!['official','third-party','project'].includes(String(s.origin))||s.counts!==null&&(!object(s.counts)||Object.entries(s.counts).some(([k,c])=>!Object.hasOwn(PROGRESS_CATEGORIES,k)||!counts(c))))return false;books.add(s.id);}
 return true;
}
export function publicationFor(manifest:ProgressManifest,identity:ProgressIdentity,release:unknown):ProgressPublication {
 const pending=(reason:string,version='待核实'):ProgressPublication=>({matched:false,availableIds:[],version,reason,ruleAuditVerified:false});
 if(manifest.build.sourceCommit!==identity.sourceCommit||manifest.build.fingerprint!==identity.fingerprint||manifest.build.mode!==identity.mode)return pending('清单与正在运行的程序不匹配；当前可用状态降为待核实。');
 if(!object(release)||!bounded(release.version,100)||!object(release.automationProgress))return pending('缺少当前发布版本的加载与可用验证证据；这里的开发核验不能当作线上证明。',object(release)&&bounded(release.version,100)?release.version:undefined);
 const proof=release.automationProgress;
 const source=release.sourceCommit??(object(release.sourceCommits)?release.sourceCommits.web:undefined);
 const channel=identity.mode==='standalone'?'standalone':'suite';
 if(proof.schemaVersion!==1||proof.channel!==channel||source!==identity.sourceCommit||proof.sourceCommit!==source||proof.version!==release.version||proof.manifestSha256!==identity.manifestSha256||proof.fingerprint!==identity.fingerprint||proof.loadedAndVerified!==true||!bounded(proof.verifiedAt,50)||!Number.isFinite(Date.parse(proof.verifiedAt))||!Array.isArray(proof.capabilityIds)||new Set(proof.capabilityIds).size!==proof.capabilityIds.length||proof.capabilityIds.some(id=>typeof id!=='string'||!manifest.capabilities.some(c=>c.id===id&&c.verified&&c.playerAvailable)))return pending('发布证据与运行源码、清单或验证范围不一致；当前可用状态降为待核实。',release.version);
 // automation-standalone is always a development preview, even with a forged standalone receipt.
 if(identity.mode==='automation-standalone'||!/^(standalone-\d+\.\d+\.\d+|\d+\.\d+\.\d+-dev)$/.test(release.version))return pending('开发预览没有当前发布可用资格。',release.version);
 return {matched:true,availableIds:proof.capabilityIds as string[],version:release.version,reason:'运行源码与发布清单一致；只显示该发布证据逐项验证的能力。',ruleAuditVerified:proof.ruleAuditVerified===true&&manifest.audit.counts!==null};
}
export function filterProgress(manifest:ProgressManifest,category:string,source:string,origin:string){
 const books=manifest.sources.filter(s=>origin==='all'||s.origin===origin);
 const allowed=new Set(books.map(s=>s.id));
 return manifest.capabilities.filter(c=>(category==='all'||c.category===category)&&(source==='all'?origin==='all'||c.sampleSources.some(s=>allowed.has(s)):c.sampleSources.includes(source)&&allowed.has(source)));
}
// Successful reads are shared across tab switches and repeated dialog openings.
// Failed reads can be retried by reopening; release identity itself is never cached here.
const manifests=new Map<string,Promise<ProgressManifest>>();
export function loadProgress(url:string,expectedSha256:string):Promise<ProgressManifest>{
 const key=url+'#'+expectedSha256;const previous=manifests.get(key);if(previous)return previous;
 const request=(async()=>{const response=await fetch(url);if(!response.ok)throw Error('进度清单读取失败');if(Number(response.headers.get('content-length'))>PROGRESS_LIMIT)throw Error('进度清单超过读取上限');
  const reader=response.body?.getReader();if(!reader)throw Error('进度清单无法读取');const chunks:Uint8Array[]=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>PROGRESS_LIMIT){await reader.cancel();throw Error('进度清单超过读取上限');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==expectedSha256)throw Error('进度清单与程序不匹配');
  const value:unknown=JSON.parse(new TextDecoder().decode(bytes));if(!validProgress(value))throw Error('进度清单格式不受支持');return value;
 })();manifests.set(key,request);void request.catch(()=>{if(manifests.get(key)===request)manifests.delete(key);});return request;
}
