import type {SyncPhase} from './sync';

/** Measures the existing sync transaction; it neither schedules nor retries writes. */
export function syncTiming(now:()=>number=()=>performance.now()){
 const started=new Map<string,number>(),elapsed=new Map<string,number>();
 return {
  observe(id:string,phase:SyncPhase){
   if(phase==='syncing'){if(!started.has(id))started.set(id,now());elapsed.delete(id);return;}
   const before=started.get(id);started.delete(id);
   if(phase==='saved'&&before!==undefined)elapsed.set(id,now()-before);
   else if(phase!=='saved')elapsed.delete(id);
  },
  read:(id:string)=>elapsed.get(id),
 };
}
