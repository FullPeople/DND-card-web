import {type Character} from '../core/model';
import {inventoryState} from '../core/characterDetails';
import {applyInventory,previewInventory,type StockContainer,type Stock} from '../core/inventory';
import {CarryCapacity} from './InventoryMarks';
import {StockBoard} from './StockBoard';
import {type PageProps} from './CharacterPages';
const names={cp:'铜币',sp:'银币',ep:'琥珀金币',gp:'金币',pp:'铂金币'};
export function containerFor(c:Character):StockContainer {
 const inv=inventoryState(c),items:Stock[]=Object.entries(names).map(([coin,name],slot)=>({id:`coin:${coin}`,kind:'currency',coin,name,quantity:inv.coins[coin as keyof typeof names],slot:inv.positions?.[`coin:${coin}`]??slot,revision:1,equipped:inv.displayEquipment?.includes(`coin:${coin}`),attuned:inv.displayAttunement?.includes(`coin:${coin}`)}));
 for(const s of c.selections.filter(s=>s.entry.kind==='item')){let slot=inv.positions?.[s.id]??items.length;while(items.some(row=>row.slot===slot))slot++;items.push({id:s.id,kind:'item',entry:s.entry,name:s.entry.name,quantity:s.quantity,slot,revision:1,equipped:s.equipped,attuned:s.attuned,unitWeight:Number(s.entry.raw.weight)||0});}
 return {id:`local:${c.id}`,name:c.name||'装备与物品',kind:'card',revision:1,write:true,columns:4,capacity:24,items};
}
export function InventoryPage({c,d,edit,browse}:PageProps){
 return <><StockBoard key={c.id} container={containerFor(c)} capacity={<CarryCapacity c={c} d={d} edit={edit}/>} operation={async op=>{edit(draft=>{const next=containerFor(draft);if(op.action==='update'){const quantity=(op.patch as Partial<Stock>)?.quantity;if(quantity!==undefined&&(!Number.isSafeInteger(quantity)||quantity<0||quantity>1000000))throw Error('请输入有效数量');}const projected=previewInventory({revision:1,publicId:'',silent:false,containers:{[next.id]:next}},{...op,container:next.id}).containers[next.id];Object.assign(next,projected);applyInventory(draft,next);draft.inventory!.positions=Object.fromEntries(next.items.map(row=>[row.id,row.slot]));});}}/><button className="feature-browse" onClick={()=>browse('item')}>＋ 查阅装备</button></>;
}
