import {useSyncExternalStore} from 'react';
import {useRetainedCaptureTarget} from './RetainedCardVisibility';
export type SheetDisplayMode='a4'|'screen';
const key='dnd-card-sheet-display';
const listeners=new Set<()=>void>();
const read=():SheetDisplayMode=>{try{return localStorage.getItem(key)==='screen'?'screen':'a4';}catch{return 'a4';}};
let preference=read(),captures=0;
const notify=()=>listeners.forEach(listener=>listener());
window.addEventListener('storage',event=>{if(event.key===key||event.key===null){preference=read();notify();}});
function subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function setSheetDisplayMode(mode:SheetDisplayMode){preference=mode;try{localStorage.setItem(key,mode);}catch{/* Keep the preference for this session. */}notify();}
export function useSheetDisplayMode(){return useSyncExternalStore(subscribe,()=>preference,()=>'a4' as const);}
export function useSheetRenderMode(){const target=useRetainedCaptureTarget();return useSyncExternalStore(subscribe,()=>captures&&(!target||target())?'a4':preference,()=>'a4' as const);}
export function useSheetCaptureActive(){const target=useRetainedCaptureTarget();return useSyncExternalStore(subscribe,()=>captures>0&&(!target||target()),()=>false);}
/** Capture changes composition without changing the user's preference. */
export function beginSheetCapture(){captures++;notify();let released=false;return()=>{if(!released){released=true;captures--;notify();}};}
