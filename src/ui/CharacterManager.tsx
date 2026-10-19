import {useEffect,useMemo,useRef,useState,lazy,Suspense,type PointerEvent as ReactPointerEvent} from 'react';
import type {Character,Edition} from '../core/model';
import {exportCharacter,exportCharacters} from '../core/export';
import {download} from '../platform/storage';
import {CopyDiagnostic,diagnosticText} from './CopyDiagnostic';
import './characterManager.css';
import {placeCharacter,useCharacterBookOrder} from './characterBookOrder';
import {inWorkbench} from '../platform/workbenchMode';
const LocateButton=lazy(()=>import('./LocateButton').then(module=>({default:module.LocateButton})));
const CharacterLocateMenu=lazy(()=>import('./LocateButton').then(module=>({default:module.CharacterLocateMenu})));
import {CloudSaveControl,useCloudSaveAvailable} from '../cloud/CloudSave';

import {CloudIcon} from './CloudIcon';
import {BadgeCheckIcon,BookIcon,DownloadIcon,GripIcon,HeartIcon,PlusIcon,ShieldIcon,TrashIcon,UserIcon} from './icons';
/** A visible button group instead of a drop-down for a handful of options. */
export function Segmented<T extends string>({label,caption,value,options,onChange}:{label:string;caption?:string;value:T;options:ReadonlyArray<readonly [T,string]>;onChange:(value:T)=>void}){
 return <span className="seg-group" role="group" aria-label={label}>{caption&&<span>{caption}</span>}<span className="seg-options">{options.map(([key,text])=><button key={key} type="button" aria-pressed={value===key} onClick={()=>onChange(key)}>{text}</button>)}</span></span>;
}
export type CharacterRow={cloudRoom?:boolean;cloudReadOnly?:boolean;id:string;name:string;player?:string;edition?:string;classes?:string;hp?:number;maxHp?:number;ac?:number;level?:number;write:boolean;locked?:boolean;inScene?:boolean};
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
 const ordered=useCharacterBookOrder(rows),[sort,setSort]=useState('manual'),[filter,setFilter]=useState('all'),[context,setContext]=useState<{id:string;x:number;y:number}>();
 const visible=useMemo(()=>{const term=query.trim().toLocaleLowerCase();return ordered.filter(row=>filter==='all'||filter==='scene'&&row.inScene||filter==='write'&&row.write||filter==='read'&&!row.write).filter(r=>`${r.name} ${r.player||''} ${r.classes||''} ${r.edition||''}`.toLocaleLowerCase().includes(term)).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'zh-CN',{numeric:true}):sort==='player'?(a.player||'').localeCompare(b.player||'','zh-CN'):sort==='level'?(b.level||0)-(a.level||0):sort==='scene'?Number(!!b.inScene)-Number(!!a.inScene):0);},[ordered,filter,query,sort]);
 const ids=selected.filter(id=>rows.some(r=>r.id===id)),all=visible.length>0&&visible.every(r=>ids.includes(r.id));
 // App owns the lock across closing/reopening this dialog and releases it only
 // for a correlated terminal receipt. Standalone callers retain a local lock.
 // Manual reordering: one pointer gesture with our own ghost (never the
 // browser's drag image). The list reorders live under the pointer and the
 // order is persisted on release; Escape or a cancelled pointer restores it.
 const [drag,setDrag]=useState<{id:string;target?:string;after?:boolean;ids?:string[]}>(),[orderNotice,setOrderNotice]=useState('');
 const dragRef=useRef<{id:string;pointer:number;startX:number;startY:number;offsetX?:number;offsetY?:number;active:boolean;ghost?:HTMLElement;target?:string;after?:boolean}>(undefined),listRef=useRef<HTMLUListElement>(null),latest=useRef({rows,visible,busy,sort});latest.current={rows,visible,busy,sort};
 const beginDrag=(event:ReactPointerEvent<HTMLButtonElement>,id:string)=>{if(event.button!==0||!event.isPrimary||busy||sort!=='manual')return;event.preventDefault();dragRef.current={id,pointer:event.pointerId,startX:event.clientX,startY:event.clientY,active:false};};
 useEffect(()=>{
  let frame=0,point:{x:number;y:number}|undefined;
  const finish=(commit:boolean)=>{cancelAnimationFrame(frame);frame=0;point=undefined;const d=dragRef.current;if(!d)return;dragRef.current=undefined;d.ghost?.remove();document.body.classList.remove('book-dragging');if(commit&&d.active&&d.target&&d.target!==d.id&&!latest.current.busy&&latest.current.sort==='manual'){placeCharacter(latest.current.rows,d.id,d.target,!!d.after);setOrderNotice('角色顺序已更新');}setDrag(undefined);};
  const targetAt=(x:number,y:number)=>{
   const d=dragRef.current;if(!d)return;
   const over=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-book-id]');if(!over||!listRef.current?.contains(over)||over.dataset.bookId===d.id)return;
   const box=over.getBoundingClientRect(),after=y>box.top+box.height/2,target=over.dataset.bookId!;if(target===d.target&&after===d.after)return;d.target=target;d.after=after;
   setDrag(current=>({id:d.id,target,after,ids:(()=>{const ids=(current?.ids||latest.current.visible.map(row=>row.id)).filter(key=>key!==d.id),at=ids.indexOf(target);if(at<0)return current?.ids;ids.splice(after?at+1:at,0,d.id);return ids;})()}));
  };
  const autoScroll=()=>{const list=listRef.current;if(!dragRef.current?.active||!list||!point){frame=0;return;}const box=list.getBoundingClientRect(),edge=32;
   const speed=point.x>=box.left&&point.x<=box.right?(point.y<box.top+edge?-Math.min(1,(box.top+edge-point.y)/edge):point.y>box.bottom-edge?Math.min(1,(point.y-box.bottom+edge)/edge):0):0;
   if(speed){const before=list.scrollTop;list.scrollTop+=speed*8;if(list.scrollTop!==before)targetAt(point.x,Math.max(box.top+1,Math.min(box.bottom-1,point.y)));}frame=requestAnimationFrame(autoScroll);
  };
  const move=(event:PointerEvent)=>{const d=dragRef.current;if(!d||event.pointerId!==d.pointer)return;
   if(!d.active){if(Math.hypot(event.clientX-d.startX,event.clientY-d.startY)<5)return;d.active=true;document.body.classList.add('book-dragging');
    const source=listRef.current?.querySelector<HTMLElement>(`[data-book-id="${CSS.escape(d.id)}"]`);if(!source){finish(false);return;}
    const box=source.getBoundingClientRect(),ghost=document.createElement('div'),list=document.createElement('ul'),clone=source.cloneNode(true) as HTMLElement;
    ghost.className='character-manager book-drag-ghost';ghost.setAttribute('aria-hidden','true');ghost.inert=true;ghost.style.width=`${box.width}px`;list.className='book-list';clone.classList.remove('is-dragging');clone.removeAttribute('id');clone.removeAttribute('data-book-id');for(const node of clone.querySelectorAll('[id]'))node.removeAttribute('id');list.append(clone);ghost.append(list);
    d.offsetX=d.startX-box.left;d.offsetY=d.startY-box.top;(listRef.current?.closest('dialog[open]')||document.body).append(ghost);d.ghost=ghost;}
   event.preventDefault();point={x:event.clientX,y:event.clientY};if(d.ghost)d.ghost.style.transform=`translate3d(${point.x-(d.offsetX||0)}px,${point.y-(d.offsetY||0)}px,0)`;
   targetAt(point.x,point.y);if(!frame)frame=requestAnimationFrame(autoScroll);
  };
  const up=(event:PointerEvent)=>{if(dragRef.current&&event.pointerId===dragRef.current.pointer)finish(true);};
  const cancel=()=>finish(false);const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&dragRef.current){event.preventDefault();event.stopPropagation();finish(false);}};
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',escape,true);window.addEventListener('blur',cancel);
  return()=>{finish(false);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',escape,true);window.removeEventListener('blur',cancel);};
 },[]);
 const shown=drag?.ids?drag.ids.map(id=>visible.find(row=>row.id===id)!).filter(Boolean):visible;
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
 const sortOptions:ReadonlyArray<readonly [string,string]>=[['manual','手动顺序'],['name','角色名'],['player','玩家名'],['level','等级'],...(inWorkbench?[['scene','场内优先'] as const]:[])],filterOptions:ReadonlyArray<readonly [string,string]>=[['all','全部'],['write','可编辑'],['read','只读'],...(inWorkbench?[['scene','当前场景'] as const]:[])];
 return <section className="character-manager">
 <div className="manager-tools"><input type="search" aria-label="搜索角色" placeholder="搜索角色 / 玩家 / 职业 / 版本" value={query} onChange={e=>setQuery(e.target.value)}/><Segmented label="角色排序" caption="排序" value={sort} options={sortOptions} onChange={setSort}/><Segmented label="角色筛选" caption="筛选" value={filter} options={filterOptions} onChange={setFilter}/></div>
 <div className="manager-selection"><label className="manager-select-all"><input type="checkbox" aria-label="选择当前搜索结果" checked={all} disabled={busy||!visible.length} onChange={e=>{setConfirm(false);setSelected(e.target.checked?[...new Set([...ids,...visible.map(r=>r.id)])]:ids.filter(id=>!visible.some(r=>r.id===id)));}}/>全选</label><span className="manager-summary">{visible.length} / {rows.length} 张{ids.length?` · 已选 ${ids.length}`:''}</span><span className="manager-actions">{ids.length>1&&<button className="icon-button" disabled={busy} onClick={()=>void act('readCards',async()=>download('角色集合.json',exportCharacters(await read(ids))))}><DownloadIcon/>导出所选</button>}{ids.length>0&&<button className="icon-button is-danger" disabled={!canDelete} onClick={()=>setConfirm(true)}><TrashIcon/>删除所选</button>}{refresh&&<button disabled={busy} onClick={()=>{setConfirm(false);void act('refreshCatalog',async()=>{await refresh();setRefreshNotice('已重新读取目录，请核对当前列表。不确定的删除不会自动重试。');},true);}}>重新读取目录</button>}</span></div>
 {error&&<div className="inline-error"><p role="alert">{error.completed!==undefined&&!/^已确认删除 \d+ 张/.test(message)?`已确认删除 ${error.completed} 张；其余项目保留，未自动重试。`:''}{message}</p><CopyDiagnostic text={diagnosticText(error.cause,{operation:error.operation,at:error.at})} label="复制诊断信息" ariaLabel="诊断信息"/></div>}
 {pendingVisible.length>0&&<p role="status">有 {pendingVisible.length} 张角色的批量删除正在处理，正在等待宿主确认；请勿重复提交。</p>}
 {blockedVisible.length>0&&<p role="status">有 {blockedVisible.length} 张角色的删除结果尚未确认，已暂停再次删除。请重新读取目录核对；仍在目录中的未确认项目不会自动解锁。</p>}
 {refreshNotice&&<p role="status">{refreshNotice}</p>}
 {confirm&&<div className="delete-confirm">将删除所选 {ids.length} 张角色资料，场景棋子保留；请先导出备份。<button disabled={!canDelete} onClick={()=>void deleteSelected()}>确认批量删除</button><button onClick={()=>setConfirm(false)}>取消</button></div>}
 <div className="book-heading" aria-hidden="true"><span>↕</span><span/><span>角色 / 玩家 · 职业 · 版本</span><span className="book-heading-stats">生命 / 护甲</span><span className="book-heading-actions">操作</span></div>
 <p className="book-order-notice" role="status" aria-live="polite">{orderNotice}</p>
 <ul ref={listRef} className="book-list" aria-label="角色列表">{shown.map(row=><li key={row.id} data-book-id={row.id} className={`book-row${row.id===currentId?' is-current':''}${drag?.id===row.id?' is-dragging':''}`} aria-current={row.id===currentId?'true':undefined}>
  <button type="button" className="book-grip" aria-label={`拖动调整${row.name}的顺序`} title={sort==='manual'?'拖动排序；键盘 ↑ / ↓ 调整顺序':'切换到“手动顺序”后可拖动'} disabled={busy||sort!=='manual'} onContextMenu={event=>event.preventDefault()} onPointerDown={event=>beginDrag(event,row.id)} onKeyDown={event=>{if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;event.preventDefault();const at=visible.findIndex(item=>item.id===row.id),next=visible[at+(event.key==='ArrowUp'?-1:1)];if(!next)return;placeCharacter(rows,row.id,next.id,event.key==='ArrowDown');setOrderNotice(`${row.name}已${event.key==='ArrowUp'?'上移':'下移'}`);}}><GripIcon/></button>
  <input type="checkbox" aria-label={`选择${row.name}`} checked={ids.includes(row.id)} disabled={busy} onChange={e=>toggle(row.id,e.target.checked)}/>
  <button type="button" onContextMenu={inWorkbench?event=>{event.preventDefault();setContext({id:row.id,x:event.clientX,y:event.clientY});}:undefined} className="book-title" disabled={busy} onClick={()=>open(row.id)} title={row.id===currentId?'当前角色':'打开这张角色卡'}><span className="book-name"><strong><span className="book-display-name">{row.name}</span>{row.cloudRoom&&<span className="cloud-sync-icon"><CloudIcon/></span>}{row.id===currentId&&<span className="book-current">当前</span>}</strong><small title={`${row.player||'未填玩家'} · ${row.classes||(row.level?`${row.level} 级`:'未选职业')}${row.edition?` · ${row.edition}`:''}`}>{row.player||'未填玩家'} · {row.classes||(row.level?`${row.level} 级`:'未选职业')}{row.edition?` · ${row.edition}`:''}</small><span className="book-chips"><span>{row.write&&!row.cloudReadOnly?'可编辑':'只读'}</span>{row.cloudRoom&&<span>云端</span>}{!cloud&&row.locked&&<span>上锁</span>}{row.inScene&&<span>场内</span>}{pendingDeleteIds.includes(row.id)?<span className="book-warning">删除处理中</span>:blocked.includes(row.id)?<span className="book-warning">删除待核对</span>:null}</span></span></button>
  <span className="book-stats"><span className="book-stat" title="生命值"><HeartIcon/>{row.hp??'—'}<em>/{row.maxHp??'—'}</em></span><span className="book-stat" title="护甲等级"><ShieldIcon/>{row.ac??'—'}</span></span>
  <span className="row-actions">{cloud&&<span className="book-cloud"><CloudSaveControl id={row.id} disabled={busy||!row.write} book/></span>}{inWorkbench&&<Suspense fallback={null}><LocateButton id={row.id}/></Suspense>}<button type="button" className="icon-button" title="打开 DM 审卡" disabled={busy} onClick={()=>void act('readCards',async()=>review((await read([row.id]))[0]))}><BadgeCheckIcon/><span className="label">审卡</span></button><button type="button" className="icon-button" title="导出这张卡的 JSON 备份" disabled={busy} onClick={()=>void act('readCards',async()=>download(`${row.name.replace(/[<>:"/\\|?*]/g,'_')}.json`,exportCharacter((await read([row.id]))[0])))}><DownloadIcon/><span className="label">JSON</span></button></span>
 </li>)}{!shown.length&&<li className="book-empty"><BookIcon/><p>{query||filter!=='all'?'没有符合条件的角色。换个关键词，或把筛选改回“全部”。':'这里还没有角色卡。用下方“批量创建角色”新建，或在“导入与导出”里导入 JSON / Excel。'}</p></li>}</ul>
 <details className="manager-create"><summary><PlusIcon/>批量创建角色</summary><Segmented label="规则版本" caption="规则版本" value={edition} options={[['2024','2024'],['2014','2014']] as const} onChange={value=>setEdition(value as Edition)}/><label>每行一个角色名<textarea aria-label="批量角色名" value={names} onChange={e=>setNames(e.target.value)} placeholder={'旅行者\n向导\n守卫'}/></label><button disabled={busy||disabled||createUncertain||!names.trim()} onClick={()=>void act('createCard',async()=>{const list=names.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);if(list.length>100)throw Error('一次最多创建 100 张角色卡');try{await create(list,edition);setNames('');}catch(error){const result=error as {completed?:number;uncertain?:boolean};if(result.completed)setNames(list.slice(result.completed).join('\n'));if(result.uncertain)setCreateUncertain(true);throw error;}})}>{busy?'正在处理…':'创建这些角色'}</button><p className="manager-hint"><UserIcon/>新角色会使用所选规则版本，之后可以在卡面上改名、换版本。</p>{createUncertain&&<p role="status">创建结果尚未确认，请先核对角色簿，避免重复创建。</p>}</details>
 {context&&<Suspense fallback={null}><CharacterLocateMenu id={context.id} position={{x:context.x,y:context.y}} close={()=>setContext(undefined)}/></Suspense>}</section>;
}
