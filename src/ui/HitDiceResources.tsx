import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import type {Character} from '../core/model';
import {isHitDieResource,setResource} from '../core/resources';
import {inWorkbench,useWorkbench} from '../platform/workbench';
import {ResourceRow} from './ResourceRow';
import './hitDiceResources.css';

// Same assets used by the Full Suite dice panel; preserve the established art.
function Die({faces}:{faces:number}){return <span className="hit-die-art"><img src={`${import.meta.env.BASE_URL}dice/d${faces}.png`} alt=""/><b>{faces}</b></span>;}

export function HitDiceResources({c,edit}:{c:Character;edit:(action:(draft:Character)=>void)=>void}){
 const wb=useWorkbench(),root=useRef<HTMLDivElement>(null),panel=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useState<{x:number;y:number;id:string}>();
 const rows=Object.entries(c.runtime.resources).filter(([id,r])=>isHitDieResource(id)&&r.max>0).map(([id,r])=>({...r,id,faces:Number(id.split(':')[1])})).sort((a,b)=>a.faces-b.faces);
 const selected=rows.find(row=>row.id===open?.id)||rows[0];
 useEffect(()=>setOpen(undefined),[c.id]);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!root.current?.contains(e.target as Node))setOpen(undefined);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(undefined);};window.addEventListener('pointerdown',outside,true);window.addEventListener('keydown',key);return()=>{window.removeEventListener('pointerdown',outside,true);window.removeEventListener('keydown',key);};},[!!open]);
 useLayoutEffect(()=>{if(!open||!panel.current)return;const el=panel.current,place=()=>{const r=el.getBoundingClientRect();el.style.left=`${Math.max(8,Math.min(open.x,innerWidth-r.width-8))}px`;el.style.top=`${Math.max(8,Math.min(open.y,innerHeight-r.height-8))}px`;};place();const observer=new ResizeObserver(place);observer.observe(el);window.addEventListener('resize',place);return()=>{observer.disconnect();window.removeEventListener('resize',place);};},[open]);
 if(!rows.length)return null;
 return <><div ref={root} className="hit-dice-groups" style={{'--hit-groups':rows.length} as CSSProperties}>{rows.map(row=><div className={`hit-dice-group ${row.max===1?'single-die':''}`} key={row.id} role="group" aria-label={`d${row.faces}：${row.current} / ${row.max}`} style={{'--hit-count':row.max,gridTemplateColumns:row.max>1?`repeat(${row.max-1},minmax(0,1fr)) var(--die-size)`:'var(--die-size)'} as CSSProperties}>{Array.from({length:row.max},(_,i)=><button key={i} type="button" className={`hit-die ${i<row.current?'available':'spent'}`} aria-label={`d${row.faces} 生命骰 ${i+1}，${i<row.current?'可用':'已消耗'}`} aria-haspopup="dialog" aria-expanded={open?.id===row.id} onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();setOpen(open?.id===row.id?undefined:{id:row.id,x:e.detail?e.clientX:rect.left,y:e.detail?e.clientY:rect.bottom});}}><Die faces={row.faces}/></button>)}</div>)}</div>{open&&selected&&createPortal(<div ref={panel} role="dialog" aria-label="生命骰" className="spell-slot-popover hit-dice-popover" style={{left:open.x,top:open.y}}><strong>生命骰</strong><div role="tablist" aria-label="生命骰类型" className="hit-dice-tabs">{rows.map(row=><button key={row.id} role="tab" aria-selected={selected.id===row.id} onClick={()=>setOpen({...open,id:row.id})}>d{row.faces} <small>{row.current}/{row.max}</small></button>)}</div><ResourceRow key={selected.id} resource={{...selected,type:'count'}} enabled={!inWorkbench||!!wb.target?.write} gm={!inWorkbench||wb.role==='GM'} change={async value=>edit(draft=>setResource(draft,selected.id,value))}/></div>,document.body)}</>;
}
