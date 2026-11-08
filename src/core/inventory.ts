import type {Character,Entry} from './model';
import {removeSelection} from './sheet';
export type Stock={id:string;kind:'item'|'condition'|'currency'|'resource';name:string;quantity:number;slot:number;revision:number;entry?:Entry;coin?:string;max?:number;locked?:boolean;equipped?:boolean;attuned?:boolean;unitWeight?:number;unlimited?:boolean;type?:string;presentation?:Pick<import('./resourceWidgets').ResourceWidgetLayout,'style'|'color'|'icon'>};
/** Stack identity excludes position, quantity and transport revision, never source or rules. */
const normalizeStockValue=(v:any):any=>Array.isArray(v)?v.map(normalizeStockValue):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,normalizeStockValue(v[k])])):v;
function stockIdentity({id,slot,quantity,revision,equipped,attuned,...row}:Stock){return JSON.stringify(normalizeStockValue({...row,locked:!!row.locked,unitWeight:row.unitWeight||0}));}
export function sameStock(a:Stock,b:Stock):boolean {return a.kind!=='resource'&&b.kind!=='resource'&&stockIdentity(a)===stockIdentity(b);}
/** Operation-local identity only: mutable core callers never retain a content cache. */
function matchingStock(items:Stock[],row:Stock){if(row.kind==='resource')return;const identity=stockIdentity(row);return items.find(item=>item.kind!=='resource'&&stockIdentity(item)===identity);}
export type StockContainer={id:string;name:string;kind:'public'|'card'|'monster';revision:number;items:Stock[];columns:number;capacity:number;write:boolean;locked?:boolean};
export type InventoryState={access?:string;revision:number;publicId:string;silent:boolean;containers:Record<string,StockContainer>};
// Complete stock membership controls possession. Missing rows are not proof of
// an explicit player dismissal: only removedIds may withdraw grant receipts.
export function applyInventory(c:Character,container:StockContainer,removedIds:string[]=[]){
 const itemRows=container.items.filter(row=>row.kind==='item');
 if(new Set(container.items.map(row=>row.id)).size!==container.items.length)throw Error('物资记录存在重复身份。');
 const existing=new Map(c.selections.map(row=>[row.id,row]));
 if(itemRows.some(row=>row.entry&&row.quantity>0&&(row.entry.kind!=='item'||existing.has(row.id)&&existing.get(row.id)!.entry.kind!=='item')))throw Error('物资身份与其他条目冲突。');
 for(const id of removedIds)if(c.selections.some(row=>row.id===id&&row.entry.kind==='item')&&!itemRows.some(row=>row.id===id&&row.quantity>0))removeSelection(c,id);
 const current=new Map(c.selections.map(row=>[row.id,row])),removedSelections=new Set([...existing.keys()].filter(id=>!current.has(id)));
 const replacements=new Map(itemRows.filter(row=>row.entry&&row.quantity>0&&!removedSelections.has(row.id)).map(row=>{
  const old=current.get(row.id);let next=old;
  const patch={entry:row.entry!,quantity:row.quantity,equipped:!!row.equipped,attuned:!!row.attuned};
  if(!next)next={id:row.id,level:1,...patch};
  else for(const key of ['entry','quantity','equipped','attuned'] as const){const same=key==='equipped'||key==='attuned'?!!old![key]===patch[key]:old![key]===patch[key];if(!same){if(next===old)next={...old};(next as any)[key]=patch[key];}}
  return [row.id,next] as const;
 }));
 const previous=c.selections,next=previous.flatMap(row=>row.entry.kind==='item'?(replacements.has(row.id)?[replacements.get(row.id)!]:[]):[row]),ids=new Set(next.map(row=>row.id));
 for(const [id,row] of replacements)if(!ids.has(id))next.push(row);
 if(next.length!==previous.length||next.some((row,index)=>row!==previous[index]))c.selections=next;
 const inventory=c.inventory||={view:'grid',order:[],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:0,pp:0}};
 const incoming=new Map(container.items.filter(row=>!removedSelections.has(row.id)).map(row=>[row.id,row])),update={...inventory};
 for(const [field,flag] of [['displayEquipment','equipped'],['displayAttunement','attuned']] as const){
  const prior=inventory[field],values=[...incoming.values()].filter(row=>row[flag]).map(row=>row.id);
  if(prior?prior.length!==values.length||prior.some((id,index)=>id!==values[index]):values.length>0)update[field]=values;
 }
 const positions=Object.fromEntries([...incoming.values()].filter(row=>row.kind!=='resource').map(row=>[row.id,row.slot]));
 if(Object.keys(positions).length!==Object.keys(inventory.positions||{}).length||Object.entries(positions).some(([id,slot])=>inventory.positions?.[id]!==slot))update.positions=positions;
 const coins={...inventory.coins,cp:0,sp:0,ep:0,gp:0,pp:0};
 for(const row of incoming.values())if(row.kind==='currency'&&row.coin&&Object.hasOwn(coins,row.coin))coins[row.coin as keyof typeof coins]=row.quantity;
 if(Object.keys(coins).some(key=>coins[key as keyof typeof coins]!==inventory.coins[key as keyof typeof coins]))update.coins=coins;
 if(Object.keys(update).some(key=>update[key as keyof typeof update]!==inventory[key as keyof typeof inventory]))c.inventory=update;
}

