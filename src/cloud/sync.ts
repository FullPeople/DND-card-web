import {openDB} from 'idb';
import type {Character} from '../core/model';
import {cloudCards,cloudMutation,cloudSession,readCloudCard,CloudRequestError,type CloudCard} from './api';
import type {CloudBinding} from '../platform/storage';

export type SyncPhase='local'|'saved'|'syncing'|'error'|'conflict'|'uncertain';
export interface SyncState {phase:SyncPhase;cloudId?:string;message?:string}
export interface SyncReceipt {binding?:CloudBinding;hash?:string;pending?:{accountId:string;hash:string;revision?:number;cloudId?:string;startedAt?:number};lastError?:{phase:SyncPhase;message:string}}
export interface SyncDependencies {
 readCharacter:(id:string)=>Promise<Character>;
 readReceipt:(id:string)=>Promise<SyncReceipt>;
 writeReceipt:(id:string,receipt:SyncReceipt)=>Promise<void>;
 session:typeof cloudSession;read:typeof readCloudCard;directory:typeof cloudCards;mutation:typeof cloudMutation;
 hash:(character:Character)=>Promise<string>;
 lock:<T>(id:string,action:()=>Promise<T>)=>Promise<T>;
 changed:(id:string,state:SyncState)=>void;
}
// The persisted pending operation prevents an unknown network outcome from
// becoming a duplicate upload or a blind overwrite after reopening the page.
export function createCloudSync(deps:SyncDependencies){
 const flights=new Map<string,Promise<void>>();
 const state=(id:string,phase:SyncPhase,receipt:SyncReceipt,message?:string)=>deps.changed(id,{phase,cloudId:receipt.binding?.cloudId||receipt.pending?.cloudId,message});
 async function reconcile(id:string,receipt:SyncReceipt){
  const pending=receipt.pending!;
  const session=await deps.session(),actor=session.authenticated?session.account?.id:session.uploadOwner?.id;
  if(actor!==pending.accountId)throw new CloudRequestError(401,'account_changed','登录账号或上传浏览器已改变。本机草稿保留。');
  const directory=pending.cloudId?undefined:await deps.directory();
  const candidates=pending.cloudId?[await deps.read(pending.cloudId)]:await Promise.all((directory!.mine||directory!.cards.filter(row=>row.role)).map(row=>deps.read(row.id)));
  const matched=[];
  for(const card of candidates)if(card.role&&card.character.id===id&&await deps.hash(card.character)===pending.hash&&(!pending.cloudId||card.revision===pending.revision!+1))matched.push(card);
  if(matched.length!==1)throw Error('上次同步结果尚未确认，已暂停重复上传。请在云端存储中核对，本机草稿保留。');
  const card=matched[0],next:SyncReceipt={binding:{accountId:pending.accountId,cloudId:card.id,revision:card.revision},hash:pending.hash};
  await deps.writeReceipt(id,next);return next;
 }
 function run(id:string,confirmedAccount?:string){
  const existing=flights.get(id);if(existing)return existing;
  const task=deps.lock(id,async()=>{
   let receipt:SyncReceipt={};
   try{
    receipt=await deps.readReceipt(id);
    if(confirmedAccount&&receipt.lastError){receipt={...receipt,lastError:undefined};await deps.writeReceipt(id,receipt);}
    if(receipt.pending){state(id,'syncing',receipt);receipt=await reconcile(id,receipt);}
    if(!receipt.binding&&!confirmedAccount){state(id,'local',receipt);return;}
    state(id,'syncing',receipt);
    // Old bindings remain usable, but their original revision must still match.
    // Never adopt a newer remote revision to make a stale draft pass CAS.
    if(receipt.binding&&!receipt.hash){
     const remote=await deps.read(receipt.binding.cloudId);
     if(remote.revision!==receipt.binding.revision)throw new CloudRequestError(409,'revision_conflict','云端已有其他修改。请先核对云端版本，本机草稿保留。');
     receipt={...receipt,hash:await deps.hash(remote.character)};await deps.writeReceipt(id,receipt);
    }
    for(;;){
     const snapshot=await deps.readCharacter(id),hash=await deps.hash(snapshot);
     if(receipt.binding&&receipt.hash===hash){state(id,'saved',receipt);return;}
     const account=receipt.binding?.accountId||confirmedAccount!;
     if(confirmedAccount&&confirmedAccount!==account)throw new CloudRequestError(401,'account_changed','原上传浏览器或账号已改变。本机草稿保留。');
     const pending={accountId:account,hash,revision:receipt.binding?.revision,cloudId:receipt.binding?.cloudId,startedAt:Date.now()};
     receipt={...receipt,pending};await deps.writeReceipt(id,receipt);
     let saved:CloudCard;
     try{saved=await deps.mutation<CloudCard>(account,receipt.binding?'cards/'+receipt.binding.cloudId:'cards',receipt.binding?'PUT':'POST',{character:snapshot,revision:receipt.binding?.revision,confirmUpload:true,confirmPublicTemporary:true});}
     catch(error){if(error instanceof CloudRequestError&&error.status<500&&error.status!==408){receipt={...receipt,pending:undefined};await deps.writeReceipt(id,receipt);}throw error;}
     receipt={binding:{accountId:account,cloudId:saved.id,revision:saved.revision},hash};await deps.writeReceipt(id,receipt);
     // Edits made while the request was running are saved in the next revision.
     // The uploaded snapshot is never written back over the local character.
    }
   }catch(error){
    const phase=receipt.pending?'uncertain':error instanceof CloudRequestError&&error.status===409?'conflict':'error',message=error instanceof Error?error.message:String(error);
    receipt={...receipt,lastError:{phase,message}};try{await deps.writeReceipt(id,receipt);}catch{}
    state(id,phase,receipt,message);
   }
  }).catch(error=>deps.changed(id,{phase:'error',message:error instanceof Error?error.message:String(error)})).finally(()=>flights.delete(id));
  flights.set(id,task);return task;
 }
 return {run};
}

