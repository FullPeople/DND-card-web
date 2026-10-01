import {useContext,useEffect,useRef,useState} from 'react';
import type {Character,Entry} from '../core/model';
import {chooseSheetOption,setSheetChoiceSlot,sheetChoices,claimStartingEquipment,equipmentBlocks,equipmentCandidates,equipmentTypeLabel,equipmentOptionConcept,equipmentPackage} from '../core/automation/choices';
import {Reference} from './Reference';
import {SheetCell} from './SheetCell';
import {DragContext,DropZone} from './DragEntry';
import {choiceCatalog,optionForEntry} from './choiceCatalog';
import './automationChoices.css';

export function ChoiceWorkspace({c,id,catalog,edit,close}:{c:Character;id:string;catalog:Entry[];edit:(action:(c:Character)=>void)=>void;close:()=>void}){
 const choice=sheetChoices(c,catalog).find(r=>r.id===id),drag=useContext(DragContext),[error,setError]=useState(''),[equipment,setEquipment]=useState(''),[picks,setPicks]=useState<Record<string,string>>(()=>({...c.backgroundChoices?.[id.split(':equipment')[0]]?.equipment})),confirmed=useRef(false);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[close]);
 if(!choice)return null;
 const scope=choiceCatalog(c,choice,catalog),selected=choice.channel==='equipment'?(equipment?[equipment]:choice.selected.length?choice.selected:choice.equipmentIndex!<0?[choice.options[0].value]:[]):choice.selected,owner=c.selections.find(s=>s.id===choice.ownerId)!,packageItems=choice.channel==='equipment'&&selected[0]?equipmentPackage(owner.entry,choice.equipmentIndex!,selected[0],picks):[],grouped=choice.channel==='equipment'&&choice.equipmentIndex!<0?equipmentBlocks(owner.entry):[];
 const act=(action:(draft:Character)=>void)=>{try{edit(action);setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}};
 const claim=()=>{if(confirmed.current)return;try{if(!selected[0])throw Error('请先选择起始装备方案。');confirmed.current=true;edit(draft=>claimStartingEquipment(draft,id,selected[0],catalog,picks));close();}catch(e){confirmed.current=false;setError(e instanceof Error?e.message:String(e));}};
 return <SheetCell label={`选择${choice.label}`} className="choice-workspace" trailing={<button className="choice-exit" onClick={close}>返回特性</button>}><div data-choice-workspace data-local-preview>
  <p className="choice-progress">{choice.label} {choice.selected.length}/{choice.count}</p>
  {choice.hint&&<p className="choice-hint">{choice.hint}</p>}
  {scope.wiki?<><p className="choice-hint">从 Wiki 拖拽条目到下方空格，可删除或拖拽替换。</p><div className="choice-slots">{Array.from({length:Math.max(choice.count,choice.slots?.length||0)},(_,index)=>{
   const option=choice.options.find(o=>o.value===(choice.slots||choice.selected)[index]);
   return <DropZone referenceOnly key={index} className="choice-slot" aria-label={`${choice.label}选择格 ${index+1}`} accepts={entry=>!choice.restricted&&!!optionForEntry(c,choice,entry)&&!optionForEntry(c,choice,entry)?.unavailable} onReceive={entry=>{const match=optionForEntry(c,choice,entry);if(match)act(draft=>setSheetChoiceSlot(draft,id,index,match.value,catalog));}}>
    {option?<><Reference className="choice-slot-entry" entry={option.entry} reference={`entry:${option.entry.id}`} commitOnClick={false} onPointerDown={event=>drag?.start(event,option.entry)}>{option.label}</Reference><button className="choice-remove" aria-label={`移除${option.label}`} disabled={choice.restricted} onClick={()=>act(draft=>setSheetChoiceSlot(draft,id,index,undefined,catalog))}>×</button></>:<span className="choice-empty">等待拖拽加入</span>}
   </DropZone>;
  })}</div>{!scope.entries.length&&<p className="choice-hint">{choice.spellKind==='prepared'&&owner.entry.raw.spellsKnownProgressionFixed?'请先选择法术书中的法术。':'候选资料尚未加载，保留此选择。'}</p>}</>:<div className="choice-options">{choice.options.map(option=><Reference key={option.value} entry={option.entry} reference={`entry:${option.entry.id}`} commitOnClick={false} onPointerDown={e=>e.stopPropagation()} className={`choice-option ${selected.includes(option.value)?'is-picked':''}`} aria-pressed={selected.includes(option.value)} aria-disabled={choice.restricted||!!option.unavailable} onClick={()=>{if(choice.restricted||option.unavailable){setError(option.unavailable||'此选择来源尚未启用。');return;}if(choice.channel==='equipment'){setEquipment(option.value);setError('');}else act(draft=>chooseSheetOption(draft,id,option.value,catalog));}}>{option.label}{option.unavailable&&<small>{option.unavailable}</small>}</Reference>)}</div>}
  {grouped.map((block,index)=>{const keys=Object.keys(block).filter(k=>k!=='_');return keys.length>1&&<div className="choice-options" key={`group:${index}`}><strong>装备选择 {index+1}</strong>{keys.map(value=>{const entry=equipmentOptionConcept(owner.entry,index,value);return <Reference key={value} entry={entry} reference={`entry:${entry.id}`} commitOnClick={false} onPointerDown={e=>e.stopPropagation()} className={`choice-option ${picks[`group:${index}`]===value?'is-picked':''}`} aria-pressed={picks[`group:${index}`]===value} onClick={()=>setPicks({...Object.fromEntries(Object.entries(picks).filter(([key])=>key.startsWith('group:'))),[`group:${index}`]:value})}>方案 {value}</Reference>;})}</div>;})}
  {packageItems.flatMap((item:any,index:number)=>item.equipmentType?Array.from({length:item.quantity||1},(_,n)=><div className="choice-options" key={`${index}:${n}`}><strong>{equipmentTypeLabel(item.equipmentType)} · {n+1}</strong>{equipmentCandidates(item.equipmentType,owner.entry,catalog).map(entry=><Reference key={entry.id} entry={entry} reference={`entry:${entry.id}`} commitOnClick={false} onPointerDown={e=>e.stopPropagation()} className={`choice-option ${picks[`${index}:${n}`]===entry.id?'is-picked':''}`} aria-pressed={picks[`${index}:${n}`]===entry.id} onClick={()=>setPicks({...picks,[`${index}:${n}`]:entry.id})}>{entry.name}</Reference>)}</div>):[])}
  {error&&<p role="alert">{error}</p>}
  {choice.channel==='equipment'&&<footer><button disabled={choice.restricted} onClick={claim}>领取装备</button></footer>}
 </div></SheetCell>;
}
