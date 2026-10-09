import {useContext} from 'react';
import type {Character,Entry} from '../core/model';
import {useSheetChoices} from './SheetChoicesContext';
import {useChoiceWorkspace} from './ChoiceWorkspaceContext';
import {SheetEditContext} from './SheetEdit';
import {Reference} from './Reference';

/** Display saved learning intent without creating selections or rule effects. */
export function ClassChoiceRecords({c,catalog,mode}:{c:Character;catalog:Entry[];mode:'feat'|'optional'}){
 const choices=useSheetChoices(c,catalog).filter(choice=>choice.sourceProgression===mode),workspace=useChoiceWorkspace(),editing=useContext(SheetEditContext);
 if(!choices.length)return null;
 return <div className="class-choice-records" aria-label={mode==='feat'?'职业授予专长':'职业学习记录'}>{choices.map(choice=>{
  const owner=c.selections.find(row=>row.id===choice.ownerId)!;
  return <section key={choice.id} data-class-choice={choice.id}>
   <button type="button" className={`sheet-choice-chip ${choice.complete?'':'is-pending'}`} data-choice-id={choice.id} disabled={!editing||choice.count===0} onClick={()=>workspace.open(choice.id)}>{owner.entry.name} · {owner.entry.source} · {choice.label} {choice.count?`${choice.selected.length}/${choice.count}`:'待核对'}</button>
   {choice.count===0&&choice.hint&&<small>{choice.hint}</small>}
   {choice.support&&<small>{choice.support.reason} 当前发布验证：待核实。</small>}
   {mode==='optional'&&<small>已学记录；效果和物品操作手动处理</small>}
   {!!choice.restricted&&<small>来源未启用，原记录保留</small>}
   <div>{choice.slots?.map((value,index)=>{
    if(!value)return null;const option=choice.options.find(row=>row.value===value),entry=option?.entry||c.classChoiceSnapshots?.[value];
    const unavailable=choice.restricted||index>=choice.count||!option||!!option.unavailable;
    return <span key={index} className={unavailable?'is-restricted':''}>{entry?<Reference entry={entry} reference={`entry:${entry.id}`}>{entry.name}</Reference>:value}{unavailable&&<small>（当前不可用，记录保留）</small>}</span>;
   })}</div>
  </section>;
 })}</div>;
}
