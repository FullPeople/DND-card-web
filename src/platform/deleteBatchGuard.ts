/** Owned by App, so dismissing/reopening a manager cannot replay a live batch. */
export function deleteBatchGuard(){
 let running=false;
 return {async run<T>(action:()=>Promise<T>):Promise<T>{
  if(running)throw Error('上一批删除仍在处理中，请等待确认结果后再操作。');
  running=true;try{return await action();}finally{running=false;}
 }};
}
