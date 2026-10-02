import {useState,type PointerEvent,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {RESOURCE_TEMPLATES,normalizeWidget,supportsWidgetStyle,widgetStyleNames,type ResourceTemplate,type ResourceModule,type ResourceTemplateValues} from '../core/resourceWidgets';
import {ResourceModuleFace} from './ResourceModuleFace';
import './resourceTemplates.css';

const grouped=new Set(['pool','poolchips','poolbars','poolpips']);
export function resourceTemplatePreview(template:ResourceTemplate,values?:ResourceTemplateValues){
 const group=grouped.has(template.id),ready=template.id==='ready';
 const sample={name:values?.name.trim()||'新资源',current:values?Number.isFinite(values.current)?values.current:0:ready?1:3,max:values?Number.isFinite(values.max)?values.max:0:ready?1:5,unlimited:values?.unlimited??false};
 const children=group?(values?.children??Array.from({length:Math.max(2,Math.min(12,values?.count||3))},(_,i)=>({...sample,name:`${sample.name} ${i+1}`}))):[sample];
 const module:ResourceModule={id:'preview',name:sample.name,slots:false,rows:children.map((r,i)=>[`preview-${i}`,r])};
 return {module,layout:normalizeWidget({style:template.style,w:template.w,h:template.h,color:'#527880',icon:ready?'shield':'spark'})};
}
type Child=NonNullable<ResourceTemplateValues['children']>[number];
const newChild=(n:number):Child=>({name:`子资源 ${n}`,current:3,max:3,unlimited:false});
export function ResourceTemplatePicker({choose,disabled=false,hidden=0,restore,drag,settingsTarget,activeModule}:{hidden?:number;restore?:()=>void;choose:(template:ResourceTemplate,values:ResourceTemplateValues)=>void;disabled?:boolean;drag?:(event:PointerEvent<HTMLButtonElement>,template:ResourceTemplate,values:ResourceTemplateValues)=>void;settingsTarget?:HTMLElement|null;activeModule?:ResourceModule}) {
 const [name,setName]=useState('新资源'),[current,setCurrent]=useState(3),[max,setMax]=useState(3),[unlimited,setUnlimited]=useState(false),[multi,setMulti]=useState(false),[children,setChildren]=useState<Child[]>([newChild(1),newChild(2)]);
 const values:ResourceTemplateValues={name,current,max,unlimited,count:children.length,...(multi?{children}:{})};
 const validRow=(r:Child)=>!!r.name.trim()&&Number.isInteger(r.current)&&r.current>=0&&r.current<=999999999&&Number.isInteger(r.max)&&r.max>=0&&r.max<=99999&&(r.unlimited||r.current<=r.max);
 const valid=!!name.trim()&&(multi?children.every(validRow):validRow(values)),isMulti=activeModule?activeModule.slots||activeModule.rows.length>1:multi;
 function child(index:number,patch:Partial<Child>){setChildren(rows=>rows.map((row,i)=>i===index?{...row,...patch}:row));}
 const settings=<fieldset className="resource-template-values" disabled={disabled}><legend>新模块设置</legend><div className="resource-module-mode"><button type="button" aria-pressed={!multi} onClick={()=>setMulti(false)}>模块</button><button type="button" aria-pressed={multi} onClick={()=>setMulti(true)}>多模块</button></div><label className="resource-template-name">{multi?'总名称':'名称'}<input aria-label="新模块名称" maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>{!multi?<><label>当前值<input aria-label="新模块当前值" type="number" min="0" max="999999999" value={Number.isFinite(current)?current:''} onChange={e=>setCurrent(e.target.valueAsNumber)}/></label><label className="resource-template-limit"><span><input aria-label="新模块有上限" type="checkbox" checked={!unlimited} onChange={e=>setUnlimited(!e.target.checked)}/>上限</span><input aria-label="新模块上限" type="number" min="0" max="99999" disabled={unlimited} value={Number.isFinite(max)?max:''} onChange={e=>setMax(e.target.valueAsNumber)}/></label></>:<div className="resource-template-children">{children.map((r,i)=><div className="resource-child-fields" key={i}><label>子项名称<input aria-label={`子项 ${i+1} 名称`} maxLength={100} value={r.name} onChange={e=>child(i,{name:e.target.value})}/></label><label>当前值<input aria-label={`子项 ${i+1} 当前值`} type="number" min="0" value={Number.isFinite(r.current)?r.current:''} onChange={e=>child(i,{current:e.target.valueAsNumber})}/></label><label><span><input aria-label={`子项 ${i+1} 有上限`} type="checkbox" checked={!r.unlimited} onChange={e=>child(i,{unlimited:!e.target.checked})}/>上限</span><input aria-label={`子项 ${i+1} 上限`} type="number" min="0" disabled={r.unlimited} value={Number.isFinite(r.max)?r.max:''} onChange={e=>child(i,{max:e.target.valueAsNumber})}/></label><button type="button" aria-label={`删除子项 ${i+1}`} disabled={children.length<=2} onClick={()=>setChildren(rows=>rows.filter((_,n)=>n!==i))}>×</button></div>)}<button type="button" disabled={children.length>=12} onClick={()=>setChildren(rows=>[...rows,newChild(rows.length+1)])}>添加子项</button></div>}<small role="status">{valid?'选择右侧样式添加，或拖入中央预览':'请填写名称及有效的当前值和上限'}。资源数值手动管理。</small></fieldset>;
 return <section className="resource-template-library" aria-label="资源模块样式库">
  {!activeModule&&(settingsTarget?createPortal(settings,settingsTarget):settings)}
  {hidden>0&&<button type="button" className="resource-template-restore" disabled={disabled} onClick={restore}>显示已隐藏的 {hidden} 项资源</button>}
  <div className="resource-template-grid">{RESOURCE_TEMPLATES.filter(template=>{const preview=activeModule??resourceTemplatePreview(template,values).module;return template.multi===isMulti&&supportsWidgetStyle(template.style,preview.rows,isMulti);}).map(template=>{
   const preview=resourceTemplatePreview(template,values),module=activeModule??preview.module,layout=preview.layout;
   return <button type="button" className="resource-template-option" key={template.id} data-template-id={template.id} data-multi={template.multi} data-dense={module.rows.length>3} style={{'--preview-pool-rows':Math.ceil(module.rows.length/3)} as CSSProperties} data-supported="true" data-drag-enabled={!!drag&&!activeModule} disabled={disabled||!activeModule&&!valid} onPointerDown={e=>{if(!activeModule&&valid)drag?.(e,template,values);}} onDragStart={e=>e.preventDefault()} onClick={e=>{if(!e.defaultPrevented)choose(template,values);}} aria-label={`${activeModule?'使用':'添加'}${widgetStyleNames[template.style]}样式`}>
    <span className={`resource-template-preview template-${template.id}`}><ResourceModuleFace module={module} style={template.style} layout={layout}/></span><span className="resource-template-add" aria-hidden="true">{activeModule?'✓':'+'}</span>
   </button>;
  })}</div>
 </section>;
}
