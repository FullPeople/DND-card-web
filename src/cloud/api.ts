import type {Character} from '../core/model';
export interface CloudCard {id:string;revision:number;character:Character;updatedAt:string;role?:'owner'|'editor';editors?:string[]}
export interface CardSummary {id:string;revision:number;name:string;edition:string;updatedAt:string;role:'owner'|'editor'}
export interface Slots {free:number;permanent:number;total:number;used:number;priceYuan:number;paymentAvailable:boolean}
export interface CloudSession {authenticated:boolean;qqLogin:'pending';account?:{id:string;qq:string|null};csrf?:string;slots?:Slots}
export class CloudRequestError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
async function request<T>(path:string,method='GET',value?:unknown,csrf?:string):Promise<T>{
  const response=await fetch('/api/'+path,{method,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(30_000),headers:{...(value===undefined?{}:{'Content-Type':'application/json'}),...(csrf?{'X-CSRF-Token':csrf}:{})},...(value===undefined?{}:{body:JSON.stringify(value)})});
  const data=await response.json();if(!response.ok)throw new CloudRequestError(response.status,data.error||'request_failed',data.message||'云端操作失败，本机草稿保留。');return data as T;
}
export const cloudSession=()=>request<CloudSession>('session');
export const cloudCards=()=>request<{cards:CardSummary[];slots:Slots}>('cards');
export const readCloudCard=(id:string)=>request<CloudCard>('cards/'+encodeURIComponent(id));
// Re-read the authoritative session before every mutation. A tab from a former
// account must never save its pending operation under a newly signed-in account.
export async function cloudMutation<T>(accountId:string,path:string,method:string,value?:unknown){
  const session=await cloudSession();
  if(!session.authenticated||session.account?.id!==accountId||!session.csrf)throw new CloudRequestError(401,'account_changed','登录账号已改变。请刷新卡库后重新确认，本机草稿保留。');
  return request<T>(path,method,value,session.csrf);
}
export const cloudViewUrl=(id:string)=>'/card/?legacyViewer=1&cloud='+encodeURIComponent(id);
