import type {Character,Entry} from './model';
export type Stock={id:string;kind:'item'|'condition'|'currency'|'resource';name:string;quantity:number;slot:number;revision:number;entry?:Entry;coin?:string;max?:number;locked?:boolean;equipped?:boolean;attuned?:boolean;unitWeight?:number;unlimited?:boolean;type?:string};
/** Stack identity excludes position, quantity and transport revision, never source or rules. */
export function sameStock(a:Stock,b:Stock):boolean {
 if(a.kind==='resource'||b.kind==='resource')return false;
 const normalize=(v:any):any=>Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,normalize(v[k])])):v;
 const identity=({id,slot,quantity,revision,equipped,attuned,...row}:Stock)=>normalize({...row,locked:!!row.locked,unitWeight:row.unitWeight||0});
 return JSON.stringify(identity(a))===JSON.stringify(identity(b));
}
export type StockContainer={id:string;name:string;kind:'public'|'card'|'monster';revision:number;items:Stock[];columns:number;capacity:number;write:boolean;locked?:boolean};
export type InventoryState={access?:string;revision:number;publicId:string;silent:boolean;containers:Record<string,StockContainer>};
export function applyInventory(c:Character,container:StockContainer){
 const itemRows=container.items.filter(row=>row.kind==='item');
 c.selections=[...c.selections.filter(row=>row.entry.kind!=='item'),...itemRows.filter(row=>row.entry&&row.quantity>0).map(row=>({...c.selections.find(s=>s.id===row.id),id:row.id,entry:row.entry!,quantity:row.quantity,level:1,equipped:!!row.equipped,attuned:!!row.attuned}))];
 const inventory=c.inventory||={view:'grid',order:[],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:0,pp:0}};
 inventory.displayEquipment=container.items.filter(r=>r.equipped).map(r=>r.id);inventory.displayAttunement=container.items.filter(r=>r.attuned).map(r=>r.id);
 inventory.positions=Object.fromEntries(container.items.filter(row=>row.kind!=='resource').map(row=>[row.id,row.slot]));
 inventory.coins={cp:0,sp:0,ep:0,gp:0,pp:0};for(const row of container.items)if(row.kind==='currency'&&row.coin&&row.coin in inventory.coins)inventory.coins[row.coin as keyof typeof inventory.coins]=row.quantity;
}

/** Immediate projection of stock commands. The host validates and commits atomically. */
export function previewInventory(state:InventoryState,op:any):InventoryState{
 const next=structuredClone(state),c=next.containers[op.container||op.from];if(op.action==='silent'){next.silent=!!op.value;return next;}if(!c)return next;if(op.action==='containerLock'){c.locked=!!op.locked;c.revision++;return next;}
 const vacancy=(target:StockContainer,start=0)=>{let slot=Math.max(0,start);while(target.items.some(r=>r.slot===slot))slot++;return slot;};
 if(op.action==='add'){const same=c.items.find(r=>sameStock(r,op.row));if(same){same.quantity+=op.row.quantity;same.equipped=!!(same.equipped||op.row.equipped);same.attuned=!!(same.attuned||op.row.attuned);}else if(!c.items.some(r=>r.id===op.row.id))c.items.push({...op.row,slot:vacancy(c,op.row.slot)});}
 if(op.action==='merge'){const row=c.items.find(r=>r.id===op.id),target=c.items.find(r=>r.id===op.targetId);if(row&&target&&row.id!==target.id&&sameStock(row,target)){target.quantity+=row.quantity;target.equipped=!!(target.equipped||row.equipped);target.attuned=!!(target.attuned||row.attuned);c.items=c.items.filter(r=>r.id!==row.id);}}
 if(op.action==='remove')c.items=c.items.filter(r=>!op.ids.includes(r.id));
 if(op.action==='update'){const row=c.items.find(r=>r.id===op.id);if(row){Object.assign(row,op.patch);if(!row.quantity&&['item','condition'].includes(row.kind))c.items=c.items.filter(r=>r.id!==row.id);}}
 if(op.action==='move')for(const p of op.positions){const row=c.items.find(r=>r.id===p.id);if(row)row.slot=p.slot;}
 if(op.action==='split'){const row=c.items.find(r=>r.id===op.id);if(row&&op.quantity>0&&op.quantity<row.quantity){row.quantity-=op.quantity;c.items.push({...row,id:op.newId,quantity:op.quantity,slot:vacancy(c,op.slot),equipped:false,attuned:false});}}
 if(op.action==='transfer'){const target=next.containers[op.to];if(target){for(const request of op.rows){const row=c.items.find(r=>r.id===request.id);if(!row)continue;const same=target.items.find(r=>sameStock(r,{...row,equipped:false,attuned:false,locked:false}));if(same)same.quantity+=request.quantity;else target.items.push({...row,id:request.newId,quantity:request.quantity,slot:vacancy(target,op.slot),equipped:false,attuned:false,locked:false});row.quantity-=request.quantity;if(!row.quantity&&row.kind!=='currency')c.items=c.items.filter(r=>r.id!==row.id);}target.revision++;}}
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
