import {useSyncExternalStore} from 'react';
import type {SheetDisplayMode} from '../src/ui/sheetDisplay';

// This experiment shares rendering code, never the production preference key.
let mode:SheetDisplayMode='screen',captures=0;
const listeners=new Set<()=>void>();
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
const notify=()=>listeners.forEach(listener=>listener());
export function setSheetDisplayMode(value:SheetDisplayMode){mode=value;notify();}
export function useSheetDisplayMode(){return useSyncExternalStore(subscribe,()=>mode,()=>'screen' as const);}
export function useSheetRenderMode(){return useSyncExternalStore(subscribe,()=>captures?'a4':mode,()=>'screen' as const);}
export function useSheetCaptureActive(){return useSyncExternalStore(subscribe,()=>captures>0,()=>false);}
export function beginSheetCapture(){captures++;notify();let released=false;return()=>{if(!released){released=true;captures--;notify();}};}
