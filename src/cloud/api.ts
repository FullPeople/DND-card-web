import type {Character} from '../core/model';
import {withRequestTimeout} from '../platform/requestTimeout';
export interface CloudCard {id:string;revision:number;character:Character;updatedAt:string;role?:'owner'|'editor';editors?:string[];ownerNickname?:string;ownerAccountId?:string}
export interface CardSummary {id:string;revision:number;name:string;edition:string;updatedAt:string;role?:'owner'|'editor'}
export interface Slots {total:number;used:number}
export interface IPSlots {scope:'ip';total:number;used:number}
export interface CloudSession {authenticated:boolean;qqLogin:'pending'|'ready';libraryMode?:'account'|'temporary';temporaryUpload?:boolean;uploadOwner?:{id:string};account?:{id:string;qq:string|null;nickname?:string;avatar?:string};csrf?:string;slots?:Slots|IPSlots}
export interface Directory {cards:CardSummary[];mine?:CardSummary[];temporary?:CardSummary[];slots:Slots|IPSlots;accountId?:string;total?:number;offset?:number;hasMore?:boolean}
export class CloudRequestError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
async function request<T>(path:string,method='GET',value?:unknown,csrf?:string):Promise<T>{
  // The library build targets Safari 15.4, which lacks AbortSignal.timeout; the
  // shared helper keeps the deadline alive through body consumption everywhere.
  return withRequestTimeout(30_000,undefined,async signal=>{
    const response=await fetch('/api/'+path,{method,credentials:'same-origin',cache:'no-store',signal,headers:{...(value===undefined?{}:{'Content-Type':'application/json'}),...(csrf?{'X-CSRF-Token':csrf}:{})},...(value===undefined?{}:{body:JSON.stringify(value)})});
    const data=await response.json();if(!response.ok)throw new CloudRequestError(response.status,data.error||'request_failed',data.message||'云端操作失败，本机草稿保留。');return data as T;
  });
}
const sessionListeners=new Set<()=>void>();
let sessionGeneration=0,sessionFlight:Promise<CloudSession>|undefined,sessionChannel:BroadcastChannel|undefined,sessionAnnounced=false;
function broadcastSessionChange(){
  if(typeof window==='undefined'||typeof BroadcastChannel==='undefined')return;
  try{const channel=sessionChannel||new BroadcastChannel('dnd-card-session');channel.postMessage({type:'session-changed'});if(channel!==sessionChannel)channel.close();}catch{/* Focus and the bounded poll still recheck the server when messaging is unavailable. */}
}
function invalidateSession(){sessionGeneration++;sessionFlight=undefined;for(const listener of sessionListeners)listener();}
export function announceCloudSessionChange(){invalidateSession();broadcastSessionChange();}
export function subscribeCloudSessionChanges(listener:()=>void){
  sessionListeners.add(listener);
  if(!sessionChannel&&typeof window!=='undefined'&&typeof BroadcastChannel!=='undefined')try{sessionChannel=new BroadcastChannel('dnd-card-session');sessionChannel.onmessage=event=>{if(event.data?.type==='session-changed')invalidateSession();};}catch{/* Keep the existing focus/online recovery path. */}
  return()=>{sessionListeners.delete(listener);if(!sessionListeners.size){sessionChannel?.close();sessionChannel=undefined;}};
}
// Share concurrent display reads without caching authorization. Mutations always
// start a new authoritative session request; stale in-flight results cannot
// restore the old account after a login or logout notification.
export function cloudSession({fresh=false}:{fresh?:boolean}={}):Promise<CloudSession>{
  if(!fresh&&sessionFlight)return sessionFlight;
  const generation=sessionGeneration;
  const pending=request<CloudSession>('session').then(value=>{
    if(generation!==sessionGeneration)return cloudSession({fresh});
    if(!sessionAnnounced){sessionAnnounced=true;broadcastSessionChange();}
    return value;
  });
  const tracked=pending.finally(()=>{if(sessionFlight===tracked)sessionFlight=undefined;});
  if(!fresh)sessionFlight=tracked;
  return tracked;
}
export async function cloudCards(offset=0,expectedAccountId?:string){const rows=await request<Directory>('cards?offset='+offset);if(expectedAccountId&&rows.accountId&&rows.accountId!==expectedAccountId){announceCloudSessionChange();throw new CloudRequestError(401,'account_changed','账号已改变，正在重新读取当前账号的卡库。');}return rows;}
export const readCloudCard=(id:string)=>request<CloudCard>('cards/'+encodeURIComponent(id));
// Re-read the authoritative session before every mutation. A tab from a former
// account must never save its pending operation under a newly signed-in account.
export async function cloudMutation<T>(accountId:string,path:string,method:string,value?:unknown){
  const session=await cloudSession({fresh:true});
  const actor=session.authenticated?session.account?.id:session.temporaryUpload?session.uploadOwner?.id:undefined;
  if(actor!==accountId||!session.csrf){announceCloudSessionChange();throw new CloudRequestError(401,'account_changed','登录账号或上传浏览器已改变。请刷新卡库后重新确认，本机草稿保留。');}
  const result=await request<T>(path,method,value,session.csrf);
  if(path==='logout')announceCloudSessionChange();
  return result;
}
export const cloudViewUrl=(id:string)=>'/card/?legacyViewer=1&cloud='+encodeURIComponent(id);
