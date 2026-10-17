import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Crosshair from './react-bits/Crosshair';
import ClickSpark from './react-bits/ClickSpark';
import './button-effects.css';

const selector='a,button:not(#molecule-handle):not(#die-hit):not(#logo-return)';
const enabled=element=>element&&!element.matches(':disabled,[aria-disabled="true"]');

function PointerEffects(){
  const [motion,setMotion]=useState(()=>!matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [fine,setFine]=useState(()=>matchMedia('(hover:hover) and (pointer:fine)').matches);
  useEffect(()=>{
    const reduced=matchMedia('(prefers-reduced-motion: reduce)'),pointer=matchMedia('(hover:hover) and (pointer:fine)');
    const change=()=>{setMotion(!reduced.matches);setFine(pointer.matches)};
    reduced.addEventListener('change',change);pointer.addEventListener('change',change);
    return()=>{reduced.removeEventListener('change',change);pointer.removeEventListener('change',change)};
  },[]);
  return <>{motion&&fine&&<Crosshair color="#9e794c" opacity={.4} thickness={1} fade={.7} gap={12} smoothing={.28} showCoordinates={false} hideCursor={false} targetEffect="lock" targetSelector="[data-doodle]:not(:disabled),#molecule-handle,#die-hit" clickPulse={false} className="home-crosshair"/>}
    {motion&&<ClickSpark sparkColor="#c5794e" sparkSize={9} sparkRadius={25} sparkCount={7} duration={430} targetSelector="[data-doodle]:not(:disabled),.project-interaction"/>}</>;
}

export function mountButtonEffects(element){
  const root=createRoot(element);root.render(<PointerEffects/>);
  const known=new WeakSet();let active=null,pressed=null;
  const decorate=scope=>{
    const candidates=scope instanceof Element&&scope.matches(selector)?[scope,...scope.querySelectorAll(selector)]:Array.from(scope.querySelectorAll?.(selector)||[]);
    for(const button of candidates){
      if(known.has(button))continue;known.add(button);
      button.dataset.doodle=button.matches('#about-open,.detail-back,.skip-intro')?'quiet':button.closest('#home-qq-account')?'qq':button.matches('.icon-button,.works-close,.promo-close,.project-navigation button,.about-close')?'icon':button.matches('.entry-library,.detail-link[href],.steam-card a,.about-support-links a')?'primary':'default';
      if(getComputedStyle(button).position==='static')button.style.position='relative';
    }
  };
  decorate(document);
  const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node instanceof Element)decorate(node)});
  observer.observe(document.body,{childList:true,subtree:true});
  const reset=button=>{if(button){button.style.setProperty('--button-x','0px');button.style.setProperty('--button-y','0px');if(button!==pressed)delete button.dataset.buttonState}};
  const pick=event=>event.target instanceof Element?event.target.closest('[data-doodle]'):null;
  const move=event=>{
    const button=pick(event);
    if(button!==active){reset(active);active=enabled(button)?button:null}
    if(!active||event.pointerType!=='mouse'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const box=active.getBoundingClientRect();
    const x=Math.max(-3,Math.min(3,(event.clientX-box.left-box.width/2)/10)),y=Math.max(-2,Math.min(2,(event.clientY-box.top-box.height/2)/10));
    active.style.setProperty('--button-x',`${x}px`);active.style.setProperty('--button-y',`${y}px`);
    if(active!==pressed)active.dataset.buttonState='hover';
  };
  const down=event=>{const button=pick(event);if(enabled(button)){pressed=button;button.dataset.buttonState='pressed'}};
  const release=()=>{if(pressed){delete pressed.dataset.buttonState;reset(pressed);pressed=null}};
  const out=event=>{if(!event.relatedTarget){reset(active);active=null;release()}};
  const key=event=>{if(event.key==='Enter'||event.key===' '){if(event.type==='keydown')down(event);else release()}};
  document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerdown',down);window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);window.addEventListener('blur',release);document.addEventListener('pointerout',out);document.addEventListener('keydown',key);document.addEventListener('keyup',key);
  return()=>{observer.disconnect();root.unmount();reset(active);release();document.removeEventListener('pointermove',move);document.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);window.removeEventListener('blur',release);document.removeEventListener('pointerout',out);document.removeEventListener('keydown',key);document.removeEventListener('keyup',key)};
}
