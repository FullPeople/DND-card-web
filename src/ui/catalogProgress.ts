import type {LoadProgress} from '../data/catalog';

const sameList=(a:readonly string[]|undefined,b:readonly string[]|undefined)=>a===b||!!a&&!!b&&a.length===b.length&&a.every((value,index)=>value===b[index]);
function sameProgress(a:LoadProgress,b:LoadProgress){
 return a.done===b.done&&a.total===b.total&&a.label===b.label&&a.cached===b.cached&&a.paused===b.paused
  &&sameList(a.failed,b.failed)&&sameList(a.retry,b.retry)&&sameList(a.recovered,b.recovered);
}
function snapshot(value:LoadProgress):LoadProgress{
 return {...value,failed:[...value.failed],...(value.retry?{retry:[...value.retry]}:{}),...(value.recovered?{recovered:[...value.recovered]}:{})};
}
/** Each mounted App owns its progress; it never owns rule or character data. */
export function catalogProgressStore(initial:LoadProgress){
 let current=snapshot(initial);
 const listeners=new Set<()=>void>();
 return {
  getSnapshot:()=>current,
  subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
  publish:(value:LoadProgress)=>{
   if(sameProgress(current,value))return;
   current=snapshot(value);for(const listener of listeners)listener();
  },
 };
}
export type CatalogProgressStore=ReturnType<typeof catalogProgressStore>;
