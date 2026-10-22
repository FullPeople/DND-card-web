import type {Entry} from '../core/model';
import type {SourceMeta} from '../core/sourceCatalog';
import type {LoadProgress} from './catalog';

export const CATALOG_SNAPSHOT_SCHEMA='wiki-normalized-296-v1';
export type CatalogSnapshot={
 schema:string;scope:string;createdAt:number;entries:Entry[];
 sources:Record<string,SourceMeta>;progress:LoadProgress;
};
type Progress=(value:LoadProgress)=>void;
type Sources=(value:Record<string,SourceMeta>)=>void;
type Options={
 scope:string;signal:AbortSignal;refresh?:boolean;
 read:()=>Promise<unknown>;write:(value:CatalogSnapshot)=>Promise<void>;
 load:(batch:(entries:Entry[])=>void,progress:Progress,sources:Sources)=>Promise<void>;
 onBatch:(entries:Entry[])=>void;onProgress:Progress;onSources?:Sources;
};
function complete(progress:LoadProgress|undefined):progress is LoadProgress{
 return !!progress&&Number.isSafeInteger(progress.done)&&Number.isSafeInteger(progress.total)&&progress.total>0
  &&progress.done>=progress.total&&Array.isArray(progress.failed)&&progress.failed.length===0&&!progress.paused;
}
export function validCatalogSnapshot(value:unknown,scope:string):value is CatalogSnapshot{
 const row=value as CatalogSnapshot|undefined;
 return !!row&&row.schema===CATALOG_SNAPSHOT_SCHEMA&&row.scope===scope&&Number.isFinite(row.createdAt)
  &&Array.isArray(row.entries)&&row.entries.length>0&&row.entries.every(entry=>entry&&typeof entry.id==='string'
   &&typeof entry.name==='string'&&typeof entry.kind==='string'&&typeof entry.revision==='string'&&entry.raw&&typeof entry.raw==='object')
  &&!!row.sources&&typeof row.sources==='object'&&!Array.isArray(row.sources)&&complete(row.progress);
}
/** A complete parsed catalog is a reusable view. Partial refreshes never replace it. */
export async function loadCatalogSnapshot(options:Options):Promise<void>{
 const {scope,signal,onBatch,onProgress,onSources}=options;
 if(signal.aborted)return;
 if(!options.refresh){
  let cached:unknown;try{cached=await options.read();}catch{/* Raw-file caching and reading remain available. */}
  if(signal.aborted)return;
  if(validCatalogSnapshot(cached,scope)){
   onSources?.(cached.sources);
   if(signal.aborted)return;
   onBatch(cached.entries);
   if(!signal.aborted)onProgress({...cached.progress,failed:[],retry:[],cached:cached.progress.total,label:'本地资料缓存'});
   return;
  }
 }
 const entries=new Map<string,Entry>(),sources:Record<string,SourceMeta>={};
 let progress:LoadProgress|undefined;
 await options.load(batch=>{
  if(signal.aborted)return;for(const entry of batch)entries.set(entry.id,entry);onBatch(batch);
 },value=>{
  if(signal.aborted)return;progress={...value,failed:[...value.failed],retry:[...(value.retry||[])]};onProgress(value);
 },value=>{
  if(signal.aborted)return;Object.assign(sources,value);onSources?.(value);
 });
 if(signal.aborted||!complete(progress)||!entries.size)return;
 const snapshot:CatalogSnapshot={schema:CATALOG_SNAPSHOT_SCHEMA,scope,createdAt:Date.now(),entries:[...entries.values()],sources,progress};
 try{await options.write(snapshot);}catch{/* A full or unavailable cache must not fail usable rule data. */}
}
