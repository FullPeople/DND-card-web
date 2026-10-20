import {useRef,useState} from 'react';
import type {Workspace} from '../platform/storage';
import {workspaceIdentity} from '../platform/workspaceIdentity';
import {recoverWorkspaceFromText} from '../platform/workspaceRecovery';

export function StorageRecoveryControls({recovered,retry}:{recovered:(workspace:Workspace)=>void;retry:()=>Promise<void>}){
 const file=useRef<HTMLInputElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function act(action:()=>Promise<void>){setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 return <section aria-label="恢复本机角色簿"><p>可从完整 JSON 备份恢复，保留角色身份和填写内容。已有角色簿不会被覆盖。</p>
  <div className="dialog-actions"><button disabled={busy} onClick={()=>void act(retry)}>重试读取本机记录</button><button disabled={busy} onClick={()=>file.current?.click()}>从 JSON 备份恢复</button></div>
  <input ref={file} type="file" accept=".json,application/json" aria-label="恢复角色簿备份文件" style={{position:'fixed',width:1,height:1,opacity:0,pointerEvents:'none'}} onChange={event=>{const selected=event.target.files?.[0];event.target.value='';if(selected)void act(async()=>{if(selected.size>20*1024*1024)throw Error('备份文件超过 20 MB，未修改本机记录。');const workspace=await recoverWorkspaceFromText(workspaceIdentity.database,await selected.text());recovered(workspace);});}}/>
  {busy&&<p role="status">正在核对并恢复备份…</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
