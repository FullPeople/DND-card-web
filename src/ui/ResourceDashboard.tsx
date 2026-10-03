import {useState,useEffect,useRef,useMemo} from 'react';
import {confirmResourceDraftDiscard,useResourceDraftGuard} from './resourceDraftGuard';
import type {Character,Derived,Entry} from '../core/model';
import {sameValue} from '../core/merge';
import {createDashboardDraft,commitDashboardDraft} from '../core/dashboardDraft';
import {addResourceModule,freeDashboardLayout,dashboardOverlaps,resourceModules,resourceCanvasRows,WIDGET_ICONS,canonicalWidgetStyle,resourceModuleMinimum,normalizeModuleWidget,type ResourceTemplate,type ResourceWidgetLayout,type ResourceTemplateValues} from '../core/resourceWidgets';
import {Quickbar} from './Quickbar';
import {attackWidgetKey,ResourceWidgets} from './ResourceWidgets';
import {QuickbarManager} from './QuickbarManager';
import {ResourceTemplatePicker} from './ResourceTemplatePicker';
import {ResourceModuleEditor} from './ResourceModuleEditor';
import {ResourceDashboardIcon} from './ResourceModuleFace';
import {useResourceTemplateDrag} from './useResourceTemplateDrag';
import './resourceDashboard.css';
export type DashboardViewport={page:number;width?:number;height?:number};
const colors=['#527880','#8a7652','#727aa0','#558977','#a36d61','#686f61','#80505b','#454a58'];
const iconNames={spark:'星芒',diamond:'菱形',shield:'盾牌',flame:'火焰',leaf:'叶片',bottle:'药瓶'};
export function ResourceDashboard({c:live,d,edit,inspect,disabled:externalDisabled,gm,viewport,resourcesOnly=false,initialResourceId='',onSave}:{c:Character;d:Derived;edit:(f:(c:Character)=>void)=>void;inspect:(entry:Entry)=>void;disabled:boolean;gm:boolean;viewport:DashboardViewport;resourcesOnly?:boolean;initialResourceId?:string;onSave?:(base:Character,draft:Character)=>Promise<Character>}){
 const [initial]=useState(()=>({base:live,draft:createDashboardDraft(live)}));
 const host=useRef<HTMLElement>(null),base=useRef(initial.base),pristine=useRef(initial.draft);
 const [dirty,setDirty]=useState(false),[settingsTarget,setSettingsTarget]=useState<HTMLDivElement|null>(null);
 const [c,setDraft]=useState(pristine.current),draftRef=useRef(c);
 const [saving,setSaving]=useState(false),savingRef=useRef(false),disabled=externalDisabled||saving;
 const initialModule=resourceModules(resourceCanvasRows(c),c.quickbarLayout?.widgets,c.selections).find(m=>m.rows.some(([id])=>id===initialResourceId))?.id||'';
 const [tone,setTone]=useState(''),[selected,setSelected]=useState(initialModule),[page,setPage]=useState(viewport.page),[config,setConfig]=useState(initialModule),[message,setMessage]=useState(''),[interacting,setInteracting]=useState(false),[canvasEpoch,setCanvasEpoch]=useState(0);
 useResourceDraftGuard('dashboard',dirty||!!tone,saving);
 const attackId=attackWidgetKey(c);
 const modules=useMemo(()=>resourceModules(resourceCanvasRows(c),c.quickbarLayout?.widgets,c.selections),[c]),layout=useMemo(()=>freeDashboardLayout(modules,c.quickbarLayout?.widgets,c.quickbarLayout?.attacks),[modules,c.quickbarLayout]),module=modules.find(m=>m.id===selected),selectedLayout=layout.widgets[selected],overlap=dashboardOverlaps(layout);
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
 function choose(id:string){if(id!==selected&&(!confirmResourceDraftDiscard('resource-form')||!selected&&!confirmResourceDraftDiscard('new-module')))return false;setSelected(id);setConfig(id);return true;}
 function patch(value:Partial<ResourceWidgetLayout>){if(disabled||!selectedLayout)return;change(draft=>{const l=draft.quickbarLayout||={order:[],hidden:[]};l.widgets={...l.widgets,[selected]:module?normalizeModuleWidget(module,{...selectedLayout,...value}):{...selectedLayout,...value}};});}
 function inserted(created:{id:string;page:number}){
  setSelected(created.id);setPage(created.page);setMessage('');
  requestAnimationFrame(()=>host.current?.dispatchEvent(new CustomEvent('resource-widget-created',{bubbles:true,detail:{...created,cardId:c.id,draft:true}})));
 }
 function add(template:ResourceTemplate,values?:ResourceTemplateValues,placement?:{x:number;y:number;page:number}){
  if(disabled)return;
  try{let created:{id:string;page:number}|undefined;change(draft=>{created=addResourceModule(draft,template,placement?.page??page,()=>crypto.randomUUID(),undefined,placement,values);});if(created)inserted(created);}
  catch(error){setMessage(error instanceof Error?error.message:String(error));}
 }
 async function save(){
  if(savingRef.current||disabled||overlap.count||interacting||templateDrag.dragging||!dirty)return;
  savingRef.current=true;setSaving(true);setMessage('');
  try{
   let committed:Character|undefined;
   if(onSave)committed=await onSave(base.current,draftRef.current);else edit(current=>{committed=commitDashboardDraft(current,base.current,draftRef.current,{gm});Object.assign(current,committed);});
   if(!committed)throw Error('当前无法保存，请检查角色权限和同步状态');
   base.current=structuredClone(committed);pristine.current=createDashboardDraft(committed);draftRef.current=pristine.current;setDraft(pristine.current);setDirty(false);setMessage('已保存布局');
  }catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{savingRef.current=false;setSaving(false);}
 }
 function discard(){
  if(!confirmResourceDraftDiscard())return;
  base.current=structuredClone(live);pristine.current=createDashboardDraft(live);draftRef.current=pristine.current;setDraft(pristine.current);setDirty(false);setSelected('');setTone('');setPage(viewport.page);setConfig('');setMessage('已放弃未保存的修改');setCanvasEpoch(n=>n+1);
 }
 return <section ref={host} className="resource-dashboard" aria-label="仪表盘编辑器" data-dirty={dirty} data-overlap-count={overlap.count}>
  <div className="dashboard-stage">
   <div className="dashboard-preview" style={{height:Math.max(210,viewport.height||153)}}>
    {resourcesOnly?<div className="resource-diy-quickbar"><ResourceWidgets key={canvasEpoch} c={preview} rows={resourceCanvasRows(preview)} editing enabled={!disabled} gm={gm} edit={change} manage={()=>{}} layoutEditor selectedId={selected} initialPage={viewport.page} onSelect={choose} onPage={setPage} configure={choose} onInteracting={setInteracting}/></div>:<Quickbar key={canvasEpoch} c={preview} d={d} edit={change} inspect={inspect} manage={()=>{}} manageQuickbar={()=>choose(attackId)} disabled={disabled} dashboard={{layoutEditor:true,selectedId:selected,initialPage:viewport.page,onSelect:choose,onPage:setPage,configure:choose,onInteracting:setInteracting}}/>}
   </div>
   <div className="dashboard-tools">
    <div className="dashboard-palette"><strong>{selected===attackId?'武器与攻击':module?.name||'选择一个模块'}</strong><div className="dashboard-swatches" aria-label="图标颜色" data-active={!!module}>{colors.map(color=><button key={color} type="button" aria-label={'色调 '+color} aria-pressed={selectedLayout?.color===color} disabled={!module||disabled} style={{backgroundColor:color}} onClick={()=>{setTone('');patch({color});}}/>)}<input type="color" aria-label="自选图标颜色" disabled={!module||disabled} value={tone||selectedLayout?.color||colors[0]} onChange={e=>setTone(e.target.value)} onBlur={()=>{if(tone){patch({color:tone});setTone('');}}}/></div><button type="button" disabled={!module||disabled} onClick={()=>{if(!module||!confirmResourceDraftDiscard('resource-form'))return;change(draft=>{const l=draft.quickbarLayout||={order:[],hidden:[]};l.hidden=[...new Set([...l.hidden,...module.rows.map(([id])=>`resource:${id}`)])];});setSelected('');setConfig('');}} title="从快捷栏移除，资源数值保留，可从模块库恢复">删除模块</button></div>
    <div className="dashboard-icons" aria-label="模块图标" data-active={!!iconStyle}>{WIDGET_ICONS.map(icon=><button key={icon} type="button" title={iconNames[icon]} aria-label={'图标 '+iconNames[icon]} aria-pressed={selectedLayout?.icon===icon} disabled={!iconStyle||disabled} onClick={()=>patch({icon})}><ResourceDashboardIcon icon={icon}/></button>)}<label className="dashboard-content-scale">内部缩放<input type="range" aria-label="模块内部缩放" min="0.25" max="2" step="0.05" value={selectedLayout?.contentScale??1} disabled={!module||disabled} onChange={e=>patch({contentScale:Number(e.target.value)})}/><output>{Math.round((selectedLayout?.contentScale??1)*100)}%</output></label></div>
    <fieldset className="dashboard-appearance" disabled={!module||disabled} aria-label="模块外观与尺寸">
     <label>背景<input type="color" aria-label="模块背景色" value={selectedLayout?.background&&selectedLayout.background!=='transparent'?selectedLayout.background:'#ededed'} onChange={e=>patch({background:e.target.value})}/></label><button type="button" aria-pressed={!selectedLayout?.background||selectedLayout.background==='transparent'} onClick={()=>patch({background:'transparent'})}>透明背景</button>
     <label>描边<input type="number" aria-label="模块描边粗细" min="0" max="8" value={selectedLayout?.borderWidth??0} onChange={e=>{if(e.target.value!=='')patch({borderWidth:Number(e.target.value)});}}/></label>
     <label>圆角<input type="number" aria-label="模块圆角" min="0" max="32" value={selectedLayout?.borderRadius??0} onChange={e=>{if(e.target.value!=='')patch({borderRadius:Number(e.target.value)});}}/></label>
     <label>内边距<input type="number" aria-label="模块内边距" min="0" max="16" value={selectedLayout?.padding??0} onChange={e=>{if(e.target.value!=='')patch({padding:Number(e.target.value)});}}/></label>
     <label>间距<input type="number" aria-label="模块内容间距" min="0" max="16" value={selectedLayout?.gap??0} onChange={e=>{if(e.target.value!=='')patch({gap:Number(e.target.value)});}}/></label>
     <label>宽<input type="number" aria-label="模块占位宽度" min="1" max="12" value={selectedLayout?.w??1} onChange={e=>{if(e.target.value!=='')patch({w:Number(e.target.value)});}}/></label>
     <label>高<input type="number" aria-label="模块占位高度" min="1" max="6" value={selectedLayout?.h??1} onChange={e=>{if(e.target.value!=='')patch({h:Number(e.target.value)});}}/></label>
     <button type="button" onClick={()=>{if(module&&selectedLayout)patch(resourceModuleMinimum(module,selectedLayout.style,selectedLayout.contentScale));}}>紧凑尺寸</button>
    </fieldset>
   </div>
   <div className="dashboard-savebar">
    <span role="status" className={overlap.count?'dashboard-conflict':''} title={overlap.count?'模块重叠，请移开红框后保存':message||undefined}>{overlap.count?'模块重叠，请移开红框后保存':message|| (saving?'正在保存…':dirty?'尚未保存 · 关闭前会确认':'拖入模块，自由排版后保存')}</span>
    <button type="button" disabled={saving||!dirty&&!tone||interacting||templateDrag.dragging} onClick={discard}>放弃修改</button>
    <button type="button" className="primary" disabled={disabled||!dirty||!!overlap.count||interacting||templateDrag.dragging} onClick={()=>void save()}>保存布局</button>
   </div>
  </div>
  <aside className="dashboard-library"><div className="dashboard-library-heading"><strong>模块库</strong><button type="button" disabled={disabled} onClick={()=>choose('')}>新模块</button></div><ResourceTemplatePicker key={canvasEpoch} settingsTarget={settingsTarget} activeModule={module} drag={templateDrag.begin} hidden={c.quickbarLayout?.hidden.filter(id=>id.startsWith('resource:')).length||0} restore={()=>change(draft=>{if(draft.quickbarLayout)draft.quickbarLayout.hidden=draft.quickbarLayout.hidden.filter(id=>!id.startsWith('resource:'));})} disabled={disabled} choose={(template,values)=>{if(module)patch({style:template.style});else add(template,values);}}/></aside>
  <section className="dashboard-configuration"><header><strong>{config===attackId?'整理武器与攻击':module?'模块设置':'新模块设置'}</strong></header>
   {config===attackId?<QuickbarManager c={c} edit={change}/>:module?<ResourceModuleEditor key={module.id} c={c} id={module.id} edit={change} close={()=>{}} disabled={disabled} gm={gm}/>:null}
   <div ref={setSettingsTarget} hidden={!!module||config===attackId}/>
  </section>
  {templateDrag.ghost}
 </section>;
}
