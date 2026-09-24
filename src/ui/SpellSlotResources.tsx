import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import type {ResourceValue} from './resourcePresets';
export function isSpellSlot(id:string){return /^(spell|pact)-slot:[1-9]$/.test(id);}
export function SpellSlotResources({rows,render}:{rows:ResourceValue[];render:(row:ResourceValue)=>ReactNode}){
 const slots=rows.filter(r=>isSpellSlot(r.id||'')).sort((a,b)=>Number(a.id!.split(':')[1])-Number(b.id!.split(':')[1])||a.id!.localeCompare(b.id!));
 const [point,setPoint]=useState<{x:number;y:number}>(),panel=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!point)return;const close=(e:Event)=>{if(!panel.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))setPoint(undefined);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setPoint(undefined);};window.addEventListener('pointerdown',close,true);window.addEventListener('keydown',key);return()=>{window.removeEventListener('pointerdown',close,true);window.removeEventListener('keydown',key);};},[point]);
 useLayoutEffect(()=>{if(!point||!panel.current)return;const el=panel.current;const place=()=>{const r=el.getBoundingClientRect();el.style.left=`${Math.max(8,Math.min(point.x,innerWidth-r.width-8))}px`;el.style.top=`${Math.max(8,Math.min(point.y,innerHeight-r.height-8))}px`;};place();const observer=new ResizeObserver(place);observer.observe(el);window.addEventListener('resize',place);return()=>{observer.disconnect();window.removeEventListener('resize',place);};},[point]);
 if(!slots.length)return null;
 return <><button ref={trigger} className="spell-slot-summary" aria-expanded={!!point} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setPoint(point?undefined:{x:e.detail?e.clientX:r.left,y:e.detail?e.clientY:r.bottom});}}>法术位{slots.map(r=>r.current).join('/')}</button>{point&&createPortal(<div ref={panel} role="dialog" aria-label="法术位" className="spell-slot-popover" style={{left:point.x,top:point.y}}><strong>法术位</strong><div className="resource179-flow">{slots.map(r=><div key={r.id}>{render(r)}</div>)}</div></div>,document.body)}</>;
}
