import {createContext,useContext,useLayoutEffect,useRef} from 'react';
export const RetainedCardVisibility=createContext(true);
export const useRetainedCardActive=()=>useContext(RetainedCardVisibility);
export const RetainedCardCaptureTarget=createContext<(()=>boolean)|undefined>(undefined);
export const useRetainedCaptureTarget=()=>useContext(RetainedCardCaptureTarget);

/** A tiny visibility subscriber dismisses owner portals without re-rendering
 * an otherwise unchanged card. Ordinary unretained surfaces stay active. */
export function RetainedCardHideEffect({hide}:{hide:()=>void}){
 const active=useRetainedCardActive(),latest=useRef(hide);
 useLayoutEffect(()=>{latest.current=hide;});
 useLayoutEffect(()=>{if(!active)latest.current();},[active]);
 return null;
}
