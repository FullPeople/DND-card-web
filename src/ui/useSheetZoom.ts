import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {frameLatest,sheetTouch,type SheetView} from './sheetTouch';
export function useSheetZoom(ref:RefObject<HTMLDivElement|null>,identity:string,enabled=true){
 const [view,setView]=useState<SheetView>({zoom:1,x:0,y:0}),current=useRef(view);
 const paint=useCallback((next:SheetView)=>{const stack=ref.current?.querySelector<HTMLElement>('.paper-stack');if(stack&&enabled)stack.style.transform=`translate(${next.x}px,${next.y}px) scale(${next.zoom})`;},[ref,enabled]);
 const frames=useMemo(()=>frameLatest<SheetView>(paint),[paint]);
 const reset=useCallback(()=>{frames.cancel();current.current={zoom:1,x:0,y:0};paint(current.current);setView(current.current);},[paint,frames]);
 useLayoutEffect(reset,[identity,enabled,reset]);
 useEffect(()=>{window.addEventListener('sheet-fullscreen-change',reset);return()=>window.removeEventListener('sheet-fullscreen-change',reset);},[reset]);
 useEffect(()=>{const root=ref.current;if(!root||!enabled)return;
  const dispose=sheetTouch(root,()=>current.current,next=>{current.current=next;frames.push(next);},()=>{frames.cancel();paint(current.current);setView(current.current);});
  return()=>{dispose();frames.cancel();};
 },[ref,enabled,identity,paint,frames]);
 return {view,reset};
}
