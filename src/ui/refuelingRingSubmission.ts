import type {Character,Entry} from '../core/model';
import {sheetChoices,setSheetChoiceSlot,chooseSheetOption} from '../core/automation/choices';
import {infusionRule,setInfusionTarget} from '../core/automation/infusions';
import {performRefuelingRingAction,type RefuelingRingAction,type RefuelingRingRequest} from '../core/automation/refuelingRing';
export function refuelingRingConfirmation(kind:RefuelingRingAction['kind'],value:string,confirmed:boolean):RefuelingRingAction|undefined{
 if(kind==='initialize')return /^[01]$/.test(value)?{kind,initial:Number(value) as 0|1}:undefined;
 if(kind==='dawn')return confirmed?{kind,dawnConfirmed:true}:undefined;
 return confirmed&&!!value?{kind,slotKey:value,actionConfirmed:true}:undefined;
}
type EditAction=(draft:Character)=>void;
const ringEdits=new WeakSet<EditAction>();
/** App recognizes only these actions; normal resource synchronization must never
 * adopt manual pools before or after this independently validated transaction. */
export function applyRefuelingRingEdit(current:Character,action:EditAction):Character|undefined{
 if(!ringEdits.has(action))return undefined;
 const draft=structuredClone(current);action(draft);return JSON.stringify(draft)===JSON.stringify(current)?current:draft;
}
export function dispatchRefuelingRingRequest(edit:(action:EditAction)=>void,request:RefuelingRingRequest,rejected:(message:string)=>void){
 const action:EditAction=current=>{const result=performRefuelingRingAction(current,request);if(result.status==='rejected')rejected(result.message);};ringEdits.add(action);
 try{edit(action);}catch(error){rejected(error instanceof Error?error.message:String(error));}
}

/** Binding and withdrawal are part of this Ring's transaction boundary too. */
export function refuelingRingBindingEdit(choiceId:string,entryId:string,targetId:string|null,applied:()=>void):EditAction{
 const action:EditAction=current=>{const entry=current.classChoiceSnapshots?.[entryId];if(!entry||infusionRule(entry)?.reference!=='Spell-Refueling Ring|TCE')throw Error('此操作不是已核对的法力恢复戒指绑定。');setInfusionTarget(current,choiceId,entryId,targetId);applied();};ringEdits.add(action);return action;
}

function ringChoice(c:Character,id:string,index:number,value:string|undefined,catalog:Entry[]){
 const choice=sheetChoices(c,catalog).find(row=>row.id===id),owner=c.selections.find(row=>row.id===choice?.ownerId);
 if(choice?.sourceProgression!=='optional'||owner?.entry.kind!=='class'||owner.entry.english!=='Artificer'||owner.entry.source!=='TCE'||owner.entry.raw.ENG_name!=='Artificer'||owner.entry.raw.source!=='TCE')return false;
 return [value,choice.slots?.[index]].some(key=>{const entry=choice.options.find(option=>option.value===key)?.entry||(key?c.classChoiceSnapshots?.[key]:undefined);return !!entry&&infusionRule(entry)?.reference==='Spell-Refueling Ring|TCE'&&Array.isArray(entry.raw.featureType)&&entry.raw.featureType.includes('AI');});
}
/** Only learning, replacing or removing this exact reviewed Ring bypasses the
 * normal reconciliation pipeline. Every other choice keeps its prior path. */
export function refuelingAwareChoiceSlotEdit(c:Character,id:string,index:number,value:string|undefined,catalog:Entry[]):EditAction{
 const isolated=ringChoice(c,id,index,value,catalog);
 const action:EditAction=current=>{if(isolated&&!ringChoice(current,id,index,value,catalog))throw Error('戒指学习来源已变化，请重新选择。');setSheetChoiceSlot(current,id,index,value,catalog);};
 if(isolated)ringEdits.add(action);return action;
}

/** A custom option can make this same source choice a button list rather than
 * a Wiki drop zone. Ring toggles must still clear bindings through slot edits. */
export function refuelingAwareChooseOptionEdit(c:Character,id:string,value:string,catalog:Entry[]):EditAction{
 const choice=sheetChoices(c,catalog).find(row=>row.id===id),entry=choice?.options.find(row=>row.value===value)?.entry;
 if(choice&&entry&&infusionRule(entry)?.reference==='Spell-Refueling Ring|TCE'){
  const saved=choice.slots||choice.selected,index=saved.indexOf(value),target=index>=0?index:choice.count===1?0:saved.findIndex((key,index)=>index<choice.count&&!key);
  if(target>=0&&ringChoice(c,id,target,value,catalog))return refuelingAwareChoiceSlotEdit(c,id,target,index>=0?undefined:value,catalog);
 }
 return current=>chooseSheetOption(current,id,value,catalog);
}
