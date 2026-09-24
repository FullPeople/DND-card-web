import {getWorkbench,workbenchRequest,type Target,type CardChoice} from './workbench';
import {recordAction} from './actionHistory';
import {mutationQueue} from './mutationQueue';
const queues=mutationQueue();
/** Serialize a card's vital edits; unrelated cards continue independently. */
export function saveVital(entity:Target|CardChoice,field:string,expression:string|number,label:string,remember=true,expected?:number):Promise<number>{
 const cardId='cardId' in entity?entity.cardId:entity.kind!=='monster'?entity.id:undefined,itemId=cardId?`card:${cardId}`:entity.itemId,key=cardId||entity.itemId;
 const send=async(previous?:any)=>{const wb=getWorkbench(),live=cardId?wb.cards.find(c=>c.id===cardId):wb.monsters.find(c=>c.itemId===itemId);const selected=wb.target?.itemId===entity.itemId?wb.target:undefined;
  const before=expected??live?.stats[field]??selected?.stats[field]??previous?.snapshot?.state.stats[field]??entity.stats[field];
  const result=await workbenchRequest('stats',{key:undefined,itemId,patch:{[field]:expression},expected:{[field]:before}});if(!result.snapshot)return {...result,committedValue:before};const after=result.snapshot.state.stats[field];
  if(remember&&before!==after)recordAction({label,undo:()=>saveVital(entity,field,before,label,false,after),redo:()=>saveVital(entity,field,after,label,false,before)});return result;};
 return queues.run(key,send).then(result=>result.snapshot?.state.stats[field]??result.committedValue).catch(error=>{if(error?.uncertain)throw Object.assign(Error(error.message),error,{statField:field});throw error;});
}