export async function characterHash(character:Character){
 const {id,revision,updatedAt,...content}=character;
 const stable=(value:unknown):unknown=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,row])=>[key,stable(row)])):value;
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable(content))));
 return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function readSyncReceipt(id:string):Promise<SyncReceipt>{
 return (await readSyncReceipts([id]))[id];
}
export async function readSyncReceipts(ids:string[]):Promise<Record<string,SyncReceipt>>{
 if(!ids.length)return {};
 const db=await openDB('dnd-card-standalone',1);try{
  const tx=db.transaction('documents','readonly');
  const rows=await Promise.all(ids.map(async id=>{const [binding,receipt]=await Promise.all([tx.store.get('cloud-binding:'+id),tx.store.get('cloud-sync:'+id)]);return [id,{...receipt,binding}] as const;}));await tx.done;
  return Object.fromEntries(rows);
 }finally{db.close();}
}
export async function writeSyncReceipt(id:string,receipt:SyncReceipt){
 const db=await openDB('dnd-card-standalone',1);try{
  const tx=db.transaction('documents','readwrite');
  if(receipt.binding)await tx.store.put(receipt.binding,'cloud-binding:'+id);
  await tx.store.put(receipt,'cloud-sync:'+id);await tx.done;
 }finally{db.close();}
 const notice={id,pending:!!receipt.pending,failed:!!receipt.lastError};
 window.dispatchEvent(new CustomEvent('cloud-binding-changed',{detail:notice}));
 if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel('dnd-card-cloud');channel.postMessage(notice);channel.close();}
}
export function cloudCardLock<T>(id:string,action:()=>Promise<T>){return navigator.locks?navigator.locks.request('dnd-card-cloud:'+id,action):action();}
