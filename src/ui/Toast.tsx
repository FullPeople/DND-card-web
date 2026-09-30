import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './toast.css';
import {CopyDiagnostic} from './CopyDiagnostic';

export function Toast({message,close,details,action}:{message:string;close:()=>void;details?:string;action?:{label:string;run:()=>void}}){
 const ref=useRef<HTMLDivElement>(null),latestClose=useRef(close);latestClose.current=close;
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
 return createPortal(<div ref={ref} popover="manual" className="suite-toast" role="status"><i key={message} className="toast-timer"/><span>{message}</span>{action&&<button className="toast-action" onClick={action.run}>{action.label}</button>}{details&&<CopyDiagnostic text={details}/>}<button aria-label="关闭提示" onClick={close}>×</button></div>,container);
}
