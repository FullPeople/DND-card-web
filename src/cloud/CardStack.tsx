import {lazy,Suspense,useEffect,useRef,useState,type CSSProperties,type PointerEvent} from 'react';
import type {Character} from '../core/model';
import {cloudViewUrl,readCloudCard,CloudRequestError,type CardSummary} from './api';
import './gallerySheet.css';
let renderer:ReturnType<typeof importPreview>|undefined;
function importPreview(){return import('./SheetPreview');}
const loadPreview=()=>renderer||(renderer=importPreview());
const SheetPreview=lazy(loadPreview);
const wrap=(value:number,length:number)=>(value%length+length)%length;
type Preview={revision:number;character?:Character;error?:string};

export function CardStack({cards,manage,edit,missing}:{cards:CardSummary[];manage:(card:CardSummary)=>void;edit:(card:CardSummary)=>void;missing:(id:string)=>void}){
 const [position,setPosition]=useState(0),[previews,setPreviews]=useState<Record<string,Preview>>({}),[copy,setCopy]=useState(''),[retry,setRetry]=useState(0);
 const stage=useRef<HTMLDivElement>(null),gesture=useRef<{x:number;y:number;lastX:number;lastAt:number;velocity:number;dragging:boolean}|undefined>(undefined),drag=useRef(0),animation=useRef(0);
 const cache=useRef(new Map<string,Preview>()),pending=useRef(new Map<string,Promise<void>>()),latest=useRef({cards,position,missing});latest.current={cards,position,missing};
 const index=cards.length?wrap(position,cards.length):0,current=cards[index];
 function move(offset:number){if(latest.current.cards.length<2)return;setPosition(value=>value+offset);setCopy('');}
 useEffect(()=>{setPosition(0);setCopy('');},[cards.map(card=>card.id).join('|')]);
 useEffect(()=>()=>cancelAnimationFrame(animation.current),[]);
 useEffect(()=>{const node=stage.current;if(!node)return;const fit=()=>{const small=node.clientWidth<500,width=Math.min((node.clientHeight-35)*.707+42,node.clientWidth*(small?.94:.76));node.style.setProperty('--gallery-width',width+'px');node.style.setProperty('--gallery-spacing',Math.min(node.clientWidth*(small?.8:.37),width*.8)+'px');};fit();const observer=new ResizeObserver(fit);observer.observe(node);return()=>observer.disconnect();},[!!current]);
 useEffect(()=>{const node=stage.current;if(!node)return;let amount=0,last=0;const wheel=(event:WheelEvent)=>{if(event.ctrlKey||event.metaKey||latest.current.cards.length<2)return;for(let child=event.target as HTMLElement;child&&child!==node;child=child.parentElement!){if(child.scrollHeight>child.clientHeight+1&&['auto','scroll'].includes(getComputedStyle(child).overflowY))return;}event.preventDefault();const now=performance.now();if(now-last<300)return;amount+=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;if(Math.abs(amount)>35){move(amount>0?1:-1);amount=0;last=now;}};node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel);},[!!current]);
 useEffect(()=>{
  let alive=true;const wanted=current?[current,...[-1,1].map(offset=>cards[wrap(index+offset,cards.length)])]:[];
  const load=async(row:CardSummary)=>{
   const saved=cache.current.get(row.id);if(saved?.revision===row.revision){cache.current.delete(row.id);cache.current.set(row.id,saved);if(alive)setPreviews(Object.fromEntries(cache.current));return;}
   if(!pending.current.has(row.id)){
    const promise=readCloudCard(row.id).then(value=>{
     cache.current.delete(row.id);cache.current.set(row.id,{revision:value.revision,character:value.character});
     while(cache.current.size>3)cache.current.delete(cache.current.keys().next().value!);
    }).catch(error=>{
     if(error instanceof CloudRequestError&&error.status===404){cache.current.delete(row.id);latest.current.missing(row.id);return;}
     cache.current.set(row.id,{revision:row.revision,error:error instanceof Error?error.message:'角色卡读取失败，请重试。'});
    }).finally(()=>pending.current.delete(row.id));pending.current.set(row.id,promise);
   }
   await pending.current.get(row.id);if(alive)setPreviews(Object.fromEntries(cache.current));
  };
  // Prioritize the selected card; nearby cards reuse one loaded module graph.
  let timer:ReturnType<typeof setTimeout>;
  if(current){void loadPreview().catch(()=>{});void load(current).then(()=>{if(alive)timer=setTimeout(()=>void(async()=>{for(const row of wanted.slice(1)){if(!alive)return;await load(row);}})(),180);});}
  return()=>{alive=false;clearTimeout(timer);};
 },[current?.id,current?.revision,cards,retry]);
 function paintDrag(value:number){drag.current=value;stage.current?.style.setProperty('--gallery-drag',value+'px');}
 function finish(){
  cancelAnimationFrame(animation.current);const start=gesture.current;gesture.current=undefined;
  const projected=drag.current+(start&&performance.now()-start.lastAt<150?start.velocity*90:0);
  stage.current?.classList.remove('is-dragging');paintDrag(0);
  if(start?.dragging&&Math.abs(projected)>48)move(projected<0?1:-1);
 }
 function down(event:PointerEvent){
  if(!event.isPrimary||(event.target as Element).closest('a,button,input,textarea,select,[role=button]'))return;
  const now=performance.now();gesture.current={x:event.clientX,y:event.clientY,lastX:event.clientX,lastAt:now,velocity:0,dragging:false};
 }
 function dragMove(event:PointerEvent){
  const start=gesture.current;if(!start)return;const x=event.clientX-start.x,y=event.clientY-start.y;
  if(!start.dragging){if(Math.abs(x)<8)return;if(Math.abs(y)>Math.abs(x)){gesture.current=undefined;return;}start.dragging=true;event.currentTarget.setPointerCapture(event.pointerId);stage.current?.classList.add('is-dragging');}
  const now=performance.now();start.velocity=(event.clientX-start.lastX)/Math.max(1,now-start.lastAt);start.lastX=event.clientX;start.lastAt=now;event.preventDefault();
  cancelAnimationFrame(animation.current);animation.current=requestAnimationFrame(()=>paintDrag(Math.max(-280,Math.min(280,x))));
 }
 if(!current)return <p className="cloud-stack-empty">没有找到角色卡。可以调整搜索，或从左侧“本机角色”保存一张卡。</p>;
 const slots=cards.length===1?[0]:[-2,-1,0,1,2];
 return <section className="cloud-card-stack" aria-label="完整 A4 云端角色卡" onKeyDown={event=>{if((event.target as Element).closest('input,textarea,select,[role=tab]'))return;if(event.key==='ArrowLeft'){event.preventDefault();move(-1);}if(event.key==='ArrowRight'){event.preventDefault();move(1);}}} tabIndex={0}>
 <div className="cloud-stack-heading"><div><strong>{current.name||'未命名角色'}</strong><small>{current.edition} · {index+1} / {cards.length}{current.role==='owner'?' · 当前浏览器上传':current.role==='editor'?' · 获授权编辑':' · 公开只读'}</small></div><span className="cloud-stack-id"><code>{current.id}</code><button onClick={()=>void navigator.clipboard.writeText(current.id).then(()=>setCopy('已复制')).catch(()=>setCopy('请选中 ID 手动复制'))}>{copy||'复制 ID'}</button></span></div>
 <div ref={stage} className="cloud-gallery-stage" onPointerDown={down} onPointerMove={dragMove} onPointerUp={finish} onPointerCancel={()=>{cancelAnimationFrame(animation.current);gesture.current=undefined;stage.current?.classList.remove('is-dragging');paintDrag(0);}}>
 {slots.map(offset=>{const slot=position+offset,row=cards[wrap(slot,cards.length)],preview=previews[row.id],active=offset===0;return <div className={`cloud-gallery-item ${active?'is-active':''}`} key={slot} data-card-id={row.id} data-offset={offset} style={{'--gallery-offset':offset} as CSSProperties}>
  <div className="cloud-gallery-paper" inert={!active} aria-hidden={!active}>
  {Math.abs(offset)<=1&&preview?.character?<Suspense fallback={<div className="cloud-preview-placeholder" role={active?'status':undefined}>正在加载角色卡界面…</div>}><SheetPreview character={preview.character} active={active}/></Suspense>:<div className="cloud-preview-placeholder"><strong>{row.name}</strong><small>{row.edition} · {row.id}</small>{active&&<p role={preview?.error?'alert':'status'}>{preview?.error||'正在读取完整角色卡…'}</p>}{active&&preview?.error&&<button onClick={()=>{cache.current.delete(row.id);setPreviews(old=>{const next={...old};delete next[row.id];return next;});setRetry(value=>value+1);}}>重试读取</button>}</div>}
  </div>
  {!active&&<button className="cloud-gallery-select" aria-label={`切换到 ${row.name} ${row.id}`} onClick={()=>move(offset)}/>}
 </div>;})}
 </div>
 <div className="cloud-stack-switch"><button aria-label="上一张角色卡" disabled={cards.length<2} onClick={()=>move(-1)}>← 上一张</button><span>拖动卡片 · 循环浏览</span><button aria-label="下一张角色卡" disabled={cards.length<2} onClick={()=>move(1)}>下一张 →</button></div>
 <div className="cloud-stack-actions"><a className="cloud-button" href={cloudViewUrl(current.id)} target="_blank" rel="noopener noreferrer">查看五页 / 导出 JSON</a>{current.role&&<button onClick={()=>edit(current)}>编辑本机草稿</button>}{current.role==='owner'&&<button onClick={()=>manage(current)}>管理这张卡</button>}</div>
 </section>;
}
