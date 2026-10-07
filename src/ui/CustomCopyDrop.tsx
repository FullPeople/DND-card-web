import {useContext,useLayoutEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {DragContext} from './DragEntry';
import type {Entry} from '../core/model';
import './customCanvas.css';

export function CustomCopyDrop({enabled,receive,children}:{enabled:boolean;receive:(entry:Entry)=>void;children:ReactNode}){
 const drag=useContext(DragContext),id=useId(),element=useRef<HTMLDivElement>(null),[rect,setRect]=useState<DOMRect>();
 const active=enabled&&!!drag?.entry&&drag.over===id,register=drag?.register;
 useLayoutEffect(()=>{if(enabled&&element.current)return register?.(id,{element:element.current,onReceive:receive,authoring:true,accepts:()=>true});},[register,id,enabled,receive]);
 useLayoutEffect(()=>{if(!active)return;const update=()=>setRect(element.current?.getBoundingClientRect());update();window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update);},[active]);
 return <div ref={element} className="wiki-content-drop" data-drop-zone={enabled?id:undefined} data-custom-copy-zone={enabled}>{children}{active&&rect&&createPortal(<div className="workspace-hide-preview custom-copy-preview" role="status" style={{left:rect.left,top:rect.top,width:rect.width,height:rect.height}}><strong>以该条目创建自定义副本</strong><span>松手创建副本并打开编辑 · 原条目保留</span></div>,document.body)}</div>;
}
