import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import type {Character} from '../core/model';
import {isHitDieResource,setResource} from '../core/resources';
import {inWorkbench,useWorkbench} from '../platform/workbench';
import {ResourceRow} from './ResourceRow';
import './hitDiceResources.css';

const shapes:Record<number,{outline:string;facets:string}>={
  4:{outline:'M16 2 30 28H2Z',facets:'M16 2v6M2 28l6-4m22 4-6-4'},
  6:{outline:'M6 3H26L30 7V25L26 29H6L2 25V7Z',facets:'M6 3v5H2m28 0h-5V3M2 24h5v5m18 0v-5h5'},
  8:{outline:'M16 1 30 16 16 31 2 16Z',facets:'M16 1v7M2 16h5m18 0h5m-14 8v7'},
  10:{outline:'M16 1 29 10 27 23 16 31 5 23 3 10Z',facets:'M16 1v7M3 10l6 1m20-1-6 1M16 24v7'},
  12:{outline:'M10 2h12l9 10-4 14-11 5L5 26 1 12Z',facets:'M10 2l1 5m11-5-1 5M1 12l6 2m24-2-6 2M5 26l5-4m17 4-5-4'},
};
function Die({faces}:{faces:number}){const shape=shapes[faces]||shapes[12];return <svg viewBox="0 0 32 32" aria-hidden="true"><path className="hit-die-face" d={shape.outline}/><path className="hit-die-facets" d={shape.facets}/><text x="16" y="17" textAnchor="middle" dominantBaseline="central">{faces}</text></svg>;}

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
