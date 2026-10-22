import {useContext,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CloudSaveContext} from './CloudSaveContext';
import {cloudMutation,cloudSession,readCloudCard,type CloudCard} from './api';
import {forgetDeletedCloudCard} from './bindings';
import {cloudCardLock} from './sync';
import {CloudIcon} from '../ui/CloudIcon';
import {CheckIcon,CloseIcon,CloudIconGlyph,CloudUploadIcon,CopyIcon,IdCardIcon,LockClosedIcon,LockOpenIcon,RefreshIcon,SpinnerIcon,TrashIcon,UserIcon,UsersIcon,WarningIcon} from '../ui/icons';
import '../ui/cloudRoomControl.css';

export function CloudCardControl({id,name,locked,lock}:{id:string;name:string;locked:boolean;lock:()=>void}){
 const context=useContext(CloudSaveContext),state=context?.states[id],cloudId=state?.cloudId,[open,setOpen]=useState(false),[info,setInfo]=useState<CloudCard>(),[actor,setActor]=useState(''),[editor,setEditor]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false),dialog=useRef<HTMLDialogElement>(null),epoch=useRef(0),key=[id,cloudId,context?.session?.account?.id].join('|'),current=useRef(key);current.current=key;
 useEffect(()=>{epoch.current++;setOpen(false);setInfo(undefined);setEditor('');setMessage('');setBusy(false);},[id,cloudId,context?.session?.account?.id]);
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
 const close=()=>{if(current.current!==key)return;epoch.current++;setOpen(false);};
 async function read(){
  const generation=epoch.current,value=await cloudSession();if(!value.authenticated||!value.account)throw Error('请先使用有权限的 QQ 账号登录，再核对云端卡设置。');
  const card=await readCloudCard(cloudId!);if(generation!==epoch.current||current.current!==key)return;
  setActor(value.account.id);setInfo(card);
 }
 async function act(action:()=>Promise<unknown>){const generation=epoch.current;setBusy(true);setMessage('');try{await action();}catch(error){if(generation===epoch.current&&current.current===key)setMessage(error instanceof Error?error.message:String(error));}finally{if(generation===epoch.current&&current.current===key)setBusy(false);}}
 function show(){if(!context)return;setInfo(undefined);setActor('');setCopied(false);setOpen(true);if(cloudId)void act(read);}
 if(!context||!cloudId&&!context.session?.authenticated)return <button className="card-lock" aria-label={locked?'解锁角色卡':'上锁角色卡'} aria-pressed={locked} disabled={context?.disabled} onClick={lock}>{locked?<LockClosedIcon size={18}/>:<LockOpenIcon size={18}/>}</button>;
