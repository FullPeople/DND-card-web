import {useState} from 'react';
import {useWorkbench,getWorkbench} from '../platform/workbench';
import {inventoryRequest} from './StockBoard';
import {ResourceEditor} from './ResourceEditor';
import {ResourcePresets,ResourceRow} from './ResourceRow';
import type {ResourceValue} from './resourcePresets';
import {reportWorkbenchError} from './CopyDiagnostic';
export function DuplicateResource({name,choose}:{name:string;choose:(replace:boolean|null)=>void}){return <div className="resource-duplicate" role="dialog" aria-label="同名资源"><strong>已有「{name}」</strong><div><button onClick={()=>choose(true)}>覆盖</button><button onClick={()=>choose(false)}>同时存在</button><button onClick={()=>choose(null)}>取消</button></div></div>;}
export function PublicResources(){
 const wb=useWorkbench(),gm=wb.role==='GM',id=wb.inventory?.publicId,container=id?wb.inventory?.containers[id]:undefined;
 const [editing,setEditing]=useState(''),[duplicate,setDuplicate]=useState<ResourceValue>();
 if(!container)return null;const rows=container.items.filter(r=>r.kind==='resource');
 const value=(row:typeof rows[number]):ResourceValue=>({id:row.id,name:row.name,current:row.quantity,max:row.max||0,type:row.type||(row.max!>20?'number':'count'),locked:row.locked,unlimited:row.unlimited});
 const save=async(key:string,r:ResourceValue|null)=>{try{const live=getWorkbench().inventory!.containers[container.id],patch=r?{name:r.name,quantity:r.current,max:r.max,type:r.type,locked:!!r.locked,unlimited:!!r.unlimited}:{};await inventoryRequest({action:!r?'remove':key==='new'?'add':'update',container:container.id,expected:{[container.id]:live.revision},id:key,ids:[key],patch:gm?patch:{quantity:r?.current},row:r?{...patch,id:crypto.randomUUID(),kind:'resource',slot:9000,revision:1}:undefined});}catch(e){reportWorkbenchError(e);throw e;}};
 const give=(r:ResourceValue,replace?:boolean)=>{const same=rows.find(row=>row.name===r.name);if(same&&replace===undefined){setDuplicate(r);return;}void save(same&&replace?same.id:'new',{...r,automatic:false}).catch(()=>{});};
 return <section className="public-resources" data-resource-scope="public" data-resource-target={container.id}><header className="resource-section-heading"><h3>公共资源</h3><ResourcePresets scope="public" disabled={!gm||!wb.online} give={r=>give(r)}/>{gm&&<button disabled={!wb.online} onClick={()=>setEditing('new')}>＋ 资源</button>}</header><div className="public-resource-grid">{rows.map(row=><ResourceRow key={row.id} resource={value(row)} gm={gm} enabled={wb.online} change={n=>save(row.id,{...value(row),current:n})} configure={gm?()=>setEditing(row.id):undefined} lock={()=>void save(row.id,{...value(row),locked:!row.locked}).catch(()=>{})}/>)}</div>{editing&&<ResourceEditor gm={gm} presetScope="public" value={rows.find(r=>r.id===editing)?value(rows.find(r=>r.id===editing)!):undefined} close={()=>setEditing('')} save={r=>save(editing,r)} remove={editing==='new'?undefined:()=>save(editing,null)}/>} {duplicate&&<DuplicateResource name={duplicate.name||''} choose={choice=>{if(choice!==null)give(duplicate,choice);setDuplicate(undefined);}}/>}</section>;
}
