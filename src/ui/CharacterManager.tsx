import {useRef,useState} from 'react';
import type {Character,Edition} from '../core/model';
import {exportCharacter,exportCharacters} from '../core/export';
import {download} from '../platform/storage';
import {CopyDiagnostic,diagnosticText} from './CopyDiagnostic';
import './characterManager.css';
import {CloudSaveControl,useCloudSaveAvailable} from '../cloud/CloudSave';

export type CharacterRow={id:string;name:string;player?:string;edition?:string;classes?:string;hp?:number;maxHp?:number;ac?:number;level?:number;write:boolean;locked?:boolean;inScene?:boolean};
export {localCharacterRow} from './characterRows';

// A failure acknowledges only explicitly completed IDs. A 404, a refreshed
// directory or an elapsed timeout never authorizes removal or mutation replay.
export function characterDeleteFailure(attemptedIds:string[],error:unknown){
 const result=error as {completedIds?:unknown;uncertain?:unknown;uncertainIds?:unknown}|null;
 const completedIds=Array.isArray(result?.completedIds)?attemptedIds.filter(id=>result.completedIds instanceof Array&&result.completedIds.includes(id)):[];
 const remainingIds=attemptedIds.filter(id=>!completedIds.includes(id));
 const reportedUncertain=Array.isArray(result?.uncertainIds)?remainingIds.filter(id=>result.uncertainIds instanceof Array&&result.uncertainIds.includes(id)):[];
 const uncertainIds=result?.uncertain===true?(reportedUncertain.length?reportedUncertain:remainingIds):[];
 return {completedIds,remainingIds,uncertainIds};
}
type ManagerError={cause:unknown;operation:string;at:string;completed?:number};
type ManagerProps={rows:CharacterRow[];currentId:string;disabled:boolean;open:(id:string)=>void;read:(ids:string[])=>Promise<Character[]>;remove:(ids:string[])=>Promise<void>;create:(names:string[],edition:Edition)=>Promise<void>;review:(card:Character)=>void;refresh?:()=>Promise<void>;blockedDeleteIds?:string[];pendingDeleteIds?:string[]};
export function CharacterManager({rows,currentId,disabled,open,read,remove,create,review,refresh,blockedDeleteIds,pendingDeleteIds=[]}:ManagerProps){
 const [selected,setSelected]=useState<string[]>([]),[query,setQuery]=useState(''),[edition,setEdition]=useState<Edition>('2024'),[names,setNames]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<ManagerError|null>(null),[confirm,setConfirm]=useState(false),[createUncertain,setCreateUncertain]=useState(false),[localBlocked,setLocalBlocked]=useState<string[]>([]),[refreshNotice,setRefreshNotice]=useState('');
 const inFlight=useRef(false),cloud=useCloudSaveAvailable();
 const visible=rows.filter(r=>`${r.name} ${r.player||''} ${r.classes||''} ${r.edition||''}`.toLowerCase().includes(query.toLowerCase())),ids=selected.filter(id=>rows.some(r=>r.id===id)),all=visible.length>0&&visible.every(r=>ids.includes(r.id));
 // App owns the lock across closing/reopening this dialog and releases it only
 // for a correlated terminal receipt. Standalone callers retain a local lock.
 const blocked=blockedDeleteIds??localBlocked,blockedVisible=blocked.filter(id=>rows.some(row=>row.id===id)),pendingVisible=pendingDeleteIds.filter(id=>rows.some(row=>row.id===id));
 const canDelete=ids.length>0&&!busy&&!disabled&&!ids.some(id=>blocked.includes(id)||pendingDeleteIds.includes(id)||!rows.find(r=>r.id===id)?.write);
 const act=async(operation:string,fn:()=>Promise<void>,keepError=false)=>{if(inFlight.current)return;inFlight.current=true;setBusy(true);setRefreshNotice('');if(!keepError)setError(null);try{await fn();}catch(cause){setError({cause,operation,at:new Date().toISOString()});}finally{inFlight.current=false;setBusy(false);}};
 const toggle=(id:string,checked:boolean)=>{if(inFlight.current)return;setConfirm(false);setSelected(current=>checked?[...new Set([...current,id])]:current.filter(v=>v!==id));};
 const deleteSelected=async()=>{
  if(!canDelete)return;const attempted=[...ids];setConfirm(false);
  await act('delete',async()=>{try{await remove(attempted);setSelected(current=>current.filter(id=>!attempted.includes(id)));}catch(cause){
   const outcome=characterDeleteFailure(attempted,cause);setSelected(current=>current.filter(id=>!outcome.completedIds.includes(id)));setLocalBlocked(current=>[...new Set([...current,...outcome.uncertainIds])]);
   setError({cause,operation:'delete',at:new Date().toISOString(),completed:outcome.completedIds.length});
  }});
 };
 const message=error?.cause instanceof Error?error.cause.message:error?'操作失败，请复制诊断信息以便排查。':'';
 return <section className="character-manager"><div className="manager-tools"><input aria-label="搜索角色" placeholder="角色 / 玩家 / 职业 / 版本" value={query} onChange={e=>setQuery(e.target.value)}/><span>{rows.length} 张 · 已选 {ids.length} 张</span><button disabled={!ids.length||busy} onClick={()=>void act('readCards',async()=>download('角色集合.json',exportCharacters(await read(ids))))}>导出所选 JSON</button><button disabled={!canDelete} onClick={()=>setConfirm(true)}>删除所选</button>{refresh&&<button disabled={busy} onClick={()=>{setConfirm(false);void act('refreshCatalog',async()=>{await refresh();setRefreshNotice('已重新读取目录，请核对当前列表。不确定的删除不会自动重试。');},true);}}>重新读取目录</button>}</div>
 {error&&<div className="inline-error"><p role="alert">{error.completed!==undefined&&!/^已确认删除 \d+ 张/.test(message)?`已确认删除 ${error.completed} 张；其余项目保留，未自动重试。`:''}{message}</p><CopyDiagnostic text={diagnosticText(error.cause,{operation:error.operation,at:error.at})} label="复制诊断信息" ariaLabel="诊断信息"/></div>}
 {pendingVisible.length>0&&<p role="status">有 {pendingVisible.length} 张角色的批量删除正在处理，正在等待宿主确认；请勿重复提交。</p>}
 {blockedVisible.length>0&&<p role="status">有 {blockedVisible.length} 张角色的删除结果尚未确认，已暂停再次删除。请重新读取目录核对；仍在目录中的未确认项目不会自动解锁。</p>}
 {refreshNotice&&<p role="status">{refreshNotice}</p>}
 {confirm&&<div className="delete-confirm">将删除所选 {ids.length} 张角色资料，场景棋子保留；请先导出备份。<button disabled={!canDelete} onClick={()=>void deleteSelected()}>确认批量删除</button><button onClick={()=>setConfirm(false)}>取消</button></div>}
 <div className="manager-table-wrap"><table className="manager-table"><thead><tr><th><input type="checkbox" aria-label="选择当前搜索结果" checked={all} disabled={busy} onChange={e=>{setConfirm(false);setSelected(e.target.checked?[...new Set([...ids,...visible.map(r=>r.id)])]:ids.filter(id=>!visible.some(r=>r.id===id)));}}/></th><th>角色 / 玩家</th><th>版本 / 职业</th><th>生命 / AC</th><th>权限</th>{cloud&&<th>云端存储</th>}<th>操作</th></tr></thead><tbody>{visible.map(row=><tr key={row.id} aria-current={row.id===currentId?'true':undefined}><td><input type="checkbox" aria-label={`选择${row.name}`} checked={ids.includes(row.id)} disabled={busy} onChange={e=>toggle(row.id,e.target.checked)}/></td><td><button className="character-title" disabled={busy} onClick={()=>open(row.id)}><strong>{row.name}</strong><small>{row.player||'未填玩家'}{row.id===currentId?' · 当前':''}</small></button></td><td>{row.edition||'查看详情'}<small>{row.classes|| (row.level?`${row.level} 级`:'')}</small></td><td>{row.hp??'—'} / {row.maxHp??'—'}<small>AC {row.ac??'—'}</small></td><td>{row.write?'可编辑':'只读'}{!cloud&&row.locked?' · 上锁':''}{row.inScene?' · 场内':''}{pendingDeleteIds.includes(row.id)?' · 删除处理中':blocked.includes(row.id)?' · 删除待核对':''}</td>{cloud&&<td><CloudSaveControl id={row.id} disabled={busy||!row.write} book/></td>}<td><button disabled={busy} onClick={()=>void act('readCards',async()=>review((await read([row.id]))[0]))}>审卡</button><button disabled={busy} onClick={()=>void act('readCards',async()=>download(`${row.name.replace(/[<>:"/\\|?*]/g,'_')}.json`,exportCharacter((await read([row.id]))[0])))}>JSON</button></td></tr>)}</tbody></table></div>
 <details className="manager-create"><summary>批量创建角色</summary><label>规则版本<select value={edition} onChange={e=>setEdition(e.target.value as Edition)}><option>2024</option><option>2014</option></select></label><label>每行一个角色名<textarea aria-label="批量角色名" value={names} onChange={e=>setNames(e.target.value)} placeholder={'旅行者\n向导\n守卫'}/></label><button disabled={busy||disabled||createUncertain||!names.trim()} onClick={()=>void act('createCard',async()=>{const list=names.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);if(list.length>100)throw Error('一次最多创建 100 张角色卡');try{await create(list,edition);setNames('');}catch(error){const result=error as {completed?:number;uncertain?:boolean};if(result.completed)setNames(list.slice(result.completed).join('\n'));if(result.uncertain)setCreateUncertain(true);throw error;}})}>{busy?'正在处理…':'创建这些角色'}</button>{createUncertain&&<p role="status">创建结果尚未确认，请先核对角色簿，避免重复创建。</p>}</details>
 </section>;
}
