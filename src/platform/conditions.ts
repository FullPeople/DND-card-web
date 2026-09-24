import {useSyncExternalStore} from 'react';
import {getWorkbench,workbenchRequest} from './workbench';
import {recordAction} from './actionHistory';
import type {Entry} from '../core/model';
import {runtimeConditionMatches as same} from './conditionIdentity';

export type ConditionValue={id:string;name:string;entry?:Entry;level?:number};
type Change={target:string;condition:ConditionValue;present:boolean};
type Draft={changes:Change[];requestId?:string;complete?:(result:any)=>void};
const drafts=new Map<string,Draft>(),listeners=new Set<()=>void>();let revision=0;
const emit=()=>{revision++;listeners.forEach(listener=>listener());};
function apply(rows:ConditionValue[],change:Change){return change.present?rows.some(row=>same(row,change.condition))?rows:[...rows,change.condition]:rows.filter(row=>!same(row,change.condition));}
function current(target:string){const wb=getWorkbench(),card=target.startsWith('card:')?wb.cards.find(card=>card.id===target.slice(5)):wb.monsters.find(card=>card.itemId===target);let rows:ConditionValue[]=card?.conditions||[];for(const draft of drafts.values())for(const change of draft.changes)if(change.target===target)rows=apply(rows,change);return rows;}
export function useConditionRows(target:string,rows:ConditionValue[]){useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>revision);let next=rows;for(const draft of drafts.values())for(const change of draft.changes)if(change.target===target)next=apply(next,change);return next;}
window.addEventListener('workbench-operation-result',event=>{const detail=(event as CustomEvent).detail;if(detail.uncertain)return;let changed=false;for(const [id,draft] of drafts){if(draft.requestId!==detail.requestId)continue;drafts.delete(id);changed=true;if(detail.ok)draft.complete?.(detail.result);}if(changed)emit();});

async function perform(command:Record<string,unknown>,changes:Change[],complete?:(result:any)=>void){
 const id=crypto.randomUUID(),draft:Draft={changes,complete};drafts.set(id,draft);emit();let uncertain=false;
 try{const result=await workbenchRequest('condition',{key:undefined,...command});complete?.(result);return result;}
 catch(error){uncertain=!!(error as any)?.uncertain;if(uncertain)draft.requestId=(error as any).requestId;throw error;}
 finally{if(!uncertain){drafts.delete(id);emit();}}
}
/** Optimism is a presentation overlay; the host remains the sole data authority. */
export function saveCondition(itemId:string,action:'add'|'remove'|'transfer',condition:ConditionValue,to?:string){
 const changes:Change[]=[{target:itemId,condition,present:action==='add'}];if(action==='transfer'&&to)changes.push({target:to,condition,present:true});
 const reverse=changes.map(change=>({...change,present:current(change.target).some(row=>same(row,condition))}));
 return perform({itemId,action,condition,to},changes,result=>{
  if(!result.undo&&!result.historyId)return;
  let command=result.undo||{itemId,action:'history',reference:result.historyId},next=reverse,previous=changes;
  const travel=async()=>{const response=await perform(command,next);command=response.undo||{...command,reference:response.historyId||command.reference};[next,previous]=[previous,next];};
  recordAction({label:condition.name,undo:travel,redo:travel});
 });
}
