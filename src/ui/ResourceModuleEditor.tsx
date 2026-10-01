import {useState} from 'react';
import type {Character} from '../core/model';
import {resourceModules} from '../core/resourceWidgets';
import {setResource} from '../core/resources';
import {ResourceEditor} from './ResourceEditor';
export function ResourceModuleEditor({c,id,edit,close,disabled,gm}:{c:Character;id:string;edit:(f:(c:Character)=>void)=>void;close:()=>void;disabled:boolean;gm:boolean}){
 const module=resourceModules(Object.entries(c.runtime.resources),c.quickbarLayout?.widgets).find(m=>m.id===id||m.rows.some(([key])=>key===id))||resourceModules(c.runtime.resources[id]?[[id,c.runtime.resources[id]]]:[],c.quickbarLayout?.widgets)[0];
 const [selected,setSelected]=useState(id),[message,setMessage]=useState(''),active=module?.rows.some(([key])=>key===selected)?selected:module?.rows[0]?.[0],value=active&&c.runtime.resources[active];
 if(!value)return <p>此资源已移除。</p>;
 function change(fn:(draft:Character)=>void){if(disabled)throw Error('当前角色不可编辑');let applied=false;edit(draft=>{fn(draft);applied=true;});if(!applied)throw Error('修改未提交，请检查角色权限和同步状态');}
 return <section className="resource-module-editor">{module.rows.length>1&&!module.slots&&<label className="resource-module-heading">模块名称<input aria-label="资源模块名称" defaultValue={module.name} maxLength={100} disabled={disabled} onBlur={e=>{const label=e.currentTarget.value.trim();if(label&&label!==module.name)try{change(draft=>{draft.quickbarLayout!.widgets![module.id].label=label;});setMessage('');}catch(error){setMessage(String(error));}}}/></label>}{module.rows.length>1&&<><strong>{module.name}</strong><div className="resource-module-tabs" aria-label="子资源配置">{module.rows.map(([key,r])=><button key={key} aria-pressed={key===active} onClick={()=>setSelected(key)}>{r.name||key}</button>)}</div></>}
 {message&&<p role="alert">{message}</p>}<ResourceEditor inline key={active} value={value} disabled={disabled} gm={gm} close={close} save={async(resource)=>{change(draft=>{if(!draft.runtime.resources[active])throw Error('此资源已移除');draft.runtime.resources[active]=resource;setResource(draft,active,resource.current);});}} remove={value.automatic?undefined:async()=>{change(draft=>{delete draft.runtime.resources[active];const widgets=draft.quickbarLayout?.widgets;if(widgets){const old=widgets[active];delete widgets[active];for(const layout of Object.values(widgets))if(layout.members){layout.members=layout.members.filter(key=>key!==active);if(layout.members.length<2){delete layout.members;delete layout.label;}}if(old?.members){const members=old.members.filter(key=>!!draft.runtime.resources[key]);if(members.length){widgets[members[0]]={...old,...(members.length>1?{members}:{members:undefined,label:undefined})};}}}});}}/>
 </section>;
}
