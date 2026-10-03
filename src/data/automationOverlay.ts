import {privateRecordValid} from '../core/automation/privateRecord';
import type {Entry} from '../core/model';
import type {AutomationEnvelope,AutomationRecord} from './automation/protocol';
import defaults from './automation/default-source.json';
import {readCache,writeCache} from '../platform/storage';
import {automationIdentityResolver} from './automationIdentity';
export interface AutomationSource {url:string;sha256:string;kiweeVersion:string;toolVersion?:string;bytes?:number}
export type AutomationLoad={status:'ready';data:AutomationData;cached:boolean}|{status:'missing';message:string};
const LIMIT=32*1024*1024;
export const defaultAutomationSource=():AutomationSource=>({url:new URL(defaults.path,new URL(import.meta.env.BASE_URL,location.href)).href,sha256:defaults.sha256,kiweeVersion:defaults.kiweeVersion,toolVersion:defaults.toolVersion,bytes:defaults.bytes});
export function configuredAutomationSource():AutomationSource{
 try{const value=JSON.parse(localStorage.getItem('dnd-card:automation-source')||'null');if(value&&typeof value.url==='string'&&/^[a-f0-9]{64}$/.test(value.sha256)&&typeof value.kiweeVersion==='string')return value;}catch{}
 return defaultAutomationSource();
}
export function rememberAutomationSource(source:AutomationSource):void{localStorage.setItem('dnd-card:automation-source',JSON.stringify(source));}
export async function cacheAutomationImport(text:string,source:AutomationSource,signal?:AbortSignal):Promise<AutomationData>{const data=await importAutomationData(text,source,signal);if(signal?.aborted)throw signal.reason;await writeCache(`automation:${new URL(source.url).href}:${source.sha256}`,{body:{text},revision:source.sha256});return data;}
export async function automationHash(text:string):Promise<string>{return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export class AutomationData {
 readonly version:string;readonly envelope:AutomationEnvelope;
 private readonly byEntryId=new Map<string,AutomationRecord[]>();
 private readonly byIdentity=new Map<string,AutomationRecord>();
 constructor(envelope:AutomationEnvelope,hash:string){this.envelope=envelope;this.version=hash;for(const record of envelope.records){this.byIdentity.set(record.identity.key,record);for(const id of record.entryIds||[])this.byEntryId.set(id,[...(this.byEntryId.get(id)||[]),record]);}}
 record(key:string):AutomationRecord|undefined{return this.byIdentity.get(key);}
 bind(entries:readonly Entry[],identityCatalog:readonly Entry[]=entries):Entry[]{
  const resolveIdentity=automationIdentityResolver(identityCatalog);
  return entries.map(entry=>{
   const {automation:_old,automationVersion:_version,automationOptions:labels,...snapshot}=entry;
   if(privateRecordValid(entry,this.envelope.records))return entry;
   const identity=resolveIdentity(entry),primary=identity&&this.byIdentity.get(identity.key);
   const candidates=(primary?[primary]:this.byEntryId.get(entry.id)||[]).filter(r=>r.identity.packId===entry.packId&&r.identity.source===entry.source.toUpperCase()&&r.identity.kind===String(entry.raw._category||entry.kind)&&(r.edition===undefined||r.edition==='both'||entry.edition==='both'||r.edition===entry.edition));
   if(candidates.length!==1)return snapshot;
   const record=candidates[0],options:NonNullable<Entry['automationOptions']>={};
   // Imported labels are player-owned display metadata. Their references never
   // override the signed IR option identities or add a candidate.
   for(const grant of record.mechanics?.grants||[]){const label=grant.key&&labels?.[grant.key];if(!label||typeof label.label!=='string'||label.label.length>1000)continue;const values=[...(grant.fixed||[]),...(grant.choose?.from||[])];options[grant.key!]={label:label.label,options:Object.fromEntries(values.flatMap(value=>{const option=label.options?.[value];return option&&typeof option.label==='string'&&option.label.length<=1000?[[value,{label:option.label,reference:value}]]:[]}))};}
   return {...snapshot,automation:record,automationVersion:this.version,...(Object.keys(options).length?{automationOptions:options}:{})};
  });
 }
}
async function validateText(text:string,signal?:AbortSignal):Promise<AutomationEnvelope>{
 if(new TextEncoder().encode(text).length>LIMIT)throw Error('自动化资料超出支持大小。');
 if(signal?.aborted)throw signal.reason;
 let worker:Worker|undefined;
 try{if(typeof Worker!=='undefined')worker=new Worker(new URL('./automation.worker.ts',import.meta.url),{type:'module'});}catch{/* Validated fallback for browsers with a denied worker policy. */}
 if(worker){
  const current=worker;
  try{return await new Promise((resolve,reject)=>{
   const abort=()=>{current.terminate();reject(signal?.reason||Error('自动化资料读取已中止。'));};
   signal?.addEventListener('abort',abort,{once:true});
   current.onmessage=({data})=>{signal?.removeEventListener('abort',abort);data.error?reject(Error(data.error)):resolve(data.envelope);};
   current.onerror=()=>{signal?.removeEventListener('abort',abort);reject(Error('自动化资料处理失败。'));};
   current.postMessage({id:1,text});
  });}finally{current.terminate();}
 }
 await new Promise<void>(resolve=>setTimeout(resolve,0));if(signal?.aborted)throw signal.reason;
 const validate:typeof import('./automation/validate').validateAutomation=(await import('./automation/validate')).validateAutomation;const value:unknown=JSON.parse(text);validate(value);return value;
}
export async function importAutomationData(text:string,source:Pick<AutomationSource,'sha256'|'kiweeVersion'|'toolVersion'>,signal?:AbortSignal):Promise<AutomationData>{
 if(!/^[a-f0-9]{64}$/.test(source.sha256))throw Error('自动化资料缺少有效的哈希锁。');
 const hash=await automationHash(text);if(hash!==source.sha256)throw Error('自动化资料与哈希锁不一致。');
 const envelope=await validateText(text,signal);
 if(envelope.versionLock.kiweeChangelogVersion!==source.kiweeVersion||source.toolVersion&&envelope.versionLock.toolVersion!==source.toolVersion)throw Error('自动化资料与所选资料版本不一致。');
 if(signal?.aborted)throw signal.reason;
 return new AutomationData(envelope,hash);
}
async function fetchText(url:string,signal?:AbortSignal):Promise<string>{
 const response=await fetch(url,{signal});if(!response.ok)throw Error('自动化资料无法读取。');
 if(Number(response.headers.get('content-length'))>LIMIT)throw Error('自动化资料超出支持大小。');
 if(!response.body){const text=await response.text();if(new TextEncoder().encode(text).length>LIMIT)throw Error('自动化资料超出支持大小。');return text;}
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>LIMIT){await reader.cancel();throw Error('自动化资料超出支持大小。');}chunks.push(next.value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export async function loadAutomationData(source:AutomationSource,signal?:AbortSignal,refresh=false):Promise<AutomationLoad>{
 try{
  const url=new URL(source.url,typeof location==='undefined'?'https://localhost/':location.href);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('自动化资料源需要 HTTPS。');
  const cacheKey=`automation:${url.href}:${source.sha256}`,prior=await readCache(cacheKey).catch(()=>undefined);
  const cachedText=typeof prior?.body?.text==='string'?prior.body.text:undefined;
  if(!refresh&&cachedText)return {status:'ready',data:await importAutomationData(cachedText,source,signal),cached:true};
  let text:string;
  try{text=await fetchText(url.href,signal);}catch(error){if(signal?.aborted)throw error;if(cachedText)return {status:'ready',data:await importAutomationData(cachedText,source,signal),cached:true};throw error;}
  const data=await importAutomationData(text,source,signal);
  // A failed cache write must not discard a valid response.
  if(!signal?.aborted)await writeCache(cacheKey,{body:{text},revision:source.sha256}).catch(()=>undefined);
  return {status:'ready',data,cached:false};
 }catch{return {status:'missing',message:signal?.aborted?'自动化资料读取已中止。':'自动化资料不可用或版本核对失败；手写内容与已消耗资源仍保留。'};}
}
