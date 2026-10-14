import {useEffect,useRef,useState,type ReactNode} from 'react';
import {cloudFeaturesEnabled} from './availability';
import {cloudMutation,cloudSession,subscribeCloudSessionChanges,type CloudSession} from './api';
import './qqLogin.css';
import {CheckIcon,ChevronDownIcon,CloseIcon,CloudCheckIcon,CopyIcon,FolderOpenIcon,LogOutIcon,SheetIcon,UserIcon,WarningIcon} from '../ui/icons';

type QQLoginProps={session?:CloudSession;managed?:boolean;beforeLogin?:()=>Promise<void>;refresh?:()=>Promise<void>;children?:ReactNode};
export function QQLogin(props:QQLoginProps){
  if(!cloudFeaturesEnabled)return null;
  if(!['http:','https:'].includes(location.protocol)||!['/card/','/library/'].includes(location.pathname))return null;
  return <OnlineQQLogin {...props}/>;
}
/** First visible character of the nickname for the avatar circle when QQ gave no picture. */
export const avatarInitial=(nickname?:string)=>(nickname||'').trim().slice(0,1).toUpperCase()||'Q';
function OnlineQQLogin({session:managedSession,managed=false,beforeLogin,refresh,children}:QQLoginProps){
  const [local,setLocal]=useState<CloudSession>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState(false),[copied,setCopied]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const session=managed?managedSession:local;
  useEffect(()=>{
    if(managed)return;
    let active=true;const update=()=>{if(document.visibilityState==='visible')void cloudSession().then(value=>{if(active)setLocal(value);}).catch(()=>{});};
    const stop=subscribeCloudSessionChanges(update);update();window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);
    return()=>{active=false;stop();window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};
  },[managed]);
  useEffect(()=>{if(open&&session?.authenticated)dialog.current?.showModal();else {dialog.current?.close();setOpen(false);}},[open,session?.authenticated]);
  function close(){dialog.current?.close();setOpen(false);trigger.current?.focus();}
  function logout(){
    if(!session?.account||busy)return;
    setBusy(true);setError('');
    void cloudMutation(session.account.id,'logout','POST').then(async()=>{if(!managed)setLocal(await cloudSession());await refresh?.();close();}).catch(()=>setError('退出失败，请稍后重试。')).finally(()=>setBusy(false));
  }
  const href='/api/auth/qq/login?returnTo='+encodeURIComponent(location.pathname+location.search+location.hash);
  const account=session?.authenticated?session.account:undefined,initial=avatarInitial(account?.nickname),slots=session?.slots,inLibrary=location.pathname==='/library/';
  return <div className="qq-account">{account?<><button ref={trigger} type="button" className="qq-account-trigger" aria-label="账号" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setCopied(false);setError('');setOpen(true);}}><span className="qq-profile">{account.avatar?<img src={account.avatar} alt="" referrerPolicy="no-referrer"/>:<span className="qq-avatar qq-avatar-small" aria-hidden="true">{initial}</span>}<span>{account.nickname||'QQ 已登录'}</span></span><span className="qq-account-chevron" aria-hidden="true"><ChevronDownIcon size={14}/></span></button>
    {open&&<dialog ref={dialog} className="qq-account-dialog cloud-modal dialog" aria-label="账号" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();}}}>
      <header className="cloud-modal-head"><span className="cloud-modal-icon"><UserIcon size={18}/></span><div className="cloud-modal-heading"><h2>账号</h2><p>QQ 登录 · 私人卡库</p></div><button type="button" className="cloud-modal-close" autoFocus onClick={close} aria-label="关闭账号弹窗"><CloseIcon size={18}/></button></header>
      <div className="cloud-modal-body">
        <div className="qq-account-card"><span className="qq-avatar" aria-hidden="true">{account.avatar?<img src={account.avatar} alt="" referrerPolicy="no-referrer"/>:initial}</span><div className="qq-account-name"><strong>{account.nickname||'QQ 已登录'}</strong><span className="qq-chips"><span className="qq-chip is-on"><CloudCheckIcon size={13}/>已连接</span>{slots&&<span className="qq-chip"><SheetIcon size={13}/>私人卡库 {slots.used} / {slots.total}</span>}</span></div></div>
        <div className="qq-account-id"><span className="qq-field-label" id="qq-account-id-label">账号 ID</span><div className="qq-id-row"><code aria-labelledby="qq-account-id-label">{account.id}</code><button type="button" aria-label="复制账号 ID" onClick={()=>void navigator.clipboard.writeText(account.id).then(()=>setCopied(true)).catch(()=>setError('复制失败，请选中账号 ID 手动复制。'))}>{copied?<CheckIcon size={14}/>:<CopyIcon size={14}/>}<span>{copied?'已复制':'复制'}</span></button></div><p className="qq-help">复制给卡主以获得编辑权：卡主在“管理云端卡”里填入这个 ID，你就能编辑那张卡。</p></div>
        {children}
        {error&&<p className="cloud-modal-alert qq-account-error" role="alert"><WarningIcon size={15}/><span>{error}</span></p>}
      </div>
      <footer className="cloud-modal-foot">{!inLibrary&&<a className="cloud-button" href="/library/"><FolderOpenIcon size={15}/><span>打开卡库</span></a>}<button type="button" className="cloud-danger" disabled={busy} onClick={logout}><LogOutIcon size={15}/><span>{busy?'正在退出…':'退出登录'}</span></button></footer>
    </dialog>}</>:<a className="qq-login-button" href={href} aria-label="QQ 登录" onClick={beforeLogin?event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');void beforeLogin().then(()=>location.assign(href)).catch(()=>{setError('本机保存尚未完成，请先导出备份。');setBusy(false);});}:undefined} aria-busy={busy||undefined}><picture><source media="(max-width: 640px)" srcSet="/card/qq-login-120x24.png"/><img src="/card/qq-login-170x32.png" alt="QQ 登录" width="170" height="32"/></picture></a>}{error&&!open&&<span className="qq-account-error" role="alert">{error}</span>}</div>;
}
