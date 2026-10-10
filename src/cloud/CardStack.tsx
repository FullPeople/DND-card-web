import {lazy,Suspense,useEffect,useLayoutEffect,useRef,useState,type PointerEvent} from 'react';
import type {Character} from '../core/model';
import {exportCharacter} from '../core/export';
import {readCloudCard,CloudRequestError,type CardSummary} from './api';
import './gallerySheet.css';
import './galleryPresentation.css';
import {galleryMotion} from './galleryMotion';
import {prepareGalleryFlight,flyGalleryPaper,type GalleryFlight} from './galleryFlight';
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
 const stage=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDialogElement>(null),fullSheet=useRef<HTMLDivElement>(null),opener=useRef<HTMLElement|undefined>(undefined),from=useRef<DOMRect|undefined>(undefined),gesture=useRef<{x:number;y:number;dragging:boolean;moved:boolean;origin:number;spacing:number;id:number}|undefined>(undefined),suppressClick=useRef(0),animation=useRef<Animation|undefined>(undefined),closing=useRef(false),selection=useRef<string|undefined>(undefined);
 const fraction=useRef(0),paintFrame=useRef(0),departures=useRef<HTMLDivElement>(null),flights=useRef(new Set<Animation>()),flight=useRef<GalleryFlight|undefined>(undefined);
 function paint(){const node=stage.current;if(!node)return;const spacing=parseFloat(node.style.getPropertyValue('--gallery-spacing')||'180'),moving=flight.current;flight.current=undefined;for(const item of node.querySelectorAll<HTMLElement>('.cloud-gallery-item')){const offset=Number(item.dataset.offset)+fraction.current;if(moving)flyGalleryPaper(item,offset,spacing,moving,flights.current);else Object.assign(item.style,galleryMotion(offset,spacing));}}
 function schedulePaint(){if(paintFrame.current)return;paintFrame.current=requestAnimationFrame(()=>{paintFrame.current=0;paint();});}
 useLayoutEffect(paint);
 useEffect(()=>()=>{cancelAnimationFrame(paintFrame.current);for(const moving of flights.current)moving.cancel();},[]);
 const index=Math.max(0,cards.findIndex(row=>row.id===selected)),current=cards[index];
 const latest=useRef({cards,current,fullId,missing});latest.current={cards,current,fullId,missing};
 const signature=cards.map(row=>`${row.id}:${row.revision}`).join('|');
 function select(id:string,delta?:number){
  const now=latest.current,oldIndex=now.cards.findIndex(row=>row.id===(selection.current||now.current?.id)),nextIndex=now.cards.findIndex(row=>row.id===id);
  if(id!==selection.current&&oldIndex>=0&&nextIndex>=0&&stage.current&&departures.current&&!gesture.current?.dragging&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
   let steps=delta??nextIndex-oldIndex;if(delta===undefined&&Math.abs(steps)>now.cards.length/2)steps-=Math.sign(steps)*now.cards.length;
   const next=new Map(offsets(now.cards.length).map(offset=>[now.cards[wrap(nextIndex+offset,now.cards.length)].id,offset]));
   flight.current=prepareGalleryFlight(stage.current,next,steps,departures.current,flights.current);
  }
  selection.current=id;setSelected(id);setCopy('');
 }
 function move(offset:number){const now=latest.current;if(now.cards.length<2||!now.current)return;const i=Math.max(0,now.cards.findIndex(row=>row.id===(selection.current||now.current!.id))),steps=offset%now.cards.length;if(steps)select(now.cards[wrap(i+steps,now.cards.length)].id,steps);}
 useEffect(()=>{if(current&&selected!==current.id)select(current.id);if(fullId&&!cards.some(row=>row.id===fullId))close();},[signature]);
 useEffect(()=>{
  if(!current)return;let active=true;
  const wanted=[current,...[-1,1,-2,2,-3,3].map(offset=>cards[wrap(index+offset,cards.length)])].filter((row,i,list)=>list.findIndex(other=>other.id===row.id)===i);
  const pinned=new Set(offsets(cards.length).map(offset=>cards[wrap(index+offset,cards.length)].id));if(fullId)pinned.add(fullId);
  function trim(){const now=latest.current,i=Math.max(0,now.cards.findIndex(row=>row.id===now.current?.id)),keep=new Set(now.cards.length?offsets(now.cards.length).map(offset=>now.cards[wrap(i+offset,now.cards.length)].id):[]);if(now.fullId)keep.add(now.fullId);for(const id of cache.keys())if(cache.size>8&&!keep.has(id))cache.delete(id);}
  function publish(row:CardSummary,value:Preview){trim();if(!active)return;setPreviews(old=>Object.fromEntries(Object.entries({...old,[row.id]:value}).filter(([id])=>cache.has(id)||pinned.has(id))));}
  const read=(row:CardSummary)=>{void load(row).then(value=>{publish(row,value);if(active&&value.revision<row.revision)setRetry(n=>n+1);}).catch(error=>{if(!active)return;if(error instanceof CloudRequestError&&error.status===404){cache.delete(row.id);latest.current.missing(row.id);}else publish(row,{revision:row.revision,error:`角色读取失败${error instanceof CloudRequestError?`（HTTP ${error.status}）`:''}，请重试。`});});};
  for(const row of wanted){const saved=cache.get(row.id);if(saved?.character&&saved.revision>=row.revision)publish(row,saved);}
  void loadPreview();wanted.forEach(read);
  return()=>{active=false;};
 },[signature,current?.id,retry]);
 useEffect(()=>{if(!stage.current)return;const update=()=>{const node=stage.current!,height=node.clientHeight;node.style.setProperty('--gallery-width',Math.min(node.clientWidth*.66,Math.max(100,height-28)*210/297)+'px');node.style.setProperty('--gallery-spacing',Math.min(node.clientWidth*.25,Math.max(90,height*.22))+'px');paint();};update();const observer=new ResizeObserver(update);observer.observe(stage.current);return()=>observer.disconnect();},[!!current]);
 function down(event:PointerEvent){if(!event.isPrimary||event.button!==0)return;suppressClick.current=0;const now=latest.current;gesture.current={x:event.clientX,y:event.clientY,dragging:false,moved:false,origin:Math.max(0,now.cards.findIndex(row=>row.id===now.current?.id)),spacing:Math.max(90,parseFloat(stage.current?.style.getPropertyValue('--gallery-spacing')||'180')),id:event.pointerId};}
 function dragMove(event:PointerEvent){const start=gesture.current;if(!start||event.pointerId!==start.id)return;const x=event.clientX-start.x,y=event.clientY-start.y;if(Math.hypot(x,y)>5)start.moved=true;if(!start.dragging){if(Math.hypot(x,y)<8||latest.current.cards.length<2)return;start.dragging=true;event.currentTarget.setPointerCapture(event.pointerId);stage.current?.classList.add('is-dragging');}event.preventDefault();const distance=Math.abs(x)>=Math.abs(y)?x:y,steps=Math.round(-distance/start.spacing),rows=latest.current.cards,id=rows[wrap(start.origin+steps,rows.length)]?.id;fraction.current=distance/start.spacing+steps;if(id&&id!==selection.current)select(id);schedulePaint();}
 function finish(event:PointerEvent,cancel=false){const start=gesture.current;gesture.current=undefined;stage.current?.classList.remove('is-dragging');if(start?.dragging&&!cancel&&stage.current&&departures.current&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const next=new Map([...stage.current.querySelectorAll<HTMLElement>('.cloud-gallery-item')].map(node=>[node.dataset.cardId!,Number(node.dataset.offset)]));flight.current=prepareGalleryFlight(stage.current,next,0,departures.current,flights.current);}fraction.current=0;schedulePaint();if(stage.current?.hasPointerCapture(event.pointerId))stage.current.releasePointerCapture(event.pointerId);if(start?.moved||cancel)suppressClick.current=performance.now()+350;if(cancel&&start&&latest.current.cards[start.origin])select(latest.current.cards[start.origin].id);}
 useEffect(()=>{const node=stage.current;if(!node)return;let amount=0,last=0;const wheel=(event:WheelEvent)=>{if(event.ctrlKey||latest.current.fullId||latest.current.cards.length<2)return;event.preventDefault();const now=performance.now();if(now-last>180)amount=0;last=now;amount+=(Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY)*(event.deltaMode===1?24:event.deltaMode===2?node.clientHeight:1);const steps=Math.trunc(amount/70);if(steps){amount-=steps*70;move(steps);suppressClick.current=now+100;}};node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel);},[!!current]);
 function open(row:CardSummary,node:HTMLElement){if(performance.now()<suppressClick.current)return;if(row.id!==latest.current.current?.id){select(row.id,Number(node.parentElement?.dataset.offset));return;}opener.current=node;from.current=(node.parentElement?.querySelector('.paper')||node).getBoundingClientRect();setFullId(row.id);}
 function travel(reverse=false){const node=fullSheet.current,rect=from.current,paper=node?.querySelector('.paper');if(!node||!rect||!paper||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const target=paper.getBoundingClientRect(),container=node.getBoundingClientRect(),scale=Math.min(rect.width/target.width,rect.height/target.height);node.style.transformOrigin=`${target.x+target.width/2-container.x}px ${target.y+target.height/2-container.y}px`;const small=`translate(${rect.x+rect.width/2-target.x-target.width/2}px,${rect.y+rect.height/2-target.y-target.height/2}px) scale(${scale})`;return node.animate(reverse?[{transform:'none',opacity:1},{transform:small,opacity:.4}]:[{transform:small,opacity:.4},{transform:'none',opacity:1}],{duration:330,easing:'cubic-bezier(.22,.8,.22,1)'});}
 function close(){if(closing.current)return;closing.current=true;animation.current?.cancel();const moving=travel(true);const done=()=>{dialog.current?.close();setFullId(undefined);closing.current=false;opener.current?.focus();};if(moving)void moving.finished.catch(()=>{}).then(done);else done();}
 useEffect(()=>{if(!fullId)return;closing.current=false;dialog.current?.showModal();const frame=requestAnimationFrame(()=>{animation.current=travel();});return()=>{cancelAnimationFrame(frame);animation.current?.cancel();};},[fullId]);
 useEffect(()=>()=>{animation.current?.cancel();dialog.current?.close();},[]);
 async function refreshFull(){const row=latest.current.cards.find(row=>row.id===latest.current.fullId);if(!row)return;try{const value=await readCloudCard(row.id),next={revision:value.revision,character:value.character};cache.set(row.id,next);setPreviews(old=>({...old,[row.id]:next}));}catch(error){if(error instanceof CloudRequestError&&error.status===404)latest.current.missing(row.id);else setPreviews(old=>({...old,[row.id]:{...old[row.id],error:'刷新失败，已读取的角色保留。'}}));}}
 if(!current)return <section className="cloud-card-stack"><header className="cloud-gallery-title"><h2>{title}</h2></header><p className="cloud-stack-empty">没有找到角色卡。可以调整搜索，或从左侧“本机角色”保存一张卡。</p></section>;
 const fullscreen=cards.find(row=>row.id===fullId),fullPreview=fullId?(previews[fullId]||cache.get(fullId)):undefined;
 return <section className="cloud-card-stack" aria-label="完整 A4 云端角色卡" onKeyDown={event=>{if(fullId||(event.target as Element).closest('input,textarea,select'))return;if(event.key==='ArrowLeft'){event.preventDefault();move(-1);}if(event.key==='ArrowRight'){event.preventDefault();move(1);}}}>
 <header className="cloud-gallery-title"><h2>{title}</h2><span className="cloud-stack-id"><code>{current.id}</code><button aria-label={`复制云端卡 ID ${current.id}`} onClick={()=>void navigator.clipboard.writeText(current.id).then(()=>setCopy('已复制')).catch(()=>setCopy('请选中 ID 手动复制'))}>{copy||'复制 ID'}</button></span></header>
 <div className="cloud-stack-body"><nav className="cloud-stack-controls" aria-label="切换与管理角色卡"><button disabled={cards.length<2} onClick={()=>move(-1)} aria-label="上一张角色卡">← 上一张</button><button disabled={cards.length<2} onClick={()=>move(1)} aria-label="下一张角色卡">下一张 →</button>{current.role&&<button onClick={()=>edit(current)}>编辑本机草稿</button>}{current.role==='owner'&&<button aria-label="管理这张卡" onClick={()=>manage(current)}>管理／删除</button>}</nav>
 <div ref={stage} className="cloud-gallery-stage" onPointerDown={down} onPointerMove={dragMove} onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)}>
 {offsets(cards.length).map(offset=>{const row=cards[wrap(index+offset,cards.length)],preview=previews[row.id]||cache.get(row.id),active=offset===0;return <div className={`cloud-gallery-item ${active?'is-active':''}`} key={row.id} data-card-id={row.id} data-offset={offset} style={galleryMotion(offset,parseFloat(stage.current?.style.getPropertyValue('--gallery-spacing')||'180'))}>
  <div className="cloud-gallery-paper" inert aria-hidden="true">{preview?.character?<Suspense fallback={<div className="cloud-preview-placeholder"/>}><SheetPreview character={preview.character} active={false} displayOnly/></Suspense>:<div className="cloud-preview-placeholder">{active&&<p>{preview?.error||'正在读取完整角色卡…'}</p>}</div>}</div>
  {active&&preview?.error?<button className="cloud-gallery-retry" onClick={()=>{cache.delete(row.id);setRetry(n=>n+1);}}>重试读取</button>:<button className="cloud-gallery-open" aria-label={`${active?'全屏查看':'切换到'}角色卡 ${row.id}`} disabled={active&&!preview?.character} onClick={event=>open(row,event.currentTarget)}/>}
 </div>;})}<div ref={departures} className="cloud-gallery-departures"/></div></div>
 {fullId&&<dialog ref={dialog} className="cloud-card-fullscreen" aria-label="全屏角色卡" onCancel={event=>{event.preventDefault();close();}}><header><strong>{fullscreen?.name||'角色卡'}</strong><span className="cloud-stack-id"><code>{fullId}</code></span>{fullscreen?.role&&<button onClick={()=>edit(fullscreen)}>编辑本机草稿</button>}<button autoFocus onClick={close}>返回画廊</button></header><div ref={fullSheet} className="cloud-fullscreen-sheet">{fullPreview?.character?<Suspense fallback={<p>正在加载角色卡界面…</p>}><SheetPreview character={fullPreview.character} active displayOnly={false} originalJson={JSON.stringify(exportCharacter(fullPreview.character))} onReload={()=>void refreshFull()}/></Suspense>:<p role="status">正在读取角色卡…</p>}</div>{fullPreview?.error&&<p role="alert">{fullPreview.error}</p>}</dialog>}
 </section>;
}
