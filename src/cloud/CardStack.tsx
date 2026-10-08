import {lazy,Suspense,useEffect,useRef,useState,type CSSProperties,type PointerEvent} from 'react';
import type {Character} from '../core/model';
import {exportCharacter} from '../core/export';
import {readCloudCard,CloudRequestError,type CardSummary} from './api';
import './gallerySheet.css';
import './galleryPresentation.css';
let renderer:ReturnType<typeof importPreview>|undefined;
function importPreview(){return import('./SheetPreview');}
const loadPreview=()=>renderer||(renderer=importPreview());
const SheetPreview=lazy(loadPreview);
const wrap=(value:number,length:number)=>(value%length+length)%length;
type Preview={revision:number;character?:Character;error?:string};
// Public content only. Ownership is always taken from the fresh directory.
const cache=new Map<string,Preview>();
const pending=new Map<string,Promise<Preview>>();
function load(row:CardSummary){
 const saved=cache.get(row.id);if(saved?.character&&saved.revision>=row.revision)return Promise.resolve(saved);
 let task=pending.get(row.id);if(task)return task;
 task=readCloudCard(row.id).then(card=>{const next={revision:card.revision,character:card.character};if((cache.get(row.id)?.revision||0)<=next.revision)cache.set(row.id,next);return cache.get(row.id)!;}).finally(()=>pending.delete(row.id));pending.set(row.id,task);return task;
}
function offsets(length:number){return length<=1?[0]:length===2?[0,1]:length===3?[-1,0,1]:length===4?[-1,0,1,2]:[-2,-1,0,1,2];}

