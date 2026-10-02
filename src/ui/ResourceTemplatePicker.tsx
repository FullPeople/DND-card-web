import {useState,type PointerEvent,type CSSProperties} from 'react';
import {RESOURCE_TEMPLATES, normalizeWidget,chooseDefaultWidgetStyle,suitableWidgetStyle,widgetStyleNames, type ResourceTemplate, type ResourceModule,type ResourceTemplateValues} from '../core/resourceWidgets';
import {ResourceModuleFace} from './ResourceModuleFace';
import './resourceTemplates.css';

const grouped=new Set(['pool','poolchips','poolbars','poolpips']);

/** The gallery and the drag preview show the same example, at their actual display size. */
export function resourceTemplatePreview(template:ResourceTemplate,values?:ResourceTemplateValues){
 const group=grouped.has(template.id),isReady=template.id==='ready';
 const module:ResourceModule={id:'preview',name:'动作如潮',slots:group,rows:group?[['spell-slot:1',{name:'动作如潮',current:4,max:4}],['spell-slot:2',{name:'动作如潮',current:3,max:3}],['spell-slot:3',{name:'动作如潮',current:2,max:2}]]:[['preview',{name:'动作如潮',current:isReady?1:template.id==='counter'?1874.6:template.id==='matrix'?4:3,max:isReady?1:template.id==='counter'?2000:template.id==='matrix'?6:5}]]};
 if(values){module.slots=false;module.name=values.name.trim()||'新资源';module.rows=Array.from({length:group?Math.max(2,Math.min(12,values.count||3)):1},(_,i)=>[`preview-${i}`,{name:group?`${module.name} ${i+1}`:module.name,current:values.current,max:values.max,unlimited:values.unlimited}]);}
 return {module,layout:normalizeWidget({style:template.style,w:template.w,h:template.h,color:'#527880',icon:isReady?'shield':'spark'})};
}

export function ResourceTemplatePicker({choose,disabled=false,hidden=0,restore,drag}:{hidden?:number;restore?:()=>void;choose:(template:ResourceTemplate,values:ResourceTemplateValues)=>void;disabled?:boolean;drag?:(event:PointerEvent<HTMLButtonElement>,template:ResourceTemplate,values:ResourceTemplateValues)=>void}) {
 const [name,setName]=useState('新资源'),[current,setCurrent]=useState('3'),[max,setMax]=useState('3'),[unlimited,setUnlimited]=useState(false),[count,setCount]=useState('3');
 const values={name,current:Number(current),max:Number(max),unlimited,count:Number(count)},valid=!!name.trim()&&current!==''&&Number.isInteger(values.current)&&values.current>=0&&values.current<=999999999&&Number.isInteger(values.max)&&values.max>=0&&values.max<=99999&&(unlimited||max!==''&&values.current<=values.max)&&Number.isInteger(values.count)&&values.count>=2&&values.count<=12;
 const suggested=RESOURCE_TEMPLATES.find(t=>t.id===chooseDefaultWidgetStyle(values))!;
 return <section className="resource-template-library" aria-label="资源模块样式库">
  <fieldset className="resource-template-values" disabled={disabled}><legend>新模块预览</legend><label className="resource-template-name">名称<input aria-label="新模块名称" maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>当前值<input aria-label="新模块当前值" type="number" min="0" max="999999999" value={current} onChange={e=>setCurrent(e.target.value)}/></label><label className="resource-template-limit"><span><input aria-label="新模块有上限" type="checkbox" checked={!unlimited} onChange={e=>setUnlimited(!e.target.checked)}/>上限</span><input aria-label="新模块上限" type="number" min="0" max="99999" disabled={unlimited} value={max} onChange={e=>{if(current===max)setCurrent(e.target.value);setMax(e.target.value);}}/></label><small role="status">{valid?'点击样式添加，或拖入上方快捷栏':'请填写名称及有效的当前值和上限'}</small></fieldset>
  <div className="resource-template-matching"><button type="button" disabled={disabled||!valid} onClick={()=>choose(suggested,values)}>自动匹配 · {widgetStyleNames[suggested.style]}</button><label>多项资源数量<input aria-label="子资源数量" type="number" min="2" max="12" value={count} onChange={e=>setCount(e.target.value)}/></label></div>
  {hidden>0&&<button type="button" className="resource-template-restore" disabled={disabled} onClick={restore}>显示已隐藏的 {hidden} 项资源</button>}
  <div className="resource-template-grid">{RESOURCE_TEMPLATES.map((template,index)=>{
   const {module,layout}=resourceTemplatePreview(template,{...values,current:Number.isFinite(values.current)?Math.max(0,values.current):0,max:Number.isFinite(values.max)?Math.max(0,values.max):0});
   const supported=suitableWidgetStyle(template.style,module.rows)===template.style;
   return <button type="button" className="resource-template-option" key={template.id} data-template-id={template.id} data-multi={template.multi} data-dense={module.rows.length>3} style={{'--preview-pool-rows':Math.ceil(module.rows.length/3)} as CSSProperties} data-supported={supported} data-recommended={template.id===suggested.id} data-drag-enabled={!!drag} disabled={disabled||!valid||!supported} onPointerDown={e=>{if(supported&&valid)drag?.(e,template,values);}} onDragStart={e=>e.preventDefault()} onClick={e=>{if(!e.defaultPrevented)choose(template,values);}} aria-label={`添加${module.name}模块，样式 ${index+1}`}>
    <span className={`resource-template-preview template-${template.id}`}><ResourceModuleFace module={module} style={template.style} layout={layout}/></span><span className="resource-template-add" aria-hidden="true">+</span>
   </button>;
  })}</div>
 </section>;
}
