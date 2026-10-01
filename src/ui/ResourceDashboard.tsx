import {useState,useEffect,useRef,useMemo} from 'react';
import type {Character,Derived,Entry} from '../core/model';
import {sameValue} from '../core/merge';
import {createDashboardDraft,commitDashboardDraft} from '../core/dashboardDraft';
import {addResourceModule,ensureResourceWidget,freeDashboardLayout,dashboardOverlaps,resourceModules,resourceCanvasRows,WIDGET_ICONS,canonicalWidgetStyle,type ResourceTemplate,type ResourceWidgetLayout,type ResourceTemplateValues} from '../core/resourceWidgets';
import {Quickbar} from './Quickbar';
import {attackWidgetKey} from './ResourceWidgets';
import {QuickbarManager} from './QuickbarManager';
import {ResourceTemplatePicker} from './ResourceTemplatePicker';
import {ResourceModuleEditor} from './ResourceModuleEditor';
import {ResourceEditor} from './ResourceEditor';
import {ResourceDashboardIcon} from './ResourceModuleFace';
import {useResourceTemplateDrag} from './useResourceTemplateDrag';
import './resourceDashboard.css';
export type DashboardViewport={page:number;width?:number;height?:number};
const colors=['#527880','#8a7652','#727aa0','#558977','#a36d61','#686f61','#80505b','#454a58'];
const iconNames={spark:'星芒',diamond:'菱形',shield:'盾牌',flame:'火焰',leaf:'叶片',bottle:'药瓶'};
export function ResourceDashboard({c:live,d,edit,inspect,disabled,gm,viewport}:{c:Character;d:Derived;edit:(f:(c:Character)=>void)=>void;inspect:(entry:Entry)=>void;disabled:boolean;gm:boolean;viewport:DashboardViewport}){
 const [initial]=useState(()=>({base:structuredClone(live),draft:createDashboardDraft(live)}));
 const host=useRef<HTMLElement>(null),base=useRef(initial.base),pristine=useRef(initial.draft);
 const [dirty,setDirty]=useState(false);
 const [c,setDraft]=useState(pristine.current),draftRef=useRef(c);
 const [tone,setTone]=useState(''),[selected,setSelected]=useState(''),[page,setPage]=useState(viewport.page),[config,setConfig]=useState(''),[message,setMessage]=useState(''),[interacting,setInteracting]=useState(false),[canvasEpoch,setCanvasEpoch]=useState(0);
 const attackId=attackWidgetKey(c);
 let newResourceKey='__new__';while(Object.hasOwn(c.runtime.resources,newResourceKey))newResourceKey='_'+newResourceKey;
 const modules=useMemo(()=>resourceModules(resourceCanvasRows(c),c.quickbarLayout?.widgets),[c]),layout=useMemo(()=>freeDashboardLayout(modules,c.quickbarLayout?.widgets,c.quickbarLayout?.attacks),[modules,c.quickbarLayout]),module=modules.find(m=>m.id===selected),selectedLayout=layout.widgets[selected],overlap=dashboardOverlaps(layout);
 const preview=tone&&selectedLayout?{...c,quickbarLayout:{...c.quickbarLayout!,widgets:{...c.quickbarLayout?.widgets,[selected]:{...selectedLayout,color:tone}}}}:c;
 const iconStyle=selectedLayout&&['pips','matrix','ready','poolpips'].includes(canonicalWidgetStyle(selectedLayout.style));
 const templateDrag=useResourceTemplateDrag({host,page,disabled,drop:(template,placement,values)=>add(template,values,placement)});
 useEffect(()=>setTone(''),[selected]);
 // A clean editor follows incoming data. A dirty draft is merged at explicit save.
 useEffect(()=>{if(!dirty&&!sameValue(base.current,live)){base.current=structuredClone(live);pristine.current=createDashboardDraft(live);draftRef.current=pristine.current;setDraft(pristine.current);}},[live,dirty]);
 function change(update:(draft:Character)=>void){
  if(disabled)throw Error('当前角色不可编辑');
  const next=structuredClone(draftRef.current);update(next);draftRef.current=next;setDraft(next);setDirty(!sameValue(next,pristine.current));setMessage('');
 }
 function patch(value:Partial<ResourceWidgetLayout>){if(disabled||!selectedLayout)return;change(draft=>{const l=draft.quickbarLayout||={order:[],hidden:[]};l.widgets={...l.widgets,[selected]:{...selectedLayout,...value}};});}
 function inserted(created:{id:string;page:number}){
  setSelected(created.id);setPage(created.page);setMessage('');
  requestAnimationFrame(()=>host.current?.dispatchEvent(new CustomEvent('resource-widget-created',{bubbles:true,detail:{...created,cardId:c.id,draft:true}})));
 }
 function add(template:ResourceTemplate,values?:ResourceTemplateValues,placement?:{x:number;y:number;page:number}){
  if(disabled)return;
  try{let created:{id:string;page:number}|undefined;change(draft=>{created=addResourceModule(draft,template,placement?.page??page,()=>crypto.randomUUID(),undefined,placement,values);});if(created)inserted(created);}
  catch(error){setMessage(error instanceof Error?error.message:String(error));}
 }
 function save(){
  if(disabled||overlap.count||interacting||templateDrag.dragging||!dirty)return;
  try{
   let committed:Character|undefined;
   edit(current=>{committed=commitDashboardDraft(current,base.current,draftRef.current,{gm});Object.assign(current,committed);});
   if(!committed)throw Error('当前无法保存，请检查角色权限和同步状态');
   base.current=structuredClone(committed);pristine.current=createDashboardDraft(committed);draftRef.current=pristine.current;setDraft(pristine.current);setDirty(false);setMessage('已保存布局');
  }catch(error){setMessage(error instanceof Error?error.message:String(error));}
 }
 function discard(){
  base.current=structuredClone(live);pristine.current=createDashboardDraft(live);draftRef.current=pristine.current;setDraft(pristine.current);setDirty(false);setSelected('');setTone('');setPage(viewport.page);setConfig('');setMessage('已放弃未保存的修改');setCanvasEpoch(n=>n+1);
 }
 return <section ref={host} className="resource-dashboard" aria-label="仪表盘编辑器" data-dirty={dirty} data-overlap-count={overlap.count}>
  <div className="dashboard-stage">
   <div className="dashboard-preview" style={{width:viewport.width?viewport.width+4:422,height:viewport.height?viewport.height+23:153}}>
    <Quickbar key={canvasEpoch} c={preview} d={d} edit={change} inspect={inspect} manage={()=>{}} manageQuickbar={()=>setConfig(attackId)} disabled={disabled} dashboard={{layoutEditor:true,initialPage:viewport.page,onSelect:setSelected,onPage:setPage,configure:setConfig,onInteracting:setInteracting}}/>
   </div>
   <div className="dashboard-tools">
    <div className="dashboard-palette"><strong>{selected===attackId?'武器与攻击':module?.name||'选择一个模块'}</strong><div className="dashboard-swatches" aria-label="图标颜色" data-active={!!module}>{colors.map(color=><button key={color} type="button" aria-label={'色调 '+color} aria-pressed={selectedLayout?.color===color} disabled={!module||disabled} style={{backgroundColor:color}} onClick={()=>{setTone('');patch({color});}}/>)}<input type="color" aria-label="自选图标颜色" disabled={!module||disabled} value={tone||selectedLayout?.color||colors[0]} onChange={e=>setTone(e.target.value)} onBlur={()=>{if(tone){patch({color:tone});setTone('');}}}/></div><button type="button" disabled={!selected||disabled} onClick={()=>setConfig(selected)}>设置</button></div>
    <div className="dashboard-icons" aria-label="模块图标" data-active={!!iconStyle}>{WIDGET_ICONS.map(icon=><button key={icon} type="button" title={iconNames[icon]} aria-label={'图标 '+iconNames[icon]} aria-pressed={selectedLayout?.icon===icon} disabled={!iconStyle||disabled} onClick={()=>patch({icon})}><ResourceDashboardIcon icon={icon}/></button>)}<small>{iconStyle?'颜色仅用于图标':'拖动位置 · 八点缩放 · 双击设置'}</small></div>
   </div>
   <div className="dashboard-savebar">
    <span role="status" className={overlap.count?'dashboard-conflict':''} title={overlap.count?'模块重叠，请移开红框后保存':message||undefined}>{overlap.count?'模块重叠，请移开红框后保存':message|| (dirty?'尚未保存 · 关闭会放弃修改':'拖入模块，自由排版后保存')}</span>
    <button type="button" disabled={!dirty&&!tone||interacting||templateDrag.dragging} onClick={discard}>放弃修改</button>
    <button type="button" className="primary" disabled={disabled||!dirty||!!overlap.count||interacting||templateDrag.dragging} onClick={save}>保存布局</button>
   </div>
  </div>
  {config?<section className="dashboard-configuration"><header><strong>{config===newResourceKey?'添加资源':config===attackId?'整理快捷栏':'模块设置'}</strong><button type="button" aria-label="返回模块库" onClick={()=>setConfig('')}>完成</button></header>
   {config===attackId?<QuickbarManager c={c} edit={change}/>:config===newResourceKey?<ResourceEditor inline disabled={disabled} gm={gm} close={()=>setConfig('')} save={async value=>{
    let created:{id:string;page:number}|undefined;
    change(draft=>{const id=crypto.randomUUID();draft.runtime.resources[id]=value;ensureResourceWidget(draft,id);const w=draft.quickbarLayout!.widgets![id];created={id,page:w.page};});
    if(created)inserted(created);
   }}/>:<ResourceModuleEditor key={config} c={c} id={config} edit={change} close={()=>setConfig('')} disabled={disabled} gm={gm}/>}
  </section>:<><div className="dashboard-library-heading"><strong>模块</strong><button type="button" disabled={disabled} onClick={()=>setConfig(newResourceKey)}>默认添加资源</button></div><ResourceTemplatePicker drag={templateDrag.begin} hidden={c.quickbarLayout?.hidden.filter(id=>id.startsWith('resource:')).length||0} restore={()=>change(draft=>{if(draft.quickbarLayout)draft.quickbarLayout.hidden=draft.quickbarLayout.hidden.filter(id=>!id.startsWith('resource:'));})} disabled={disabled} choose={add}/></>}
  {templateDrag.ghost}
 </section>;
}
