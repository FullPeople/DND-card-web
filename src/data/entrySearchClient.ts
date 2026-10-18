import {searchEntryRows,type SearchRow} from './entrySearchTask';
export function entrySearchClient(rows:SearchRow[]){
 let worker:Worker|undefined,initialized=false,disabled=false,sequence=0;
 const jobs=new Map<number,{resolve:(indices:number[])=>void;reject:(error:unknown)=>void}>();
 const stop=()=>{worker?.terminate();worker=undefined;disabled=true;for(const job of jobs.values())job.reject(Error('Search worker unavailable'));jobs.clear();};
 function start(){
  if(initialized||disabled)return;initialized=true;
  try{if(typeof Worker==='undefined')return;worker=new Worker(new URL('./entrySearch.worker.ts',import.meta.url),{type:'module'});
   worker.onmessage=({data})=>{const job=jobs.get(data.id);if(!job)return;jobs.delete(data.id);if(data.error)job.reject(Error(data.error));else job.resolve(data.indices);};
   worker.onerror=stop;worker.postMessage({id:0,rows});
  }catch{stop();}
 }
 return {async search(query:string,signal:AbortSignal):Promise<number[]|undefined>{
  if(signal.aborted)return;start();const id=++sequence;
  const cancel=()=>{jobs.get(id)?.resolve([]);jobs.delete(id);worker?.postMessage({id:++sequence});};
  signal.addEventListener('abort',cancel,{once:true});
  try{
   if(worker){try{const indices=await new Promise<number[]>((resolve,reject)=>{jobs.set(id,{resolve,reject});try{worker!.postMessage({id,query});}catch(error){jobs.delete(id);reject(error);}});return signal.aborted?undefined:indices;}catch{stop();}}
   return await searchEntryRows(rows,query,()=>signal.aborted);
  }finally{signal.removeEventListener('abort',cancel);}
 },dispose:stop};
}
