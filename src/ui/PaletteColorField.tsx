import {useEffect,useRef,useState,type CSSProperties,type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import {isPaletteColor} from '../core/palette';
import {hexToHsv,hsvToHex} from '../platform/paletteSettings';

export function PaletteColorField({label,value,preview,commit,highlight,clearHighlight,disabled,enabled}:{label:string;value:string;preview:(value:string)=>void;commit:(value:string)=>void;highlight:()=>void;clearHighlight:()=>void;disabled:boolean;enabled:boolean}){
 const button=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),plane=useRef<HTMLDivElement>(null),hue=useRef<HTMLDivElement>(null);
 const [hex,setHex]=useState(value.toUpperCase()),[opened,setOpened]=useState(false),[position,setPosition]=useState({left:0,top:0});const [,renderPreview]=useState(0);
 const callbacks=useRef({preview,commit,clearHighlight});callbacks.current={preview,commit,clearHighlight};
 const committed=useRef(value),pending=useRef<string|undefined>(undefined),hsv=useRef(hexToHsv(value)),held=useRef(false),dragging=useRef<'plane'|'hue'|undefined>(undefined),press=useRef<{id:number;x:number;y:number}|undefined>(undefined),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),frame=useRef<number|undefined>(undefined),ignoreClick=useRef(false),isOpen=useRef(false);
 const show=()=>{callbacks.current.clearHighlight();const rect=button.current!.getBoundingClientRect(),height=258,width=248;setPosition({left:Math.max(8,Math.min(innerWidth-width-8,rect.left-width/2+rect.width/2)),top:Math.max(8,Math.min(innerHeight-height-8,rect.top-height-8))});isOpen.current=true;setOpened(true);};
 function paint(){const color=hsvToHex(hsv.current);pending.current=color;setHex(color);renderPreview(n=>n+1);callbacks.current.preview(color);}
 function schedule(){if(frame.current!==undefined)return;frame.current=requestAnimationFrame(()=>{frame.current=undefined;paint();});}
 function finish(save:boolean,hide:boolean){clearTimeout(timer.current);if(frame.current!==undefined){cancelAnimationFrame(frame.current);frame.current=undefined;paint();}const color=pending.current;pending.current=undefined;dragging.current=undefined;held.current=false;press.current=undefined;callbacks.current.clearHighlight();
  if(save&&color&&color.toLowerCase()!==committed.current.toLowerCase()){committed.current=color;callbacks.current.commit(color);}else if(!save&&color){callbacks.current.preview(committed.current);setHex(committed.current.toUpperCase());hsv.current=hexToHsv(committed.current);}
  if(hide){isOpen.current=false;setOpened(false);}
 }
 function choose(x:number,y:number,part?:'plane'|'hue'){
  const p=plane.current?.getBoundingClientRect(),h=hue.current?.getBoundingClientRect();if(!p||!h)return;
  const area=part||(x>=h.left&&x<=h.right&&y>=h.top&&y<=h.bottom?'hue':x>=p.left&&x<=p.right&&y>=p.top&&y<=p.bottom?'plane':undefined);if(!area)return;
  if(area==='hue')hsv.current={...hsv.current,h:Math.min(359.99,Math.max(0,(x-h.left)/h.width*360))};else hsv.current={...hsv.current,s:Math.min(1,Math.max(0,(x-p.left)/p.width)),v:1-Math.min(1,Math.max(0,(y-p.top)/p.height))};schedule();
 }
 useEffect(()=>{committed.current=value;if(!isOpen.current){setHex(value.toUpperCase());hsv.current=hexToHsv(value);}},[value]);
 useEffect(()=>{if(!enabled)finish(false,true);},[enabled]);
 useEffect(()=>{
  const move=(event:globalThis.PointerEvent)=>{if(held.current){event.preventDefault();choose(event.clientX,event.clientY);}else if(dragging.current){event.preventDefault();choose(event.clientX,event.clientY,dragging.current);}else if(press.current&&Math.hypot(event.clientX-press.current.x,event.clientY-press.current.y)>8)clearTimeout(timer.current);};
  const up=()=>{if(held.current){ignoreClick.current=true;finish(true,true);}else if(dragging.current)finish(true,false);else{clearTimeout(timer.current);press.current=undefined;}};
  const cancel=()=>finish(false,true);
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&isOpen.current){event.preventDefault();event.stopImmediatePropagation();finish(false,true);button.current?.focus();}};
  const outside=(event:globalThis.PointerEvent)=>{if(isOpen.current&&!panel.current?.contains(event.target as Node)&&!button.current?.contains(event.target as Node))finish(true,true);};
  const visibility=()=>{if(document.hidden)finish(false,true);};
  document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);document.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape,true);window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',visibility);
  return()=>{clearTimeout(timer.current);if(frame.current!==undefined)cancelAnimationFrame(frame.current);if(pending.current)callbacks.current.preview(committed.current);callbacks.current.clearHighlight();document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);document.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape,true);window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 function down(event:PointerEvent<HTMLButtonElement>){if(!event.isPrimary||event.button!==0)return;callbacks.current.clearHighlight();press.current={id:event.pointerId,x:event.clientX,y:event.clientY};ignoreClick.current=false;timer.current=setTimeout(()=>{held.current=true;show();},320);}
 function panelDown(event:PointerEvent<HTMLDivElement>,part:'plane'|'hue'){if(!event.isPrimary||event.button!==0)return;event.preventDefault();dragging.current=part;choose(event.clientX,event.clientY,part);}
 const displayed=isPaletteColor(hex)?hex:value;
 return <div className="palette-color"><span>{label}</span><button ref={button} type="button" className="palette-swatch" aria-label={`${label}选色`} aria-expanded={opened} style={{'--swatch-color':displayed} as CSSProperties} disabled={disabled} onPointerEnter={event=>{if(event.pointerType==='mouse'&&!isOpen.current&&!disabled)highlight();}} onPointerLeave={clearHighlight} onPointerDown={down} onClick={()=>{if(ignoreClick.current){ignoreClick.current=false;return;}if(isOpen.current)finish(true,true);else show();}}/>
 <input type="text" aria-label={`${label}颜色代码`} value={hex} spellCheck={false} maxLength={7} disabled={disabled} onFocus={clearHighlight} onChange={event=>setHex(event.target.value)} onBlur={()=>{if(isPaletteColor(hex)&&hex.toLowerCase()!==committed.current.toLowerCase()){committed.current=hex;callbacks.current.preview(hex);callbacks.current.commit(hex);}else setHex(committed.current.toUpperCase());}}/>
 {opened&&createPortal(<div ref={panel} className="palette-picker" role="group" aria-label={`${label}选色面板`} style={position}>
  <strong>{label}</strong><div ref={plane} className="palette-picker-plane" aria-label="饱和度和亮度" style={{backgroundColor:`hsl(${hsv.current.h} 100% 50%)`}} onPointerDown={event=>panelDown(event,'plane')}><i style={{left:`${hsv.current.s*100}%`,top:`${(1-hsv.current.v)*100}%`}}/></div>
  <div ref={hue} className="palette-picker-hue" aria-label="色相" onPointerDown={event=>panelDown(event,'hue')}><i style={{left:`${hsv.current.h/360*100}%`}}/></div><div className="palette-picker-footer"><code>{displayed.toUpperCase()}</code><button type="button" onClick={()=>finish(true,true)}>完成</button></div><small>拖动预览，松开应用；Esc 取消。</small>
 </div>,button.current?.closest('dialog[open]')||document.body)}
 </div>;
}
