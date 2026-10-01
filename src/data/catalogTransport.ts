import {withRequestTimeout} from '../platform/requestTimeout';
import type {Raw} from '../core/model';

class HttpError extends Error {
 constructor(readonly status:number,readonly retryAfter:string|null){super(`HTTP ${status}`);}
}
export class CatalogPausedError extends Error {}
const transient=(error:unknown)=>error instanceof TypeError || error instanceof DOMException&&['TimeoutError','AbortError'].includes(error.name) || error instanceof HttpError&&[408,425,429,500,502,503,504].includes(error.status);
function retryDelay(error:unknown,attempt:number){
 const fallback=attempt?1200:400;
 if(!(error instanceof HttpError)||!error.retryAfter)return fallback;
 const seconds=Number(error.retryAfter),date=Date.parse(error.retryAfter);
 const delay=Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?date-Date.now():fallback;
 return Math.max(fallback,Math.min(30000,delay));
}
function wait(milliseconds:number,signal:AbortSignal){
 return new Promise<void>((resolve,reject)=>{
  if(signal.aborted){reject(signal.reason);return;}
  const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason);};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},milliseconds);
  signal.addEventListener('abort',abort,{once:true});
 });
}

/** Retries belong to one loading session. A broken origin must not flood the whole file queue. */
export function catalogTransport(signal:AbortSignal){
 const origins=new Map<string,{failures:number;retryAt:number;paused?:CatalogPausedError}>();
 return {
  get paused(){return [...origins.values()].find(state=>state.paused)?.paused;},
  async json(url:string):Promise<{body:Raw;etag:string|null}>{
   const origin=new URL(url).origin;
   let state=origins.get(origin);if(!state){state={failures:0,retryAt:0};origins.set(origin,state);}
   for(let attempt=0;;attempt++){
    if(signal.aborted)throw signal.reason;
    if(state.paused)throw state.paused;
    // Share server/network cooldown with the other readers of this origin.
    while(state.retryAt>Date.now()){
     await wait(state.retryAt-Date.now(),signal);
     if(state.paused)throw state.paused;
    }
    try{
     const result=await withRequestTimeout(20000,signal,async requestSignal=>{
      const response=await fetch(url,{signal:requestSignal,cache:'no-cache'});
      if(!response.ok)throw new HttpError(response.status,response.headers.get('Retry-After'));
      const body=await response.json();
      if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('资料格式不正确');
      return {body,etag:response.headers.get('etag')};
     });
     state.failures=0;return result;
    }catch(error){
     if(signal.aborted)throw signal.reason;
     if(!transient(error)){state.failures=0;throw error;}
     if(attempt<2){state.retryAt=Math.max(state.retryAt,Date.now()+retryDelay(error,attempt));continue;}
     if(++state.failures>=2)state.paused=new CatalogPausedError(`${origin} 连接持续失败，已暂停后续请求；已有资料仍可使用，请恢复连接后重试。`);
     throw error;
    }
   }
  }
 };
}
