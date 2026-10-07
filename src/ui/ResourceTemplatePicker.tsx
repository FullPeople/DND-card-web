import {useState,useRef,type PointerEvent,type CSSProperties} from 'react';
import {sameValue} from '../core/merge';
import {useResourceDraftGuard} from './resourceDraftGuard';
import {createPortal} from 'react-dom';
import {RESOURCE_TEMPLATES,WIDGET_STYLE_GROUPS,normalizeWidget,supportsWidgetStyle,widgetStyleNames,defaultModuleStyle,canonicalWidgetStyle,type ResourceTemplate,type ResourceModule,type ResourceTemplateValues,type WidgetStyle} from '../core/resourceWidgets';
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
/** The style library. For a selected module it offers every applicable style and
 * marks the current one; for a new module it also carries the value form. */
export function ResourceTemplatePicker({choose,disabled=false,hidden=0,restore,drag,settingsTarget,activeModule,activeStyle}:{hidden?:number;restore?:()=>void;choose:(template:ResourceTemplate,values:ResourceTemplateValues)=>void;disabled?:boolean;drag?:(event:PointerEvent<HTMLButtonElement>,template:ResourceTemplate,values:ResourceTemplateValues)=>void;settingsTarget?:HTMLElement|null;activeModule?:ResourceModule;activeStyle?:WidgetStyle}) {
 const [name,setName]=useState('新资源'),[current,setCurrent]=useState(3),[max,setMax]=useState(3),[unlimited,setUnlimited]=useState(false),[multi,setMulti]=useState(false),[children,setChildren]=useState<Child[]>([newChild(1),newChild(2)]);
 const values:ResourceTemplateValues={name,current,max,unlimited,count:children.length,...(multi?{children}:{})};
 const initial=useRef(values);useResourceDraftGuard('new-module',!activeModule&&!sameValue(initial.current,values));
 const validRow=(r:Child)=>!!r.name.trim()&&Number.isInteger(r.current)&&r.current>=0&&r.current<=999999999&&Number.isInteger(r.max)&&r.max>=0&&r.max<=99999&&(r.unlimited||r.current<=r.max);
 const valid=!!name.trim()&&(multi?children.every(validRow):validRow(values)),isMulti=activeModule?activeModule.slots||activeModule.rows.length>1:multi;
 function child(index:number,patch:Partial<Child>){setChildren(rows=>rows.map((row,i)=>i===index?{...row,...patch}:row));}
 const numberField=(label:string,value:number,set:(n:number)=>void,extra:{max?:number;disabled?:boolean}={})=><input aria-label={label} type="number" min="0" max={extra.max??999999999} disabled={extra.disabled} value={Number.isFinite(value)?value:''} onChange={e=>set(e.target.valueAsNumber)}/>;
 const settings=<fieldset className="resource-template-values" disabled={disabled}>
  <div className="resource-module-mode" role="group" aria-label="模块类型"><button type="button" aria-pressed={!multi} onClick={()=>setMulti(false)}>模块</button><button type="button" aria-pressed={multi} onClick={()=>setMulti(true)}>多模块</button><small>{multi?'一个标题下的 2–12 项独立资源':'一项独立计数的资源'}</small></div>
  <label className="resource-template-name"><span>{multi?'总名称':'名称'}</span><input aria-label="新模块名称" maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
  {!multi?<div className="resource-template-numbers">
   <label><span>当前值</span>{numberField('新模块当前值',current,setCurrent)}</label>
   <label className="resource-template-limit"><span><input aria-label="新模块有上限" type="checkbox" checked={!unlimited} onChange={e=>setUnlimited(!e.target.checked)}/>上限</span>{numberField('新模块上限',max,setMax,{max:99999,disabled:unlimited})}</label>
  </div>:<div className="resource-template-children">
   {children.map((r,i)=><div className="resource-child-fields" key={i}>
    <label><span>子项 {i+1}</span><input aria-label={`子项 ${i+1} 名称`} maxLength={100} value={r.name} onChange={e=>child(i,{name:e.target.value})}/></label>
    <label><span>当前值</span>{numberField(`子项 ${i+1} 当前值`,r.current,n=>child(i,{current:n}))}</label>
    <label><span><input aria-label={`子项 ${i+1} 有上限`} type="checkbox" checked={!r.unlimited} onChange={e=>child(i,{unlimited:!e.target.checked})}/>上限</span>{numberField(`子项 ${i+1} 上限`,r.max,n=>child(i,{max:n}),{max:99999,disabled:r.unlimited})}</label>
    <button type="button" className="resource-child-remove" aria-label={`删除子项 ${i+1}`} disabled={children.length<=2} onClick={()=>setChildren(rows=>rows.filter((_,n)=>n!==i))}>×</button>
   </div>)}
   <button type="button" className="resource-child-add" disabled={children.length>=12} onClick={()=>setChildren(rows=>[...rows,newChild(rows.length+1)])}>添加子项</button>
  </div>}
  <small role="status" className="resource-template-hint">{valid?'在右侧样式库点选添加，或把样式拖到上方预览里放置':'请填写名称及有效的当前值和上限'}。资源数值手动管理。</small>
 </fieldset>;
 const previewModule=(template:ResourceTemplate)=>activeModule??resourceTemplatePreview(template,values).module;
 const applicable=RESOURCE_TEMPLATES.filter(template=>template.multi===isMulti&&supportsWidgetStyle(template.style,previewModule(template).rows,isMulti));
 const defaultStyle=activeModule?defaultModuleStyle(activeModule):defaultModuleStyle(resourceTemplatePreview(applicable[0]??RESOURCE_TEMPLATES[0],values).module);
 const selectedStyle=activeStyle?canonicalWidgetStyle(activeStyle):undefined;
 // Each family lists its styles in reading order; the capacity filter only removes entries.
 const groups=WIDGET_STYLE_GROUPS.map(group=>({...group,templates:group.styles.map(id=>applicable.find(template=>template.id===id)).filter((template):template is ResourceTemplate=>!!template)})).filter(group=>group.templates.length);
 return <section className="resource-template-library" aria-label="资源模块样式库" data-mode={activeModule?'restyle':'create'}>
  {!activeModule&&(settingsTarget?createPortal(settings,settingsTarget):settings)}
  {hidden>0&&<button type="button" className="resource-template-restore" disabled={disabled} onClick={restore}>显示已隐藏的 {hidden} 项资源</button>}
  {groups.map(group=><div className="resource-template-group" key={group.id} data-group={group.id}><h4>{group.name}<small>{group.templates.length}</small></h4>
   <div className="resource-template-grid">{group.templates.map(template=>{
    const preview=resourceTemplatePreview(template,values),module=activeModule??preview.module,layout=preview.layout,isDefault=template.id===defaultStyle,isCurrent=template.id===selectedStyle;
    return <button type="button" className="resource-template-option" key={template.id} data-template-id={template.id} data-multi={template.multi} data-dense={module.rows.length>3} data-default={isDefault||undefined} aria-pressed={activeModule?isCurrent:undefined} style={{'--preview-pool-rows':Math.ceil(module.rows.length/3)} as CSSProperties} data-supported="true" data-drag-enabled={!!drag&&!activeModule} disabled={disabled||!activeModule&&!valid} onPointerDown={e=>{if(!activeModule&&valid)drag?.(e,template,values);}} onDragStart={e=>e.preventDefault()} onClick={e=>{if(!e.defaultPrevented)choose(template,values);}} aria-label={`${activeModule?'使用':'添加'}${widgetStyleNames[template.style]}样式`} title={isDefault?`${widgetStyleNames[template.style]} · 当前容量的默认样式`:widgetStyleNames[template.style]}>
     <span className={`resource-template-preview template-${template.id}`}><ResourceModuleFace module={module} style={template.style} layout={layout}/></span>
     <span className="resource-template-label"><span>{widgetStyleNames[template.style]}</span>{isDefault&&<em className="resource-template-default">默认</em>}{isCurrent&&!isDefault&&<em className="resource-template-current">当前</em>}</span>
    </button>;
   })}</div>
  </div>)}
 </section>;
}
