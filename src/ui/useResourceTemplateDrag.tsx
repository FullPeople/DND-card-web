import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {WIDGET_COLS,WIDGET_ROWS,type ResourceTemplate} from '../core/resourceWidgets';
import {ResourceModuleFace} from './ResourceModuleFace';
import {resourceTemplatePreview} from './ResourceTemplatePicker';
import './resourceTemplateDrag.css';

export type ResourceTemplatePlacement={x:number;y:number;page:number};
type Options={host:RefObject<HTMLElement|null>;page:number;disabled:boolean;drop:(template:ResourceTemplate,placement:ResourceTemplatePlacement)=>void};
type Bounds={left:number;top:number;width:number;height:number};
type DragView={template:ResourceTemplate;bounds:Bounds;placement?:ResourceTemplatePlacement;overlap:boolean;portal:HTMLElement};

/** Templates are only created after a completed drop. This gesture never writes a layout. */
export function useResourceTemplateDrag(options:Options){
 const latest=useRef(options);latest.current=options;
 const [view,setView]=useState<DragView|null>(null);
 const cancel=useRef<()=>void>(()=>{}),clearClick=useRef<()=>void>(()=>{});
 useEffect(()=>()=>{cancel.current();clearClick.current();},[]);
 useEffect(()=>{if(options.disabled)cancel.current();},[options.disabled]);

 // Prevent the synthetic click after a drag from adding twice or dismissing the dialog.
 // A fresh gesture or a keyboard activation always ends this one-shot suppression.
 function suppressDropClick(){
  clearClick.current();
  let timer:ReturnType<typeof setTimeout>;
  const clear=()=>{clearTimeout(timer);document.removeEventListener('click',click,true);document.removeEventListener('pointerdown',clear,true);clearClick.current=()=>{};};
  const click=(event:MouseEvent)=>{clear();if(event.detail===0)return;event.preventDefault();event.stopImmediatePropagation();};
  document.addEventListener('click',click,true);
  document.addEventListener('pointerdown',clear,true);
  timer=setTimeout(clear,600);clearClick.current=clear;
 }

 function begin(event:ReactPointerEvent<HTMLButtonElement>,template:ResourceTemplate){
  if(latest.current.disabled||event.button!==0||!event.isPrimary)return;
  cancel.current();clearClick.current();
  const host=latest.current.host.current,source=event.currentTarget;
  if(!host)return;
  const portal=host.closest<HTMLDialogElement>('dialog[open]')||document.body;
  const pointerId=event.pointerId,startX=event.clientX,startY=event.clientY;
  let moved=false,finished=false;
  // Capture keeps a release over a backdrop from being interpreted as a backdrop click.
  try{source.setPointerCapture(pointerId);}catch{/* Detached hosts are cancelled below. */}

  function locate(x:number,y:number):DragView|null{
   const active=latest.current,canvas=active.host.current?.querySelector<HTMLElement>('.resource-widget-canvas');
   if(active.disabled||!source.isConnected||!canvas)return null;
   const rect=canvas.getBoundingClientRect();
   if(rect.width<=0||rect.height<=0)return null;
   const width=rect.width*template.w/WIDGET_COLS,height=rect.height*template.h/WIDGET_ROWS;
   const inside=x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;
   if(!inside)return {template,portal,bounds:{left:x-width/2,top:y-height/2,width,height},overlap:false};
   const col=Math.max(0,Math.min(WIDGET_COLS-template.w,Math.round((x-rect.left)/rect.width*WIDGET_COLS-template.w/2)));
   const row=Math.max(0,Math.min(WIDGET_ROWS-template.h,Math.round((y-rect.top)/rect.height*WIDGET_ROWS-template.h/2)));
   const left=rect.left+col/WIDGET_COLS*rect.width,top=rect.top+row/WIDGET_ROWS*rect.height;
   const overlap=[...canvas.querySelectorAll<HTMLElement>('.resource-widget')].some(widget=>{
    const box=widget.getBoundingClientRect();
    return box.width>0&&box.height>0&&left<box.right-.25&&left+width>box.left+.25&&top<box.bottom-.25&&top+height>box.top+.25;
   });
   return {template,portal,bounds:{left,top,width,height},placement:{x:col,y:row,page:active.page},overlap};
  }
  function move(event:PointerEvent){
   if(event.pointerId!==pointerId)return;
   if(!moved&&Math.hypot(event.clientX-startX,event.clientY-startY)<5)return;
   moved=true;event.preventDefault();
   const next=locate(event.clientX,event.clientY);
   if(!next){finish();return;}
   setView(next);
  }
  function finish(event?:PointerEvent,commit=false){
   if(finished||event&&event.pointerId!==pointerId)return;
   finished=true;
   const target=commit&&moved&&event?locate(event.clientX,event.clientY):null;
   window.removeEventListener('pointermove',move);
   window.removeEventListener('pointerup',up,true);
   window.removeEventListener('pointercancel',abort,true);
   window.removeEventListener('keydown',key,true);
   window.removeEventListener('blur',blur);
   source.removeEventListener('lostpointercapture',lost);
   try{if(source.hasPointerCapture(pointerId))source.releasePointerCapture(pointerId);}catch{/* Already released by the browser. */}
   cancel.current=()=>{};setView(null);
   if(moved){suppressDropClick();if(event){event.preventDefault();event.stopPropagation();}}
   if(target?.placement&&!latest.current.disabled)latest.current.drop(template,target.placement);
  }
  function up(event:PointerEvent){finish(event,true);}
  function abort(event:PointerEvent){finish(event);}
  function lost(){finish();}
  function blur(){finish();}
  function key(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish();}}
  window.addEventListener('pointermove',move,{passive:false});
  window.addEventListener('pointerup',up,true);
  window.addEventListener('pointercancel',abort,true);
  window.addEventListener('keydown',key,true);
  window.addEventListener('blur',blur);
  source.addEventListener('lostpointercapture',lost);
  cancel.current=()=>finish();
 }

 const example=view?resourceTemplatePreview(view.template):null;
 const ghost=view&&example?createPortal(<>
  {view.placement&&<div className="resource-template-drop-preview" data-testid="resource-template-drop-preview" data-overlap={view.overlap} data-grid-x={view.placement.x} data-grid-y={view.placement.y} style={view.bounds} aria-hidden="true"><span>{view.overlap?'重叠 · 调整后可保存':'松开放置'}</span></div>}
  <div className="resource-template-ghost" data-testid="resource-template-ghost" data-over-canvas={!!view.placement} data-overlap={view.overlap} data-template-id={view.template.id} style={view.bounds} aria-hidden="true"><ResourceModuleFace module={example.module} style={view.template.style} layout={example.layout}/></div>
 </>,view.portal):null;
 return {begin,ghost,dragging:!!view};
}
