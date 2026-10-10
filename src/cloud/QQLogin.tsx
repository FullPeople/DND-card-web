import {useEffect,useRef,useState,type ReactNode} from 'react';
import {cloudMutation,cloudSession,type CloudSession} from './api';
import './qqLogin.css';

type QQLoginProps={session?:CloudSession;managed?:boolean;beforeLogin?:()=>Promise<void>;refresh?:()=>Promise<void>;children?:ReactNode};
export function QQLogin(props:QQLoginProps){
  if(!['http:','https:'].includes(location.protocol)||!['/card/','/library/'].includes(location.pathname))return null;
  return <OnlineQQLogin {...props}/>;
}
function OnlineQQLogin({session:managedSession,managed=false,beforeLogin,refresh,children}:QQLoginProps){
  const [local,setLocal]=useState<CloudSession>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState(false),[copied,setCopied]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const session=managed?managedSession:local;
  useEffect(()=>{
    if(managed)return;
    let active=true;const update=()=>{if(document.visibilityState==='visible')void cloudSession().then(value=>{if(active)setLocal(value);}).catch(()=>{});};
    update();window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);
    return()=>{active=false;window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};
  },[managed]);
  useEffect(()=>{if(open&&session?.authenticated)dialog.current?.showModal();else {dialog.current?.close();setOpen(false);}},[open,session?.authenticated]);
  function close(){dialog.current?.close();setOpen(false);trigger.current?.focus();}
  function logout(){
    if(!session?.account||busy)return;
    setBusy(true);setError('');
    void cloudMutation(session.account.id,'logout','POST').then(async()=>{if(!managed)setLocal(await cloudSession());await refresh?.();close();}).catch(()=>setError('退出失败，请稍后重试。')).finally(()=>setBusy(false));
  }
  const href='/api/auth/qq/login?returnTo='+encodeURIComponent(location.pathname+location.search+location.hash);
  return <div className="qq-account">{session?.authenticated&&session.account?<><button ref={trigger} type="button" className="qq-account-trigger" aria-label="账号" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setCopied(false);setError('');setOpen(true);}}><span className="qq-profile">{session.account.avatar&&<img src={session.account.avatar} alt="" referrerPolicy="no-referrer"/>}<span>{session.account.nickname||'QQ 已登录'}</span></span><span className="qq-account-chevron" aria-hidden="true">▾</span></button>{open&&<dialog ref={dialog} className="qq-account-dialog" aria-label="账号" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();}}}><header><h2>账号</h2><button type="button" autoFocus onClick={close} aria-label="关闭账号弹窗">关闭</button></header><div className="qq-account-details"><span className="qq-profile">{session.account.avatar&&<img src={session.account.avatar} alt="" referrerPolicy="no-referrer"/>}<span>{session.account.nickname||'QQ 已登录'}</span></span><label>账号 ID</label><code>{session.account.id}</code><button type="button" onClick={()=>void navigator.clipboard.writeText(session.account!.id).then(()=>setCopied(true)).catch(()=>setError('复制失败，请选中账号 ID 手动复制。'))}>{copied?'已复制':'复制账号 ID'}</button></div>{children}{error&&<p className="qq-account-error" role="alert">{error}</p>}<footer><button type="button" disabled={busy} onClick={logout}>{busy?'正在退出…':'退出登录'}</button></footer></dialog>}</>:<a className="qq-login-button" href={href} aria-label="QQ 登录" onClick={beforeLogin?event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');void beforeLogin().then(()=>location.assign(href)).catch(()=>{setError('本机保存尚未完成，请先导出备份。');setBusy(false);});}:undefined} aria-busy={busy||undefined}><picture><source media="(max-width: 640px)" srcSet="/card/qq-login-120x24.png"/><img src="/card/qq-login-170x32.png" alt="QQ 登录" width="170" height="32"/></picture></a>}{error&&!open&&<span className="qq-account-error" role="alert">{error}</span>}</div>;
}