// The dialog is portalled to <body>: inside the sheet pane the card palette redefines the --ui-* tokens, which would paint the dialog in paper colours.
 const failed=!!state&&['error','conflict','uncertain'].includes(state.phase),owner=info?.ownerNickname||(info?.role==='owner'?context.session?.account?.nickname:'')||'卡主';
 return <><button className="card-lock cloud-card-control" aria-label={cloudId?'云端卡设置':'上传角色卡到云端'} title={cloudId?'云端卡设置':'上传到自己的 QQ 卡库'}  onClick={show}><CloudIcon/></button>{open&&createPortal(<dialog aria-modal="true" ref={dialog} className="cloud-room-dialog cloud-modal dialog is-wide" aria-label="云端卡设置" onCancel={event=>{if(busy)event.preventDefault();else close();}}>
  <header className="cloud-modal-head"><span className="cloud-modal-icon"><CloudIconGlyph size={18}/></span><div className="cloud-modal-heading"><h2>云端卡设置</h2><p>{name||'未命名角色'}{cloudId?' · 已保存到云端':' · 仅本机保存'}</p></div><button type="button" className="cloud-modal-close" autoFocus disabled={busy} onClick={close} aria-label="关闭"><CloseIcon size={18}/></button></header>
  <div className="cloud-modal-body">
   {cloudId&&<div className="qq-account-id"><span className="qq-field-label">云端卡 ID</span><div className="qq-id-row"><code>{cloudId}</code><button type="button" aria-label="复制云端卡 ID" onClick={()=>void navigator.clipboard.writeText(cloudId!).then(()=>setCopied(true)).catch(()=>setMessage('复制失败，请选中 ID 手动复制。'))}>{copied?<CheckIcon size={14}/>:<CopyIcon size={14}/>}<span>{copied?'已复制':'复制'}</span></button></div></div>}
   {!cloudId?<section className="cloud-modal-section"><h3><CloudUploadIcon size={16}/>上传到云端</h3><p className="cloud-modal-help">这张卡还只保存在本机。上传后它归当前 QQ 账号（{context.session?.account?.nickname||'QQ 用户'}）所有，之后获准的修改会自动写回云端原卡。</p>{context.disabled?<p role="status" className="cloud-modal-status"><LockClosedIcon size={15}/><span>当前角色卡没有编辑权限，无法上传。</span></p>:<button type="button" className="primary cloud-primary" onClick={()=>{close();context.request(id);}}><CloudUploadIcon size={15}/><span>上传为我的云端卡</span></button>}</section>
   :info?<>
    <section className="cloud-modal-section"><h3><UserIcon size={16}/>卡主与权限</h3><p>卡主：{owner}</p>{info.ownerAccountId&&<p className="cloud-muted">卡主账号 ID：<code>{info.ownerAccountId}</code></p>}<p role="status" className="cloud-modal-status">{info.role==='owner'?<CheckIcon size={15}/>:info.role==='editor'?<UsersIcon size={15}/>:<LockClosedIcon size={15}/>}<span>{info.role==='owner'?'你是这张卡的拥有者，可以管理这张卡的编辑授权。':info.role==='editor'?'卡主已授权你的 QQ 账号编辑这张卡；你可以编辑完整角色内容，权限设置由卡主管理。':'你没有编辑权限，只能查看基本信息。'}</span></p><p className="cloud-modal-help">获准的修改会自动写回云端原卡。允许整个房间修改的设置可在枭熊当前房间的云端按钮中调整。</p></section>
    {info.role==='owner'&&<><section className="cloud-modal-section"><h3><UsersIcon size={16}/>编辑者</h3><p className="cloud-modal-help">填写对方在 QQ 账号弹窗中复制的账号 ID；被授权的账号可以修改这张卡的完整内容。</p><form className="cloud-editor-form" onSubmit={event=>{event.preventDefault();void act(async()=>{await cloudMutation(actor,'cards/'+cloudId+'/editors','POST',{accountId:editor});setEditor('');await read();});}}><label>编辑者账号 ID<input value={editor} disabled={busy} onChange={event=>setEditor(event.target.value)} pattern="[a-f0-9-]{36}" placeholder="对方的 36 位账号 ID" required/></label><button type="submit" className="primary cloud-primary" disabled={busy||context.disabled}><UsersIcon size={15}/><span>授予编辑权限</span></button></form>{info.editors?.length?<ul className="cloud-editor-list">{info.editors.map(accountId=><li key={accountId}><IdCardIcon size={16}/><code>{accountId}</code><button type="button" disabled={busy||context.disabled} onClick={()=>void act(async()=>{await cloudMutation(actor,'cards/'+cloudId+'/editors/'+encodeURIComponent(accountId),'DELETE');await read();})}>撤销授权</button></li>)}</ul>:<p className="cloud-muted">还没有授权任何账号。</p>}</section>
    <section className="cloud-modal-section cloud-modal-danger"><h3><TrashIcon size={16}/>移除云端卡</h3><p className="cloud-modal-help">移除后云端授权和房间关联失效，别人无法再读取这张卡；本机角色卡与草稿保留。</p><button type="button" className="cloud-danger" disabled={busy||context.disabled} onClick={()=>{if(window.confirm('移除这张云端原卡？云端授权和房间关联会失效，本机角色卡与草稿保留。'))void act(async()=>{await cloudCardLock(id,async()=>{await cloudMutation(actor,'cards/'+cloudId,'DELETE',{revision:info.revision});await forgetDeletedCloudCard(cloudId!);});close();});}}><TrashIcon size={15}/><span>移除云端卡（本机保留）</span></button></section></>}
    {failed&&<section className="cloud-modal-section"><p role="alert" className="cloud-modal-alert"><WarningIcon size={15}/><span>{state!.message}</span></p><button type="button" disabled={busy||context.disabled||!info.role} onClick={()=>{close();context.request(id);}}><RefreshIcon size={15}/><span>核对并重试同步</span></button></section>}
   </>:<p role="status" className="cloud-modal-status">{message?<><WarningIcon size={15}/><span>暂时无法核对这张卡的权限，可以查看上面的本机基本信息。</span></>:<><SpinnerIcon size={15} className="cloud-spin"/><span>正在读取云端卡权限…</span></>}</p>}
   {message&&<p role="alert" className="cloud-modal-alert"><WarningIcon size={15}/><span>{message}</span></p>}
  </div></dialog>,document.body)}</>;
}
