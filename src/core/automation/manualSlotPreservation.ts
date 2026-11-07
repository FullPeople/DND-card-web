import type {Character,RuntimeResource} from '../model';
import {ensureResourceWidget,resourceModules,resourceCanvasRows,type ResourceWidgetLayout} from '../resourceWidgets';
import {ownedItemChargeResource} from './itemChargeDebits';
import {ownedLimitedSourceResource} from './limitedSourceUses';
import {manualSlotDestination} from './slotCapacityReview';
const fields=new Set(['name','current','max','type','icon','order','automatic','unlimited','locked']);
export function preservableManualSlot(c:Character,id:string):boolean{
 const r=c.runtime.resources[id];
 return !!r&&(r.automatic===undefined||r.automatic===false)&&(r.locked===undefined||r.locked===false)&&(r.unlimited===undefined||typeof r.unlimited==='boolean')&&typeof r.name==='string'&&!!r.name.trim()&&Object.entries(r).every(([key,value])=>value===undefined||fields.has(key))&&Number.isFinite(r.max)&&r.max>=0&&Number.isFinite(r.current)&&r.current>=0&&!ownedItemChargeResource(c,id)&&!ownedLimitedSourceResource(c,id)&&!Object.values(c.spellSettings?.special||{}).some(value=>value.sourceGrant?.resourceKey===id);
}
export function manualSlotDestinationFree(c:Character,id:unknown):id is string{
 return manualSlotDestination(id)&&!Object.hasOwn(c.runtime.resources,id)&&!Object.hasOwn(c.quickbarLayout?.widgets||{},id)&&!Object.values(c.quickbarLayout?.widgets||{}).some(w=>w.members?.includes(id))&&![...(c.quickbarLayout?.order||[]),...(c.quickbarLayout?.hidden||[])].includes('resource:'+id);
}
/** This operates only on the recovery actor's detached draft. Preserve the
 * manual record and its explicit references; allocate a separate automatic row. */
export function preserveManualSlot(c:Character,from:string,to:string,replacement:RuntimeResource):void{
 const layout=c.quickbarLayout,source=layout?.widgets,oldModule=resourceModules(resourceCanvasRows(c),source,c.selections).find(m=>m.rows.some(([key])=>key===from));
 const oldWidget=source?.[oldModule?.id||from],standalone=oldModule?.rows.length===1&&oldModule.id===from;
 c.runtime.resources[to]=c.runtime.resources[from];c.runtime.resources[from]=replacement;
 if(layout){
  const reference=(value:string)=>value==='resource:'+from?'resource:'+to:value;
  layout.order=layout.order.map(reference);layout.hidden=layout.hidden.map(reference);
  if(layout.widgets){for(const value of Object.values(layout.widgets))if(value.members)value.members=value.members.map(id=>id===from?to:id);
   if(standalone&&oldWidget){layout.widgets[to]=structuredClone(oldWidget);delete layout.widgets[from];}
  }
 }
 const presentation=oldWidget&&Object.fromEntries(Object.entries(oldWidget).filter(([key])=>!['x','y','w','h','page','members','label','resourceArea','split'].includes(key))) as Partial<ResourceWidgetLayout>|undefined;
 ensureResourceWidget(c,to,()=>0,presentation);ensureResourceWidget(c,from,()=>0);
}
