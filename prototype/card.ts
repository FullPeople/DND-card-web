import './style.css';
import {discover,originOf,packet,send,valid,type Snapshot} from './protocol';
const config=new URLSearchParams(location.hash.slice(1)),session=config.get('session')||'',bridge=originOf(config.get('bridge')||'');
const status=document.querySelector<HTMLElement>('#status')!,hp=document.querySelector<HTMLInputElement>('#hp')!,log=document.querySelector('#log')!;
const buttons=['damage','heal','apply'].map(id=>document.getElementById(id) as HTMLButtonElement);
let host:Window|null=null,snapshot:Snapshot|undefined,lastSeen=0,pending='',stopped=false,connected=false;
function record(text:string){log.textContent=(new Date().toLocaleTimeString()+' '+text+'\n'+log.textContent).slice(0,5000);}
function display(text:string,enabled=false){connected=enabled;status.textContent=text;status.dataset.state=enabled?'connected':'error';hp.disabled=!enabled||!!pending;buttons.forEach(b=>b.disabled=!enabled||!!pending);}
function hello(){if(!bridge||stopped)return;if(host)send(host,'hello',{session},bridge);else try{if(window.opener)discover(window.opener.parent,packet('hello',{session}),bridge);}catch{/* Background heartbeats can recover the same child after its opener is removed. */}}
window.addEventListener('message',e=>{
 if(stopped||!bridge||e.origin!==bridge||!valid(e.data)||e.data.session!==session||!e.source||(host&&e.source!==host))return;
 const m=e.data;if(m.type==='revoked'){stopped=true;pending='';display(String(m.message));record(String(m.message));return;}
 if(m.type!=='state')return;const value=m.snapshot as Snapshot;
 if(!value||typeof value.hp!=='number'||!Number.isFinite(value.hp)||!Number.isInteger(value.revision)||typeof value.itemId!=='string')return;
 host=e.source as Window;lastSeen=Date.now();if(snapshot&&value.revision<snapshot.revision)return;
 const changed=!snapshot||snapshot.revision!==value.revision;
 snapshot=value;document.querySelector('#token')!.textContent=value.name;document.querySelector('#max')!.textContent=String(value.max);
 if(changed||!connected||m.ack===pending||m.rejected===pending)hp.value=String(value.hp);
 if(m.ack===pending||m.rejected===pending){pending='';if(m.rejected)record(String(m.message));}
 if(changed)record(`收到场景生命 ${value.hp}，修订 ${value.revision}`);
 document.querySelector('#detail')!.textContent=`已绑定：${value.itemId} · 修订 ${value.revision}`;
 display(m.rejected?String(m.message):'已连接 · 与枭熊双向同步',true);
});
function change(mode:'set'|'delta',value:number){if(!connected||pending||!snapshot||!host||!bridge)return;if(!Number.isInteger(value)){display('请输入整数生命值。',true);return;}
 pending=crypto.randomUUID();send(host,'change',{session,operationId:pending,baseRevision:snapshot.revision,mode,value},bridge);display('正在同步…',true);record(`发送 ${mode} ${value}`);
}
document.getElementById('damage')!.onclick=()=>change('delta',-1);document.getElementById('heal')!.onclick=()=>change('delta',1);document.getElementById('apply')!.onclick=()=>change('set',Number(hp.value));
hp.onkeydown=e=>{if(e.key==='Enter')change('set',Number(hp.value));};
document.getElementById('disconnect')!.onclick=()=>{if(host&&bridge)send(host,'bye',{session},bridge);stopped=true;pending='';display('已断开连接。');};
if(!bridge||session.length<32){stopped=true;display('请从枭熊的“打开联动角色卡”按钮进入。');}else{hello();record('等待后台握手');}
setInterval(()=>{if(stopped)return;if(Date.now()-lastSeen>4000){if(connected)record('连接中断，已暂停写入');pending='';display('连接已断开或尚未建立，请确认枭熊房间仍然打开。');}hello();},1000);
