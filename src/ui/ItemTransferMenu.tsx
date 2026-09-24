import {useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {StockContainer} from '../core/inventory';

export function ItemTransferMenu({targets,disabled,transfer}:{targets:StockContainer[];disabled:boolean;transfer:(target:string)=>void}){
 const anchor=useRef<HTMLButtonElement>(null),pane=useRef<HTMLDivElement>(null),[open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0});
 const dismiss=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const keep=()=>clearTimeout(dismiss.current),leave=()=>{dismiss.current=setTimeout(()=>setOpen(false),180);};
 useLayoutEffect(()=>{if(!open||!pane.current||!anchor.current)return;const a=anchor.current.getBoundingClientRect(),p=pane.current.getBoundingClientRect();setPosition({left:Math.max(6,a.right+p.width+6<=innerWidth?a.right+2:a.left-p.width-2),top:Math.max(6,Math.min(a.top,innerHeight-p.height-6))});return keep;},[open,targets.length]);
 return <><button ref={anchor} type="button" role="menuitem" aria-haspopup="menu" aria-expanded={open} disabled={disabled||!targets.length} onMouseEnter={()=>{keep();setOpen(true);}} onMouseLeave={leave} onClick={()=>{keep();setOpen(true);}} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();setOpen(true);requestAnimationFrame(()=>pane.current?.querySelector<HTMLButtonElement>('button')?.focus());}if(e.key==='Escape'){e.stopPropagation();setOpen(false);}}} className="stock-transfer-trigger">转移至… <span>›</span></button>{open&&createPortal(<div ref={pane} role="menu" aria-label="转移至" className="stock-menu stock-submenu" style={position} onMouseEnter={keep} onMouseLeave={leave} onKeyDown={e=>{if(e.key==='Escape'||e.key==='ArrowLeft'){e.preventDefault();setOpen(false);anchor.current?.focus();}}}>{targets.map(target=><button type="button" role="menuitem" key={target.id} onClick={()=>transfer(target.id)}>{target.name}</button>)}</div>,document.body)}</>;
}
