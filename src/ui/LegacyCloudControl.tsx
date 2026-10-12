import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {LEGACY_CLOUD_CHANNEL,legacyCloudRequest} from '../platform/legacyCloud';
import {CloudIcon} from './CloudIcon';
import {CloudIconGlyph,CloseIcon,WarningIcon} from './icons';
import '../cloud/cloudSave.css';
import './cloudRoomControl.css';
type Status={account?:{id:string;nickname?:string};write:boolean};
export function LegacyCloudControl({name}:{name:string}){
 const [status,setStatus]=useState<Status>(),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),dialog=useRef<HTMLDialogElement>(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;const update=()=>{void legacyCloudRequest('status').then(value=>{if(alive.current)setStatus(value);}).catch(()=>{});},receive=(event:MessageEvent)=>{if(event.source===parent&&event.origin===location.origin&&event.data?.channel===LEGACY_CLOUD_CHANNEL&&event.data.method==='account')update();};update();window.addEventListener('message',receive);return()=>{alive.current=false;window.removeEventListener('message',receive);};},[]);
 useEffect(()=>{setOpen(false);setMessage('');},[status?.account?.id]);
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
 if(!status?.account)return null;
 return <><button className="card-lock cloud-card-control" aria-label="上传角色卡到云端" title="上传到自己的 QQ 卡库" onClick={()=>{setOpen(true);setMessage('');}}><CloudIcon/></button>{open&&createPortal(<dialog ref={dialog} className="cloud-room-dialog cloud-modal dialog is-wide" aria-label="云端卡设置" onCancel={event=>{if(busy)event.preventDefault();else setOpen(false);}}><header className="cloud-modal-head"><span className="cloud-modal-icon"><CloudIconGlyph size={18}/></span><div className="cloud-modal-heading"><h2>云端卡设置</h2><p>{name} · 仅房间保存</p></div><button className="cloud-modal-close" disabled={busy} aria-label="关闭" autoFocus onClick={()=>setOpen(false)}><CloseIcon size={18}/></button></header><div className="cloud-modal-body"><section className="cloud-modal-section"><h3>上传到云端</h3><p className="cloud-modal-help">上传后这张卡归当前 QQ 账号（{status.account.nickname||'QQ 用户'}）所有。卡主授权后，房间内获准的修改会自动写回云端原卡。</p>{!status.write?<aside className="class-compatibility-banner card-permission-banner" role="status"><p>当前玩家没有这张房间卡的修改权限，无法将它上传到自己的卡库。请核对棋子的所属玩家设置。</p></aside>:<button className="primary" disabled={busy} onClick={()=>{setBusy(true);setMessage('');void legacyCloudRequest('upload').catch(error=>{if(alive.current)setMessage(String(error));}).finally(()=>{if(alive.current)setBusy(false);});}}>{busy?'正在上传…':'上传为我的云端卡'}</button>}</section>{message&&<p role="alert" className="cloud-modal-alert"><WarningIcon size={16}/><span>{message}</span></p>}</div><footer className="cloud-modal-foot"><button disabled={busy} onClick={()=>setOpen(false)}>关闭</button></footer></dialog>,document.body)}</>;
}
