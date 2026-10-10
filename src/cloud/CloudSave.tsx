import {useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {Character} from '../core/model';
import {cloudCards,cloudMutation,cloudSession,readCloudCard,type CloudSession} from './api';
import {characterHash,cloudCardLock,createCloudSync,readSyncReceipt,readSyncReceipts,writeSyncReceipt,type SyncState} from './sync';
import {UploadWarning} from './UploadWarning';
import './cloudSave.css';
import {QQLogin} from './QQLogin';
import {CloudSaveContext} from './CloudSaveContext';
import {CloudSaveBadge} from './CloudSaveBadge';


export function CloudSaveProvider({enabled,disabled,characters,readCharacter,children,auto=true}:{enabled:boolean;disabled:boolean;auto?:boolean;characters:Character[];readCharacter:(id:string)=>Promise<Character>;children:ReactNode}){
 const [states,setStates]=useState<Record<string,SyncState>>({}),[target,setTarget]=useState<{id:string;name:string;account?:string;temporary?:boolean;error?:string}>(),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false);
 const [session,setSession]=useState<CloudSession>();
 const sessionEpoch=useRef(0);
 const refreshSession=useCallback(async()=>{const epoch=++sessionEpoch.current,value=await cloudSession();if(!disposed.current&&epoch===sessionEpoch.current)setSession(value);},[]);
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
 useEffect(()=>{if(!enabled)return;const refresh=()=>{if(document.visibilityState==='visible')void refreshSession().catch(()=>{});};refresh();window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[enabled,refreshSession]);
 useEffect(()=>{
  if(!enabled)return;
  let alive=true,refreshEpoch=0,pendingDeadline:ReturnType<typeof setTimeout>|undefined;
  const refresh=async()=>{
   const epoch=++refreshEpoch;clearTimeout(pendingDeadline);const receipts=await readSyncReceipts(latest.current.characters.map(character=>character.id));if(!alive||epoch!==refreshEpoch)return;
   let nextDeadline=Infinity;const updates:Record<string,SyncState>={};
   for(const character of latest.current.characters){const receipt=receipts[character.id]||{};if(receipt.pending&&Date.now()<(receipt.pending.startedAt||0)+35000)nextDeadline=Math.min(nextDeadline,(receipt.pending.startedAt||0)+35000);
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
  if(!enabled||disabled||!auto||!session?.authenticated&&!session?.temporaryUpload)return;
  let alive=true;
  const timer=setTimeout(()=>{void (async()=>{const receipts=await readSyncReceipts(characters.map(character=>character.id));for(const character of characters){const receipt=receipts[character.id];if(!alive)return;if(receipt.binding&&!receipt.pending&&!receipt.lastError&&!['conflict','error','uncertain'].includes(states[character.id]?.phase||''))await engine.current!.run(character.id);}})().catch(()=>{});},650);
  return()=>{alive=false;clearTimeout(timer);};
 },[enabled,disabled,characters,auto,readCharacter,session?.authenticated,session?.temporaryUpload,session?.account?.id]);
 async function request(id:string){
  const character=latest.current.characters.find(card=>card.id===id);if(!character||latest.current.disabled)return;
  setConfirmed(false);setTarget({id,name:character.name});
  try{const session=await cloudSession(),account=session.authenticated?session.account?.id:session.temporaryUpload?session.uploadOwner?.id:undefined;setTarget(old=>old?.id===id?{...old,account,temporary:session.temporaryUpload===true&&!session.authenticated,error:account?undefined:session.qqLogin==='ready'?'请先使用 QQ 登录，再保存到自己的卡库。':'云端暂时无法保存。请保留本机 JSON 备份，稍后重试。'}:old);}
  catch{setTarget(old=>old?.id===id?{...old,error:'云端连接失败。请保留本机 JSON 备份，稍后重试。'}:old);}
 }
 return <CloudSaveContext.Provider value={enabled?{states,session,refreshSession,request:id=>void request(id),beforeLogin:async id=>{if(!latest.current.disabled)await latest.current.readCharacter(id);},disabled}:undefined}>{children}
 {target&&<CloudUploadDialog target={target} confirmed={confirmed} busy={busy} disabled={disabled} change={setConfirmed} cancel={()=>setTarget(undefined)} submit={async()=>{if(!confirmed||!target.account||busy||disabled)return;setBusy(true);try{await engine.current!.run(target.id,target.account);const result=terminal.current[target.id];if(result?.phase==='saved')setTarget(undefined);else setTarget(old=>old?{...old,error:result?.message||'同步未成功，本机草稿保留。'}:old);}finally{setBusy(false);}}}/>}
 </CloudSaveContext.Provider>;
}
function CloudUploadDialog({target,confirmed,busy,disabled,change,cancel,submit}:{target:{id:string;name:string;account?:string;temporary?:boolean;error?:string};confirmed:boolean;busy:boolean;disabled:boolean;change:(value:boolean)=>void;cancel:()=>void;submit:()=>Promise<void>}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog ref={ref} className="cloud-save-dialog" aria-label="保存到云端确认" onCancel={event=>{if(busy)event.preventDefault();else cancel();}}>
 <h2>保存“{target.name||'未命名角色'}”到云端</h2>{target.account&&<UploadWarning temporary={target.temporary!==false}/>}
 <p className="cloud-save-details">上传完整五页到{target.temporary!==false?'临时卡库':'当前 QQ 账号的私人卡库'}。请保留本机完整 JSON 备份。确认后，这张卡的后续修改会自动同步；发生冲突时保留本机草稿。</p>
 {target.error&&<p role="alert">{target.error}</p>}
 <label className="cloud-save-consent"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>change(event.target.checked)}/>{target.temporary!==false?'我真的同意公开这张卡，并确认卡内没有隐私信息。':'我同意将完整角色卡保存到当前账号，并启用后续自动同步。'}</label>
 <div className="cloud-save-actions"><button className="primary" disabled={!confirmed||!target.account||busy||disabled} onClick={()=>void submit()}>{busy?'正在同步...':'确认保存到云端'}</button><button disabled={busy} onClick={cancel}>取消</button></div>
 </dialog>;
}
export function useCloudSaveAvailable(){return !!useContext(CloudSaveContext);}
export function CloudSaveControl({id,disabled=false,book=false,library=false}:{id:string;disabled?:boolean;book?:boolean;library?:boolean}){
 const context=useContext(CloudSaveContext),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
 useEffect(()=>{setCopied(false);setCopyError(false);},[id,context?.states[id]?.cloudId]);
 if(!context)return null;
 const state=context.states[id]||{phase:'local'},failed=['error','conflict','uncertain'].includes(state.phase);
 if(library)return <span className="cloud-save-control cloud-save-book" data-cloud-phase={state.phase}><CloudSaveBadge id={id}/>{state.phase==='syncing'?<span role="status">正在同步...</span>:<>{state.cloudId?<span className="cloud-id-box"><code aria-label="云端卡 ID">{state.cloudId}</code><button aria-label={`复制云端卡 ID ${state.cloudId}`} onClick={()=>void navigator.clipboard.writeText(state.cloudId!).then(()=>setCopied(true)).catch(()=>setCopyError(true))}>{copied?'已复制':'复制'}</button></span>:<><button disabled={disabled||context.disabled} onClick={()=>context.request(id)}>保存到云端</button><small>仅本机保存</small></>}{failed&&<button disabled={disabled||context.disabled} title={state.message} onClick={()=>context.request(id)}>{state.phase==='conflict'?'同步冲突':state.phase==='uncertain'?'核对同步结果':'同步失败'} · 重试</button>}</>}{failed&&<small role="alert">{state.message} 本机草稿保留。</small>}{copyError&&<small role="alert">复制失败，请选中 ID 手动复制。</small>}</span>;
 const details=<section className="qq-cloud-card-details"><h3>当前角色卡</h3>{state.cloudId?<><label>云端卡 ID</label><code>{state.cloudId}</code><button onClick={()=>void navigator.clipboard.writeText(state.cloudId!).then(()=>{setCopied(true);setCopyError(false);}).catch(()=>setCopyError(true))}>{copied?'已复制':'复制云端卡 ID'}</button></>:<p>这张卡保存在本机，可通过卡片右上角的云端按钮上传。</p>}{state.phase==='syncing'&&<p role="status">正在同步…</p>}{failed&&<p role="alert">{state.message} 本机草稿保留。</p>}{copyError&&<p role="alert">复制失败，请选中 ID 手动复制。</p>}<p><a href="/library/">打开我的 QQ 卡库</a></p></section>;
 if(!book)return <QQLogin managed session={context.session} refresh={context.refreshSession} beforeLogin={()=>context.beforeLogin(id)}>{details}</QQLogin>;
 return <span className="cloud-save-control cloud-save-book" data-cloud-phase={state.phase}><CloudSaveBadge id={id}/>{state.cloudId?<small>{state.phase==='syncing'?'正在同步…':failed?'云端同步待核对':'云端卡'}</small>:<button disabled={disabled||context.disabled||!context.session?.authenticated} onClick={()=>context.request(id)}>{context.session?.authenticated?'上传到云端':'仅本机保存'}</button>}{failed&&<button disabled={disabled||context.disabled} title={state.message} onClick={()=>context.request(id)}>核对同步</button>}</span>;
}
