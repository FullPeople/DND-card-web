import type {Character} from './model';
import {inventoryState} from './characterDetails';
import type {Stock,StockContainer} from './inventory';
const names={cp:'铜币',sp:'银币',ep:'琥珀金币',gp:'金币',pp:'铂金币'};
/** Project this card's possessions only. Source snapshots are never copied. */
export function containerFor(c:Character):StockContainer{
 const inv=inventoryState(c),items:Stock[]=Object.entries(names).map(([coin,name],slot)=>({id:`coin:${coin}`,kind:'currency',coin,name,quantity:inv.coins[coin as keyof typeof names],slot:inv.positions?.[`coin:${coin}`]??slot,revision:1,equipped:inv.displayEquipment?.includes(`coin:${coin}`),attuned:inv.displayAttunement?.includes(`coin:${coin}`)})),occupied=new Set(items.map(row=>row.slot));
 for(const s of c.selections)if(s.entry.kind==='item'){let slot=inv.positions?.[s.id]??items.length;while(occupied.has(slot))slot++;occupied.add(slot);items.push({id:s.id,kind:'item',entry:s.entry,name:s.entry.name,quantity:s.quantity,slot,revision:1,equipped:s.equipped,attuned:s.attuned,unitWeight:Number(s.entry.raw.weight)||0});}
 return {id:`local:${c.id}`,name:c.name||'装备与物品',kind:'card',revision:1,write:true,columns:5,capacity:25,items};
}
