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
 const ref=useRef<HTMLDivElement>(null),start=useRef<number|undefined>(undefined);
 const [ratio,setRatio]=useState(()=>{try{return savedWorkspaceShare(localStorage.getItem(KEY));}catch{return DEFAULT_SHEET_SHARE;}});
 const [hiddenSide,setHiddenSide]=useState(()=>{try{return savedWorkspaceSide(localStorage.getItem(WORKSPACE_HIDDEN_KEY));}catch{return undefined;}});
 const [resetMount,setResetMount]=useState<HTMLElement|null>(null);
 const [preview,setPreview]=useState<{side:WorkspaceSide;left:number;width:number}>();
 useLayoutEffect(()=>{ref.current?.parentElement?.style.setProperty('--sheet-share',`${ratio*100}%`);if(start.current===undefined)rememberShare(ratio);},[ratio]);
 // The divider owns layout preferences and projects its reset control into the
 // existing header, without coupling character/rules state to panel visibility.
 useLayoutEffect(()=>{
  const workspace=ref.current!.parentElement!,shell=workspace.closest('.app-shell')!,tabs=shell.querySelector<HTMLElement>('.mobile-tabs'),tools=shell.querySelector('.header-tools')!;
  const notice=Array.from(tools.querySelectorAll('button')).find(button=>button.textContent===t('announcements'));
  const mount=document.createElement('span');mount.className='workspace-reset-mount';tools.insertBefore(mount,notice||tools.firstChild);setResetMount(mount);
  return()=>{mount.remove();delete workspace.dataset.hiddenSide;if(tabs)delete tabs.dataset.hiddenSide;};
 },[]);
 useLayoutEffect(()=>{
  const workspace=ref.current!.parentElement!,tabs=workspace.closest('.app-shell')?.querySelector<HTMLElement>('.mobile-tabs');
  if(hiddenSide){workspace.dataset.hiddenSide=hiddenSide;if(tabs)tabs.dataset.hiddenSide=hiddenSide;}
  else {delete workspace.dataset.hiddenSide;if(tabs)delete tabs.dataset.hiddenSide;}
  try{if(hiddenSide)localStorage.setItem(WORKSPACE_HIDDEN_KEY,hiddenSide);else localStorage.removeItem(WORKSPACE_HIDDEN_KEY);}catch{}
 },[hiddenSide]);
 function cancel(){if(start.current===undefined)return;setRatio(start.current);start.current=undefined;setPreview(undefined);}
 useEffect(()=>{
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&start.current!==undefined){event.preventDefault();cancel();}};
  window.addEventListener('keydown',escape);window.addEventListener('blur',cancel);
  return()=>{window.removeEventListener('keydown',escape);window.removeEventListener('blur',cancel);};
 },[]);
 function update(x:number){
  const box=ref.current!.parentElement!.getBoundingClientRect(),share=(x-box.left)/box.width;
  const next=Math.max(MIN,Math.min(MAX,share)),side:WorkspaceSide|undefined=share<MIN?'sheet':share>MAX?'wiki':undefined;
  setRatio(next);
  setPreview(side?{side,left:box.left+(side==='wiki'?next*box.width+8:0),width:side==='sheet'?next*box.width:box.width-next*box.width-8}:undefined);
  return {ratio:next,side};
 }
 return <><div ref={ref} className="workspace-splitter" role="separator" aria-label="调整角色卡与规则资料宽度" title="拖向边缘并松手隐藏该区域，拖回取消" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={70} aria-valuenow={Math.round(ratio*100)} tabIndex={0}
  onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();start.current=ratio;event.currentTarget.setPointerCapture(event.pointerId);}}
  onPointerMove={event=>{if(start.current!==undefined)update(event.clientX);}}
  onPointerUp={event=>{
   if(start.current===undefined)return;
   const initial=start.current,result=update(event.clientX);start.current=undefined;setPreview(undefined);
   if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
   if(result.side){setRatio(initial);setHiddenSide(result.side);}else rememberShare(result.ratio);
  }}
  onPointerCancel={cancel} onLostPointerCapture={cancel}
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
