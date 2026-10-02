import {useLayoutEffect,useRef,useState} from 'react';

type Schedule=(callback:()=>void)=>()=>void;
/** Defer presentation changes across a native pointerup/click sequence only. */
export function createPointerStableValue<T>(initial:T,publish:(value:T)=>void,schedule:Schedule){
 let latest=initial,shown=initial,stopped=false,cancelPending:(()=>void)|undefined;
 const pointers=new Set<number>();
 const cancel=()=>{cancelPending?.();cancelPending=undefined;};
 const flush=()=>{if(stopped||pointers.size)return;if(!Object.is(shown,latest)){shown=latest;publish(latest);}};
 const settle=()=>{cancel();cancelPending=schedule(()=>{cancelPending=undefined;flush();});};
 return {
  update(value:T){if(stopped)return;latest=value;if(!pointers.size&&!cancelPending)flush();},
  down(id:number){if(stopped)return;cancel();pointers.add(id);},
  up(id:number){if(stopped||!pointers.delete(id)||pointers.size)return;settle();},
  release(){if(stopped)return;pointers.clear();settle();},
  reset(value:T){if(stopped)return;cancel();pointers.clear();latest=value;flush();},
  dispose(){stopped=true;cancel();pointers.clear();}
 };
}

/** A late status banner must not move the control currently being pressed.
 * The source state keeps updating; only its layout-affecting presentation waits.
 */
export function usePointerStableValue<T>(value:T,identity:unknown):T{
 const [shown,setShown]=useState(value),latest=useRef(value),scope=useRef(identity);
 latest.current=value;
 const gate=useRef<ReturnType<typeof createPointerStableValue<T>>|undefined>(undefined);
 useLayoutEffect(()=>{
  const active=createPointerStableValue(latest.current,setShown,callback=>{const timer=setTimeout(callback,0);return()=>clearTimeout(timer);});
  gate.current=active;
  const down=(event:PointerEvent)=>active.down(event.pointerId),up=(event:PointerEvent)=>active.up(event.pointerId),release=()=>active.release();
  document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);window.addEventListener('blur',release);
  return()=>{active.dispose();gate.current=undefined;document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);window.removeEventListener('blur',release);};
 },[]);
 useLayoutEffect(()=>{
  if(scope.current!==identity){scope.current=identity;gate.current?.reset(value);setShown(value);}else gate.current?.update(value);
 },[value,identity]);
 return shown;
}
