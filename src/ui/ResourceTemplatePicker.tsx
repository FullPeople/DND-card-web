import type {PointerEvent} from 'react';
import {RESOURCE_TEMPLATES, normalizeWidget, type ResourceTemplate, type ResourceModule} from '../core/resourceWidgets';
import {ResourceModuleFace} from './ResourceModuleFace';
import './resourceTemplates.css';

const colors=['#527880','#8a7652','#727aa0','#558977','#a36d61','#686f61'];
const grouped=new Set(['pool','poolchips','poolbars','poolpips']);

/** The gallery and the drag preview show the same example, at their actual display size. */
export function resourceTemplatePreview(template:ResourceTemplate){
 const group=grouped.has(template.id),isReady=template.id==='ready',index=RESOURCE_TEMPLATES.findIndex(item=>item.id===template.id);
 const module:ResourceModule={id:'preview',name:'动作如潮',slots:group,rows:group?[['spell-slot:1',{name:'动作如潮',current:4,max:4}],['spell-slot:2',{name:'动作如潮',current:3,max:3}],['spell-slot:3',{name:'动作如潮',current:2,max:2}]]:[['preview',{name:'动作如潮',current:isReady?1:template.id==='counter'?1874.6:template.id==='matrix'?4:3,max:isReady?1:template.id==='counter'?2000:template.id==='matrix'?6:5}]]};
 return {module,layout:normalizeWidget({style:template.style,w:template.w,h:template.h,color:colors[Math.max(0,index)%colors.length],icon:isReady?'shield':'spark'})};
}

export function ResourceTemplatePicker({choose,disabled=false,hidden=0,restore,drag}:{hidden?:number;restore?:()=>void;choose:(template:ResourceTemplate)=>void;disabled?:boolean;drag?:(event:PointerEvent<HTMLButtonElement>,template:ResourceTemplate)=>void}) {
 return <section className="resource-template-library" aria-label="资源模块样式库">
  {hidden>0&&<button type="button" className="resource-template-restore" disabled={disabled} onClick={restore}>显示已隐藏的 {hidden} 项资源</button>}
  <div className="resource-template-grid">{RESOURCE_TEMPLATES.map((template,index)=>{
   const {module,layout}=resourceTemplatePreview(template);
   return <button type="button" className="resource-template-option" key={template.id} data-template-id={template.id} data-drag-enabled={!!drag} disabled={disabled} onPointerDown={e=>drag?.(e,template)} onDragStart={e=>e.preventDefault()} onClick={e=>{if(!e.defaultPrevented)choose(template);}} aria-label={`添加动作如潮模块，样式 ${index+1}`}>
    <span className={`resource-template-preview template-${template.id}`}><ResourceModuleFace module={module} style={template.style} layout={layout}/></span><span className="resource-template-add" aria-hidden="true">+</span>
   </button>;
  })}</div>
 </section>;
}
