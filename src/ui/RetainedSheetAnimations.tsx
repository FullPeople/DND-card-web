import {useEffect,useLayoutEffect,useRef} from 'react';
import {afterPaint} from '../platform/afterPaint';

/** Pause known animations rather than changing an inherited CSS property on
 * thousands of descendants. Discover new animations after the first paint. */
export function RetainedSheetAnimations({host,active}:{host:HTMLElement;active:boolean}){
 const latest=useRef(active);latest.current=active;
 const paused=useRef(new Set<Animation>());
 const known=useRef(new Set<Animation>());
 const update=(animations:Animation[])=>{
  for(const animation of animations){
   if(!latest.current&&(animation.playState==='running'||animation.pending)){
    paused.current.add(animation);animation.pause();
   }else if(latest.current&&paused.current.has(animation)){
    paused.current.delete(animation);if(animation.playState==='paused')animation.play();
   }
  }
 };
 useLayoutEffect(()=>{update([...known.current]);},[active]);
 useEffect(()=>{
  const register=(animation:Animation)=>{
   if(known.current.has(animation))return;
   known.current.add(animation);
   const forget=()=>{known.current.delete(animation);paused.current.delete(animation);animation.removeEventListener('finish',forget);animation.removeEventListener('cancel',forget);};
   animation.addEventListener('finish',forget,{once:true});animation.addEventListener('cancel',forget,{once:true});
  };
  const stop=afterPaint(()=>{const animations=host.getAnimations({subtree:true});for(const animation of animations)register(animation);update(animations);});
  const started=(event:Event)=>{if(event.target instanceof Element){const animations=event.target.getAnimations();for(const animation of animations)register(animation);update(animations);}};
  host.addEventListener('animationstart',started,true);host.addEventListener('transitionrun',started,true);
  return()=>{stop();host.removeEventListener('animationstart',started,true);host.removeEventListener('transitionrun',started,true);};
 },[host]);
 return null;
}
