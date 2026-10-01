import {useEffect,useRef,useState,type CSSProperties,type PointerEvent as ReactPointerEvent,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import type {Character} from '../core/model';
import {setResource} from '../core/resources';
import {moveWidget,resourceWidgetLayout,WIDGET_STYLES,widgetStyleNames,type ResourceWidgetLayout,type WidgetStyle} from '../core/resourceWidgets';
import {ResourceRow} from './ResourceRow';
import './resourceWidgets.css';
type Value=Character['runtime']['resources'][string];
const handles=['nw','n','ne','e','se','s','sw','w'] as const;
const handleNames={nw:'左上',n:'上',ne:'右上',e:'右',se:'右下',s:'下',sw:'左下',w:'左'};
export function ResourceWidgets({c,rows,editing,enabled,gm,edit,manage}:{c:Character;rows:[string,Value][];editing:boolean;enabled:boolean;gm:boolean;edit:(f:(c:Character)=>void)=>void;manage:()=>void}){
 const ids=rows.map(([id])=>id),saved=c.quickbarLayout?.widgets||{};
 const [preview,setPreview]=useState<Record<string,ResourceWidgetLayout>>(),[page,setPage]=useState(0),[selected,setSelected]=useState(''),[open,setOpen]=useState('');
 const canvas=useRef<HTMLDivElement>(null),panel=useRef<HTMLDivElement>(null),trigger=useRef<HTMLElement|null>(null),cancel=useRef<(()=>void)|undefined>(undefined);
 const widgets=preview||resourceWidgetLayout(ids,saved),pages=Math.max(1,...Object.values(widgets).map(w=>w.page+1)),shownPage=Math.min(page,pages-1);
 const writable=editing&&enabled;
 useEffect(()=>{cancel.current?.();setPreview(undefined);setPage(0);setSelected('');setOpen('');return()=>cancel.current?.();},[c.id]);
 useEffect(()=>{if(!writable){cancel.current?.();setPreview(undefined);}},[writable]);
 useEffect(()=>{if(!open)return;const focus=requestAnimationFrame(()=>panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());const dismiss=(e:Event)=>{if(!panel.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))setOpen('');};const key=(e:globalThis.KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setOpen('');trigger.current?.focus();}};window.addEventListener('pointerdown',dismiss,true);window.addEventListener('keydown',key,true);return()=>{cancelAnimationFrame(focus);window.removeEventListener('pointerdown',dismiss,true);window.removeEventListener('keydown',key,true);};},[open]);
 function persist(next:Record<string,ResourceWidgetLayout>){edit(d=>{const layout=d.quickbarLayout||={order:[],hidden:[]};const existing=Object.fromEntries(Object.entries(layout.widgets||{}).filter(([id])=>!!d.runtime.resources[id]));layout.widgets={...existing,...Object.fromEntries(Object.entries(next).filter(([id])=>!!d.runtime.resources[id]))};});}
 function change(id:string,patch:Partial<ResourceWidgetLayout>){const next=resourceWidgetLayout(ids,{...widgets,[id]:{...widgets[id],...patch}},id);persist(next);setPage(next[id].page);}
 function begin(e:ReactPointerEvent,id:string,handle='move'){
  if(!writable||e.button!==0||!canvas.current)return;e.preventDefault();e.stopPropagation();cancel.current?.();setSelected(id);
  const rect=canvas.current.getBoundingClientRect(),start=widgets[id],original=widgets,x=e.clientX,y=e.clientY;let next=original,moved=false;
  const onMove=(event:globalThis.PointerEvent)=>{if(event.pointerId!==e.pointerId)return;const dx=Math.round((event.clientX-x)/rect.width*12),dy=Math.round((event.clientY-y)/rect.height*6);moved=moved||Math.abs(event.clientX-x)+Math.abs(event.clientY-y)>4;next=resourceWidgetLayout(ids,{...original,[id]:moveWidget(start,dx,dy,handle)},id);setPreview(next);};
  const release=()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',abort);window.removeEventListener('keydown',escape);cancel.current=undefined;setPreview(undefined);};
  const finish=(event:globalThis.PointerEvent)=>{if(event.pointerId!==e.pointerId)return;release();if(moved)persist(next);};
  const abort=()=>release();const escape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();release();}};
  cancel.current=release;window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',abort);window.addEventListener('keydown',escape);
 }
 function keyboard(e:KeyboardEvent,id:string,handle='move'){
  if(!writable||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();
  const dx=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,dy=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;
  const next=moveWidget(widgets[id],dx,dy,e.shiftKey&&handle==='move'?'se':handle);change(id,next);
 }
 function show(e:React.MouseEvent<HTMLElement>,id:string){trigger.current=e.currentTarget;setOpen(open===id?'':id);}
 const active=rows.find(([id])=>id===open),selection=widgets[selected];
 return <section className="resource-workspace" aria-label="资源模块快捷栏" data-layout-editing={writable}>
  <div className="resource-workspace-toolbar">{editing?<button aria-label="管理资源" onClick={manage}>＋ 资源 / 管理</button>:<span>资源 <small>{rows.length}</small></span>}<span className="resource-page-nav"><button aria-label="上一页资源" disabled={shownPage===0} onClick={()=>setPage(shownPage-1)}>‹</button><output aria-live="polite">{shownPage+1}/{pages}</output><button aria-label="下一页资源" disabled={shownPage>=pages-1} onClick={()=>setPage(shownPage+1)}>›</button></span></div>
  <div className="resource-widget-canvas" ref={canvas}>
   {!rows.length&&<button className="resource-widget-empty" onClick={manage} disabled={!writable}>添加资源，选择模块样式</button>}
   {rows.filter(([id])=>widgets[id].page===shownPage).map(([id,r])=>{const w=widgets[id],ratio=r.unlimited?1:r.max?Math.min(1,Math.max(0,r.current/r.max)):0;return <div key={id} className={`resource-widget widget-${w.style}`} data-resource-id={id} data-resource-name={r.name||id} data-resource-current={r.current} data-selected={selected===id&&writable} data-locked={!!r.locked} style={{left:`${w.x/12*100}%`,top:`${w.y/6*100}%`,width:`${w.w/12*100}%`,height:`${w.h/6*100}%`,'--resource-ratio':ratio} as CSSProperties}>
    <button className="resource-widget-face" title={`${r.name||id} · ${r.current} / ${r.unlimited?'∞':r.max}`} aria-label={`${r.name||id}：${r.current}${r.unlimited?'，无上限':` / ${r.max}`}，打开资源操作`} onClick={e=>show(e,id)} onFocus={()=>setSelected(id)}><span className="resource-widget-symbol" aria-hidden="true">{w.style==='icon'?'✦':r.locked?'▣':'◆'}</span><span className="resource-widget-name">{r.name||id}</span><strong className="resource-widget-value">{r.current}<small>{r.unlimited?' / ∞':` / ${r.max}`}</small></strong><span className="resource-widget-meter" aria-hidden="true"/>{r.locked&&<span className="resource-widget-lock" aria-label="已锁定">▣</span>}</button>
    {writable&&<><button className="resource-widget-move" aria-label={`移动${r.name||id}，方向键移动，Shift加方向键缩放`} title="拖动位置；方向键移动，Shift＋方向键缩放" onFocus={()=>setSelected(id)} onPointerDown={e=>begin(e,id)} onKeyDown={e=>keyboard(e,id)}>⠿</button>{selected===id&&handles.map(handle=><button key={handle} className={`resource-widget-handle handle-${handle}`} aria-label={`${handleNames[handle]}缩放${r.name||id}`} onPointerDown={e=>begin(e,id,handle)} onKeyDown={e=>keyboard(e,id,handle)}/>)}</>}
   </div>;})}
  </div>
  {writable&&<div className="resource-layout-tools">{selection?<><label>样式<select aria-label="选中资源样式" value={selection.style} onChange={e=>change(selected,{style:e.target.value as WidgetStyle})}>{WIDGET_STYLES.map(style=><option key={style} value={style}>{widgetStyleNames[style]}</option>)}</select></label><button disabled={selection.page===0} aria-label="将选中资源移至前页" onClick={()=>change(selected,{page:selection.page-1})}>←页</button><button aria-label="将选中资源移至后页" onClick={()=>change(selected,{page:selection.page+1})}>页→</button></>:<span>选模块 · 拖动 ⠿ · 八点缩放</span>}<button onClick={()=>{edit(d=>{if(d.quickbarLayout)delete d.quickbarLayout.widgets;});setPage(0);setSelected('');}}>重排</button></div>}
  {active&&createPortal(<div ref={panel} role="dialog" aria-label={`${active[1].name||active[0]}资源操作`} className="resource-widget-popover" style={{left:Math.max(8,Math.min(trigger.current?.getBoundingClientRect().left||8,window.innerWidth-304)),top:Math.max(8,Math.min((trigger.current?.getBoundingClientRect().bottom||8)+4,window.innerHeight-190))}}><button className="resource-widget-close" aria-label="关闭资源操作" onClick={()=>{setOpen('');trigger.current?.focus();}}>×</button><ResourceRow key={active[0]} resource={{...active[1],id:active[0]}} enabled={enabled} gm={gm} change={async n=>edit(d=>setResource(d,active[0],n))} configure={()=>{window.dispatchEvent(new CustomEvent('edit-character-resource',{detail:active[0]}));setOpen('');}} lock={()=>edit(d=>{const r=d.runtime.resources[active[0]];if(r)r.locked=!r.locked;})}/></div>,document.querySelector('dialog[open]')||document.body)}
 </section>;
}
