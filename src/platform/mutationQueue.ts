/** Only unknown outcomes stop a chain. A terminal receipt unlocks future user
 * intents; it never replays operations that were waiting behind the lost write. */
export function mutationQueue(events:Pick<EventTarget,'addEventListener'>|undefined=typeof window==='undefined'?undefined:window){
 const chains=new Map<string,Promise<any>>(),unknown=new Map<string,any>();
 const blocked=(error:any)=>Object.assign(new Error(error.message),error,{queueBlocked:true});
 events?.addEventListener('workbench-operation-reconciled',((event:CustomEvent)=>{for(const [key,error] of unknown)if(error.requestId===event.detail?.requestId)unknown.delete(key);}) as EventListener);
 events?.addEventListener('workbench-operation-result',((event:CustomEvent)=>{if(event.detail?.uncertain)return;for(const [key,error] of unknown)if(error.requestId===event.detail?.requestId)unknown.delete(key);}) as EventListener);
 return {run<T>(key:string,send:(previous?:any)=>Promise<T>):Promise<T>{
  if(unknown.has(key))return Promise.reject(blocked(unknown.get(key)));
  const task=(chains.get(key)||Promise.resolve()).catch(error=>{if(error?.uncertain)throw blocked(error);}).then(previous=>{if(unknown.has(key))throw blocked(unknown.get(key));return send(previous);}).catch(error=>{if(error?.uncertain&&!error.queueBlocked&&!unknown.has(key))unknown.set(key,error);throw error;});
  chains.set(key,task);void task.finally(()=>{if(chains.get(key)===task)chains.delete(key);}).catch(()=>{});return task;
 }};
}