export function CardStack({cards,manage,edit,missing,title='全部云端卡'}:{title?:string;cards:CardSummary[];manage:(card:CardSummary)=>void;edit:(card:CardSummary)=>void;missing:(id:string)=>void}){
 const [selected,setSelected]=useState<string>(),[previews,setPreviews]=useState<Record<string,Preview>>({}),[copy,setCopy]=useState(''),[retry,setRetry]=useState(0),[fullId,setFullId]=useState<string>();
 const stage=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDialogElement>(null),fullSheet=useRef<HTMLDivElement>(null),opener=useRef<HTMLElement|undefined>(undefined),from=useRef<DOMRect|undefined>(undefined),gesture=useRef<{x:number;y:number;dragging:boolean}|undefined>(undefined),suppressClick=useRef(0),animation=useRef<Animation|undefined>(undefined),closing=useRef(false);
 const index=Math.max(0,cards.findIndex(row=>row.id===selected)),current=cards[index];
 const latest=useRef({cards,current,fullId,missing});latest.current={cards,current,fullId,missing};
 const signature=cards.map(row=>`${row.id}:${row.revision}`).join('|');
 function move(offset:number){const now=latest.current;if(now.cards.length<2||!now.current)return;const i=now.cards.findIndex(row=>row.id===now.current!.id);setSelected(now.cards[wrap(i+offset,now.cards.length)].id);setCopy('');}
 useEffect(()=>{if(current&&selected!==current.id)setSelected(current.id);if(fullId&&!cards.some(row=>row.id===fullId))close();},[signature]);
 useEffect(()=>{
  if(!current)return;let active=true;
  const wanted=[current,...[-1,1].map(offset=>cards[wrap(index+offset,cards.length)])].filter((row,i,list)=>list.findIndex(other=>other.id===row.id)===i);
  const pinned=new Set(offsets(cards.length).map(offset=>cards[wrap(index+offset,cards.length)].id));if(fullId)pinned.add(fullId);
  function trim(){const now=latest.current,i=Math.max(0,now.cards.findIndex(row=>row.id===now.current?.id)),keep=new Set(now.cards.length?offsets(now.cards.length).map(offset=>now.cards[wrap(i+offset,now.cards.length)].id):[]);if(now.fullId)keep.add(now.fullId);for(const id of cache.keys())if(cache.size>8&&!keep.has(id))cache.delete(id);}
  function publish(row:CardSummary,value:Preview){trim();if(!active)return;setPreviews(old=>Object.fromEntries(Object.entries({...old,[row.id]:value}).filter(([id])=>cache.has(id)||pinned.has(id))));}
  const read=(row:CardSummary)=>{void load(row).then(value=>{publish(row,value);if(active&&value.revision<row.revision)setRetry(n=>n+1);}).catch(error=>{if(!active)return;if(error instanceof CloudRequestError&&error.status===404){cache.delete(row.id);latest.current.missing(row.id);}else publish(row,{revision:row.revision,error:`角色读取失败${error instanceof CloudRequestError?`（HTTP ${error.status}）`:''}，请重试。`});});};
  for(const row of wanted){const saved=cache.get(row.id);if(saved?.character&&saved.revision>=row.revision)publish(row,saved);}
  read(current);const timer=setTimeout(()=>{void loadPreview();wanted.slice(1).forEach(read);},180);
  return()=>{active=false;clearTimeout(timer);};
 },[signature,current?.id,retry]);
 useEffect(()=>{if(!stage.current)return;const update=()=>{const node=stage.current!,height=node.clientHeight;node.style.setProperty('--gallery-width',Math.min(node.clientWidth*.66,Math.max(100,height-28)*210/297)+'px');node.style.setProperty('--gallery-spacing',Math.min(node.clientWidth*.25,Math.max(90,height*.22))+'px');};update();const observer=new ResizeObserver(update);observer.observe(stage.current);return()=>observer.disconnect();},[!!current]);
 function down(event:PointerEvent){if(!event.isPrimary||event.button!==0)return;gesture.current={x:event.clientX,y:event.clientY,dragging:false};}
 function dragMove(event:PointerEvent){const start=gesture.current;if(!start)return;const x=event.clientX-start.x,y=event.clientY-start.y;if(!start.dragging){if(Math.abs(x)<10)return;if(Math.abs(y)>Math.abs(x)){gesture.current=undefined;return;}start.dragging=true;event.currentTarget.setPointerCapture(event.pointerId);stage.current?.classList.add('is-dragging');}event.preventDefault();stage.current?.style.setProperty('--gallery-drag',Math.max(-250,Math.min(250,x))+'px');}
 function finish(event:PointerEvent){const start=gesture.current;gesture.current=undefined;stage.current?.classList.remove('is-dragging');stage.current?.style.setProperty('--gallery-drag','0px');if(start?.dragging){suppressClick.current=performance.now()+250;const offset=event.clientX-start.x;if(Math.abs(offset)>48)move(offset<0?1:-1);}}
 function open(row:CardSummary,node:HTMLElement){if(performance.now()<suppressClick.current)return;opener.current=node;from.current=node.getBoundingClientRect();setFullId(row.id);}
 function travel(reverse=false){const node=fullSheet.current,rect=from.current;if(!node||!rect||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const target=node.getBoundingClientRect(),small=`translate(${rect.x+rect.width/2-target.x-target.width/2}px,${rect.y+rect.height/2-target.y-target.height/2}px) scale(${rect.width/target.width},${rect.height/target.height})`;return node.animate(reverse?[{transform:'none',opacity:1},{transform:small,opacity:.4}]:[{transform:small,opacity:.4},{transform:'none',opacity:1}],{duration:330,easing:'cubic-bezier(.22,.8,.22,1)'});}
 function close(){if(closing.current)return;closing.current=true;animation.current?.cancel();const moving=travel(true);const done=()=>{dialog.current?.close();setFullId(undefined);closing.current=false;opener.current?.focus();};if(moving)void moving.finished.catch(()=>{}).then(done);else done();}
 useEffect(()=>{if(!fullId)return;closing.current=false;dialog.current?.showModal();animation.current=travel();return()=>{animation.current?.cancel();};},[fullId]);
 useEffect(()=>()=>{animation.current?.cancel();dialog.current?.close();},[]);
 async function refreshFull(){const row=latest.current.cards.find(row=>row.id===latest.current.fullId);if(!row)return;try{const value=await readCloudCard(row.id),next={revision:value.revision,character:value.character};cache.set(row.id,next);setPreviews(old=>({...old,[row.id]:next}));}catch(error){if(error instanceof CloudRequestError&&error.status===404)latest.current.missing(row.id);else setPreviews(old=>({...old,[row.id]:{...old[row.id],error:'刷新失败，已读取的角色保留。'}}));}}
 if(!current)return <section className="cloud-card-stack"><header className="cloud-gallery-title"><h2>{title}</h2></header><p className="cloud-stack-empty">没有找到角色卡。可以调整搜索，或从左侧“本机角色”保存一张卡。</p></section>;
 const fullscreen=cards.find(row=>row.id===fullId),fullPreview=fullId?(previews[fullId]||cache.get(fullId)):undefined;
 return <section className="cloud-card-stack" aria-label="完整 A4 云端角色卡" onKeyDown={event=>{if(fullId||(event.target as Element).closest('input,textarea,select'))return;if(event.key==='ArrowLeft'){event.preventDefault();move(-1);}if(event.key==='ArrowRight'){event.preventDefault();move(1);}}}>
 <header className="cloud-gallery-title"><h2>{title}</h2><span className="cloud-stack-id"><code>{current.id}</code><button aria-label={`复制云端卡 ID ${current.id}`} onClick={()=>void navigator.clipboard.writeText(current.id).then(()=>setCopy('已复制')).catch(()=>setCopy('请选中 ID 手动复制'))}>{copy||'复制 ID'}</button></span></header>
 <div className="cloud-stack-body"><nav className="cloud-stack-controls" aria-label="切换与管理角色卡"><button disabled={cards.length<2} onClick={()=>move(-1)} aria-label="上一张角色卡">← 上一张</button><button disabled={cards.length<2} onClick={()=>move(1)} aria-label="下一张角色卡">下一张 →</button>{current.role&&<button onClick={()=>edit(current)}>编辑本机草稿</button>}{current.role==='owner'&&<button aria-label="管理这张卡" onClick={()=>manage(current)}>管理／删除</button>}</nav>
 <div ref={stage} className="cloud-gallery-stage" onPointerDown={down} onPointerMove={dragMove} onPointerUp={finish} onPointerCancel={()=>{gesture.current=undefined;stage.current?.classList.remove('is-dragging');stage.current?.style.setProperty('--gallery-drag','0px');}}>
 {offsets(cards.length).map(offset=>{const row=cards[wrap(index+offset,cards.length)],preview=previews[row.id]||cache.get(row.id),active=offset===0;return <div className={`cloud-gallery-item ${active?'is-active':''}`} key={row.id} data-card-id={row.id} data-offset={offset} style={{'--gallery-offset':offset,zIndex:10-Math.abs(offset)} as CSSProperties}>
  <div className="cloud-gallery-paper" inert aria-hidden="true">{preview?.character?<Suspense fallback={<div className="cloud-preview-placeholder"/>}><SheetPreview character={preview.character} active={active&&!fullId} displayOnly/></Suspense>:<div className="cloud-preview-placeholder">{active&&<p>{preview?.error||'正在读取完整角色卡…'}</p>}</div>}</div>
  {active&&preview?.error?<button className="cloud-gallery-retry" onClick={()=>{cache.delete(row.id);setRetry(n=>n+1);}}>重试读取</button>:<button className="cloud-gallery-open" aria-label={`全屏查看角色卡 ${row.id}`} disabled={!preview?.character} onClick={event=>open(row,event.currentTarget)}/>}
 </div>;})}</div></div>
 {fullId&&<dialog ref={dialog} className="cloud-card-fullscreen" aria-label="全屏角色卡" onCancel={event=>{event.preventDefault();close();}}><header><strong>{fullscreen?.name||'角色卡'}</strong><span className="cloud-stack-id"><code>{fullId}</code></span>{fullscreen?.role&&<button onClick={()=>edit(fullscreen)}>编辑本机草稿</button>}<button autoFocus onClick={close}>返回画廊</button></header><div ref={fullSheet} className="cloud-fullscreen-sheet">{fullPreview?.character?<Suspense fallback={<p>正在加载角色卡界面…</p>}><SheetPreview character={fullPreview.character} active displayOnly={false} originalJson={JSON.stringify(exportCharacter(fullPreview.character))} onReload={()=>void refreshFull()}/></Suspense>:<p role="status">正在读取角色卡…</p>}</div>{fullPreview?.error&&<p role="alert">{fullPreview.error}</p>}</dialog>}
 </section>;
}
