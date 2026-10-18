export type SheetReadiness='ready'|'loading'|'changed';
/** Observe actual content readiness. Two animation frames do not load a chunk. */
export function waitForRenderedSheet(read:()=>SheetReadiness,watch:(check:()=>void)=>()=>void,timeoutMs=15000):Promise<void>{
 const first=read();
 if(first==='ready')return Promise.resolve();
 if(first==='changed')return Promise.reject(Error('角色或页面已切换，已停止导出'));
 return new Promise((resolve,reject)=>{
  let stop:()=>void=()=>{},timer:ReturnType<typeof setTimeout>|undefined,finished=false;
  const finish=(error?:Error)=>{if(finished)return;finished=true;clearTimeout(timer);stop();error?reject(error):resolve();};
  const check=()=>{const state=read();if(state==='ready')finish();else if(state==='changed')finish(Error('角色或页面已切换，已停止导出'));};
  stop=watch(check);if(finished){stop();return;}
  timer=setTimeout(()=>finish(Error(read()==='changed'?'角色或页面已切换，已停止导出':'角色卡页面仍在加载，未生成文件。请稍后重试。')),timeoutMs);
  check();
 });
}
