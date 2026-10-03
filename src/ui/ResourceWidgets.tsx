import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode,type PointerEvent as ReactPointerEvent,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import type {Character} from '../core/model';
import {composeRoll} from '../platform/workbench';
import {setResource} from '../core/resources';
import {moveWidget,freeDashboardLayout,dashboardOverlaps,resourceModuleMinimum,resourceModules,dashboardSplit,migrateDashboardWidgets,type ResourceWidgetLayout} from '../core/resourceWidgets';
import {ResourceRow} from './ResourceRow';
import {ResourceModuleFace,resourceAmount} from './ResourceModuleFace';
import './resourceWidgets.css';
import './resourceDashboard.css';
export function attackWidgetKey(c:Character){let id='__attacks__';while(Object.hasOwn(c.runtime.resources,id))id='_'+id;return id;}
type Value=Character['runtime']['resources'][string];
const handles=['nw','n','ne','e','se','s','sw','w'] as const;
const handleNames={nw:'左上',n:'上',ne:'右上',e:'右',se:'右下',s:'下',sw:'左下',w:'左'};
export type DashboardControls={selectedId?:string;layoutEditor?:boolean;initialPage?:number;onSelect?:(id:string)=>void|boolean;onPage?:(page:number)=>void;configure?:(id:string)=>void;onInteracting?:(active:boolean)=>void};
type Props=DashboardControls&{c:Character;rows:[string,Value][];editing:boolean;enabled:boolean;gm:boolean;edit:(f:(c:Character)=>void)=>void;manage:()=>void;attacks?:ReactNode};
export function ResourceWidgets({c,rows,editing,enabled,gm,edit,manage,attacks,selectedId,layoutEditor=false,initialPage=0,onSelect,onPage,configure:openConfiguration,onInteracting}:Props){
 const attackId=attackWidgetKey(c);
 const saved=c.quickbarLayout?.widgets||{},modules=resourceModules(rows,saved,c.selections);
 const base=freeDashboardLayout(modules,saved,c.quickbarLayout?.attacks);
 const [preview,setPreview]=useState<typeof base>(),[page,setPage]=useState(initialPage),[selected,setSelected]=useState(''),[open,setOpen]=useState(''),[edge,setEdge]=useState('');
 const canvas=useRef<HTMLDivElement>(null),panel=useRef<HTMLDivElement>(null),trigger=useRef<HTMLElement|null>(null),cancel=useRef<(()=>void)|undefined>(undefined),suppressClick=useRef(false);
 const current=preview||base,widgets=current.widgets,collisions=dashboardOverlaps(current);
 const all:Record<string,ResourceWidgetLayout>=widgets;
 const pages=Math.max(1,...Object.values(all).map(w=>w.page+1)),shownPage=Math.min(page,pages-1),writable=layoutEditor&&enabled;
 const bands=pages+(writable?1:0);
 function select(id:string){if(onSelect?.(id)===false)return false;setSelected(id);return true;}
 function go(next:number){setPage(next);onPage?.(next);requestAnimationFrame(()=>{const scroll=canvas.current?.parentElement;if(scroll)scroll.scrollTop=next*scroll.clientHeight;});}
 useEffect(()=>{if(selectedId!==undefined)setSelected(selectedId);},[selectedId]);
 useEffect(()=>{onPage?.(shownPage);},[shownPage,onPage]);
 useEffect(()=>{cancel.current?.();setPreview(undefined);setPage(initialPage);setSelected('');setOpen('');return()=>cancel.current?.();},[c.id]);
 useEffect(()=>{if(!writable||!enabled){cancel.current?.();setPreview(undefined);}setOpen('');},[writable,enabled]);
 useEffect(()=>{if(!open)return;const focus=requestAnimationFrame(()=>panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());const dismiss=(e:Event)=>{if(!panel.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))setOpen('');};const key=(e:globalThis.KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setOpen('');trigger.current?.focus();}};window.addEventListener('pointerdown',dismiss,true);window.addEventListener('keydown',key,true);return()=>{cancelAnimationFrame(focus);window.removeEventListener('pointerdown',dismiss,true);window.removeEventListener('keydown',key,true);};},[open]);
 useLayoutEffect(()=>{
  const node=panel.current;if(!open||!node)return;
  const place=()=>{const anchor=trigger.current?.getBoundingClientRect();node.style.left=`${Math.max(8,Math.min(anchor?.left??8,innerWidth-node.offsetWidth-8))}px`;node.style.top=`${Math.max(8,Math.min((anchor?.bottom??8)+5,innerHeight-node.offsetHeight-8))}px`;};
  place();const observer=new ResizeObserver(place);observer.observe(node);window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
 },[open]);
 function persist(next:typeof base){edit(d=>{const layout=d.quickbarLayout||={order:[],hidden:[]};const existing=Object.fromEntries(Object.entries(migrateDashboardWidgets(layout.widgets,layout.attacks)).filter(([id])=>!!d.runtime.resources[id]));layout.widgets={...existing,...Object.fromEntries(Object.entries(next.widgets).filter(([id])=>!!d.runtime.resources[id]))};layout.attacks=next.attacks;});}
 function configure(id:string){if(!enabled)return;setOpen('');if(openConfiguration)openConfiguration(id);else window.dispatchEvent(new CustomEvent('edit-character-resource',{detail:id}));}
 useEffect(()=>{const inserted=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail.cardId!==c.id||!!detail.draft!==layoutEditor)return;select(detail.id);go(detail.page);};window.addEventListener('resource-widget-created',inserted);return()=>window.removeEventListener('resource-widget-created',inserted);},[c.id,layoutEditor]);
 function arrange(original:typeof base,id:string,value:ResourceWidgetLayout){return freeDashboardLayout(modules,id===attackId?original.widgets:{...original.widgets,[id]:value},id===attackId?value:original.attacks);}
 function minimum(id:string){const module=modules.find(m=>m.id===id);return module?resourceModuleMinimum(module,all[id].style,all[id].contentScale):{w:3,h:3};}
 function begin(e:ReactPointerEvent,id:string,handle='move'){
  if(id===attackId||!writable||e.button!==0||!canvas.current)return;e.preventDefault();e.stopPropagation();cancel.current?.();if(!select(id)){suppressClick.current=true;setTimeout(()=>{suppressClick.current=false;},200);return;}onInteracting?.(true);
  const rect=canvas.current.getBoundingClientRect(),start=all[id],original=current,x=e.clientX,y=e.clientY;let next=original,moved=false,targetPage=start.page,lastX=x,lastY=y,edgeTimer:ReturnType<typeof setTimeout>|undefined;
  const apply=()=>{const dx=Math.round((lastX-x)/rect.width*12),dy=Math.round((lastY-y)/rect.height*(bands*6));let value:ResourceWidgetLayout;
   if(handle==='move'){const globalY=Math.max(0,Math.min(2999*6,start.page*6+start.y+dy));targetPage=Math.floor(globalY/6);value={...moveWidget(start,dx,0),page:targetPage,y:Math.min(6-start.h,globalY%6)};}
   else value={...moveWidget(start,dx,dy,handle,minimum(id)),page:targetPage};
   next=arrange(original,id,value);setPreview(next);};
  const onMove=(event:globalThis.PointerEvent)=>{if(event.pointerId!==e.pointerId)return;lastX=event.clientX;lastY=event.clientY;moved=moved||Math.abs(lastX-x)+Math.abs(lastY-y)>4;apply();};
  const release=()=>{onInteracting?.(false);if(edgeTimer)clearTimeout(edgeTimer);setEdge('');window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',abort);window.removeEventListener('keydown',escape);cancel.current=undefined;setPreview(undefined);};
  const finish=(event:globalThis.PointerEvent)=>{if(event.pointerId!==e.pointerId)return;release();if(moved){suppressClick.current=true;const suppress=(event:MouseEvent)=>{event.preventDefault();event.stopPropagation();};document.addEventListener('click',suppress,{capture:true,once:true});setTimeout(()=>document.removeEventListener('click',suppress,true),100);persist(next);go(id===attackId?next.attacks.page:next.widgets[id].page);setTimeout(()=>{suppressClick.current=false;},0);}};
  const abort=()=>{release();go(start.page);};const escape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();abort();}};
  cancel.current=release;window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',abort);window.addEventListener('keydown',escape);
 }
 function keyboard(e:KeyboardEvent,id:string,handle='move'){
  if(id===attackId)return;
  if(writable&&(e.key==='Enter'||e.key==='F2')){e.preventDefault();configure(id);return;}if(!writable||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();
  const dx=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,dy=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;
  const start=all[id],value=moveWidget(start,dx,dy,e.shiftKey&&handle==='move'?'se':handle,minimum(id));if(handle==='move'&&!e.shiftKey&&dy){if(start.y+dy<0&&start.page>0){value.page--;value.y=6-value.h;}else if(start.y+dy+start.h>6&&start.page<2999){value.page++;value.y=0;}}if(e.key==='PageUp'||e.key==='PageDown')value.page=Math.max(0,value.page+(e.key==='PageUp'?-1:1));const next=arrange(current,id,value);persist(next);go(id===attackId?next.attacks.page:next.widgets[id].page);
 }
 function grips(id:string,name:string){return writable&&selected===id?<>{handles.map(handle=><button key={handle} className={`resource-widget-handle handle-${handle}`} aria-label={`${handleNames[handle]}缩放${name}`} onPointerDown={e=>begin(e,id,handle)} onKeyDown={e=>keyboard(e,id,handle)}/>)}</>:null;}
 function geometry(w:ResourceWidgetLayout):CSSProperties{return {left:`${w.x/12*100}%`,top:`${(w.page*6+w.y)/(bands*6)*100}%`,width:`${w.w/12*100}%`,height:`${w.h/(bands*6)*100}%`};}
 function splitKeyboard(e:KeyboardEvent){
  if(!enabled||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();
  const split=dashboardSplit(e.key==='Home'?.2:e.key==='End'?.55:dashboardSplit(current.attacks.split)+(e.key==='ArrowRight'?.02:-.02));
  persist({...current,attacks:{...current.attacks,split}});
 }
 function splitPointer(e:ReactPointerEvent){
  if(!enabled||e.button!==0)return;e.preventDefault();e.stopPropagation();cancel.current?.();
  const element=e.currentTarget.closest('.resource-quickbar-split')!,rect=element.getBoundingClientRect(),original=current;let next=original;
  const move=(event:globalThis.PointerEvent)=>{if(event.pointerId!==e.pointerId)return;next={...original,attacks:{...original.attacks,split:dashboardSplit((event.clientX-rect.left)/rect.width)}};setPreview(next);};
  const release=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',abort);window.removeEventListener('keydown',escape);setPreview(undefined);onInteracting?.(false);cancel.current=undefined;};
  const finish=(event:globalThis.PointerEvent)=>{if(event.pointerId!==e.pointerId)return;release();persist(next);};
  const abort=()=>release(),escape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();abort();}};
  onInteracting?.(true);cancel.current=release;window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',abort);window.addEventListener('keydown',escape);
 }
 const active=modules.find(module=>module.id===open);
 return <div className="resource-quickbar-split" data-has-attacks={!!attacks} style={{'--attack-split':`${dashboardSplit(current.attacks.split)*100}%`} as CSSProperties}>
  {attacks&&<aside className="resource-fixed-attacks" aria-label="固定武器与攻击区" data-resource-id="__attacks__">{attacks}</aside>}
  {attacks&&<button className="quickbar-divider" role="separator" aria-label="调整武器与资源分割线" aria-orientation="vertical" aria-valuemin={20} aria-valuemax={55} aria-valuenow={Math.round(dashboardSplit(current.attacks.split)*100)} disabled={!enabled} onPointerDown={splitPointer} onKeyDown={splitKeyboard}/>}
  <section className="resource-workspace" aria-label="资源模块快捷栏" data-layout-editing={writable}>
  <div className="resource-widget-scroll"><div className="resource-widget-canvas" data-bands={bands} style={{height:`${bands*100}%`,'--screen-resource-count':Math.max(1,modules.length)} as CSSProperties} ref={canvas} data-edge={edge} onPointerDown={e=>{if(e.target===e.currentTarget)select('');}}>
   {modules.map(module=>{const id=module.id,r=module.rows[0][1],w=widgets[id],group=module.slots||module.rows.length>1;const values=module.rows.map(([key,value])=>`${value.name||key} ${resourceAmount(value)}`).join('，');return <div key={id} className="resource-widget" data-resource-id={id} data-resource-name={module.name} data-resource-current={group?undefined:r.current} data-selected={selected===id&&writable} data-locked={!!r.locked} data-overlapping={writable&&collisions.resources.includes(id)} data-grid-x={w.x} data-grid-y={w.y} data-grid-w={w.w} data-grid-h={w.h} data-grid-page={w.page} style={geometry(w)}>
    <button className="resource-widget-face" aria-expanded={open===id} title={writable?`${module.name} · 拖动调整；双击配置；方向键移动；Shift + 方向键缩放`:`${module.name} · ${values}`} aria-label={writable?`${module.name}，选择资源模块，双击配置`:`${module.name}：${values}，打开资源操作`} onPointerDown={e=>{if(writable)begin(e,id);}} onKeyDown={e=>keyboard(e,id)} onClick={e=>{if(suppressClick.current)return;if(writable)select(id);else if(editing)configure(id);else{trigger.current=e.currentTarget;setOpen(open===id?'':id);}}} onDoubleClick={()=>{if(writable)configure(id);}} onFocus={()=>{if(writable)select(id);}}><ResourceModuleFace module={module} style={w.style} layout={w}/></button>{r.featureGrant?.formula&&<button disabled={editing||!enabled} className="resource-formula module-formula" onClick={()=>composeRoll(r.featureGrant!.formula!,r.name||id)}>{r.featureGrant.formula}</button>}{grips(id,module.name)}
   </div>;})}
  </div>
  </div>
  {active&&createPortal(<div ref={panel} role="dialog" aria-label={`${active.name}资源操作`} className="resource-widget-popover" style={{left:Math.max(8,Math.min(trigger.current?.getBoundingClientRect().left||8,window.innerWidth-304)),top:Math.max(8,Math.min((trigger.current?.getBoundingClientRect().bottom||8)+4,window.innerHeight-190))}}><button className="resource-widget-close" aria-label="关闭资源操作" onClick={()=>{setOpen('');trigger.current?.focus();}}>×</button>{active.rows.map(([id,r])=><div key={id}>{r.featureGrant?.formula&&<button disabled={editing||!enabled} className="resource-formula" onClick={()=>composeRoll(r.featureGrant!.formula!,r.name||id)}>{r.featureGrant.formula}</button>}<ResourceRow resource={{...r,id}} enabled={enabled} gm={gm} change={async n=>edit(d=>setResource(d,id,n))} configure={()=>configure(id)} lock={()=>edit(d=>{const value=d.runtime.resources[id];if(value)value.locked=!value.locked;})}/></div>)}</div>,document.querySelector('dialog[open]')||document.body)}
 </section></div>;
}
