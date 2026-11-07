import type {Character} from './model';
import {containerFor} from './characterInventory';
import {inventoryState} from './characterDetails';
import {forkCharacterConstruction} from './characterConstruction';
import {sameValue,applyPatch} from './merge';
type Action=(draft:Character)=>void;
type Move={id:string;slot:number};
const intents=new WeakMap<Action,{positions:Move[];observed?:Record<string,number>}>();
function projectedPositions(c:Character,positions:Move[],observed?:Record<string,number>){
 const rows=containerFor(c).items,current=new Map(rows.map(row=>[row.id,row.slot]));
 if(!Array.isArray(positions)||new Set(positions.map(p=>p.id)).size!==positions.length)throw Error('物品移动记录无效。');
 for(const p of positions){if(!current.has(p.id))throw Error('物品已被移除或转移，请按当前背包继续操作。');if(!Number.isSafeInteger(p.slot)||p.slot<0||p.slot>=10000)throw Error('背包格子位置无效。');if(observed&&Object.hasOwn(observed,p.id)&&current.get(p.id)!==observed[p.id])throw Error('物品位置已改变，请重新移动。');}
 if(positions.every(p=>current.get(p.id)===p.slot))return c.inventory?.positions;
 const next=Object.fromEntries(current);for(const p of positions)next[p.id]=p.slot;
 if(new Set(Object.values(next)).size!==rows.length)throw Error('目标格子已被占用，请重新移动。');return next;
}
/** Only explicit slot moves opt out of rule reconstruction. */
export function inventoryLayoutEdit(positions:Move[],observed?:Record<string,number>):Action{
 const intent={positions:positions.map(p=>({...p})),observed:observed&&{...observed}},action:Action=c=>{const next=projectedPositions(c,intent.positions,intent.observed);if(next!==c.inventory?.positions)c.inventory={...inventoryState(c),positions:next};};intents.set(action,intent);return action;
}
export function applyInventoryLayoutEdit(c:Character,action:Action):Character|undefined{
 const intent=intents.get(action);if(!intent)return;const positions=projectedPositions(c,intent.positions,intent.observed);if(positions===c.inventory?.positions)return c;
 // Initializing an absent legacy inventory remains on the normal rule path.
 if(!c.inventory)return;return forkCharacterConstruction(c,{...c,inventory:{...c.inventory,positions}});
}
export function inventoryLayoutHistory(live:Character,from:Character,to:Character):Character['inventory']{
 if(sameValue(from.inventory?.positions,to.inventory?.positions))return live.inventory;
 const ids=new Set(containerFor(live).items.map(row=>row.id));
 for(const id of new Set([...Object.keys(from.inventory?.positions||{}),...Object.keys(to.inventory?.positions||{})]))if(from.inventory?.positions?.[id]!==to.inventory?.positions?.[id]&&!ids.has(id))throw Error('物品已被移除或转移，不能恢复旧位置。');
 const positions=applyPatch(live.inventory?.positions,from.inventory?.positions,to.inventory?.positions,'inventory.positions');
 if(positions&&(Object.values(positions).some(n=>typeof n!=='number'||!Number.isSafeInteger(n)||n<0||n>=10000)||new Set(Object.values(positions)).size!==Object.keys(positions).length))throw Error('目标格子已被占用，不能恢复旧位置。');
 return {...live.inventory!,positions};
}
