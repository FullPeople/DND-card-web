import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {permissionNoticeState} from '../platform/playerPermissionNotice';
import {WorkbenchPanel} from './WorkbenchPanel';
import './playerPermissionNotice.css';

type Request=(type:string,data:Record<string,unknown>)=>Promise<unknown>;
function PermissionDialog({close}:{close:()=>void}){
 const root=useRef<HTMLDialogElement>(null),latestClose=useRef(close);latestClose.current=close;
 useLayoutEffect(()=>{
  const dialog=root.current;if(!dialog)return;
  dialog.showModal();
  const keydown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();latestClose.current();}};
  const frame=dialog.querySelector('iframe');let frameDocument:Document|null=null;
  const loaded=()=>{frameDocument?.removeEventListener('keydown',keydown);try{frameDocument=frame?.contentDocument??null;frameDocument?.addEventListener('keydown',keydown);}catch{frameDocument=null;}};
  frame?.addEventListener('load',loaded);loaded();
  return()=>{frame?.removeEventListener('load',loaded);frameDocument?.removeEventListener('keydown',keydown);dialog.close();};
 },[]);
 return <dialog ref={root} className="player-permission-dialog" aria-label="关于玩家分配卡和权限" onCancel={event=>{event.preventDefault();close();}}><header><strong>DM 重要说明</strong><button type="button" onClick={close} aria-label="关闭权限说明">×</button></header><WorkbenchPanel panel="permissions" close={close}/></dialog>;
}
export function PlayerPermissionButton({gm,online,request}:{gm:boolean;online:boolean;request:Request}){
 const [seen,setSeen]=useState(false),[opening,setOpening]=useState(false),refreshStatus=useRef(()=>{});
 useEffect(()=>{
  if(!gm||!online)return;
  const status=permissionNoticeState(()=>request('console',{action:'playerPermissions',statusOnly:true}),setSeen);
  const refresh=()=>{if(document.visibilityState!=='hidden')void status.refresh();};refreshStatus.current=refresh;
  const storage=(event:StorageEvent)=>{if(event.key===null||event.key==='obr-suite/workbench/player-permissions-seen')refresh();};
  refresh();window.addEventListener('focus',refresh);window.addEventListener('storage',storage);document.addEventListener('visibilitychange',refresh);
  return()=>{refreshStatus.current=()=>{};status.dispose();window.removeEventListener('focus',refresh);window.removeEventListener('storage',storage);document.removeEventListener('visibilitychange',refresh);};
 },[gm,online,request]);
 useEffect(()=>{if(!gm)setOpening(false);},[gm]);
 if(!gm||seen)return null;
 const close=()=>{setOpening(false);refreshStatus.current();};
 return <><button type="button" className="workbench-mode player-permission-entry" disabled={!online} onClick={()=>{if(online&&!opening)setOpening(true);}}>关于玩家分配卡和权限</button>{opening&&<PermissionDialog close={close}/>}</>;
}
