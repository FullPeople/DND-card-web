import {useEffect,useRef,useState} from 'react';
import {CloseIcon} from './icons';
import {createPortal} from 'react-dom';
import './toast.css';
import './actionPresentation.css';
import {CopyDiagnostic} from './CopyDiagnostic';
import {useInteractionStatus} from './InteractionFeedback';
import {noticePresentation,type NoticeOrigin} from './noticePresentation';

export function Toast({message,close,details,action}:{message:string;close:()=>void;details?:string;action?:{label:string;run:()=>void}}){
 const ref=useRef<HTMLDivElement>(null),latestClose=useRef(close);latestClose.current=close;
 const status=useInteractionStatus(),origin=useRef<NoticeOrigin|undefined>(undefined),receipt=noticePresentation(message,status?.scope,origin.current);origin.current=receipt.origin;
 useEffect(()=>{if(!receipt.visible)latestClose.current();},[receipt.visible]);
 const [container,setContainer]=useState<Element>(document.body);
 useEffect(()=>{
  const find=()=>setContainer([...document.querySelectorAll('dialog[open]')].at(-1)||document.body);
  find();const observer=new MutationObserver(find);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
  return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  const node=ref.current;
  // A confirmed operation can remove its dialog and update the toast in the
  // same commit. The observer will reparent it; a detached node cannot open.
  if(!node?.isConnected)return;
  node.showPopover();
  return()=>{if(node.isConnected&&node.matches(':popover-open'))node.hidePopover();};
 },[container,message]);
 useEffect(()=>{const timer=setTimeout(()=>latestClose.current(),6500);return()=>clearTimeout(timer);},[message]);
 const applied=receipt.selection;
 if(!receipt.visible)return null;
 return createPortal(<div ref={ref} popover="manual" className={`suite-toast ${applied?'selection-cue':''}`} role="status"><i key={message} className="toast-timer"/>{applied&&<span key={message} className="selection-confirm-stamp" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 2 43 13V35L24 46 5 35V13Z"/><path className="selection-check" d="m14 24 7 7 14-15"/></svg></span>}<span>{message}</span>{action&&<button className="toast-action" onClick={action.run}>{action.label}</button>}{details&&<CopyDiagnostic text={details}/>}<button aria-label="关闭提示" onClick={close}><CloseIcon/></button></div>,container);
}
