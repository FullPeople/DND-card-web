import {useEffect,useState} from 'react';
import {permissionNoticeState} from '../platform/playerPermissionNotice';
import {reportWorkbenchError} from './CopyDiagnostic';

type Request=(type:string,data:Record<string,unknown>)=>Promise<unknown>;
export function PlayerPermissionButton({gm,online,request}:{gm:boolean;online:boolean;request:Request}){
 const [seen,setSeen]=useState(false),[opening,setOpening]=useState(false);
 useEffect(()=>{
  if(!gm||!online)return;
  const status=permissionNoticeState(()=>request('console',{action:'playerPermissions',statusOnly:true}),setSeen);
  const refresh=()=>{if(document.visibilityState!=='hidden')void status.refresh();};
  const storage=(event:StorageEvent)=>{if(event.key===null||event.key==='obr-suite/workbench/player-permissions-seen')refresh();};
  refresh();window.addEventListener('focus',refresh);window.addEventListener('storage',storage);document.addEventListener('visibilitychange',refresh);
  return()=>{status.dispose();window.removeEventListener('focus',refresh);window.removeEventListener('storage',storage);document.removeEventListener('visibilitychange',refresh);};
 },[gm,online,request]);
 if(!gm||seen)return null;
 return <button type="button" className="workbench-mode player-permission-entry" disabled={!online||opening} onClick={()=>{
  if(!online||opening)return;
  setOpening(true);
  void request('console',{action:'playerPermissions'}).catch(reportWorkbenchError).finally(()=>setOpening(false));
 }}>关于玩家分配卡和权限</button>;
}
