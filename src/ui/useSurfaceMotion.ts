import {useEffect,useLayoutEffect,useRef,type RefObject} from 'react';
import {createSurfaceMotion,SURFACE_MOTION_EASING,SURFACE_MOTION_MS} from './surfaceMotion';

/** Opacity alone leaves paper scale, status physics and all input hitboxes intact. */
export function useSurfaceMotion(ref:RefObject<HTMLElement|null>,identity:string,enabled:boolean,scope?:string){
 const motion=useRef<ReturnType<typeof createSurfaceMotion<string>>|undefined>(undefined);
 if(!motion.current)motion.current=createSurfaceMotion(()=>{
  const node=ref.current;
  if(!node?.animate)return;
  const value=node.animate([{opacity:.78},{opacity:1}],{duration:SURFACE_MOTION_MS,easing:SURFACE_MOTION_EASING});
  node.dataset.surfaceMotion='entering';
  const clear=()=>{if(node.dataset.surfaceMotion==='entering')delete node.dataset.surfaceMotion;};
  value.addEventListener('finish',clear,{once:true});
  return {cancel:()=>{value.removeEventListener('finish',clear);value.cancel();clear();}};
 },()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 useLayoutEffect(()=>{motion.current!.update(identity,enabled,scope);},[identity,enabled,scope]);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const change=()=>{if(media.matches)motion.current!.cancel();};
  media.addEventListener('change',change);
  return()=>{media.removeEventListener('change',change);motion.current!.cancel();};
 },[]);
}
