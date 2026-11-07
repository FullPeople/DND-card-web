import {ArcaneGrimoireHoldingControls} from './ArcaneGrimoireHoldingControls';
import {applyInventory,previewInventory,type Stock} from '../core/inventory';
import {CarryCapacity} from './InventoryMarks';
import {StockBoard} from './StockBoard';
import {type PageProps} from './CharacterPages';
import {containerFor} from '../core/characterInventory';
import {inventoryLayoutEdit} from '../core/inventoryLayoutEdit';
export {containerFor} from '../core/characterInventory';
export function InventoryPage({c,d,edit,browse}:PageProps){
 const operation=async(op:Record<string,unknown>)=>{if(op.action==='move'){edit(inventoryLayoutEdit(op.positions as {id:string;slot:number}[],op.observedSlots as Record<string,number>|undefined));return;}edit(draft=>{
  const next=containerFor(draft),quantity=(op.patch as Partial<Stock>)?.quantity;
  if(op.action==='update'&&quantity!==undefined&&(!Number.isSafeInteger(quantity)||quantity<0||quantity>1000000))throw Error('请输入有效数量');
  const projected=previewInventory({revision:1,publicId:'',silent:false,containers:{[next.id]:next}},{...op,container:next.id}).containers[next.id];
  Object.assign(next,projected);
  const removedIds=op.action==='remove'&&Array.isArray(op.ids)?op.ids.filter((id):id is string=>typeof id==='string'):op.action==='update'&&quantity===0&&typeof op.id==='string'?[op.id]:[];
  applyInventory(draft,next,removedIds);
 });};
 return <><StockBoard key={c.id} container={containerFor(c)} capacity={<CarryCapacity c={c} d={d} edit={edit}/>} operation={operation}/><ArcaneGrimoireHoldingControls c={c} edit={edit}/><button className="feature-browse" onClick={()=>browse('item')}>＋ 查阅装备</button></>;
}
