import type {Character} from '../core/model';
import {withRequestTimeout} from '../platform/requestTimeout';
export const qqRoom=typeof location==='undefined'?null:new URLSearchParams(location.search).get('qqRoom');
export type RoomState={id:string;cardId:string;revision:number;locked:boolean;owner:boolean;write:boolean;character:Character};
let current:RoomState|undefined;
export const roomState=()=>current;
export const roomEditorLock=qqRoom?'dnd-qq-room-editor:'+qqRoom:'dnd-card-editor';
const listeners=new Set<()=>void>();
export const subscribeRoom=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
function update(value:RoomState){current=value;listeners.forEach(listener=>listener());return value;}
function credentials(){
  let token='';try{const value=JSON.parse(localStorage.getItem('dnd-qq-plugin')||'null');if(value?.expiresAt>Date.now())token=value.token;}catch{}
  const capability=new URLSearchParams(location.hash.slice(1)).get('cap')||'';
  return {...token?{Authorization:'Bearer '+token}:{},'X-Room-Capability':capability};
}
export async function readRoom(){
  return withRequestTimeout(30000,undefined,async signal=>{
    const response=await fetch('https://dnd.center/api/room-cards/'+encodeURIComponent(qqRoom!),{headers:credentials(),credentials:'omit',cache:'no-store',signal});
    const data=await response.json();if(!response.ok){if(current)update({...current,write:false});throw Error(data.message||'房间卡读取失败。');}return update(data);
  });
}
export async function saveRoom(character:Character,revision:number){
  const headers=credentials();let csrf='';
  if('Authorization' in headers)csrf=await withRequestTimeout(30000,undefined,async signal=>{const response=await fetch('https://dnd.center/api/session',{headers,credentials:'omit',cache:'no-store',signal});return (await response.json()).csrf||'';});
  try{return await withRequestTimeout(30000,undefined,async signal=>{
    const response=await fetch('https://dnd.center/api/room-cards/'+encodeURIComponent(qqRoom!),{method:'PUT',credentials:'omit',headers:{...headers,'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({character,revision}),signal});
    const data=await response.json();if(!response.ok){if(response.status===403&&current)update({...current,write:false});throw Object.assign(Error(data.message||'房间卡保存失败，本机草稿保留。'),{status:response.status});}return update(data);
  });}catch(error){
    if(!(error as {status?:number}).status)try{const confirmed=await readRoom();if(confirmed.revision===revision+1&&JSON.stringify(confirmed.character)===JSON.stringify(character))return confirmed;}catch{}
    throw error;
  }
}
