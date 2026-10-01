import {useSyncExternalStore} from 'react';
export type SheetDisplayMode='a4'|'screen';
const key='dnd-card-sheet-display';
const listeners=new Set<()=>void>();
const read=():SheetDisplayMode=>{try{return localStorage.getItem(key)==='a4'?'a4':'screen';}catch{return 'screen';}};
let preference=read(),captures=0;
const notify=()=>listeners.forEach(listener=>listener());
window.addEventListener('storage',event=>{if(event.key===key||event.key===null){preference=read();notify();}});
function subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function setSheetDisplayMode(mode:SheetDisplayMode){preference=mode;try{localStorage.setItem(key,mode);}catch{/* Keep the preference for this session. */}notify();}
export function useSheetDisplayMode(){return useSyncExternalStore(subscribe,()=>preference,()=>'screen' as const);}
export function useSheetRenderMode(){return useSyncExternalStore(subscribe,()=>captures?'a4':preference,()=>'screen' as const);}
/** Capture changes composition without changing the user's preference. */
export function beginSheetCapture(){captures++;notify();let released=false;return()=>{if(!released){released=true;captures--;notify();}};}
