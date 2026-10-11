import {useEffect,useState} from 'react';
import {cloudMutation,cloudSession,type CloudSession} from './api';
import {QQLogin} from './QQLogin';
import {pairingCode} from './pairing';
import {CheckIcon,InfoIcon,PlugIcon,WarningIcon} from '../ui/icons';
export function PluginLogin(){
  const [session,setSession]=useState<CloudSession>(),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const query=new URLSearchParams(location.search),target=query.get('origin')||'',nonce=query.get('nonce')||'',challenge=query.get('challenge')||'',connection=query.get('connection');
  const valid=['https://obr.dnd.center',location.origin].includes(target)&&/^[A-Za-z0-9_-]{43}$/.test(challenge)&&/^[A-Za-z0-9_-]{43}$/.test(nonce)&&!!connection&&/^[a-f0-9-]{36}$/.test(connection);
  useEffect(()=>{void cloudSession().then(setSession).catch(()=>setMessage('登录状态读取失败，请刷新重试。'));},[]);
  return <main className="cloud-library"><div className="cloud-main"><section className="cloud-frame cloud-plugin-frame"><header className="cloud-frame-head"><h1><PlugIcon size={16}/>连接枭熊插件</h1></header><div className="cloud-content">{valid?<><p className="cloud-pairing"><span className="cloud-pairing-label">校验码</span><strong className="cloud-pairing-code">{pairingCode(challenge)}</strong></p><p className="cloud-frame-lead"><InfoIcon size={15}/><span>只有当你刚在枭熊插件里点击了 QQ 登录、且插件显示的校验码与这里一致时才点连接；否则请直接关闭此窗口。</span></p><p>连接后，插件以你的账号读取卡库、上传新卡、把卡加载到房间并管理房间卡的锁定与授权；它不能删除你的云端原卡。加载到房间的卡默认锁定；你解锁后，房间里的修改会自动写回云端原卡。</p><div className="cloud-plugin-actions"><QQLogin managed session={session} refresh={async()=>setSession(await cloudSession())}/>{session?.authenticated&&<><span className="cloud-muted">当前账号：{session.account?.nickname||session.account?.id}</span><button type="button" className="cloud-primary" disabled={busy} onClick={()=>{setBusy(true);void cloudMutation<{connected:boolean}>(session.account!.id,'plugin/authorize','POST',{origin:target,challenge,...connection?{connection}:{}}).then(()=>{setMessage('已连接，可以关闭此窗口。');}).catch(error=>{setMessage(String(error));setBusy(false);});}}><PlugIcon size={15}/><span>连接当前账号</span></button></>}</div></>:<p role="alert" className="cloud-message"><WarningIcon size={16}/><span>连接请求无效，请从枭熊插件重新打开。</span></p>}{message&&<p role="status" className="cloud-message"><CheckIcon size={16}/><span>{message}</span></p>}</div></section></div></main>;
}
