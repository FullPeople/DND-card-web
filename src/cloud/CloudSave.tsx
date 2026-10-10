import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {Character} from '../core/model';
import {cloudCards,cloudMutation,cloudSession,readCloudCard} from './api';
import {characterHash,cloudCardLock,createCloudSync,readSyncReceipt,readSyncReceipts,writeSyncReceipt,type SyncState} from './sync';
import {UploadWarning} from './UploadWarning';
import './cloudSave.css';
import {QQLogin} from './QQLogin';

const CloudSaveContext=createContext<{states:Record<string,SyncState>;request:(id:string)=>void;beforeLogin:(id:string)=>Promise<void>;disabled:boolean}|undefined>(undefined);
export function CloudSaveProvider({enabled,disabled,characters,readCharacter,children,auto=true}:{enabled:boolean;disabled:boolean;auto?:boolean;characters:Character[];readCharacter:(id:string)=>Promise<Character>;children:ReactNode}){
 const [states,setStates]=useState<Record<string,SyncState>>({}),[target,setTarget]=useState<{id:string;name:string;account?:string;temporary?:boolean;error?:string}>(),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false);
 const latest=useRef({readCharacter,disabled,characters});latest.current={readCharacter,disabled,characters};
 const disposed=useRef(false),terminal=useRef<Record<string,SyncState>>({}),engine=useRef<ReturnType<typeof createCloudSync>|undefined>(undefined);
 if(!engine.current)engine.current=createCloudSync({readCharacter:async id=>{
  if(latest.current.disabled)throw Error('当前标签页只读，本机草稿保留。');
  // A new edit can extend App's local save queue while the first read waits.
  // Read again until the previously observed content has also been persisted.
  let before=await latest.current.readCharacter(id);
  for(;;){const after=await latest.current.readCharacter(id);if(await characterHash(before)===await characterHash(after))return before;before=after;}
 },readReceipt:readSyncReceipt,writeReceipt:writeSyncReceipt,session:cloudSession,read:readCloudCard,directory:cloudCards,mutation:cloudMutation,hash:characterHash,lock:cloudCardLock,changed:(id,state)=>{terminal.current[id]=state;if(!disposed.current)setStates(old=>({...old,[id]:state}));}});
 useEffect(()=>{disposed.current=false;return()=>{disposed.current=true;};},[]);
 useEffect(()=>{
  if(!enabled)return;
  let alive=true,refreshEpoch=0,pendingDeadline:ReturnType<typeof setTimeout>|undefined;
  const refresh=async()=>{
   const epoch=++refreshEpoch;clearTimeout(pendingDeadline);const receipts=await readSyncReceipts(latest.current.characters.map(character=>character.id));if(!alive||epoch!==refreshEpoch)return;
   let nextDeadline=Infinity;const updates:Record<string,SyncState>={};
   for(const character of latest.current.characters){const receipt=receipts[character.id];if(!receipt)continue;if(receipt.pending&&Date.now()<(receipt.pending.startedAt||0)+35000)nextDeadline=Math.min(nextDeadline,(receipt.pending.startedAt||0)+35000);
    updates[character.id]=receipt.lastError?{...receipt.lastError,cloudId:receipt.binding?.cloudId}:receipt.pending?{phase:Date.now()<(receipt.pending.startedAt||0)+35000?'syncing':'uncertain',cloudId:receipt.binding?.cloudId,message:'上次同步结果尚未确认，请重试核对。本机草稿保留。'}:receipt.binding?{phase:'saved',cloudId:receipt.binding.cloudId}:{phase:'local'};
   }
   setStates(old=>{const next={...old};for(const [id,state] of Object.entries(updates))if(state.phase==='syncing'||old[id]?.phase!=='syncing')next[id]=state;return next;});
   if(Number.isFinite(nextDeadline))pendingDeadline=setTimeout(()=>void refresh().catch(()=>{}),Math.max(1,nextDeadline-Date.now()));
  };
  void refresh().catch(()=>{});
  const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('dnd-card-cloud'):undefined;
  let refreshTimer:ReturnType<typeof setTimeout>;const changed=()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>void refresh().catch(()=>{}),40);};
  channel?.addEventListener('message',changed);window.addEventListener('cloud-binding-changed',changed);
  return()=>{alive=false;clearTimeout(pendingDeadline);clearTimeout(refreshTimer);channel?.close();window.removeEventListener('cloud-binding-changed',changed);};
 },[enabled,characters.map(character=>character.id).join('|')]);
 useEffect(()=>{
  if(!enabled||disabled||!auto)return;
  let alive=true;
  const timer=setTimeout(()=>{void (async()=>{const receipts=await readSyncReceipts(characters.map(character=>character.id));for(const character of characters){const receipt=receipts[character.id];if(!alive)return;if(receipt.binding&&!receipt.pending&&!receipt.lastError&&!['conflict','error','uncertain'].includes(states[character.id]?.phase||''))await engine.current!.run(character.id);}})().catch(()=>{});},650);
  return()=>{alive=false;clearTimeout(timer);};
 },[enabled,disabled,characters,auto,readCharacter]);
 async function request(id:string){
  const character=latest.current.characters.find(card=>card.id===id);if(!character||latest.current.disabled)return;
  setConfirmed(false);setTarget({id,name:character.name});
  try{const session=await cloudSession(),account=session.authenticated?session.account?.id:session.temporaryUpload?session.uploadOwner?.id:undefined;setTarget(old=>old?.id===id?{...old,account,temporary:!session.authenticated,error:account?undefined:'云端暂时无法保存。请保留本机 JSON 备份，稍后重试。'}:old);}
  catch{setTarget(old=>old?.id===id?{...old,error:'云端连接失败。请保留本机 JSON 备份，稍后重试。'}:old);}
 }
 return <CloudSaveContext.Provider value={enabled?{states,request:id=>void request(id),beforeLogin:async id=>{if(!latest.current.disabled)await latest.current.readCharacter(id);},disabled}:undefined}>{children}
 {target&&<CloudUploadDialog target={target} confirmed={confirmed} busy={busy} disabled={disabled} change={setConfirmed} cancel={()=>setTarget(undefined)} submit={async()=>{if(!confirmed||!target.account||busy||disabled)return;setBusy(true);try{await engine.current!.run(target.id,target.account);const result=terminal.current[target.id];if(result?.phase==='saved')setTarget(undefined);else setTarget(old=>old?{...old,error:result?.message||'同步未成功，本机草稿保留。'}:old);}finally{setBusy(false);}}}/>}
 </CloudSaveContext.Provider>;
}
function CloudUploadDialog({target,confirmed,busy,disabled,change,cancel,submit}:{target:{id:string;name:string;account?:string;temporary?:boolean;error?:string};confirmed:boolean;busy:boolean;disabled:boolean;change:(value:boolean)=>void;cancel:()=>void;submit:()=>Promise<void>}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog ref={ref} className="cloud-save-dialog" aria-label="保存到云端确认" onCancel={event=>{if(busy)event.preventDefault();else cancel();}}>
 <h2>保存“{target.name||'未命名角色'}”到云端</h2><UploadWarning temporary={target.temporary!==false}/>
 <p className="cloud-save-details">上传完整五页；{target.temporary!==false?'同一个 IP 最多 10 张':'每个账号免费保存 10 张自有卡'}。请保留本机完整 JSON 备份。确认后，这张卡的后续修改会自动同步；发生冲突时保留本机草稿。</p>
 {target.error&&<p role="alert">{target.error}</p>}
 <label className="cloud-save-consent"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>change(event.target.checked)}/>{target.temporary!==false?'我真的同意公开这张卡，并确认卡内没有隐私信息。':'我同意将完整角色卡保存到当前账号，并启用后续自动同步。'}</label>
 <div className="cloud-save-actions"><button className="primary" disabled={!confirmed||!target.account||busy||disabled} onClick={()=>void submit()}>{busy?'正在同步...':'确认保存到云端'}</button><button disabled={busy} onClick={cancel}>取消</button></div>
 </dialog>;
}
export function useCloudSaveAvailable(){return !!useContext(CloudSaveContext);}
export function CloudSaveControl({id,disabled=false,book=false}:{id:string;disabled?:boolean;book?:boolean}){
 const context=useContext(CloudSaveContext),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
 useEffect(()=>{setCopied(false);setCopyError(false);},[id]);
 if(!context)return null;
 const state=context.states[id]||{phase:'local'},busy=state.phase==='syncing',failed=['error','conflict','uncertain'].includes(state.phase);
 return <>{!book&&<QQLogin beforeLogin={()=>context.beforeLogin(id)}/>}<span className={`cloud-save-control ${book?'cloud-save-book':''}`} data-cloud-phase={state.phase}>
 {busy?<span className="cloud-sync-status" role="status"><i className="cloud-sync-spinner" aria-hidden="true"/>正在同步...</span>:<>
 {state.cloudId?<span className="cloud-id-box"><code aria-label="云端卡 ID">{state.cloudId}</code><button aria-label={`复制云端卡 ID ${state.cloudId}`} title="复制卡片 ID" onClick={()=>void navigator.clipboard.writeText(state.cloudId!).then(()=>{setCopied(true);setCopyError(false);setTimeout(()=>setCopied(false),2000);}).catch(()=>setCopyError(true))}>{copied?'已复制':'复制'}</button></span>:<button disabled={disabled||context.disabled} onClick={()=>context.request(id)}>保存到云端</button>}
 {book&&!state.cloudId&&!failed&&<small>仅本机保存</small>}
 {failed&&<button className="cloud-sync-retry" disabled={disabled||context.disabled} title={state.message} onClick={()=>context.request(id)}>{state.phase==='conflict'?'同步冲突':state.phase==='uncertain'?'核对同步结果':'同步失败'} · 重试</button>}
 </>}
 {failed&&book&&<small role="alert">{state.message} 本机草稿保留。</small>}{copyError&&<small role="alert">复制失败，请选中 ID 手动复制。</small>}
 </span></>;
}
