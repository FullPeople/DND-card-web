import type {ResourceWidgetLayout} from '../core/resourceWidgets';
type Presentation=Pick<ResourceWidgetLayout,'style'>&Partial<ResourceWidgetLayout>;
import {recordAction} from './actionHistory';
import {getWorkbench,workbenchRequest,type CardChoice} from './workbench';
import type {ResourceValue} from '../ui/resourcePresets';
import {mutationQueue} from './mutationQueue';
export function latestResourceCard(card:CardChoice){const wb=getWorkbench();return [...wb.cards,...wb.monsters].find(c=>c.id===card.id&&c.kind===card.kind)||card;}
async function commitResource(card:CardChoice,id:string,resource:ResourceValue|null,remember=true,expected?:ResourceValue|null,presentation?:Presentation){
 const live=latestResourceCard(card),before=live.resources.find(r=>r.id===id)||null,target=card.kind==='monster'?card.itemId:`card:${card.id}`;
 const result=await workbenchRequest('resource',{key:undefined,itemId:target,resourceId:id,expected:expected===undefined?before:expected,resource,...(presentation?{presentation}:{})});
 if(remember&&result.snapshot){const after=result.snapshot.state.resources?.find((r:ResourceValue)=>r.id===id)||null;recordAction({label:resource?.name||before?.name||'资源',undo:()=>saveResource(card,id,before,false,after,card.kind==='monster'?undefined:live.resourceWidgets?.[id]||(presentation?{style:'bar'}:undefined)),redo:()=>saveResource(card,id,after,false,before,card.kind==='monster'?undefined:presentation||live.resourceWidgets?.[id])});}return result;
}

const resourceQueues=mutationQueue();
const resourceKey=(card:CardChoice,id:string)=>`${card.kind||'character'}:${card.id}:${id}`;
/** A button supplies an explicit field intent, not a diff against the last ACK.
 * A -> B -> A must enqueue both changes even while the confirmed value is A.
 * Merge at execution so unrelated remote settings are never copied backward. */
export function patchResource(card:CardChoice,id:string,patch:Partial<ResourceValue>){
 const intent=structuredClone(patch);
 return resourceQueues.run(resourceKey(card,id),()=>{
  const live=latestResourceCard(card).resources.find(r=>r.id===id);
  if(!live)throw Error('该资源已被移除，请刷新后再操作');
  return commitResource(card,id,{...live,...intent,id});
 });
}
export function saveResource(card:CardChoice,id:string,resource:ResourceValue|null,remember=true,expected?:ResourceValue|null,presentation?:Presentation){
 const key=resourceKey(card,id),previous=latestResourceCard(card).resources.find(r=>r.id===id)||null;
 const changed=resource&&previous?Object.fromEntries(Object.entries(resource).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(previous[k]))):null;
 const send=()=>{const live=latestResourceCard(card).resources.find(r=>r.id===id);const next=expected===undefined&&resource&&live&&changed?{...live,...changed}:resource;return commitResource(card,id,next,remember,expected,presentation);};
 return resourceQueues.run(key,send);
}
