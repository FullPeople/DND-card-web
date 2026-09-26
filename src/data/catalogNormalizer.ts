import type {Entry,Raw} from '../core/model';

/** Parsing/expansion must not monopolize the UI thread during the first download. */
export type CatalogOperation='normalize'|'monsters'|'magicItems';
export function catalogNormalizer(signal:AbortSignal,fallback:(body:Raw,revision:string,packId?:string,operation?:CatalogOperation)=>Entry[]){
 let worker:Worker|undefined,sequence=0;
 const pending=new Map<number,{resolve:(value:Entry[])=>void;reject:(error:Error)=>void}>();
 try{if(typeof Worker!=='undefined')worker=new Worker(new URL('./catalog.worker.ts',import.meta.url),{type:'module'});}catch{/* Browser/CSP fallback keeps reading available. */}
 const stop=()=>{worker?.terminate();worker=undefined;for(const job of pending.values())job.reject(new Error('资料处理已中止'));pending.clear();};
 if(worker){worker.onmessage=({data})=>{const job=pending.get(data.id);if(!job)return;pending.delete(data.id);if(data.error)job.reject(new Error(data.error));else job.resolve(data.entries);};worker.onerror=()=>{stop();};}
 signal.addEventListener('abort',stop,{once:true});
 return {async normalize(body:Raw,revision:string,packId?:string,operation:CatalogOperation='normalize'):Promise<Entry[]>{
  if(signal.aborted)throw new Error('资料处理已中止');
  if(worker){try{return await new Promise<Entry[]>((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});try{worker!.postMessage({id,body,revision,packId,operation});}catch(error){pending.delete(id);reject(error);}});}catch(error){if(signal.aborted)throw error;}}
  await new Promise<void>(resolve=>setTimeout(resolve,0));if(signal.aborted)throw new Error('资料处理已中止');return fallback(body,revision,packId,operation);
 },dispose(){signal.removeEventListener('abort',stop);stop();}};
}
