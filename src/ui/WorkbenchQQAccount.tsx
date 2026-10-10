import {useEffect,useMemo,useRef,useState} from 'react';
import {workbenchRequest,useWorkbench} from '../platform/workbench';
import {WorkbenchPanel} from './WorkbenchPanel';
import {withRequestTimeout} from '../platform/requestTimeout';
import './cloudRoomControl.css';
const origin='https://dnd.center';
const random=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function WorkbenchQQAccount(){
 const wb=useWorkbench(),instance=useMemo(()=>crypto.randomUUID(),[]),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),dialog=useRef<HTMLDialogElement>(null),active=useRef(true),login=useRef<AbortController|undefined>(undefined);
 const rpc=(method:string,...args:unknown[])=>workbenchRequest('panelRpc',{key:undefined,itemId:undefined,panel:'qq',instance,method,args});
 useEffect(()=>{active.current=true;return()=>{active.current=false;login.current?.abort();};},[]);
 useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
 async function request(path:string,data:unknown,parent:AbortSignal){return withRequestTimeout(30000,parent,async signal=>{const response=await fetch(origin+'/api/plugin/'+path,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal}),value=await response.json();if(!response.ok)throw Error(value.message||'QQ 连接失败，请重试。');return value;});}
 async function connect(popup:Window|null,signal:AbortSignal){
  if(!popup)throw Error('浏览器阻止了登录窗口，请允许弹出窗口后重试。');
  const verifier=random(),nonce=random(),bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))),challenge=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const {connection}=await request('start',{challenge},signal);popup.location.href=origin+'/library/?'+new URLSearchParams({pluginAuth:'1',origin:location.origin,challenge,nonce,connection});
  const deadline=Date.now()+600000;
  while(active.current&&!signal.aborted&&Date.now()<deadline){const value=await request('poll',{connection,verifier},signal);if(!value.pending){if(signal.aborted)return;await rpc('account.attach',value);popup.close();setOpen(true);return;}await new Promise(resolve=>setTimeout(resolve,1200));}
  throw Error('QQ 登录连接已超时，请重试。');
 }
 function begin(){if(busy)return;setBusy(true);setMessage('');const controller=new AbortController();login.current=controller;const popup=window.open('about:blank','dnd-qq-login','popup,width=620,height=720');void connect(popup,controller.signal).catch(error=>{popup?.close();if(active.current)setMessage(controller.signal.aborted?'已取消登录。':error instanceof Error?error.message:String(error));}).finally(()=>{if(login.current===controller){login.current=undefined;if(active.current)setBusy(false);}});}
 useEffect(()=>{const login=()=>{setOpen(false);begin();};window.addEventListener('workbench-qq-login',login);return()=>window.removeEventListener('workbench-qq-login',login);});
 return <><button className="workbench-qq-entry" aria-label="QQ 登录与卡库" aria-busy={busy} disabled={!wb.online||busy} onClick={()=>{if(wb.qqAccount?.id)setOpen(true);else begin();}}><picture><source media="(max-width:640px)" srcSet={origin+'/card/qq-login-120x24.png'}/><img src={origin+'/card/qq-login-170x32.png'} alt="QQ 登录" width="170" height="32"/></picture></button>{busy&&<span role="status">正在等待 QQ 登录… <button onClick={()=>login.current?.abort()}>取消登录</button></span>}{message&&<span role="alert">{message}</span>}{open&&<dialog ref={dialog} className="workbench-qq-dialog" aria-label="QQ 账号与卡库" onCancel={()=>setOpen(false)}><WorkbenchPanel panel="qq" close={()=>setOpen(false)}/></dialog>}</>;
}
