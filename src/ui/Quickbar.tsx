import {sourceSpellResourceEnabled} from '../core/automation/sourceSpellState';
import {standalone} from '../platform/buildMode';
import {quickbarEntries,removePin} from '../core/quickbar';
import './refinement183.css';
import {Reference} from './Reference';

import {ResourceWidgets,type DashboardControls} from './ResourceWidgets';
import {useWorkbench} from '../platform/workbench';
import {pointerDrag} from './pointerDrag';
import {useContext,useRef,useState,useEffect,Children,type ReactNode,type PointerEvent} from 'react';
import {type Character,type Derived,type Entry,signed} from '../core/model';
import {spellValues} from '../core/characterDetails';
import {isHitDieResource} from '../core/resources';
import {inWorkbench,composeRoll} from '../platform/workbench';
import {SheetEditContext} from './SheetEdit';
import {entryLabel} from '../core/entryLabel';
import {weaponAttacks} from '../core/weaponAttacks';
export function Quickbar({c,d,edit,inspect,manage,manageQuickbar,dashboard,disabled=false}:{dashboard?:DashboardControls;disabled?:boolean;c:Character;d:Derived;edit:(f:(c:Character)=>void)=>void;inspect:(e:Entry)=>void;manage:()=>void;manageQuickbar:()=>void}){
 const wb=useWorkbench();const editing=useContext(SheetEditContext),spell=spellValues(c,d);
 const root=useRef<HTMLDivElement>(null),cancel=useRef<(()=>void)|undefined>(undefined),[over,setOver]=useState('');useEffect(()=>()=>cancel.current?.(),[]);
 const layout=c.quickbarLayout||{order:[],hidden:[]},rank=(id:string)=>layout.order.includes(id)?layout.order.indexOf(id):9999;
 const visibleWeapons=weaponAttacks(c,d);
 const resources=Object.entries(c.runtime.resources).filter(([id])=>!isHitDieResource(id)&&sourceSpellResourceEnabled(c,id)&&!layout.hidden.includes(`resource:${id}`)).sort((a,b)=>rank(`resource:${a[0]}`)-rank(`resource:${b[0]}`)||(a[1].order||0)-(b[1].order||0));
 function drag(e:PointerEvent,id:string,name:string,side:string){
  if(!editing||dashboard?.layoutEditor)return;const ids=side==='resources'?resources.map(([id])=>`resource:${id}`):side==='pins'?quickbarEntries(c).map(row=>`pin:${row.id}`):visibleWeapons.map(w=>w.key);
  const target=(hit:Element|null)=>{const row=hit?.closest<HTMLElement>('[data-quick-id]');return row&&root.current?.contains(row)&&row.dataset.quickSide===side?row.dataset.quickId:undefined;};
  cancel.current=pointerDrag(e,{title:name,cancel:()=>setOver(''),outside:hit=>!hit||!root.current?.contains(hit),move:(_,hit)=>setOver(target(hit)||''),finish:(_,hit)=>{setOver('');if(hit&&root.current?.contains(hit)){const to=target(hit);if(!to||to===id)return {resolve:()=>root.current?.querySelector<HTMLElement>(`[data-quick-id="${CSS.escape(id)}"]`)||null};const order=ids.filter(key=>key!==id);order.splice(ids.indexOf(to),0,id);edit(draft=>{if(side==='pins'){draft.quickbarCopies=order.map(id=>quickbarEntries(draft).find(row=>row.id===id.slice(4))!).filter(Boolean);draft.quickbar=[];}else{const l=draft.quickbarLayout||={order:[],hidden:[]};l.order=[...l.order.filter(key=>!ids.includes(key)),...order];}});return {resolve:()=>root.current?.querySelector<HTMLElement>(`[data-quick-id="${CSS.escape(id)}"]`)||null};}else {edit(draft=>{if(id.startsWith('pin:'))removePin(draft,id.slice(4));else{const l=draft.quickbarLayout||={order:[],hidden:[]};l.hidden=[...new Set([...l.hidden,id])];}});return {removed:true};}}});
 }
 const roll=(expression:string,label:string)=>{if((inWorkbench||standalone)&&!editing)composeRoll(expression,label);};
 const attacks=<AttackPages>{editing&&<button className="quickbar-manage-strip" onClick={manageQuickbar}>整理快捷栏</button>}<div className="quick-weapon"><span>法术攻击</span><button disabled={!inWorkbench&&!standalone} className="rollable-stat" onClick={()=>roll(`1d20${signed(spell.attack)}`,'法术攻击')}>{signed(spell.attack)}</button><strong>DC {spell.dc}</strong></div>{visibleWeapons.map((w:any)=>{const bonus=String(w.attack_bonus??'').match(/[+-]?\s*\d+/)?.[0].replace(/\s/g,'');const damage=[w.damage,w.extra_damage].filter(Boolean).join('+').replace(/\s/g,'');return <div className={`quick-weapon ${over===w.key?'quick-drag-over':''}`} key={w.key} data-quick-id={w.key} data-quick-side="attacks"><span className="quick-drag-handle" data-editing={editing} onPointerDown={e=>drag(e,w.key,w.name,'attacks')}>{w.entry?`${entryLabel(w.entry)}${w.modeLabel?` · ${w.modeLabel}`:''}`:w.name}</span><button className="rollable-stat" disabled={(!inWorkbench&&!standalone)||bonus===undefined} onClick={()=>roll(`1d20${signed(Number(bonus))}`,`${w.name} 命中`)}>{bonus===undefined?'—':signed(Number(bonus))}</button><button className="rollable-stat" disabled={(!inWorkbench&&!standalone)||!damage} onClick={()=>roll(damage,`${w.name} 伤害`)}>{damage||'—'} {w.damage_type||''}</button></div>;})}{quickbarEntries(c).map(s=><Reference className={`quick-pin quick-drag-handle ${over===`pin:${s.id}`?'quick-drag-over':''}`} reference={`entry:${s.entry.id}`} entry={s.entry} data-editing={editing} data-quick-id={`pin:${s.id}`} data-entry-id={s.entry.id} data-quick-side="pins" onPointerDown={e=>drag(e,`pin:${s.id}`,entryLabel(s.entry),'pins')} key={s.id} onClick={()=>inspect(s.entry)}>{entryLabel(s.entry)}</Reference>)}</AttackPages>;
 return <div className="resource-diy-quickbar" ref={root}><ResourceWidgets c={c} rows={resources} editing={editing} enabled={!disabled&&(!inWorkbench||!!wb.target?.write)} gm={!inWorkbench||wb.role==='GM'} edit={edit} manage={manage} attacks={attacks} {...dashboard}/></div>;
}

function AttackPages({children}:{children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null),[height,setHeight]=useState(130),[page,setPage]=useState(0);
 useEffect(()=>{const node=ref.current;if(!node)return;const observer=new ResizeObserver(entries=>setHeight(entries[0].contentRect.height));observer.observe(node);return()=>observer.disconnect();},[]);
 const rows=Children.toArray(children),capacity=Math.max(1,Math.floor((height-21)/23)),pages=Math.max(1,Math.ceil(rows.length/capacity)),shown=Math.min(page,pages-1);
 return <div className="quickbar-attacks" ref={ref}><div className="quickbar-attacks-heading"><span>武器与攻击</span>{pages>1&&<span><button aria-label="上一页攻击" disabled={!shown} onClick={()=>setPage(shown-1)}>‹</button><small>{shown+1}/{pages}</small><button aria-label="下一页攻击" disabled={shown>=pages-1} onClick={()=>setPage(shown+1)}>›</button></span>}</div>{rows.slice(shown*capacity,(shown+1)*capacity)}</div>;
}
