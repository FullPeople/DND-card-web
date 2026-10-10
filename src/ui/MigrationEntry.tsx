import {useEffect,useId,useRef,type ReactNode} from 'react';
import type {Entry} from '../core/model';
import {KIND_LABELS} from '../core/model';
import {useSources} from './SourceName';
import {Entries} from './Entries';
import {EntryFacts} from './EntryFacts';

export function useMigrationSource(){const {registry}=useSources();return (entry:Entry)=>entry.raw._custom||entry.packId==='imported'||['CUSTOM','IMPORTED'].includes(entry.source)?'自定义':registry[entry.source]?.name||`未收录资料来源（${entry.source}）`;}
/** Native popover stays above the migration dialog without changing the card. */
export function MigrationEntry({entry,children}:{entry:Entry;children?:ReactNode}){
 const id=useId(),tip=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),source=useMigrationSource();
 const keep=()=>clearTimeout(timer.current),hide=()=>{keep();timer.current=setTimeout(()=>tip.current?.hidePopover(),120);};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const show=(anchor:HTMLElement,point?:{x:number;y:number})=>{
  keep();const node=tip.current;if(!node)return;
  document.querySelectorAll<HTMLElement>('.migration-entry-tooltip:popover-open').forEach(other=>{if(other!==node)other.hidePopover();});
  const b=anchor.getBoundingClientRect(),x=point?.x??b.left+b.width/2,y=point?.y??b.top,w=Math.min(440,innerWidth-24);
  const footer=anchor.closest('.card-migration')?.querySelector('.migration-actions')?.getBoundingClientRect();
  const bottom=Math.min(innerHeight-8,footer?.top??innerHeight-8);
  const above=y-20;
  node.style.width=`${w}px`;
  node.style.maxHeight=`${Math.max(60,Math.min(540,innerHeight*.65,above>=96?above:bottom-16))}px`;
  node.showPopover();
  node.style.left=`${Math.max(12,Math.min(x-w/2,innerWidth-w-12))}px`;
  node.style.top=`${Math.max(8,Math.min(y-node.offsetHeight-12,bottom-node.offsetHeight-8))}px`;
 };
 return <span className="migration-entry">{children||<><small>{source(entry)}</small><strong>{entry.name}</strong></>}
  <button type="button" className="migration-info" aria-label={`查看${entry.name}的资料说明`} aria-describedby={id}
   onMouseEnter={e=>show(e.currentTarget,{x:e.clientX,y:e.clientY})} onMouseLeave={hide} onFocus={e=>show(e.currentTarget)} onBlur={hide}
   onClick={e=>{e.preventDefault();e.stopPropagation();show(e.currentTarget);}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();keep();tip.current?.hidePopover();}}}><span aria-hidden="true">i</span></button>
  <div ref={tip} id={id} popover="manual" role="tooltip" className="migration-entry-tooltip" onClick={e=>{e.preventDefault();e.stopPropagation();}} onMouseEnter={keep} onMouseLeave={hide}><header><strong>{entry.name}</strong><small>{source(entry)} · {KIND_LABELS[entry.kind]} · {entry.edition==='both'?'通用':entry.edition}</small></header><div className="rules-prose"><EntryFacts entry={entry} onLink={()=>{}}/><Entries value={entry.entries}/></div></div>
 </span>;
}
