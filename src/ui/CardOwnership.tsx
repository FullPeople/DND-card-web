import {useState} from 'react';
import {createPortal} from 'react-dom';
import {useWorkbench,workbenchRequest,type CardChoice} from '../platform/workbench';
export function CardOwnership({card}:{card:CardChoice}){
 const wb=useWorkbench(),[open,setOpen]=useState(false),[owners,setOwners]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(wb.role!=='GM')return null;
 const players=wb.console?.players||[];
 return <><button onClick={()=>{setOwners(card.owner_ids||[]);setError('');setOpen(true);}}>分配玩家</button>{open&&createPortal(<div className="ownership-backdrop"><section className="ownership-dialog" role="dialog" aria-modal="true" aria-label="分配角色卡玩家"><h2>分配「{card.name}」</h2><p>选中的玩家可以查看和编辑此卡。修改卡内“玩家”姓名不会授予编辑权限。</p>{[...new Set([...players.map(p=>p.id),...owners])].map(id=><label key={id}><input type="checkbox" checked={owners.includes(id)} disabled={busy} onChange={e=>setOwners(list=>e.target.checked?[...list,id]:list.filter(v=>v!==id))}/>{players.find(p=>p.id===id)?.name||'已离线玩家'}</label>)}{error&&<p role="alert">{error}</p>}<div className="dialog-actions"><button disabled={busy} onClick={()=>{setBusy(true);void workbenchRequest('assignOwners',{key:undefined,itemId:`card:${card.id}`,ownerIds:owners}).then(()=>setOpen(false)).catch(e=>setError(String(e))).finally(()=>setBusy(false));}}>保存分配</button><button disabled={busy} onClick={()=>setOpen(false)}>取消</button></div></section></div>,document.body)}</>;
}
