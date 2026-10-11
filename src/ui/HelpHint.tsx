import {cloneElement,isValidElement,useCallback,useEffect,useId,useRef,useState,type ReactElement,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import './helpHint.css';

/** Hover, keyboard focus or a touch long-press shows what a control does,
 * with a miniature of the screen it opens. The hint never captures the
 * pointer, so the control underneath keeps its normal click. */
export type HelpHintProps={title:string;text:string|string[];preview?:ReactNode;children:ReactElement<any>;delay?:number;width?:number;disabled?:boolean};
const HOVER_DELAY=320,PRESS_DELAY=480;
let openHint:(()=>void)|undefined;
export function HelpHint({title,text,preview,children,delay=HOVER_DELAY,width=300,disabled=false}:HelpHintProps){
 const id=useId(),[open,setOpen]=useState(false),[pressed,setPressed]=useState(false),anchor=useRef<HTMLElement|null>(null),panel=useRef<HTMLDivElement>(null),timer=useRef<number|undefined>(undefined),pressTimer=useRef<number|undefined>(undefined),suppressClick=useRef(false);
 const clear=()=>{window.clearTimeout(timer.current);timer.current=undefined;};
 const hide=useCallback(()=>{clear();setOpen(false);setPressed(false);},[]);
 const show=useCallback(()=>{if(disabled)return;openHint?.();openHint=hide;setOpen(true);},[disabled,hide]);
 useEffect(()=>()=>{clear();window.clearTimeout(pressTimer.current);if(openHint===hide)openHint=undefined;},[hide]);
 useEffect(()=>{if(!open)return;const node=panel.current,target=anchor.current;if(!node||!target)return;
  const place=()=>{const b=target.getBoundingClientRect(),w=Math.min(width,innerWidth-16);node.style.width=w+'px';const h=node.offsetHeight;let left=b.left+b.width/2-w/2;left=Math.max(8,Math.min(left,innerWidth-w-8));let top=b.bottom+8;if(top+h>innerHeight-8)top=Math.max(8,b.top-h-8);node.style.left=left+'px';node.style.top=top+'px';node.dataset.below=String(top>=b.bottom);};
  place();const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')hide();};const outside=(event:PointerEvent)=>{if(!target.contains(event.target as Node))hide();};
  window.addEventListener('resize',place);window.addEventListener('scroll',hide,true);window.addEventListener('keydown',escape);window.addEventListener('pointerdown',outside,true);
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',hide,true);window.removeEventListener('keydown',escape);window.removeEventListener('pointerdown',outside,true);};
 },[open,hide,width]);
 if(!isValidElement(children))return children;
 const child=children as ReactElement<any>;
 const own=child.props;
 const handlers={
  ref:(node:HTMLElement|null)=>{anchor.current=node;const r=(child as any).ref??own.ref;if(typeof r==='function')r(node);else if(r&&typeof r==='object')r.current=node;},
  'aria-describedby':open?[own['aria-describedby'],id].filter(Boolean).join(' '):own['aria-describedby'],
  onPointerEnter:(event:any)=>{own.onPointerEnter?.(event);if(event.pointerType==='touch')return;clear();timer.current=window.setTimeout(show,delay);},
  onPointerLeave:(event:any)=>{own.onPointerLeave?.(event);if(event.pointerType==='touch')return;hide();},
  onPointerDown:(event:any)=>{own.onPointerDown?.(event);if(event.pointerType!=='touch')return;window.clearTimeout(pressTimer.current);pressTimer.current=window.setTimeout(()=>{suppressClick.current=true;setPressed(true);show();},PRESS_DELAY);},
  onPointerUp:(event:any)=>{own.onPointerUp?.(event);window.clearTimeout(pressTimer.current);},
  onPointerCancel:(event:any)=>{own.onPointerCancel?.(event);window.clearTimeout(pressTimer.current);},
  onContextMenu:(event:any)=>{own.onContextMenu?.(event);if(suppressClick.current)event.preventDefault();},
  onClickCapture:(event:any)=>{own.onClickCapture?.(event);if(suppressClick.current){suppressClick.current=false;event.preventDefault();event.stopPropagation();return;}if(!pressed)hide();},
  onFocus:(event:any)=>{own.onFocus?.(event);if(event.currentTarget.matches(':focus-visible'))show();},
  onBlur:(event:any)=>{own.onBlur?.(event);hide();},
 };
 const lines=Array.isArray(text)?text:[text];
 return <>{cloneElement(child,handlers)}{open&&createPortal(<div ref={panel} id={id} role="tooltip" className="help-hint" data-pressed={pressed||undefined}><strong className="help-hint-title">{title}</strong>{preview&&<div className="help-hint-preview" aria-hidden="true">{preview}</div>}{lines.map((line,index)=><p key={index}>{line}</p>)}{pressed&&<small className="help-hint-touch">点击其他位置关闭</small>}</div>,document.body)}</>;
}
