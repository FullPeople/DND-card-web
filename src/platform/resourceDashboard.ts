import type {Character} from '../core/model';
import {evaluate} from '../core/engine';
import {exportOwlbear} from '../core/export';
import {readCharacter,importOwlbear} from '../core/validation';
import {commitDashboardDraft} from '../core/dashboardDraft';
import {getWorkbench,workbenchRequest,type CardChoice} from './workbench';
import {mutationQueue} from './mutationQueue';

const queue=mutationQueue();
function writable(card:CardChoice){
 const wb=getWorkbench(),live=wb.cards.find(row=>row.id===card.id);
 if(!wb.online||!live?.write||card.kind==='monster')throw Error('当前角色不可编辑');
 return live;
}
function character(document:any):Character{
 if(!document)throw Error('角色文档尚未载入');
 return document.dnd_card_web?readCharacter(document.dnd_card_web).character:importOwlbear(document);
}
export async function readResourceDashboard(card:CardChoice){
 writable(card);
 const result=await workbenchRequest('readCard',{key:undefined,itemId:`card:${card.id}`});
 writable(card);
 return character(result.document);
}
/** Read and merge at save time. Only explicit draft changes enter the native
 * delta; a concurrent resource spend, HP edit or unrelated text stays intact. */
export function saveResourceDashboard(card:CardChoice,base:Character,draft:Character){
 return queue.run(card.id,async()=>{
  writable(card);
  const {document}=await workbenchRequest('readCard',{key:undefined,itemId:`card:${card.id}`});
  writable(card);
  const before=character(document),next=commitDashboardDraft(before,base,draft,{gm:getWorkbench().role==='GM'});
  next.revision=before.revision+1;next.updatedAt=new Date().toISOString();
  const result=await workbenchRequest('save',{key:undefined,itemId:`card:${card.id}`,observed:document,previous:before,native:next,previousData:exportOwlbear(before,evaluate(before)),data:exportOwlbear(next,evaluate(next)),statPatch:{}});
  const confirmed=result.snapshot?.document||(await workbenchRequest('readCard',{key:undefined,itemId:`card:${card.id}`})).document;
  return character(confirmed);
 });
}
