import type {Entry,Raw} from '../core/model';
import {hashCatalogJson} from './catalogHash';

/** Parsing/expansion must not monopolize the UI thread during the first download. */
export type CatalogOperation='normalize'|'monsters'|'magicItems'|'homebrew';
export type PreparedCatalog={revision:string;entries:Entry[]};
export function catalogNormalizer(signal:AbortSignal,fallback:(body:Raw,revision:string,packId?:string,operation?:CatalogOperation)=>Entry[]){
 let worker:Worker|undefined,sequence=0;
 type Job={reject:(error:Error)=>void;chunks?:Entry[]}&({prepare:false;resolve:(value:Entry[])=>void}|{prepare:true;resolve:(value:PreparedCatalog)=>void});
 const pending=new Map<number,Job>();
 try{if(typeof Worker!=='undefined')worker=new Worker(new URL('./catalog.worker.ts',import.meta.url),{type:'module'});}catch{/* Browser/CSP fallback keeps reading available. */}
 const stop=()=>{worker?.terminate();worker=undefined;for(const job of pending.values())job.reject(new Error('资料处理已中止'));pending.clear();};
 if(worker){worker.onmessage=({data})=>{const job=pending.get(data.id);if(!job)return;
  if(data.chunk){(job.chunks||=[]).push(...data.entries);return;}
  pending.delete(data.id);if(data.error)job.reject(new Error(data.error));else{const entries=job.chunks?job.chunks.concat(data.entries):data.entries;if(job.prepare)job.resolve({revision:data.revision,entries});else job.resolve(entries);}
 };worker.onerror=()=>{stop();};}
 signal.addEventListener('abort',stop,{once:true});
 return {async normalize(body:Raw,revision:string,packId?:string,operation:CatalogOperation='normalize'):Promise<Entry[]>{
  if(signal.aborted)throw new Error('资料处理已中止');
  if(worker){try{return await new Promise<Entry[]>((resolve,reject)=>{const id=++sequence;pending.set(id,{prepare:false,resolve,reject});try{worker!.postMessage({id,body,revision,packId,operation,chunked:true});}catch(error){pending.delete(id);reject(error);}});}catch(error){if(signal.aborted)throw error;}}
  await new Promise<void>(resolve=>setTimeout(resolve,0));if(signal.aborted)throw new Error('资料处理已中止');return fallback(body,revision,packId,operation);
 },async prepare(body:Raw,revision:string|null,packId?:string,operation:CatalogOperation='normalize'):Promise<PreparedCatalog>{
  if(signal.aborted)throw new Error('资料处理已中止');
  if(worker){try{return await new Promise<PreparedCatalog>((resolve,reject)=>{const id=++sequence;pending.set(id,{prepare:true,resolve,reject});try{worker!.postMessage({id,body,revision,packId,operation,prepare:true,chunked:true});}catch(error){pending.delete(id);reject(error);}});}catch(error){if(signal.aborted)throw error;}}
  await new Promise<void>(resolve=>setTimeout(resolve,0));
  if(signal.aborted)throw new Error('资料处理已中止');
  const resolved=revision||await hashCatalogJson(body);
  if(signal.aborted)throw new Error('资料处理已中止');
  return {revision:resolved,entries:fallback(structuredClone(body),resolved,packId,operation)};
 },dispose(){signal.removeEventListener('abort',stop);stop();}};
}
