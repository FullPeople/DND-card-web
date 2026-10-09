import {useEffect,useState} from 'react';
import {cloudMutation,cloudSession,type CloudSession} from './api';
import './qqLogin.css';

type QQLoginProps={session?:CloudSession;managed?:boolean;beforeLogin?:()=>Promise<void>;refresh?:()=>Promise<void>};
export function QQLogin(props:QQLoginProps){
  if(!['http:','https:'].includes(location.protocol)||!['/card/','/library/'].includes(location.pathname))return null;
  return <OnlineQQLogin {...props}/>;
}
function OnlineQQLogin({session:managedSession,managed=false,beforeLogin,refresh}:QQLoginProps){
  const [local,setLocal]=useState<CloudSession>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const session=managed?managedSession:local;
  useEffect(()=>{
    if(managed)return;
    let active=true;const update=()=>{if(document.visibilityState==='visible')void cloudSession().then(value=>{if(active)setLocal(value);}).catch(()=>{});};
    update();window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);
    return()=>{active=false;window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};
  },[managed]);
  const href='/api/auth/qq/login?returnTo='+encodeURIComponent(location.pathname+location.search+location.hash);
  return <div className="qq-account">{session?.authenticated&&session.account?<><span className="qq-profile">{session.account.avatar&&<img src={session.account.avatar} alt="" referrerPolicy="no-referrer"/>}<span>{session.account.nickname||'QQ 已登录'}</span></span><button type="button" disabled={busy} onClick={()=>{setBusy(true);setError('');void cloudMutation(session.account!.id,'logout','POST').then(async()=>{setLocal(await cloudSession());await refresh?.();}).catch(()=>setError('退出失败，请稍后重试。')).finally(()=>setBusy(false));}}>退出登录</button></>:<a className="qq-login-button" href={href} aria-label="QQ 登录" onClick={beforeLogin?event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');void beforeLogin().then(()=>location.assign(href)).catch(()=>{setError('本机保存尚未完成，请先导出备份。');setBusy(false);});}:undefined} aria-busy={busy||undefined}><picture><source media="(max-width: 640px)" srcSet="/card/qq-login-120x24.png"/><img src="/card/qq-login-170x32.png" alt="QQ 登录" width="170" height="32"/></picture></a>}{error&&<span className="qq-account-error" role="alert">{error}</span>}</div>;
}
