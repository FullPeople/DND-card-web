import {useLayoutEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {WorkbenchPanel} from './WorkbenchPanel';
import './threeDragonFullscreen.css';

/** A workspace-wide surface, independent of the card/Wiki splitter. The
 * underlying workspace stays mounted so closing restores its tab and scroll. */
export function ThreeDragonFullscreen({close}:{close:()=>void}){
 const root=useRef<HTMLElement>(null),latestClose=useRef(close),closing=useRef(false);latestClose.current=close;
 const finish=()=>{if(!closing.current){closing.current=true;latestClose.current();}};
 useLayoutEffect(()=>{
  const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const workspace=document.querySelector<HTMLElement>('.app-shell'),wasInert=workspace?.inert;
  const overflow=document.body.style.overflow;
  if(workspace)workspace.inert=true;document.body.style.overflow='hidden';
  root.current?.focus({preventScroll:true});
  closing.current=false;
  const keydown=(event:KeyboardEvent)=>{
   if(event.key!=='Escape'||event.defaultPrevented)return;
   const target=event.target as Node|null,doc=target?.ownerDocument??document;
   // Let in-table card cancellation, help and dialogs own their first Escape.
   if(doc!==document&&doc.querySelector('dialog[open],#tutorial-host,#introduction-host'))return;
   event.preventDefault();
   const button=doc!==document?doc.querySelector<HTMLButtonElement>('#close'):null;
   if(button&&!button.disabled)button.click();else finish();
  };
  document.addEventListener('keydown',keydown);
  const frame=root.current?.querySelector('iframe');let frameDocument:Document|null=null;
  const loaded=()=>{
   frameDocument?.removeEventListener('keydown',keydown);
   try{frameDocument=frame?.contentDocument??null;frameDocument?.addEventListener('keydown',keydown);frame?.focus({preventScroll:true});}catch{frameDocument=null;}
  };
  frame?.addEventListener('load',loaded);loaded();
  return()=>{
   document.removeEventListener('keydown',keydown);frame?.removeEventListener('load',loaded);frameDocument?.removeEventListener('keydown',keydown);
   if(workspace)workspace.inert=wasInert??false;document.body.style.overflow=overflow;
   if(opener?.isConnected)opener.focus({preventScroll:true});
  };
 },[]);
 return createPortal(<section ref={root} className="three-dragon-fullscreen" aria-label="三龙牌全屏工作区" tabIndex={-1}><WorkbenchPanel panel="table" close={finish}/></section>,document.body);
}
