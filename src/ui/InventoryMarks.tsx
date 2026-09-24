import {useContext,useState} from 'react';
import type {Character,Derived} from '../core/model';
import {inventoryState} from '../core/characterDetails';
import {carrying,capacityFormula} from '../core/carrying';
import {inWorkbench,useWorkbench} from '../platform/workbench';
import {SheetCell} from './SheetCell';
import {SheetEditContext} from './SheetEdit';
import {Reference} from './Reference';
import {pointerDrag} from './pointerDrag';
import {inventoryRequest} from './StockBoard';
import type {Edit} from './CharacterPages';
export function InventoryMarks({c,edit}:{c:Character;edit:Edit}){
 const wb=useWorkbench(),id=inWorkbench?`card:${wb.target?.cardId}`:`local:${c.id}`,stock=wb.inventory?.containers[id];
 const rows=inWorkbench?stock?.items.filter(r=>r.kind!=='resource'&&r.kind!=='condition')||[]:[...c.selections.filter(s=>s.entry.kind==='item').map(s=>({...s,name:s.entry.name})),...Object.entries({cp:'铜币',sp:'银币',ep:'琥珀金币',gp:'金币',pp:'铂金币'}).map(([coin,name])=>({id:`coin:${coin}`,name,entry:undefined,equipped:c.inventory?.displayEquipment?.includes(`coin:${coin}`),attuned:c.inventory?.displayAttunement?.includes(`coin:${coin}`)}))];
 const clear=(key:'equipped'|'attuned',rowId:string)=>{if(inWorkbench){if(stock)void inventoryRequest({action:'update',container:id,expected:{[id]:stock.revision},id:rowId,patch:{[key]:false}}).catch(e=>window.dispatchEvent(new CustomEvent('workbench-error',{detail:String(e)})));}else edit(draft=>{const row=draft.selections.find(s=>s.id===rowId);if(row)row[key]=false;const field=key==='equipped'?'displayEquipment':'displayAttunement';if(draft.inventory)draft.inventory[field]=draft.inventory[field]?.filter(id=>id!==rowId);});};
 return <>{(['equipped','attuned'] as const).map(key=><div key={key} className="stock-mark-area" data-stock-mark={key} data-stock-owner={id}><SheetCell label={key==='equipped'?'装备':'同调'}>{rows.filter(r=>r[key]).map(row=><Reference data-stock-ref-id={row.id} previewEnabled={!!row.entry} commitOnClick={!!row.entry} key={row.id} entry={row.entry} reference={`entry:${row.entry?.id}`} className="stock-mark" onPointerDown={e=>{if(inWorkbench&&!stock?.write)return;const owner=e.currentTarget.closest('[data-stock-mark]');pointerDrag(e,{appearance:'source',title:row.name,move:()=>{},cancel:()=>{},outside:hit=>!owner?.contains(hit),finish:(_,hit)=>{if(!owner?.contains(hit)){clear(key,row.id);return {removed:true};}}});}}>{row.name}</Reference>)}{!rows.some(r=>r[key])&&<span className="stock-mark-empty">拖拽物品到此处</span>}</SheetCell></div>)}</>;
}
export function CarryCapacity({c,d,edit}:{c:Character;d:Derived;edit:Edit}){
 const editing=useContext(SheetEditContext),[error,setError]=useState('');let values;try{values=carrying(c,d);}catch{values={base:d.abilities.str*15,strength:d.abilities.str,max:d.abilities.str*15};}
 return <span className="capacity-adjuster"><b title={`力量 ${values.strength} · 基础上限 ${values.base} 磅`}>{values.max.toLocaleString()}</b>{editing&&<input key={c.id+':'+(c.inventory?.capacityAdjustment||'')} className="stock-capacity-input" aria-label="负重上限调整" title="支持 +30、*2、基础*2+力量" placeholder="调整，如 *2+30" defaultValue={c.inventory?.capacityAdjustment||''} onBlur={e=>{const text=e.currentTarget.value.trim();try{capacityFormula(text,values.base,values.strength);setError('');if(text!==(c.inventory?.capacityAdjustment||''))edit(draft=>{(draft.inventory||=inventoryState(draft)).capacityAdjustment=text;});}catch(e){setError(String(e));}}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>}{error&&<span role="alert">{error}</span>}</span>;
}
