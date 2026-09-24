import {useContext,type PointerEvent} from 'react';
import {landingWithin,pointerDrag} from './pointerDrag';
import {ReferenceContext} from './Reference';
import {overviewConditionEntry,type OverviewCondition} from './OverviewVisuals';

export function OverviewConditions({conditions,editable,source,change}:{conditions:OverviewCondition[];editable:boolean;source:string;change:(action:'remove'|'transfer',condition:OverviewCondition,to?:string)=>void}){
 const preview=useContext(ReferenceContext);
 function drag(event:PointerEvent,condition:OverviewCondition){
  if(!editable)return;
  let marked:HTMLElement|null=null;
  const clear=()=>{marked?.classList.remove('inventory-drop-over');marked=null;document.querySelectorAll('.resource179-transfer-ready').forEach(node=>node.classList.remove('resource179-transfer-ready'));};
  const recipient=(hit:Element|null)=>hit?.closest<HTMLElement>('[data-condition-recipient]')||null;
  pointerDrag(event,{appearance:'source',title:condition.name,start:()=>{preview?.close();document.querySelectorAll('[data-condition-recipient][data-condition-receive=true]').forEach(node=>node.classList.add('resource179-transfer-ready'));},cancel:clear,outside:hit=>!recipient(hit),move:(_,hit)=>{const next=recipient(hit);if(marked!==next){clear();marked=next;if(next?.dataset.conditionReceive==='true')next.classList.add('inventory-drop-over');}},finish:(_,hit)=>{
   const target=recipient(hit),to=target?.dataset.conditionRecipient;clear();
   if(to===source)return;
   if(target){if(target.dataset.conditionReceive!=='true')return;change('transfer',condition,to);return landingWithin(target,()=>target.querySelector<HTMLElement>(`[data-overview-condition="${CSS.escape(condition.id)}"]`));}
   change('remove',condition);return {removed:true};
  }});
 }
 return <div className="resource179-conditions">{conditions.map(condition=>{const entry=overviewConditionEntry(condition);return <button key={condition.id} className="resource179-condition" data-overview-condition={condition.id} data-can-drag={editable} onPointerDown={event=>drag(event,condition)} onMouseEnter={event=>preview?.show(event.currentTarget,`entry:${entry.id}`,undefined,{x:event.clientX,y:event.clientY},entry)} onMouseMove={event=>preview?.move(event.currentTarget,{x:event.clientX,y:event.clientY})} onMouseLeave={()=>preview?.leave()} onClick={event=>preview?.commit?.(event.currentTarget,`entry:${entry.id}`,undefined,entry)}>{condition.name}{condition.level&&condition.level>1?` ${condition.level}`:''}</button>;})}</div>;
}
