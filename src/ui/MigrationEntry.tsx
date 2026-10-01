import {useId,useRef,type ReactNode} from 'react';
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
 const show=(anchor:HTMLElement)=>{keep();const node=tip.current;if(!node)return;node.showPopover();const b=anchor.getBoundingClientRect(),w=Math.min(440,innerWidth-24);node.style.width=`${w}px`;node.style.left=`${Math.max(12,Math.min(b.left,innerWidth-w-12))}px`;node.style.top=`${Math.max(8,Math.min(b.bottom+6,innerHeight-node.offsetHeight-8))}px`;};
 return <span className="migration-entry" tabIndex={0} aria-describedby={id} onMouseEnter={e=>show(e.currentTarget)} onMouseLeave={hide} onFocus={e=>show(e.currentTarget)} onBlur={hide}>{children||<><small>{source(entry)}</small><strong>{entry.name}</strong></>}{(<div ref={tip} id={id} popover="manual" role="tooltip" className="migration-entry-tooltip" onClick={e=>e.stopPropagation()} onMouseEnter={keep} onMouseLeave={hide}><header><strong>{entry.name}</strong><small>{source(entry)} · {KIND_LABELS[entry.kind]} · {entry.edition==='both'?'通用':entry.edition}</small></header><div className="rules-prose"><EntryFacts entry={entry} onLink={()=>{}}/><Entries value={entry.entries}/></div></div>)}</span>;
}
