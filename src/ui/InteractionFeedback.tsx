import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
type Change={anchor:HTMLElement;label:string;before:number;after:number};
const FeedbackContext=createContext<{scope:string;announce:(change:Change)=>void}|undefined>(undefined);

export function InteractionFeedbackProvider({scope,saveLabel,undo,canUndo,children}:{scope:string;saveLabel:string;undo:()=>void;canUndo:boolean;children:ReactNode}){
 const [change,setChange]=useState<(Change&{scope:string;left:number;top:number;host:Element})>(),currentScope=useRef(scope);currentScope.current=scope;
 const announce=useCallback((value:Change)=>{if(!value.anchor.isConnected||value.before===value.after)return;const box=value.anchor.getBoundingClientRect();setChange({...value,scope:currentScope.current,left:Math.max(8,Math.min(box.left,innerWidth-288)),top:Math.max(8,Math.min(box.bottom+8,innerHeight-100)),host:value.anchor.closest('dialog[open],[popover]')||document.body});},[]);
 const context=useMemo(()=>({scope,announce}),[scope,announce]);
 useEffect(()=>{if(!change)return;const close=()=>setChange(undefined),timer=setTimeout(close,5500);window.addEventListener('resize',close);window.addEventListener('scroll',close,true);return()=>{clearTimeout(timer);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true);};},[change]);
 const visible=change?.scope===scope&&change.anchor.isConnected?change:undefined;
 return <FeedbackContext.Provider value={context}>{children}{visible&&createPortal(<aside className="field-change-feedback" role="status" aria-live="polite" style={{left:visible.left,top:visible.top}}><div><strong>{visible.label}</strong><span className="field-change-values"><span className="field-change-previous">{visible.before}</span><span className="field-change-arrow">→</span><b>{visible.after}</b></span></div><small>{saveLabel}</small><div>{canUndo&&<button onClick={()=>{setChange(undefined);undo();}}>撤销最近修改</button>}<button aria-label="关闭数值反馈" onClick={()=>setChange(undefined)}>×</button></div></aside>,visible.host)}</FeedbackContext.Provider>;
}

/** Publish only after the controlled value reflects the user's submitted intent. */
export function useVerifiedValueFeedback(value:number,label:string){
 const context=useContext(FeedbackContext),pending=useRef<(Change&{time:number;scope:string})|undefined>(undefined);
 useLayoutEffect(()=>{const change=pending.current;if(!change)return;if(change.scope!==context?.scope){pending.current=undefined;return;}if(value===change.after&&Date.now()-change.time<5000){pending.current=undefined;context?.announce(change);}else if(value!==change.before||Date.now()-change.time>=5000)pending.current=undefined;},[value,context]);
 return {stage:(anchor:HTMLElement|null,before:number,after:number)=>{if(anchor&&context&&before!==after)pending.current={anchor,label,before,after,time:Date.now(),scope:context.scope};},cancel:()=>{pending.current=undefined;}};
}
