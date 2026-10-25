import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {DEFAULT_SHEET_SHARE,savedWorkspaceShare,savedWorkspaceSide,WORKSPACE_HIDDEN_KEY,type WorkspaceSide} from './workspaceGeometry';
import {useUiLanguage} from './UiLanguage';
import './workspaceVisibility.css';

const KEY='dnd-card:workspace-split';
const MIN=.3,MAX=.7;
function rememberShare(ratio:number){try{localStorage.setItem(KEY,String(ratio));}catch{}}

export function WorkspaceSplitter(){
 const {t}=useUiLanguage();
 const ref=useRef<HTMLDivElement>(null),start=useRef<{ratio:number;pointerId:number;x:number}|undefined>(undefined),frame=useRef(0);
 const [ratio,setRatio]=useState(()=>{try{return savedWorkspaceShare(localStorage.getItem(KEY));}catch{return DEFAULT_SHEET_SHARE;}});
 const [hiddenSide,setHiddenSide]=useState(()=>{try{return savedWorkspaceSide(localStorage.getItem(WORKSPACE_HIDDEN_KEY));}catch{return undefined;}});
 const [resetMount,setResetMount]=useState<HTMLElement|null>(null);
 const [preview,setPreview]=useState<{side:WorkspaceSide;left:number;width:number}>();
 useLayoutEffect(()=>{ref.current?.parentElement?.style.setProperty('--sheet-share',`${ratio*100}%`);if(start.current===undefined)rememberShare(ratio);},[ratio]);
 // The divider owns layout preferences and projects its reset control into the
 // existing header, without coupling character/rules state to panel visibility.
 useLayoutEffect(()=>{
  const workspace=ref.current!.parentElement!,shell=workspace.closest('.app-shell')!,tabs=shell.querySelector<HTMLElement>('.mobile-tabs'),tools=shell.querySelector('.header-tools')!;
  // The header groups its buttons; insert before the group that holds the
  // announcement button (or the explicit slot), never inside a React-managed span.
  const slot=tools.querySelector('.workspace-reset-slot'),notice=Array.from(tools.querySelectorAll('button')).find(button=>button.getAttribute('aria-label')===t('announcements')||button.textContent===t('announcements'));
  let before:Element|null=slot||notice||null;while(before&&before.parentElement&&before.parentElement!==tools)before=before.parentElement;
  const mount=document.createElement('span');mount.className='workspace-reset-mount';tools.insertBefore(mount,before||tools.firstChild);setResetMount(mount);
  return()=>{mount.remove();delete workspace.dataset.hiddenSide;if(tabs)delete tabs.dataset.hiddenSide;};
 },[]);
 useLayoutEffect(()=>{
  const workspace=ref.current!.parentElement!,tabs=workspace.closest('.app-shell')?.querySelector<HTMLElement>('.mobile-tabs');
  if(hiddenSide){workspace.dataset.hiddenSide=hiddenSide;if(tabs)tabs.dataset.hiddenSide=hiddenSide;}
  else {delete workspace.dataset.hiddenSide;if(tabs)delete tabs.dataset.hiddenSide;}
  try{if(hiddenSide)localStorage.setItem(WORKSPACE_HIDDEN_KEY,hiddenSide);else localStorage.removeItem(WORKSPACE_HIDDEN_KEY);}catch{}
 },[hiddenSide]);
 function cancel(){
  const gesture=start.current;if(!gesture)return;
  cancelAnimationFrame(frame.current);frame.current=0;start.current=undefined;
  setRatio(gesture.ratio);setPreview(undefined);
  if(ref.current?.hasPointerCapture(gesture.pointerId))ref.current.releasePointerCapture(gesture.pointerId);
 }
 useEffect(()=>{
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&start.current!==undefined){event.preventDefault();cancel();}};
  window.addEventListener('keydown',escape);window.addEventListener('blur',cancel);
  return()=>{cancelAnimationFrame(frame.current);window.removeEventListener('keydown',escape);window.removeEventListener('blur',cancel);};
 },[]);
 function update(x:number){
  const box=ref.current!.parentElement!.getBoundingClientRect(),share=(x-box.left)/box.width;
  const next=Math.max(MIN,Math.min(MAX,share)),side:WorkspaceSide|undefined=share<MIN?'sheet':share>MAX?'wiki':undefined;
  setRatio(next);
  const nextPreview=side?{side,left:box.left+(side==='wiki'?next*box.width+8:0),width:side==='sheet'?next*box.width:box.width-next*box.width-8}:undefined;
  setPreview(previous=>previous?.side===nextPreview?.side&&previous?.left===nextPreview?.left&&previous?.width===nextPreview?.width?previous:nextPreview);
  return {ratio:next,side};
 }
 return <><div ref={ref} className="workspace-splitter" role="separator" aria-label="调整角色卡与规则资料宽度" title="拖向边缘并松手隐藏该区域，拖回取消" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={70} aria-valuenow={Math.round(ratio*100)} tabIndex={0}
  onPointerDown={event=>{if(!event.isPrimary||event.button!==0||start.current)return;event.preventDefault();start.current={ratio,pointerId:event.pointerId,x:event.clientX};event.currentTarget.setPointerCapture(event.pointerId);}}
  onPointerMove={event=>{
   const gesture=start.current;if(!gesture||gesture.pointerId!==event.pointerId)return;
   gesture.x=event.clientX;
   if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;if(start.current)update(start.current.x);});
  }}
  onPointerUp={event=>{
   const gesture=start.current;if(!gesture||gesture.pointerId!==event.pointerId)return;
   cancelAnimationFrame(frame.current);frame.current=0;
   const initial=gesture.ratio,result=update(event.clientX);start.current=undefined;setPreview(undefined);
   if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
   if(result.side){setRatio(initial);setHiddenSide(result.side);}else rememberShare(result.ratio);
  }}
  onPointerCancel={event=>{if(start.current?.pointerId===event.pointerId)cancel();}} onLostPointerCapture={event=>{if(start.current?.pointerId===event.pointerId)cancel();}}
  onKeyDown={event=>{
   if(start.current!==undefined)return;
   if(event.key==='ArrowLeft'||event.key==='ArrowRight'||event.key==='Home'){
    event.preventDefault();const next=event.key==='Home'?DEFAULT_SHEET_SHARE:Math.max(MIN,Math.min(MAX,ratio+(event.key==='ArrowRight'?.02:-.02)));
    setRatio(next);rememberShare(next);
   }
  }}><span/></div>
  {preview&&createPortal(<div className="workspace-hide-preview" data-hide-side={preview.side} style={{left:preview.left,width:preview.width}} role="status" aria-label={preview.side==='sheet'?'隐藏角色卡区域':'隐藏规则资料区域'}><strong>隐藏该区域</strong><span>松手隐藏，拖回取消</span></div>,document.body)}
  {hiddenSide&&resetMount&&createPortal(<button className="workspace-reset" onClick={()=>setHiddenSide(undefined)}>重置隐藏区域</button>,resetMount)}
 </>;
}
