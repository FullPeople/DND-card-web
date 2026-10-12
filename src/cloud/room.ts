import type {Character} from '../core/model';
import {withRequestTimeout} from '../platform/requestTimeout';
import {workspaceIdentity} from '../platform/workspaceIdentity';
import {authorizationLease} from './authorizationLease';
export const qqRoom=typeof location==='undefined'?null:new URLSearchParams(location.search).get('qqRoom');
export type RoomState={id:string;cardId:string;revision:number;locked:boolean;owner:boolean;write:boolean;character:Character;authorization?:'checking'|'verified'|'readonly'|'expired'};
let current:RoomState|undefined,currentScope:string|undefined,readGeneration=0;
let pendingRead:{scope:string;generation:number;promise:Promise<RoomState>}|undefined;
export const roomEditorLock=workspaceIdentity.editorLock;
const listeners=new Set<()=>void>();
const notify=()=>listeners.forEach(listener=>listener());
const authorization=authorizationLease(()=>roomChangeScope(),notify);
export const roomState=()=>{const permitted=authorization.check();return current?{...current,owner:currentScope===roomChangeScope()&&current.owner,write:currentScope===roomChangeScope()&&permitted&&current.write,authorization:authorization.snapshot().phase}:undefined;};
export const invalidateRoomAuthorization=()=>{readGeneration++;authorization.invalidate();};
export const subscribeRoom=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
function update(value:RoomState,scope=roomChangeScope()){current=value;currentScope=scope;notify();return value;}
function credentials(){
  let token='';try{const value=JSON.parse(localStorage.getItem('dnd-qq-plugin')||'null');if(value?.expiresAt>Date.now())token=value.token;}catch{}
  const capability=typeof location==='undefined'?'':new URLSearchParams(location.hash.slice(1)).get('cap')||'';
  return {...token?{Authorization:'Bearer '+token}:{},'X-Room-Capability':capability};
}
export function roomChangeScope(){return JSON.stringify([qqRoom,credentials()]);}
export type RoomInfo={id:string;cardId:string;name:string;revision:number;owner:boolean;editor:boolean;write:boolean;locked:boolean;ownerAccountId:string;ownerNickname:string;editors?:string[]};
async function roomRequest(path:string,method='GET',body?:unknown){
 const headers=credentials(),scope=roomChangeScope();let csrf='';
 if(method!=='GET'&&'Authorization' in headers)csrf=await withRequestTimeout(30000,undefined,async signal=>{const response=await fetch('https://dnd.center/api/session',{headers,credentials:'omit',cache:'no-store',signal});const data=await response.json();if(!response.ok||!data.authenticated)throw Error('QQ 登录已失效，请重新连接。');return data.csrf||'';});
 if(scope!==roomChangeScope())throw Error('QQ 账号或房间连接已改变，请重新操作。');
 if(method!=='GET'&&!authorization.check())throw Object.assign(Error('云端编辑权限尚未核验或已过期，请先核对。'),{notSent:true});
 return withRequestTimeout(30000,undefined,async signal=>{const response=await fetch('https://dnd.center/api/'+path,{method,credentials:'omit',cache:'no-store',signal,headers:{...headers,...body===undefined?{}:{'Content-Type':'application/json'},...csrf?{'X-CSRF-Token':csrf}:{}},...body===undefined?{}:{body:JSON.stringify(body)}});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.message||'云端卡操作失败。'),{status:response.status});if(scope!==roomChangeScope())throw Error('QQ 账号或房间连接已改变，请重新核对。');return data;});
}
export async function roomInfo():Promise<RoomInfo>{const scope=roomChangeScope(),generation=++readGeneration,read=authorization.beginRead(),info=await roomRequest('room-cards/'+encodeURIComponent(qqRoom!)+'?summary=1') as RoomInfo;if(scope!==roomChangeScope()||generation!==readGeneration||!authorization.accepts(read))throw Error('已有更新的授权核验，已忽略旧响应。');if(currentScope===scope&&current)update({...current,owner:info.owner,write:info.write,locked:info.locked},scope);authorization.verifyRead(read,info.write);return info;}
export async function lockRoom(locked:boolean){const info=await roomInfo();if(!info.owner)throw Error('只有卡主可以修改房间授权。');await roomRequest('room-cards/'+encodeURIComponent(qqRoom!)+'/lock','PUT',{locked});await readRoom();return roomInfo();}
export async function grantRoomEditor(accountId:string,revoke=false){const info=await roomInfo();if(!info.owner)throw Error('只有卡主可以修改账号授权。');await roomRequest('cards/'+encodeURIComponent(info.cardId)+'/editors','POST',{accountId,revoke});await readRoom();return roomInfo();}
export async function removeRoom(){const info=await roomInfo();if(!info.owner)throw Error('只有卡主可以移出房间卡。');await roomRequest('room-cards/'+encodeURIComponent(qqRoom!),'DELETE',{});authorization.invalidate('readonly');}
export async function roomChangeNotice(cursor:string|undefined,signal:AbortSignal){
 const headers=credentials();
 return withRequestTimeout(30000,signal,async requestSignal=>{
  const response=await fetch('https://dnd.center/api/changes',{method:'POST',headers:{...headers,'Content-Type':'application/json'},credentials:'omit',cache:'no-store',signal:requestSignal,body:JSON.stringify({cursor,rooms:[{id:qqRoom,capability:headers['X-Room-Capability']}]})});
  const data=await response.json();if(!response.ok)throw Object.assign(Error(data.message||'房间变更读取失败。'),{status:response.status});return data;
 });
}
export async function readRoom(fresh=false){
  const scope=roomChangeScope(),previous=currentScope===scope?current:undefined,generation=++readGeneration,read=authorization.beginRead();
  const query=!fresh&&previous?'?since='+previous.revision:'';
  const promise=withRequestTimeout(30000,undefined,async signal=>{
    const response=await fetch('https://dnd.center/api/room-cards/'+encodeURIComponent(qqRoom!)+query,{headers:credentials(),credentials:'omit',cache:'no-store',signal});
    const data=await response.json();if(scope!==roomChangeScope())throw Error('QQ 账号或房间连接已改变，已忽略旧读取。');
    if(generation!==readGeneration||!authorization.accepts(read)){if(currentScope===scope&&current)return roomState()!;if(pendingRead?.scope===scope&&pendingRead.generation>generation)return pendingRead.promise;throw Error('已有更新的读取，已忽略旧响应。');}
    if(!response.ok){authorization.invalidate([401,403,404,410].includes(response.status)?'readonly':'checking');throw Object.assign(Error(data.message||'房间卡读取失败。'),{status:response.status});}
    if(data.unchanged&&(!previous||data.revision!==previous.revision)){authorization.invalidate();throw Error('云端版本核对失败，请重新读取完整角色卡。');}
    const latest=currentScope===scope?current:undefined,body=latest&&data.revision<latest.revision?{revision:latest.revision,character:latest.character}:data.unchanged?{character:previous!.character}:{};
    update({...data,...body},scope);authorization.verifyRead(read,data.write===true);return roomState()!;
  });
  pendingRead={scope,generation,promise};
  try{return await promise;}finally{if(pendingRead?.generation===generation)pendingRead=undefined;}
}
export type RoomWriteOperation={id:string;scope:string;headers:ReturnType<typeof credentials>;characterId?:string;payload?:string;revision:number;startedAt:number;phase:'pending'|'not-sent'|'uncertain'|'confirmed'|'rejected';sent:boolean;confirmedRevision?:number};
export function beginRoomWrite(revision:number):RoomWriteOperation{return {id:crypto.randomUUID(),scope:roomChangeScope(),headers:credentials(),characterId:current?.character.id,revision,startedAt:Date.now(),phase:'pending',sent:false};}
export async function roomScopeKey(scope=roomChangeScope()){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(scope)))].map(value=>value.toString(16).padStart(2,'0')).join('');}
export async function roomWriteReceipt(operation:RoomWriteOperation){return {id:operation.id,scopeKey:await roomScopeKey(operation.scope),room:qqRoom,revision:operation.revision,startedAt:operation.startedAt,phase:operation.phase,sent:operation.sent,confirmedRevision:operation.confirmedRevision};}
function assertWrite(operation:RoomWriteOperation){if(operation.scope!==roomChangeScope())throw Object.assign(Error('QQ 账号或房间连接已改变，原操作未发送，本机草稿保留。'),{notSent:true});if(!roomState()?.write)throw Object.assign(Error('云端编辑权限尚未核验或已过期，请先核对；本机草稿保留。'),{notSent:true});}
function acceptWrite(operation:RoomWriteOperation,value:RoomState){operation.phase='confirmed';operation.confirmedRevision=value.revision;if(operation.scope!==roomChangeScope())throw Object.assign(Error('原操作已确认，但 QQ 账号或房间连接已改变；原草稿保留。'),{scopeChanged:true,confirmed:true});if(currentScope===operation.scope&&current&&value.revision>=current.revision)update({...current,character:value.character,revision:value.revision},operation.scope);return roomState()??{...value,owner:false,write:false};}
export async function saveRoom(character:Character,revision:number,operation=beginRoomWrite(revision)){
 let permissionGeneration=authorization.snapshot().generation;
 try{
  const payload=structuredClone(character),body=JSON.stringify({character:payload,revision:operation.revision});
  operation.payload=JSON.stringify(payload);
  assertWrite(operation);let csrf='';
  if('Authorization' in operation.headers)csrf=await withRequestTimeout(30000,undefined,async signal=>{const response=await fetch('https://dnd.center/api/session',{headers:operation.headers,credentials:'omit',cache:'no-store',signal});const data=await response.json();if(!response.ok||!data.authenticated)throw Object.assign(Error('QQ 登录已失效，本机草稿保留。'),{notSent:true});return data.csrf||'';});
  return await withRequestTimeout(30000,undefined,async signal=>{
   assertWrite(operation);permissionGeneration=authorization.snapshot().generation;operation.sent=true;operation.phase='uncertain';
   const response=await fetch('https://dnd.center/api/room-cards/'+encodeURIComponent(qqRoom!),{method:'PUT',credentials:'omit',headers:{...operation.headers,'Content-Type':'application/json','X-CSRF-Token':csrf},body,signal});
   const data=await response.json();if(!response.ok){operation.phase='rejected';if([401,403].includes(response.status)&&operation.scope===roomChangeScope()&&permissionGeneration===authorization.snapshot().generation)authorization.invalidate('readonly');throw Object.assign(Error(data.message||'房间卡保存失败，本机草稿保留。'),{status:response.status});}return acceptWrite(operation,data);
  });
 }catch(error){
  if(!operation.sent){operation.phase='not-sent';throw Object.assign(error instanceof Error?error:Error(String(error)),{notSent:true});}
  if(operation.phase==='uncertain'&&operation.scope===roomChangeScope())try{const confirmed=await readRoom(true);if(operation.scope===roomChangeScope()&&confirmed.revision===operation.revision+1&&JSON.stringify(confirmed.character)===operation.payload)return acceptWrite(operation,confirmed);}catch{}
  throw error;
 }
}
