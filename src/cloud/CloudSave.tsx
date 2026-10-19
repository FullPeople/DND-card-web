import {cloudDirectory as cloudCards} from './directoryReader';
import {useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {cloudFeaturesEnabled} from './availability';
import {useStartupComplete} from '../platform/startup';
import type {Character} from '../core/model';
import {cloudMutation,cloudSession,readCloudCard,subscribeCloudSessionChanges,type CloudSession,type CloudCard} from './api';
import {subscribeAccountChanges} from './accountChanges';
import {queuedRefresh} from './queuedRefresh';
import {characterHash,cloudCardLock,createCloudSync,readSyncReceipt,readSyncReceipts,writeSyncReceipt,type SyncState} from './sync';
import {readPersistedCharacter} from './persistedCharacter';
import {cloudSaveScheduler,snapshotHasher} from './saveScheduler';
import {syncTiming} from './syncTiming';
import {UploadWarning} from './UploadWarning';
import './cloudSave.css';
import {QQLogin} from './QQLogin';
import {CloudSaveContext} from './CloudSaveContext';
import {CloudSaveBadge} from './CloudSaveBadge';
import {QQCardPicker} from './QQCardPicker';
import {CheckIcon,CloudUploadIcon,CopyIcon,SheetIcon,SpinnerIcon,WarningIcon} from '../ui/icons';


export function CloudSaveProvider(props:Parameters<typeof EnabledCloudSaveProvider>[0]){
 const ready=useStartupComplete();
 return cloudFeaturesEnabled?<EnabledCloudSaveProvider {...props} enabled={props.enabled&&ready}/>:<CloudSaveContext.Provider value={undefined}>{props.children}</CloudSaveContext.Provider>;
}
function EnabledCloudSaveProvider({enabled,disabled,characters,readCharacter,receive,importCard,access,children,auto=true}:{enabled:boolean;disabled:boolean;auto?:boolean;characters:Character[];readCharacter:(id:string)=>Promise<Character>;receive?:(id:string,card:Character,hash:string)=>Promise<boolean>;importCard?:(card:CloudCard,account:string)=>Promise<void>;access?:(rights:Record<string,string|undefined>)=>void;children:ReactNode}){
 const directoryRefresh=useRef<()=>Promise<void>>(()=>Promise.resolve());
 const [states,setStates]=useState<Record<string,SyncState>>({}),[target,setTarget]=useState<{id:string;name:string;account?:string;temporary?:boolean;error?:string}>(),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false);
 const [session,setSession]=useState<CloudSession>();
 const [focusedId,setFocusedId]=useState<string>();
 const focus=useCallback((id:string)=>setFocusedId(id),[]),hasCardPicker=!!importCard;
 const sessionEpoch=useRef(0);
 const refreshSession=useCallback(async()=>{const epoch=++sessionEpoch.current,value=await cloudSession();if(!disposed.current&&epoch===sessionEpoch.current)setSession(value);},[]);
 const latest=useRef({readCharacter,disabled,characters,receive,importCard,access});latest.current={readCharacter,disabled,characters,receive,importCard,access};
 const rightsRef=useRef<Record<string,string|undefined>>({});
 const hashSnapshot=useRef<ReturnType<typeof snapshotHasher>|undefined>(undefined);
 if(!hashSnapshot.current)hashSnapshot.current=snapshotHasher(characterHash);
 const disposed=useRef(false),terminal=useRef<Record<string,SyncState>>({}),engine=useRef<ReturnType<typeof createCloudSync>|undefined>(undefined);
 const timings=useRef<ReturnType<typeof syncTiming>|undefined>(undefined);timings.current??=syncTiming();
 if(!engine.current)engine.current=createCloudSync({readCharacter:async id=>{
  if(latest.current.disabled)throw Error('当前标签页只读，本机草稿保留。');
  // A new edit can extend App's local save queue while the first read waits.
  // Read again until the previously observed content has also been persisted.
  return readPersistedCharacter(()=>latest.current.readCharacter(id),hashSnapshot.current!);
 },receive:(...args)=>latest.current.receive?.(...args)||Promise.resolve(false),readReceipt:readSyncReceipt,writeReceipt:writeSyncReceipt,session:cloudSession,read:readCloudCard,directory:cloudCards,mutation:cloudMutation,hash:hashSnapshot.current!,lock:cloudCardLock,changed:(id,state)=>{timings.current!.observe(id,state.phase);terminal.current[id]=state;if(!disposed.current)setStates(old=>({...old,[id]:state}));}});
 const scheduler=useRef<ReturnType<typeof cloudSaveScheduler>|undefined>(undefined);
 if(!scheduler.current)scheduler.current=cloudSaveScheduler(async id=>{
  if(latest.current.disabled||rightsRef.current[id])return;
  const receipt=await readSyncReceipt(id);
  if(receipt.binding&&!receipt.pending&&!receipt.lastError&&!['conflict','error','uncertain'].includes(terminal.current[id]?.phase||''))await engine.current!.run(id);
 });
 useEffect(()=>{disposed.current=false;return()=>{disposed.current=true;};},[]);
 useEffect(()=>{if(!enabled)return;const refresh=()=>{if(document.visibilityState==='visible')void refreshSession().catch(()=>{});};refresh();window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[enabled,refreshSession]);
 useEffect(()=>{
  if(!enabled)return;
  let alive=true,refreshEpoch=0;const refreshQueue=queuedRefresh(async()=>{
   if(!alive||document.visibilityState==='hidden'||!navigator.onLine)return;
   const epoch=refreshEpoch;
   try{
    const value=await cloudSession();if(!alive||epoch!==refreshEpoch)return;setSession(value);
    const receipts=await readSyncReceipts(latest.current.characters.map(card=>card.id));
    if(!alive||epoch!==refreshEpoch)return;
    const bindings=Object.entries(receipts).filter(([,receipt])=>receipt.binding);
    if(!bindings.length){rightsRef.current={};latest.current.access?.({});return;}
    const account=value.authenticated?value.account?.id:value.uploadOwner?.id;
    const rows=account?await cloudCards(0,account):undefined;if(!alive||epoch!==refreshEpoch)return;
    const directory=new Map((rows?.mine||rows?.cards||[]).map(card=>[card.id,card]));
    const rights:Record<string,string|undefined>={};
    for(const [id,receipt] of bindings){const row=directory.get(receipt.binding!.cloudId);
     rights[id]=account!==receipt.binding!.accountId?'请使用导入这张卡时的 QQ 账号登录。':!row?.role?'云端卡已移除或卡主已撤销你的权限，本机草稿保留。':undefined;
    }
    rightsRef.current=rights;latest.current.access?.(rights);
    // Directory polling transfers names and revisions only. Download the full
    // five-page document only when it changed; portraits are not polled.
    for(const [id,receipt] of bindings){if(!alive||epoch!==refreshEpoch)return;const row=directory.get(receipt.binding!.cloudId);
     if(!latest.current.disabled&&!rights[id]&&row&&(!receipt.hash||row.revision!==receipt.binding!.revision))await engine.current!.pull(id);
    }
   }catch(error){throw error;}
  });
  directoryRefresh.current=refreshQueue.request;
  const refresh=()=>{void refreshQueue.request().catch(()=>{});};
  // Account change notices deliver normal updates; this is a recovery poll.
  refresh();const timer=setInterval(refresh,60000);
  const sessionChanged=()=>{refreshEpoch++;const checking=Object.fromEntries(Object.keys(rightsRef.current).map(id=>[id,'正在核对 QQ 账号和云端卡权限，暂时无法修改。']));rightsRef.current=checking;latest.current.access?.(checking);refresh();},stop=subscribeCloudSessionChanges(sessionChanged);
  window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
  return()=>{alive=false;refreshQueue.stop();directoryRefresh.current=()=>Promise.resolve();stop();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);};
 },[enabled]);
 useEffect(()=>{
  const account=session?.authenticated?session.account?.id:undefined;if(!enabled||!account)return;
  return subscribeAccountChanges(account,()=>directoryRefresh.current());
 },[enabled,session?.authenticated,session?.account?.id]);
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
  const update=()=>scheduler.current!.enable(enabled&&!disabled&&auto&&!!(session?.authenticated||session?.temporaryUpload)&&document.visibilityState==='visible'&&navigator.onLine);
  update();window.addEventListener('online',update);window.addEventListener('offline',update);document.addEventListener('visibilitychange',update);
  return()=>{scheduler.current!.enable(false);window.removeEventListener('online',update);window.removeEventListener('offline',update);document.removeEventListener('visibilitychange',update);};
 },[enabled,disabled,auto,session?.authenticated,session?.temporaryUpload,session?.account?.id]);
 useEffect(()=>{if(hasCardPicker&&!focusedId)return;scheduler.current!.observe(characters,focusedId);},[characters,focusedId,hasCardPicker]);
 async function request(id:string){
  const character=latest.current.characters.find(card=>card.id===id);if(!character||latest.current.disabled)return;
  setConfirmed(false);setTarget({id,name:character.name});
  try{const session=await cloudSession(),account=session.authenticated?session.account?.id:session.temporaryUpload?session.uploadOwner?.id:undefined;setTarget(old=>old?.id===id?{...old,account,temporary:session.temporaryUpload===true&&!session.authenticated,error:account?undefined:session.qqLogin==='ready'?'请先使用 QQ 登录，再保存到自己的卡库。':'云端暂时无法保存。请保留本机 JSON 备份，稍后重试。'}:old);}
  catch{setTarget(old=>old?.id===id?{...old,error:'云端连接失败。请保留本机 JSON 备份，稍后重试。'}:old);}
 }
 return <CloudSaveContext.Provider value={enabled?{states,syncMs:timings.current.read,session,refreshSession,focus,request:id=>void request(id),beforeLogin:async id=>{if(!latest.current.disabled)await latest.current.readCharacter(id);},importCard:importCard?async id=>{
  const account=session?.account?.id;if(!account||latest.current.disabled)throw Error('当前不可导入，请先登录并恢复编辑权限。');
  const before=await cloudSession();if(before.account?.id!==account)throw Error('账号已改变，请重新打开卡库。');
  const card=await readCloudCard(id),after=await cloudSession();
  if(after.account?.id!==account||!card.role)throw Error('账号或卡片权限已改变，未导入角色卡。');
  await latest.current.importCard!(card,account);
 }:undefined,disabled}:undefined}>{children}
 {target&&<CloudUploadDialog target={target} confirmed={confirmed} busy={busy} disabled={disabled} change={setConfirmed} cancel={()=>setTarget(undefined)} submit={async()=>{if(!confirmed||!target.account||busy||disabled)return;setBusy(true);try{await engine.current!.run(target.id,target.account);const result=terminal.current[target.id];if(result?.phase==='saved')setTarget(undefined);else setTarget(old=>old?{...old,error:result?.message||'同步未成功，本机草稿保留。'}:old);}finally{setBusy(false);}}}/>}
 </CloudSaveContext.Provider>;
}
function CloudUploadDialog({target,confirmed,busy,disabled,change,cancel,submit}:{target:{id:string;name:string;account?:string;temporary?:boolean;error?:string};confirmed:boolean;busy:boolean;disabled:boolean;change:(value:boolean)=>void;cancel:()=>void;submit:()=>Promise<void>}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);
 const temporary=target.temporary!==false;
 return <dialog ref={ref} className="cloud-save-dialog cloud-modal dialog" aria-label="保存到云端确认" onCancel={event=>{if(busy)event.preventDefault();else cancel();}}>
 <header className="cloud-modal-head"><span className="cloud-modal-icon"><CloudUploadIcon size={18}/></span><div className="cloud-modal-heading"><h2>保存到云端</h2><p>“{target.name||'未命名角色'}” → {temporary?'临时卡库':'当前 QQ 账号的私人卡库'}</p></div></header>
 <div className="cloud-modal-body">{target.account&&<UploadWarning temporary={temporary}/>}
 <p className="cloud-save-details">上传完整五页到{temporary?'临时卡库':'当前 QQ 账号的私人卡库'}。请保留本机完整 JSON 备份。确认后，这张卡的后续修改会自动同步；发生冲突时保留本机草稿。</p>
 {target.error&&<p role="alert" className="cloud-modal-alert"><WarningIcon size={15}/><span>{target.error}</span></p>}
 <label className="cloud-save-consent"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>change(event.target.checked)}/><span>{temporary?'我真的同意公开这张卡，并确认卡内没有隐私信息。':'我同意将完整角色卡保存到当前账号，并启用后续自动同步。'}</span></label></div>
 <footer className="cloud-modal-foot cloud-save-actions"><button type="button" disabled={busy} onClick={cancel}>取消</button><button type="button" className="primary cloud-primary" disabled={!confirmed||!target.account||busy||disabled} onClick={()=>void submit()}>{busy?<SpinnerIcon size={15} className="cloud-spin"/>:<CloudUploadIcon size={15}/>}<span>{busy?'正在同步...':'确认保存到云端'}</span></button></footer>
 </dialog>;
}
export function useCloudSaveAvailable(){return !!useContext(CloudSaveContext);}
export function CloudSaveControl({id,disabled=false,book=false,library=false}:{id:string;disabled?:boolean;book?:boolean;library?:boolean}){
 const context=useContext(CloudSaveContext),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
 useEffect(()=>{if(!book)context?.focus?.(id);},[id,book,context?.focus]);
 useEffect(()=>{setCopied(false);setCopyError(false);},[id,context?.states[id]?.cloudId]);
 if(!context)return null;
 const state=context.states[id]||{phase:'local'},failed=['error','conflict','uncertain'].includes(state.phase);
 if(library)return <span className="cloud-save-control cloud-save-book" data-cloud-phase={state.phase}>{state.phase==='syncing'?<span role="status" className="cloud-sync-status"><SpinnerIcon size={14} className="cloud-spin"/>正在同步...</span>:<>{state.cloudId?<span className="cloud-id-box"><code aria-label="云端卡 ID">{state.cloudId}</code><button aria-label={`复制云端卡 ID ${state.cloudId}`} onClick={()=>void navigator.clipboard.writeText(state.cloudId!).then(()=>setCopied(true)).catch(()=>setCopyError(true))}>{copied?'已复制':'复制'}</button></span>:<button disabled={disabled||context.disabled} onClick={()=>context.request(id)}><CloudUploadIcon size={15}/><span>保存到云端</span></button>}{failed&&<button className="cloud-sync-retry" disabled={disabled||context.disabled} title={state.message} onClick={()=>context.request(id)}><WarningIcon size={14}/><span>{state.phase==='conflict'?'同步冲突':state.phase==='uncertain'?'核对同步结果':'同步失败'} · 重试</span></button>}</>}{failed&&<small role="alert">{state.message} 本机草稿保留。</small>}{copyError&&<small role="alert">复制失败，请选中 ID 手动复制。</small>}</span>;
 const details=<section className="qq-cloud-card-details cloud-modal-section"><h3><SheetIcon size={15}/>当前角色卡</h3>{state.cloudId?<div className="qq-account-id"><span className="qq-field-label">云端卡 ID</span><div className="qq-id-row"><code>{state.cloudId}</code><button type="button" aria-label="复制云端卡 ID" onClick={()=>void navigator.clipboard.writeText(state.cloudId!).then(()=>{setCopied(true);setCopyError(false);}).catch(()=>setCopyError(true))}>{copied?<CheckIcon size={14}/>:<CopyIcon size={14}/>}<span>{copied?'已复制':'复制'}</span></button></div><p className="qq-help">已保存到云端，后续修改会自动同步。</p></div>:<p className="qq-help">这张卡只保存在本机，可通过卡片右上角的云端按钮上传到你的卡库。</p>}{state.phase==='syncing'&&<p role="status" className="cloud-modal-status"><SpinnerIcon size={15} className="cloud-spin"/><span>正在同步…</span></p>}{failed&&<p role="alert" className="cloud-modal-alert"><WarningIcon size={15}/><span>{state.message} 本机草稿保留。</span></p>}{copyError&&<p role="alert" className="cloud-modal-alert"><WarningIcon size={15}/><span>复制失败，请选中 ID 手动复制。</span></p>}</section>;
 if(!book)return <QQLogin managed session={context.session} refresh={context.refreshSession} beforeLogin={()=>context.beforeLogin(id)}><QQCardPicker/>{details}</QQLogin>;
 return <span className="cloud-save-control cloud-save-book" data-cloud-phase={state.phase}><CloudSaveBadge id={id}/>{state.cloudId?<small>{state.phase==='syncing'?'正在同步…':failed?'云端同步待核对':'云端卡'}</small>:<button disabled={disabled||context.disabled||!context.session?.authenticated} onClick={()=>context.request(id)}><CloudUploadIcon size={14}/><span>{context.session?.authenticated?'上传到云端':'仅本机保存'}</span></button>}{failed&&<button className="cloud-sync-retry" disabled={disabled||context.disabled} title={state.message} onClick={()=>context.request(id)}>核对同步</button>}</span>;
}
