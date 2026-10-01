import type {Character} from '../../core/model';
import {isApiError,isOperationResult,isSnapshot,type Account,type ApiError,type CharacterMeta,type CharacterSnapshot,type OperationBatch,type OperationResult} from '../../core/sync/protocol';
/**
 * The only HTTP wrapper for the Go backend. Browsers authenticate with the
 * HttpOnly session cookie; non-browser callers (tests, tools) may pass a Bearer
 * token. A transport failure or 5xx is reported as `uncertain`: the request may
 * still have committed, so callers must retry the identical body, never a new ID.
 */
export class ServerError extends Error {
  constructor(readonly status:number,readonly error:ApiError,readonly uncertain:boolean,readonly retryAfter?:number){super(error.message||error.code);}
  get code(){return this.error.code;}
}
export interface ApiOptions { baseUrl:string; token?:string; fetch?:typeof fetch; timeoutMs?:number }
export function serverOrigin(baseUrl:string){return new URL(baseUrl,typeof location==='undefined'?undefined:location.href).origin;}
const transport=(message:string)=>new ServerError(0,{code:'internal_error',message},true);
export class CharacterApi {
  readonly baseUrl:string;readonly origin:string;
  private readonly fetcher:typeof fetch;
  constructor(private readonly options:ApiOptions){
    this.baseUrl=new URL(options.baseUrl.replace(/\/+$/,''),typeof location==='undefined'?undefined:location.href).href;
    this.origin=new URL(this.baseUrl).origin;
    this.fetcher=options.fetch||((input,init)=>fetch(input,init));
  }
  /** WebSocket URL on the same site; credentials travel only in the cookie/header. */
  wsUrl(){const url=new URL(this.baseUrl+'/ws');url.protocol=url.protocol==='https:'?'wss:':'ws:';return url.href;}
  private async request<T>(path:string,init:RequestInit&{bearer?:string;signal?:AbortSignal}={}):Promise<T>{
    const headers:Record<string,string>={...(init.body?{'Content-Type':'application/json'}:{}),...(init.headers as Record<string,string>|undefined)};
    const token=init.bearer||this.options.token;if(token)headers.Authorization=`Bearer ${token}`;
    const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),this.options.timeoutMs??15000);
    const abort=()=>timeout.abort();init.signal?.addEventListener('abort',abort,{once:true});
    let response:Response;
    try{response=await this.fetcher(this.baseUrl+path,{...init,headers,credentials:'include',signal:timeout.signal});}
    catch(error){throw transport(timeout.signal.aborted?'请求超时或已取消，结果未知':`网络不可用：${String((error as Error)?.message||error)}`);}
    finally{clearTimeout(timer);init.signal?.removeEventListener('abort',abort);}
    if(response.status===204)return undefined as T;
    let body:unknown;
    try{body=await response.json();}catch{throw response.ok||response.status>=500?transport(`服务器响应无法解析（HTTP ${response.status}）`):new ServerError(response.status,{code:'internal_error',message:`HTTP ${response.status}`},false);}
    if(response.ok)return body as T;
    const retry=Number(response.headers.get('Retry-After'));
    const error=isApiError(body)?body:{code:'internal_error' as const,message:`HTTP ${response.status}`};
    throw new ServerError(response.status,error,response.status>=500,Number.isFinite(retry)&&retry>=0?retry:undefined);
  }
  login(token:string){return this.request<Account>('/session',{method:'POST',bearer:token});}
  logout(){return this.request<void>('/session',{method:'DELETE'});}
  me(){return this.request<Account>('/me');}
  list(limit=100,offset=0){return this.request<{characters:CharacterMeta[];limit:number;offset:number}>(`/characters?limit=${limit}&offset=${offset}`);}
  async listAll(){const rows:CharacterMeta[]=[];for(let offset=0;;offset+=100){const page=await this.list(100,offset);rows.push(...page.characters);if(page.characters.length<100||rows.length>=10000)return rows;}}
  async get(id:string){const snapshot=await this.request<unknown>(`/characters/${encodeURIComponent(id)}`);if(!isSnapshot(snapshot))throw transport('角色快照格式无效');return snapshot as CharacterSnapshot;}
  /** Not idempotent: on an uncertain result check the list before creating again. */
  async create(document:Character){const snapshot=await this.request<unknown>('/characters',{method:'POST',body:JSON.stringify({document})});if(!isSnapshot(snapshot))throw transport('角色快照格式无效');return snapshot as CharacterSnapshot;}
  async submit(id:string,batch:OperationBatch,signal?:AbortSignal){const result=await this.request<unknown>(`/characters/${encodeURIComponent(id)}/operations`,{method:'POST',body:JSON.stringify(batch),signal});if(!isOperationResult(result))throw transport('操作回执格式无效');return result;}
  async delta(id:string,afterRevision:number){
    const value=await this.request<{characterId:string;currentRevision:number;operations:unknown[]}>(`/characters/${encodeURIComponent(id)}/operations?afterRevision=${afterRevision}`);
    if(!Array.isArray(value?.operations)||!value.operations.every(isOperationResult))throw transport('增量格式无效');
    return value as {characterId:string;currentRevision:number;operations:OperationResult[]};
  }
  permissions(id:string){return this.request<{permissions:{userId:string;role:'owner'|'editor'|'viewer'}[]}>(`/characters/${encodeURIComponent(id)}/permissions`);}
  grant(id:string,userId:string,role:'editor'|'viewer'){return this.request<void>(`/characters/${encodeURIComponent(id)}/permissions/${encodeURIComponent(userId)}`,{method:'PUT',body:JSON.stringify({role})});}
  revoke(id:string,userId:string){return this.request<void>(`/characters/${encodeURIComponent(id)}/permissions/${encodeURIComponent(userId)}`,{method:'DELETE'});}
}
