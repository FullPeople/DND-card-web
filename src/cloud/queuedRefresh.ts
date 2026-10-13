/** Coalesce concurrent invalidations while guaranteeing a final fresh read. */
export function queuedRefresh(run:()=>Promise<void>){
 let alive=true,requested=false,flight:Promise<void>|undefined;
 const request=():Promise<void>=>{
  if(!alive)return Promise.resolve();requested=true;
  if(flight)return flight;
  const pending=Promise.resolve().then(async()=>{while(alive&&requested){requested=false;await run();}});
  const tracked=pending.then(()=>{if(flight===tracked)flight=undefined;if(alive&&requested)return request();},error=>{if(flight===tracked)flight=undefined;throw error;});
  flight=tracked;return tracked;
 };
 return {request,stop(){alive=false;requested=false;}};
}
