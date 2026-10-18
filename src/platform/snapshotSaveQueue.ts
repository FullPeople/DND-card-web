type Waiter={resolve:()=>void;reject:(reason:unknown)=>void};
type Batch<T>={snapshot:T;waiters:Waiter[];barrier:boolean};
/** Coalesce replaceable LOCAL snapshots, never remote operations or explicit barriers.
 * Every caller settles only after the snapshot containing its edit is durable. */
export function snapshotSaveQueue<T>(write:(snapshot:T)=>Promise<void>,{coalesce=true,delay=40}={}){
 const batches:Batch<T>[]=[];let running=false,timer:ReturnType<typeof setTimeout>|undefined;
 function flush(){
  if(timer!==undefined){clearTimeout(timer);timer=undefined;}
  if(running)return;
  const batch=batches.shift();if(!batch)return;running=true;
  void Promise.resolve().then(()=>write(batch.snapshot)).then(
   ()=>batch.waiters.forEach(waiter=>waiter.resolve()),
   error=>batch.waiters.forEach(waiter=>waiter.reject(error)),
  ).finally(()=>{running=false;flush();});
 }
 return {enqueue(snapshot:T,barrier=false):Promise<void>{
  const result=new Promise<void>((resolve,reject)=>{
   const last=batches.at(-1),waiter={resolve,reject};
   if(coalesce&&!barrier&&last&&!last.barrier){last.snapshot=snapshot;last.waiters.push(waiter);}
   else batches.push({snapshot,waiters:[waiter],barrier});
  });
  if(!coalesce||barrier)flush();else if(!running&&timer===undefined)timer=setTimeout(flush,delay);
  return result;
 },flush};
}
