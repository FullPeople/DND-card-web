import {useEffect,useState} from 'react';
import {builtinOptionsVisible,sheetChoicePending,sheetChoiceIgnored} from '../core/automation/choices';
import {infusionRule,setInfusionTarget,type InfusionBinding} from '../core/automation/infusions';
import type {Character,Entry} from '../core/model';
import {useSheetChoices} from './SheetChoicesContext';
import {useChoiceWorkspace} from './ChoiceWorkspaceContext';
import {Reference} from './Reference';
import {InfusionControl} from './InfusionControl';
import {refuelingRingBindingEdit} from './refuelingRingSubmission';
import {AsiAllocationControl} from './AsiAllocationControl';
import {setAsiAllocation} from '../core/automation/asi';
import {invocationRule} from '../core/automation/invocations';
import {ReviewedFeatControl} from './ReviewedFeatControl';
import {reviewedFeatRule,setReviewedFeatIntent} from '../core/automation/reviewedFeats';

/** Display saved learning intent; activation requires a separate explicit edit. */
export function ClassChoiceRecords({c,catalog,mode,edit}:{c:Character;catalog:Entry[];mode:'feat'|'optional';edit?:(action:(draft:Character)=>void)=>void}){
 const allChoices=useSheetChoices(c,catalog),choices=allChoices.filter(choice=>choice.sourceProgression===mode),workspace=useChoiceWorkspace();
 const [error,setError]=useState('');
 useEffect(()=>setError(''),[c.id]);
 const preserved=mode==='optional'&&c.infusions?.version===1?c.infusions.bindings.filter(binding=>!choices.some(choice=>choice.id===binding.choiceId&&choice.slots?.some(value=>{
  if(value!==binding.entryId)return false;
  const entry=choice.options.find(option=>option.value===value)?.entry||c.classChoiceSnapshots?.[value];return !!entry&&!!infusionRule(entry);
 }))):[];
 function withdraw(binding:InfusionBinding){
  if(workspace.canEdit===false||!edit)return;
  let applied=false;
  try{const entry=c.classChoiceSnapshots?.[binding.entryId];edit(entry&&infusionRule(entry)?.reference==='Spell-Refueling Ring|TCE'?refuelingRingBindingEdit(binding.choiceId,binding.entryId,null,()=>{applied=true;}):draft=>{setInfusionTarget(draft,binding.choiceId,binding.entryId,null);applied=true;});setError(applied?'':'修改未提交，请查看卡面的只读或同步提示。');}
  catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
 }
 const preservedAsi=mode==='feat'&&c.asiAllocations?.version===1?c.asiAllocations.bindings.filter(binding=>!choices.some(choice=>choice.id===binding.choiceId&&choice.slots?.some(value=>value===binding.entryId||binding.kind==='legacy-class'&&choice.options.some(option=>option.value===value&&option.entry.raw._classAbilityRecord)))):[];
 function withdrawAsi(choiceId:string){
  if(workspace.canEdit===false||!edit)return;let applied=false;
  try{edit(draft=>{setAsiAllocation(draft,choiceId,null);applied=true;});setError(applied?'':'修改未提交，请查看卡面的只读或同步提示。');}
  catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
 }
 const preservedFeats=mode==='feat'&&c.reviewedFeats?.version===1?c.reviewedFeats.bindings.filter(binding=>!choices.some(choice=>choice.id===binding.choiceId&&choice.slots?.some(value=>{
  if(value!==binding.entryId)return false;
  const entry=choice.options.find(option=>option.value===value)?.entry||c.classChoiceSnapshots?.[value];return !!entry&&!!reviewedFeatRule(entry);
 }))):[];
 const unknownFeats=mode==='feat'&&!!c.reviewedFeats&&c.reviewedFeats.version!==1;
 function withdrawFeat(choiceId:string,entryId:string){
  if(workspace.canEdit===false||!edit)return;let applied=false;
  try{edit(draft=>{setReviewedFeatIntent(draft,choiceId,entryId,null);applied=true;});setError(applied?'':'修改未提交，请查看卡面的只读或同步提示。');}
  catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
 }
 if(!choices.length&&!preserved.length&&!preservedAsi.length&&!preservedFeats.length&&!unknownFeats)return null;
 return <div className="class-choice-records" aria-label={mode==='feat'?'职业授予专长':'职业学习记录'}>{choices.map(choice=>{
  const owner=c.selections.find(row=>row.id===choice.ownerId)!;
  const show=builtinOptionsVisible(c,owner.id,allChoices);
  if(!show&&!choice.slots?.some(Boolean))return null;
  return <section key={choice.id} data-class-choice={choice.id}>
   {show?<button type="button" className={`sheet-choice-chip ${sheetChoicePending(c,choice)?'is-pending':''}`} data-choice-id={choice.id} disabled={workspace.canEdit===false} onClick={()=>workspace.open(choice.id)}>{owner.entry.name} · {owner.entry.source} · {choice.label} {choice.count?`${choice.selected.length}/${choice.count}`:'待核对'}{sheetChoiceIgnored(c,choice.id,choice)&&'（已忽略）'}</button>:<strong>{owner.entry.name} · {choice.label}</strong>}
   {choice.count===0&&choice.hint&&<small>{choice.hint}</small>}
   {choice.support&&<small>{choice.support.reason} 当前发布验证：待核实。</small>}
   {mode==='optional'&&<small>已学记录；受支持的灌注需另选目标并确认，已适配祈唤按下方说明授予，其他效果和物品操作仍手动处理</small>}
   {!!choice.restricted&&<small>来源未启用，原记录保留</small>}
   <div>{choice.slots?.map((value,index)=>{
    if(!value)return null;const option=choice.options.find(row=>row.value===value),entry=option?.entry||c.classChoiceSnapshots?.[value];
    const parked=Object.values(c.classChoiceArchive||{}).some(archive=>archive.choiceId===choice.id&&archive.selections[0].entry.id===value);
    const unavailable=choice.restricted||index>=choice.count||!option||!!option.unavailable||parked;
    return <div key={`${index}:${value}`} className={unavailable?'is-restricted':''} style={{minWidth:0,maxWidth:'100%'}}>{entry?<Reference entry={entry} reference={`entry:${entry.id}`}>{entry.name}</Reference>:value}{unavailable&&<small>（当前不可用，记录保留）</small>}{parked&&choice.hint&&<small>{choice.hint}</small>}{mode==='optional'&&entry&&invocationRule(entry)&&<small>{invocationRule(entry)!.boundary}</small>}{mode==='feat'&&entry&&<><AsiAllocationControl key={`asi:${c.id}:${choice.id}:${entry.id}`} c={c} choiceId={choice.id} entry={entry} unavailable={!!unavailable} writable={workspace.canEdit!==false} edit={edit}/><ReviewedFeatControl key={`feat:${c.id}:${choice.id}:${entry.id}`} c={c} choiceId={choice.id} entry={entry} unavailable={!!unavailable} writable={workspace.canEdit!==false} edit={edit}/></>}
{mode==='optional'&&entry&&<InfusionControl key={`${c.id}:${choice.id}:${entry.id}`} c={c} choiceId={choice.id} ownerId={owner.id} entry={entry} unavailable={!!unavailable} writable={workspace.canEdit!==false} edit={edit}/>}</div>;
   })}</div>
  </section>;
 })}{preservedAsi.length>0&&<section aria-label="已保留属性提升记录"><strong>已保留属性提升记录</strong><small>原授予当前未选用或不适用，不增加属性；可以撤回原分配。</small>{preservedAsi.map(binding=>{const archived=Object.values(c.classChoiceArchive||{}).flatMap(row=>row.selections).find(row=>row.id===binding.selectionId),entry=binding.kind==='legacy-class'?choices.find(choice=>choice.id===binding.choiceId)?.options.find(option=>option.entry.raw._classAbilityRecord)?.entry:archived?.entry||c.classChoiceSnapshots?.[binding.entryId]||catalog.find(row=>row.id===binding.entryId);return entry?<AsiAllocationControl key={`${binding.choiceId}:${binding.selectionId}`} c={c} choiceId={binding.choiceId} entry={entry} unavailable writable={workspace.canEdit!==false} edit={edit}/>:<div key={`${binding.choiceId}:${binding.selectionId}`}><small>原属性提升资料未载入；仅保留分配记录。</small><button type="button" disabled={workspace.canEdit===false||!edit} onClick={()=>withdrawAsi(binding.choiceId)}>撤回属性提升</button></div>;})}{error&&<small role="alert">{error}</small>}</section>}{preserved.length>0&&<section aria-label="已保留灌注记录">
  <strong>已保留灌注记录</strong><small>当前学习项未显示或已不适用；保留目标记录，不会重新激活。可明确撤回，不会移除物品。</small>
  {preserved.map((binding,index)=>{const entry=c.classChoiceSnapshots?.[binding.entryId]||catalog.find(row=>row.id===binding.entryId),target=c.selections.find(row=>row.id===binding.targetId);return <div key={`${binding.choiceId}:${binding.entryId}:${index}`}>
   <span>{entry?.name||'原灌注资料未载入'} → {target?.entry.name||'原目标已不存在'}</span>
   <button type="button" disabled={workspace.canEdit===false||!edit} onClick={()=>withdraw(binding)} aria-label={`撤回${entry?.name||'原记录'}灌注`}>撤回灌注</button>
  </div>;})}
  {error&&<small role="alert">{error}</small>}
 </section>}{preservedFeats.length>0&&<section aria-label="已保留被动专长记录"><strong>已保留被动专长记录</strong><small>原职业选择当前未选用或不适用，不增加属性、护甲训练、豁免熟练或生命值；可以撤回原确认，不改动手工字段。</small>{preservedFeats.map((binding,index)=>{
  const entry=c.classChoiceSnapshots?.[binding.entryId]||catalog.find(row=>row.id===binding.entryId);
  return entry&&reviewedFeatRule(entry)?<ReviewedFeatControl key={`${binding.choiceId}:${binding.entryId}:${index}`} c={c} choiceId={binding.choiceId} entry={entry} unavailable writable={workspace.canEdit!==false} edit={edit}/>:<div key={`${binding.choiceId}:${binding.entryId}:${index}`}><small>原被动专长资料未载入或声明不再匹配；仅保留确认记录。</small><button type="button" disabled={workspace.canEdit===false||!edit} onClick={()=>withdrawFeat(binding.choiceId,binding.entryId)}>撤回被动专长记录</button></div>;
 })}{error&&<small role="alert">{error}</small>}</section>}{unknownFeats&&<small>此被动专长记录版本尚未支持，原数据保留且不能修改。</small>}</div>;
}
