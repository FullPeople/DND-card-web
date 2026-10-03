import {sourceSpellResourceEnabled} from '../core/automation/sourceSpellState';
import {standalone} from '../platform/buildMode';
import {quickbarEntries} from '../core/quickbar';
import './refinement183.css';
import {Reference} from './Reference';

import {ResourceWidgets,type DashboardControls} from './ResourceWidgets';
import {useWorkbench} from '../platform/workbench';
import {useContext,type ReactNode} from 'react';
import {type Character,type Derived,type Entry,signed} from '../core/model';
import {spellValues} from '../core/characterDetails';
import {isHitDieResource} from '../core/resources';
import {inWorkbench,composeRoll} from '../platform/workbench';
import {SheetEditContext} from './SheetEdit';
import {entryLabel} from '../core/entryLabel';
import {weaponAttacks} from '../core/weaponAttacks';
export function Quickbar({c,d,edit,inspect,manage,manageQuickbar,dashboard,disabled=false,resourcesOnly=false}:{resourcesOnly?:boolean;dashboard?:DashboardControls;disabled?:boolean;c:Character;d:Derived;edit:(f:(c:Character)=>void)=>void;inspect:(e:Entry)=>void;manage:()=>void;manageQuickbar:()=>void}){
 const wb=useWorkbench();const editing=useContext(SheetEditContext),spell=spellValues(c,d);
 const layout=c.quickbarLayout||{order:[],hidden:[]},rank=(id:string)=>layout.order.includes(id)?layout.order.indexOf(id):9999;
 const visibleWeapons=weaponAttacks(c,d);
 const resources=Object.entries(c.runtime.resources).filter(([id])=>!isHitDieResource(id)&&sourceSpellResourceEnabled(c,id)&&!layout.hidden.includes(`resource:${id}`)).sort((a,b)=>rank(`resource:${a[0]}`)-rank(`resource:${b[0]}`)||(a[1].order||0)-(b[1].order||0));
 const roll=(expression:string,label:string)=>{if((inWorkbench||standalone)&&!editing)composeRoll(expression,label);};
 const attacks=<AttackPages manage={manageQuickbar}><div className="quick-weapon"><span>法术攻击</span><button disabled={!inWorkbench&&!standalone} className="rollable-stat" onClick={()=>roll(`1d20${signed(spell.attack)}`,'法术攻击')}>{signed(spell.attack)}</button><strong>DC {spell.dc}</strong></div>{visibleWeapons.map((w:any)=>{const bonus=String(w.attack_bonus??'').match(/[+-]?\s*\d+/)?.[0].replace(/\s/g,'');const damage=[w.damage,w.extra_damage].filter(Boolean).join('+').replace(/\s/g,'');return <div className="quick-weapon" key={w.key} data-quick-id={w.key} data-quick-side="attacks"><span className="quick-attack-name" >{w.entry?`${entryLabel(w.entry)}${w.modeLabel?` · ${w.modeLabel}`:''}`:w.name}</span><button className="rollable-stat" disabled={(!inWorkbench&&!standalone)||bonus===undefined} onClick={()=>roll(`1d20${signed(Number(bonus))}`,`${w.name} 命中`)}>{bonus===undefined?'—':signed(Number(bonus))}</button><button className="rollable-stat" disabled={(!inWorkbench&&!standalone)||!damage} onClick={()=>roll(damage,`${w.name} 伤害`)}>{damage||'—'} {w.damage_type||''}</button></div>;})}{quickbarEntries(c).map(s=><Reference className="quick-pin" reference={`entry:${s.entry.id}`} entry={s.entry} data-quick-id={`pin:${s.id}`} data-entry-id={s.entry.id} data-quick-side="pins"  key={s.id} onClick={()=>inspect(s.entry)}>{entryLabel(s.entry)}</Reference>)}</AttackPages>;
 return <div className="resource-diy-quickbar"><ResourceWidgets c={c} rows={resources} editing={editing} enabled={!disabled&&(!inWorkbench||!!wb.target?.write)} gm={!inWorkbench||wb.role==='GM'} edit={edit} manage={manage} attacks={resourcesOnly?undefined:attacks} {...dashboard}/></div>;
}

function AttackPages({children,manage}:{children:ReactNode;manage:()=>void}){
 return <div className="quickbar-attacks"><div className="quickbar-attacks-heading"><button type="button" onClick={manage} title="整理武器与攻击">武器与攻击</button></div>{children}</div>;
}
