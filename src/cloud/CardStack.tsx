import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {CardSummary} from './api';
import {cloudViewUrl} from './api';

export function CardStack({cards,manage,edit}:{cards:CardSummary[];manage:(card:CardSummary)=>void;edit:(card:CardSummary)=>void}){
 const [selected,setSelected]=useState<string>(),[drag,setDrag]=useState(0),[copy,setCopy]=useState('');
 const frames=useRef(new Map<string,HTMLIFrameElement>()),cleanup=useRef(new Map<string,()=>void>()),start=useRef<{x:number;y:number}|undefined>(undefined);
 const index=Math.max(0,cards.findIndex(card=>card.id===selected)),current=cards[index];
 const latest=useRef({index,cards});latest.current={index,cards};
 const select=(offset:number)=>{const state=latest.current,next=state.cards[state.index+offset];if(next){setSelected(next.id);setCopy('');}setDrag(0);};
 useEffect(()=>()=>{for(const dispose of cleanup.current.values())dispose();},[]);
 function startDrag(x:number,y:number){start.current={x,y};}
 function moveDrag(x:number,y:number){const origin=start.current;if(origin&&Math.abs(x-origin.x)>Math.abs(y-origin.y))setDrag(Math.max(-220,Math.min(220,x-origin.x)));}
 function endDrag(x:number,y:number){const origin=start.current;start.current=undefined;if(origin&&Math.abs(x-origin.x)>55&&Math.abs(x-origin.x)>Math.abs(y-origin.y)*1.25)select(x<origin.x?1:-1);else setDrag(0);}
 function connect(id:string){
  cleanup.current.get(id)?.();const frame=frames.current.get(id),doc=frame?.contentDocument;if(!doc)return;
  const down=(event:PointerEvent)=>{if(latest.current.cards[latest.current.index]?.id!==id||(event.target as Element).closest('button,a,input,textarea,select,[role=button]'))return;if((event.target as Element).closest('.paper')){startDrag(event.clientX,event.clientY);(event.target as Element).setPointerCapture?.(event.pointerId);}};
  const move=(event:PointerEvent)=>{if(start.current){moveDrag(event.clientX,event.clientY);if(Math.abs(event.clientX-start.current.x)>12)event.preventDefault();}};
  const up=(event:PointerEvent)=>endDrag(event.clientX,event.clientY),cancel=()=>{start.current=undefined;setDrag(0);};
  doc.addEventListener('pointerdown',down);doc.addEventListener('pointermove',move);doc.addEventListener('pointerup',up);doc.addEventListener('pointercancel',cancel);
  cleanup.current.set(id,()=>{doc.removeEventListener('pointerdown',down);doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerup',up);doc.removeEventListener('pointercancel',cancel);});
 }
 if(!current)return <p className="cloud-stack-empty">没有找到角色卡。可以调整搜索，或从左侧“本机角色”保存一张卡。</p>;
 return <section className="cloud-card-stack" aria-label="完整 A4 云端角色卡" onKeyDown={event=>{if(event.target===event.currentTarget){if(event.key==='ArrowLeft')select(-1);if(event.key==='ArrowRight')select(1);}}} tabIndex={0}>
 <div className="cloud-stack-heading"><div><strong>{current.name||'未命名角色'}</strong><small>{current.edition} · {index+1} / {cards.length}{current.role==='owner'?' · 当前浏览器上传':current.role==='editor'?' · 获授权编辑':' · 公开只读'}</small></div><span className="cloud-stack-id"><code>{current.id}</code><button onClick={()=>void navigator.clipboard.writeText(current.id).then(()=>setCopy('已复制')).catch(()=>setCopy('请选中 ID 手动复制'))}>{copy||'复制 ID'}</button></span></div>
 <div className={`cloud-stack-stage ${drag?'is-dragging':''}`} style={{'--cloud-drag':drag+'px'} as CSSProperties}>
 {cards.slice(Math.max(0,index-1),index+2).map(card=>{const offset=cards.indexOf(card)-index;return <div className={`cloud-stack-slide ${offset===0?'is-active':''}`} key={card.id} data-offset={offset} style={{'--stack-offset':offset} as CSSProperties} inert={offset!==0} aria-hidden={offset!==0}>
 <iframe ref={node=>{if(node)frames.current.set(card.id,node);else{frames.current.delete(card.id);cleanup.current.get(card.id)?.();cleanup.current.delete(card.id);}}} onLoad={()=>connect(card.id)} title={`完整角色卡 ${card.name} ${card.id}`} src={cloudViewUrl(card.id)+'&libraryPreview=1'} loading={offset===0?'eager':'lazy'}/>
 </div>;})}
 </div>
 <div className="cloud-stack-switch" onPointerDown={event=>{if((event.target as Element).closest('button'))return;startDrag(event.clientX,event.clientY);event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>moveDrag(event.clientX,event.clientY)} onPointerUp={event=>endDrag(event.clientX,event.clientY)} onPointerCancel={()=>{start.current=undefined;setDrag(0);}}>
 <button aria-label="上一张角色卡" disabled={index===0} onClick={()=>select(-1)}>← 上一张</button><span>拖动卡片切换</span><button aria-label="下一张角色卡" disabled={index===cards.length-1} onClick={()=>select(1)}>下一张 →</button>
 </div>
 <div className="cloud-stack-actions"><a className="cloud-button" href={cloudViewUrl(current.id)} target="_blank" rel="noopener noreferrer">查看五页 / 导出 JSON</a>{current.role&&<button onClick={()=>edit(current)}>编辑本机草稿</button>}{current.role==='owner'&&<button onClick={()=>manage(current)}>管理这张卡</button>}</div>
 </section>;
}
