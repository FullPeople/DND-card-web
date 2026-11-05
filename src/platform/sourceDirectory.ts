import {PROGRESS_LIMIT,type ProgressManifest} from './automationProgress.ts';
export interface SourceDirectory {
 schemaVersion:1;revision:string;reportSha256:string;legacySnapshotSha256:string;generatedAt:string;
 summary:{sources:number;legacyRegisteredIdentities:number;newCandidateIdentities:number;provisionalCombinedIdentities:number;identityUnresolved:number;duplicateConflicts:number;unclassifiedFiles:number};
 creditAdded:{sourceReviewed:0;modeled:0;executed:0;accepted:0};sources:readonly {id:string;name:string}[];
}
export interface SourceDirectoryBook {id:string;name:string;runtimeImplemented?:number|null}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=max;
const sha=(value:unknown,length=64)=>typeof value==='string'&&new RegExp(`^[a-f0-9]{${length}}$`).test(value);
export function validSourceDirectory(value:unknown):value is SourceDirectory {
 if(!object(value)||value.schemaVersion!==1||!sha(value.revision,40)||!sha(value.reportSha256)||!sha(value.legacySnapshotSha256)||!text(value.generatedAt,50)||!Number.isFinite(Date.parse(value.generatedAt))||!object(value.summary)||!object(value.creditAdded)||!Array.isArray(value.sources)||value.sources.length>2000)return false;
 const credit=value.creditAdded;if(Object.keys(credit).length!==4||!['sourceReviewed','modeled','executed','accepted'].every(key=>credit[key]===0))return false;
 const summary=value.summary;
 if(!['sources','legacyRegisteredIdentities','newCandidateIdentities','provisionalCombinedIdentities','identityUnresolved','duplicateConflicts','unclassifiedFiles'].every(key=>Number.isSafeInteger(summary[key])&&Number(summary[key])>=0)||summary.sources!==value.sources.length||Number(summary.legacyRegisteredIdentities)+Number(summary.newCandidateIdentities)!==summary.provisionalCombinedIdentities)return false;
 const ids=new Set<string>();for(const row of value.sources){if(!object(row)||!text(row.id,80)||row.id!==row.id.trim().toUpperCase()||ids.has(row.id)||!text(row.name,180)||Object.keys(row).some(key=>!['id','name'].includes(key)))return false;ids.add(row.id);}
 return true;
}
export function mergeSourceDirectoryBooks(manifest:ProgressManifest,directory:SourceDirectory):SourceDirectoryBook[]{
 if(!validSourceDirectory(directory)||directory.legacySnapshotSha256!==manifest.audit.snapshot?.artifactSha256||directory.summary.legacyRegisteredIdentities!==manifest.audit.counts?.total)throw Error('来源目录与当前规则清单不匹配。');
 const books=new Map<string,SourceDirectoryBook>(manifest.sources.map(source=>[source.id.toUpperCase(),{id:source.id,name:source.name,runtimeImplemented:source.runtimeImplemented}]));
 for(const source of directory.sources)if(!books.has(source.id))books.set(source.id,{id:source.id,name:source.name,runtimeImplemented:null});return [...books.values()];
}
const pending=new Map<string,Promise<SourceDirectory>>();
export function loadSourceDirectory(url:string,expectedSha256:string):Promise<SourceDirectory>{
 const key=url+'#'+expectedSha256,previous=pending.get(key);if(previous)return previous;
 const request=(async()=>{const response=await fetch(url);if(!response.ok)throw Error('来源目录读取失败。');if(Number(response.headers.get('content-length'))>PROGRESS_LIMIT)throw Error('来源目录超过读取上限。');const reader=response.body?.getReader();if(!reader)throw Error('来源目录无法读取。');const chunks:Uint8Array[]=[];let size=0;
  for(;;){const{value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>PROGRESS_LIMIT){await reader.cancel();throw Error('来源目录超过读取上限。');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');if(digest!==expectedSha256)throw Error('来源目录与程序不匹配。');const result:unknown=JSON.parse(new TextDecoder().decode(bytes));if(!validSourceDirectory(result))throw Error('来源目录格式不受支持。');return result;
 })();pending.set(key,request);void request.catch(()=>{if(pending.get(key)===request)pending.delete(key);});return request;
}
