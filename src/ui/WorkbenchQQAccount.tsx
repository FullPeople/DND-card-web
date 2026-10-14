import {useEffect,useMemo,useRef,useState} from 'react';
import {cloudFeaturesEnabled} from '../cloud/availability';
import {workbenchRequest,useWorkbench} from '../platform/workbench';
import {WorkbenchPanel} from './WorkbenchPanel';
import {withRequestTimeout} from '../platform/requestTimeout';
import './cloudRoomControl.css';
import '../cloud/qqLogin.css';
import {CheckIcon,ChevronDownIcon,CloseIcon,CloudCheckIcon,CopyIcon,ExternalIcon,SheetIcon,SpinnerIcon,WarningIcon} from './icons';
import {pairingCode} from '../cloud/pairing';
import {avatarInitial} from '../cloud/QQLogin';
const origin='https://dnd.center';
const random=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function WorkbenchQQAccount(){
 return cloudFeaturesEnabled?<EnabledWorkbenchQQAccount/>:null;
}
function EnabledWorkbenchQQAccount(){
 const wb=useWorkbench(),instance=useMemo(()=>crypto.randomUUID(),[]),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[copied,setCopied]=useState(false),dialog=useRef<HTMLDialogElement>(null),active=useRef(true),login=useRef<AbortController|undefined>(undefined);
 const rpc=(method:string,...args:unknown[])=>workbenchRequest('panelRpc',{key:undefined,itemId:undefined,panel:'qq',instance,method,args});
 useEffect(()=>{active.current=true;return()=>{active.current=false;login.current?.abort();};},[]);
 useEffect(()=>{if(open){setCopied(false);dialog.current?.showModal();}},[open]);
 async function request(path:string,data:unknown,parent:AbortSignal){return withRequestTimeout(30000,parent,async signal=>{const response=await fetch(origin+'/api/plugin/'+path,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal}),value=await response.json();if(!response.ok)throw Error(value.message||'QQ 连接失败，请重试。');return value;});}
 async function connect(popup:Window|null,signal:AbortSignal){
  if(!popup)throw Error('浏览器阻止了登录窗口，请允许弹出窗口后重试。');
  const verifier=random(),nonce=random(),bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))),challenge=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  if(active.current)setMessage('请在授权页核对校验码 '+pairingCode(challenge)+' 后再点击连接。');
  const {connection}=await request('start',{challenge},signal);popup.location.href=origin+'/library/?'+new URLSearchParams({pluginAuth:'1',origin:location.origin,challenge,nonce,connection});
  const deadline=Date.now()+600000;
  while(active.current&&!signal.aborted&&Date.now()<deadline){const value=await request('poll',{connection,verifier},signal);if(!value.pending){if(signal.aborted)return;await rpc('account.attach',value);popup.close();if(active.current)setMessage('');setOpen(true);return;}await new Promise(resolve=>setTimeout(resolve,1200));}
  throw Error('QQ 登录连接已超时，请重试。');
 }
 function begin(){if(busy)return;setBusy(true);setMessage('');const controller=new AbortController();login.current=controller;const popup=window.open('about:blank','dnd-qq-login','popup,width=620,height=720');void connect(popup,controller.signal).catch(error=>{popup?.close();if(active.current)setMessage(controller.signal.aborted?'已取消登录。':error instanceof Error?error.message:String(error));}).finally(()=>{if(login.current===controller){login.current=undefined;if(active.current)setBusy(false);}});}
 useEffect(()=>{const login=()=>{setOpen(false);begin();};window.addEventListener('workbench-qq-login',login);return()=>window.removeEventListener('workbench-qq-login',login);});
 const account=wb.qqAccount,initial=avatarInitial(account?.nickname);
 return <><button className={account?.id?'qq-account-trigger':'workbench-qq-entry'} aria-label={account?.id?'QQ 账号与卡库':'QQ 登录与卡库'} aria-haspopup="dialog" aria-busy={busy} disabled={!wb.online||busy} onClick={()=>{if(account?.id)setOpen(true);else begin();}}>{account?.id?<><span className="qq-profile">{account.avatar?<img src={account.avatar} alt="" referrerPolicy="no-referrer"/>:<span className="qq-avatar qq-avatar-small" aria-hidden="true">{initial}</span>}<span>{account.nickname||'QQ 已登录'}</span></span><span className="qq-account-chevron" aria-hidden="true"><ChevronDownIcon size={14}/></span></>:<picture><source media="(max-width:640px)" srcSet={origin+'/card/qq-login-120x24.png'}/><img src={origin+'/card/qq-login-170x32.png'} alt="QQ 登录" width="170" height="32"/></picture>}</button>{busy&&<span role="status" className="workbench-qq-status"><SpinnerIcon size={14} className="cloud-spin"/>正在等待 QQ 登录… <button onClick={()=>login.current?.abort()}>取消登录</button></span>}{message&&<span role="alert" className="qq-account-error">{message}</span>}
  {open&&account&&<dialog ref={dialog} className="workbench-qq-dialog cloud-modal dialog" aria-label="QQ 账号与卡库" onCancel={()=>setOpen(false)}>
   <header className="cloud-modal-head"><span className="qq-avatar" aria-hidden="true">{account.avatar?<img src={account.avatar} alt="" referrerPolicy="no-referrer"/>:initial}</span><div className="cloud-modal-heading"><h2>{account.nickname||'QQ 已登录'}</h2><p className="qq-chips"><span className="qq-chip is-on"><CloudCheckIcon size={13}/>已连接</span><span className="qq-chip"><SheetIcon size={13}/>私人卡库</span></p></div><button type="button" className="cloud-modal-close" aria-label="关闭账号弹窗" onClick={()=>setOpen(false)}><CloseIcon size={18}/></button></header>
   {account.id&&<div className="qq-account-id workbench-qq-id"><span className="qq-field-label">账号 ID</span><div className="qq-id-row"><code>{account.id}</code><button type="button" aria-label="复制账号 ID" onClick={()=>void navigator.clipboard.writeText(account.id).then(()=>setCopied(true)).catch(()=>setMessage('复制失败，请选中账号 ID 手动复制。'))}>{copied?<CheckIcon size={14}/>:<CopyIcon size={14}/>}<span>{copied?'已复制':'复制'}</span></button></div><p className="qq-help">复制给卡主以获得编辑权：卡主在“管理云端卡”里填入这个 ID，你就能编辑那张卡。</p></div>}
   <div className="cloud-modal-body workbench-qq-body"><WorkbenchPanel panel="qq" close={()=>setOpen(false)}/></div>
   <footer className="cloud-modal-foot"><p className="qq-help">卡库面板里可以上传新卡、加载到房间和退出登录。</p><a className="cloud-button" href={origin+'/library/'} target="_blank" rel="noopener noreferrer"><ExternalIcon size={15}/><span>打开卡库</span></a></footer>
   {message&&<p className="cloud-modal-alert" role="alert"><WarningIcon size={15}/><span>{message}</span></p>}
  </dialog>}</>;
}