/** Immediate projection of stock commands. The host validates and commits atomically. */
export function previewInventory(state:InventoryState,op:any):InventoryState{
 if(op.action==='silent')return {...state,silent:!!op.value};
 const key=op.container||op.from,original=state.containers[key];if(!original)return state;
 const c:StockContainer={...original,items:[...original.items]},next:InventoryState={...state,containers:{...state.containers,[key]:c}};
 const editRow=(container:StockContainer,id:string)=>{const at=container.items.findIndex(row=>row.id===id);if(at<0)return;const row={...container.items[at]};container.items[at]=row;return row;};
 if(op.action==='containerLock'){c.locked=!!op.locked;c.revision++;return next;}
 const vacancy=(target:StockContainer,start=0)=>{const occupied=new Set(target.items.map(row=>row.slot));let slot=Math.max(0,start);while(occupied.has(slot))slot++;return slot;};
 if(op.action==='add'){const match=matchingStock(c.items,op.row),same=match&&editRow(c,match.id);if(same){same.quantity+=op.row.quantity;same.equipped=!!(same.equipped||op.row.equipped);same.attuned=!!(same.attuned||op.row.attuned);}else if(!c.items.some(r=>r.id===op.row.id))c.items.push({...op.row,slot:vacancy(c,op.row.slot)});}
 if(op.action==='merge'){const row=c.items.find(r=>r.id===op.id),found=c.items.find(r=>r.id===op.targetId);if(row&&found&&row.id!==found.id&&sameStock(row,found)){const target=editRow(c,found.id)!;target.quantity+=row.quantity;target.equipped=!!(target.equipped||row.equipped);target.attuned=!!(target.attuned||row.attuned);c.items=c.items.filter(r=>r.id!==row.id);}}
 if(op.action==='remove')c.items=c.items.filter(r=>!op.ids.includes(r.id));
 if(op.action==='update'){const row=editRow(c,op.id);if(row){Object.assign(row,op.patch);if(!row.quantity&&['item','condition'].includes(row.kind))c.items=c.items.filter(r=>r.id!==row.id);}}
 if(op.action==='move')for(const p of op.positions){const current=c.items.find(r=>r.id===p.id);if(current&&current.slot!==p.slot)editRow(c,p.id)!.slot=p.slot;}
 if(op.action==='split'){const current=c.items.find(r=>r.id===op.id);if(current&&op.quantity>0&&op.quantity<current.quantity){const row=editRow(c,op.id)!;row.quantity-=op.quantity;c.items.push({...row,id:op.newId,quantity:op.quantity,slot:vacancy(c,op.slot),equipped:false,attuned:false});}}
 if(op.action==='transfer'){const originalTarget=next.containers[op.to];if(originalTarget){const target=originalTarget===c?c:{...originalTarget,items:[...originalTarget.items]};next.containers[op.to]=target;for(const request of op.rows){const current=c.items.find(r=>r.id===request.id);if(!current)continue;const found=matchingStock(target.items,{...current,equipped:false,attuned:false,locked:false});if(target===c&&found?.id===current.id)continue;const row=editRow(c,request.id)!,same=found&&editRow(target,found.id);if(same)same.quantity+=request.quantity;else target.items.push({...row,id:request.newId,quantity:request.quantity,slot:vacancy(target,op.slot),equipped:false,attuned:false,locked:false});row.quantity-=request.quantity;if(!row.quantity&&row.kind!=='currency')c.items=c.items.filter(r=>r.id!==row.id);}target.revision++;}}
 c.revision++;return next;
}
/** Apply only fields changed by each pending gesture. A slot move must not
 * conceal a concurrently received quantity/lock edit on that same stock row. */
export function overlayInventory(live:InventoryState,before:InventoryState,after:InventoryState){
 const next={...live,containers:{...live.containers}};if(before.silent!==after.silent)next.silent=after.silent;
 for(const [id,changed] of Object.entries(after.containers)){const old=before.containers[id],current=live.containers[id];if(!old||!current)continue;if(old.locked!==changed.locked)next.containers[id]={...current,locked:changed.locked};if(JSON.stringify(old.items)===JSON.stringify(changed.items))continue;
  const oldRows=new Map(old.items.map(row=>[row.id,row])),newRows=new Map(changed.items.map(row=>[row.id,row]));
  const items=current.items.flatMap(row=>{
   const previous=oldRows.get(row.id),updated=newRows.get(row.id);
   if(previous&&!updated)return [];
   if(!previous||!updated)return [row];
   let merged=row;
   for(const key of new Set([...Object.keys(previous),...Object.keys(updated)])){
    if(key==='id'||key==='revision'||JSON.stringify((previous as any)[key])===JSON.stringify((updated as any)[key]))continue;
    if(merged===row)merged={...row};
    if(Object.hasOwn(updated,key))(merged as any)[key]=(updated as any)[key];else delete (merged as any)[key];
   }
   return [merged];
  });
  // Only newly created pending rows may appear. Never resurrect a remotely
  // deleted/transferred row merely because a local position draft mentions it.
  for(const row of changed.items)if(!oldRows.has(row.id)&&!items.some(item=>item.id===row.id))items.push(row);
  next.containers[id]={...next.containers[id],items};
 }return next;
}
