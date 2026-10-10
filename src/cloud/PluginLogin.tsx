import {useEffect,useState} from 'react';
import {cloudMutation,cloudSession,type CloudSession} from './api';
import {QQLogin} from './QQLogin';
export function PluginLogin(){
  const [session,setSession]=useState<CloudSession>(),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const query=new URLSearchParams(location.search),target=query.get('origin')||'',nonce=query.get('nonce')||'',challenge=query.get('challenge')||'',connection=query.get('connection');
  const valid=['https://obr.dnd.center',location.origin].includes(target)&&/^[A-Za-z0-9_-]{43}$/.test(challenge)&&/^[A-Za-z0-9_-]{43}$/.test(nonce)&&!!connection&&/^[a-f0-9-]{36}$/.test(connection);
  useEffect(()=>{void cloudSession().then(setSession).catch(()=>setMessage('登录状态读取失败，请刷新重试。'));},[]);
  return <main className="cloud-library"><section className="cloud-frame"><h1>连接枭熊插件</h1>{valid?<><QQLogin managed session={session} refresh={async()=>setSession(await cloudSession())}/><p>连接后，插件可以读取你的卡库。加载到房间的卡默认锁定；你解锁后，房间里的修改会自动写回云端原卡。</p>{session?.authenticated&&<><p>当前账号：{session.account?.nickname||session.account?.id}</p><button disabled={busy} onClick={()=>{setBusy(true);void cloudMutation<{connected:boolean}>(session.account!.id,'plugin/authorize','POST',{origin:target,challenge,...connection?{connection}:{}}).then(()=>{setMessage('已连接，可以关闭此窗口。');}).catch(error=>{setMessage(String(error));setBusy(false);});}}>连接当前账号</button></>}</>:<p role="alert">连接请求无效，请从枭熊插件重新打开。</p>}{message&&<p role="status">{message}</p>}</section></main>;
}
