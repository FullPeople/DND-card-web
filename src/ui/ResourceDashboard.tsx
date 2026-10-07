import {useState,useEffect,useRef,useMemo} from 'react';
import {confirmResourceDraftDiscard,useResourceDraftGuard} from './resourceDraftGuard';
import type {Character,Derived,Entry} from '../core/model';
import {sameValue} from '../core/merge';
import {createDashboardDraft,commitDashboardDraft} from '../core/dashboardDraft';
import {addResourceModule,freeDashboardLayout,dashboardOverlaps,resourceModules,resourceCanvasRows,WIDGET_ICONS,WIDGET_COLS,WIDGET_ROWS,isIconWidgetStyle,widgetStyleNames,resourceModuleMinimum,normalizeModuleWidget,type ResourceTemplate,type ResourceWidgetLayout,type ResourceTemplateValues} from '../core/resourceWidgets';
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
/** A compact −/+ stepper around a real number input, so keyboard entry and tests keep working. */
function Stepper({label,value,min,max,disabled,onChange}:{label:string;value:number;min:number;max:number;disabled:boolean;onChange:(value:number)=>void}){
 return <span className="dashboard-stepper"><button type="button" aria-label={`减少${label}`} disabled={disabled||value<=min} onClick={()=>onChange(value-1)}>−</button><input type="number" aria-label={label} min={min} max={max} value={value} disabled={disabled} onChange={e=>{if(e.target.value!=='')onChange(Number(e.target.value));}}/><button type="button" aria-label={`增加${label}`} disabled={disabled||value>=max} onClick={()=>onChange(value+1)}>+</button></span>;
}
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
 const iconStyle=!!selectedLayout&&isIconWidgetStyle(selectedLayout.style);
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
 function remove(){
  if(!module||!confirmResourceDraftDiscard('resource-form'))return;
  change(draft=>{const l=draft.quickbarLayout||={order:[],hidden:[]};l.hidden=[...new Set([...l.hidden,...module.rows.map(([id])=>`resource:${id}`)])];});setSelected('');setConfig('');
 }
 const kind=module?.slots?'法术位':module&&module.rows.length>1?'多模块':module?'模块':'';
 const frameValue=(key:'borderWidth'|'borderRadius'|'padding'|'gap',fallback:number)=>selectedLayout?.[key]??fallback;
 const numberInput=(label:string,key:'borderWidth'|'borderRadius'|'padding'|'gap',max:number,fallback:number)=><label className="dashboard-field"><span>{label}</span><input type="number" aria-label={`模块${label==='描边'?'描边粗细':label==='间距'?'内容间距':label}`} min="0" max={max} value={frameValue(key,fallback)} onChange={e=>{if(e.target.value!=='')patch({[key]:Number(e.target.value)});}}/><small>px</small></label>;
 return <section ref={host} className="resource-dashboard" aria-label="仪表盘编辑器" data-dirty={dirty} data-overlap-count={overlap.count}>
  <div className="dashboard-stage">
   <div className="dashboard-preview" style={{height:Math.max(210,viewport.height||153)}}>
    {resourcesOnly?<div className="resource-diy-quickbar"><ResourceWidgets key={canvasEpoch} c={preview} rows={resourceCanvasRows(preview)} editing enabled={!disabled} gm={gm} edit={change} manage={()=>{}} layoutEditor selectedId={selected} initialPage={viewport.page} onSelect={choose} onPage={setPage} configure={choose} onInteracting={setInteracting}/></div>:<Quickbar key={canvasEpoch} c={preview} d={d} edit={change} inspect={inspect} manage={()=>{}} manageQuickbar={()=>choose(attackId)} disabled={disabled} dashboard={{layoutEditor:true,selectedId:selected,initialPage:viewport.page,onSelect:choose,onPage:setPage,configure:choose,onInteracting:setInteracting}}/>}
   </div>
   <div className="dashboard-savebar">
    <span role="status" className={overlap.count?'dashboard-conflict':''} title={overlap.count?'模块重叠，请移开红框后保存':message||undefined}>{overlap.count?'模块重叠，请移开红框后保存':message|| (saving?'正在保存…':dirty?'尚未保存 · 关闭前会确认':'拖入模块，自由排版后保存')}</span>
    <button type="button" disabled={saving||!dirty&&!tone||interacting||templateDrag.dragging} onClick={discard}>放弃修改</button>
    <button type="button" className="primary" disabled={disabled||!dirty||!!overlap.count||interacting||templateDrag.dragging} onClick={()=>void save()}>保存布局</button>
   </div>
  </div>
  <section className="dashboard-configuration" data-mode={config===attackId?'attacks':module?'module':'new'}>
   <header><strong>{config===attackId?'整理武器与攻击':module?module.name:'新模块'}</strong>{kind&&<span className="dashboard-kind">{kind}{selectedLayout&&` · ${widgetStyleNames[selectedLayout.style]}`}</span>}{module&&<button type="button" className="dashboard-remove" disabled={disabled} onClick={remove} title="从快捷栏移除，资源数值保留，可从模块库恢复">删除模块</button>}</header>
   {config===attackId?<QuickbarManager c={c} edit={change}/>:module?<div className="dashboard-props">
    <div className="dashboard-prop"><span className="dashboard-prop-label">色调</span><div className="dashboard-palette"><div className="dashboard-swatches" aria-label="图标颜色" data-active={!!module}>{colors.map(color=><button key={color} type="button" aria-label={'色调 '+color} aria-pressed={selectedLayout?.color===color} disabled={disabled} style={{backgroundColor:color}} onClick={()=>{setTone('');patch({color});}}/>)}<label className="dashboard-custom-color" title="自选图标颜色"><input type="color" aria-label="自选图标颜色" disabled={disabled} value={tone||selectedLayout?.color||colors[0]} onChange={e=>setTone(e.target.value)} onBlur={()=>{if(tone){patch({color:tone});setTone('');}}}/></label></div></div></div>
    <div className="dashboard-prop" data-active={iconStyle}><span className="dashboard-prop-label">图标</span><div className="dashboard-icons" aria-label="模块图标" data-active={iconStyle}>{WIDGET_ICONS.map(icon=><button key={icon} type="button" title={iconNames[icon]} aria-label={'图标 '+iconNames[icon]} aria-pressed={selectedLayout?.icon===icon} disabled={!iconStyle||disabled} onClick={()=>patch({icon})}><ResourceDashboardIcon icon={icon}/></button>)}{!iconStyle&&<small>当前样式不使用图标</small>}</div></div>
    <div className="dashboard-prop"><span className="dashboard-prop-label">占位</span><div className="dashboard-size"><Stepper label="模块占位宽度" value={selectedLayout?.w??1} min={1} max={WIDGET_COLS} disabled={disabled} onChange={w=>patch({w})}/><span className="dashboard-size-times">×</span><Stepper label="模块占位高度" value={selectedLayout?.h??1} min={1} max={WIDGET_ROWS} disabled={disabled} onChange={h=>patch({h})}/><button type="button" className="dashboard-compact" disabled={disabled} onClick={()=>{if(module&&selectedLayout)patch(resourceModuleMinimum(module,selectedLayout.style,selectedLayout.contentScale));}}>紧凑尺寸</button></div></div>
    <div className="dashboard-prop"><span className="dashboard-prop-label">内部缩放</span><label className="dashboard-content-scale"><input type="range" aria-label="模块内部缩放" min="0.25" max="2" step="0.05" value={selectedLayout?.contentScale??1} disabled={disabled} onChange={e=>patch({contentScale:Number(e.target.value)})}/><output>{Math.round((selectedLayout?.contentScale??1)*100)}%</output></label></div>
    <div className="dashboard-prop dashboard-prop-appearance"><span className="dashboard-prop-label">外观</span>
     <fieldset className="dashboard-appearance" disabled={disabled} aria-label="模块外观与尺寸">
      <div className="dashboard-field dashboard-field-background"><span>背景</span><label className="dashboard-custom-color" title="模块背景色"><input type="color" aria-label="模块背景色" value={selectedLayout?.background&&selectedLayout.background!=='transparent'?selectedLayout.background:'#f2f2f0'} onChange={e=>patch({background:e.target.value})}/></label><button type="button" aria-pressed={selectedLayout?.background==='transparent'} onClick={()=>patch({background:'transparent'})}>透明背景</button></div>
      {numberInput('描边','borderWidth',8,1)}{numberInput('圆角','borderRadius',32,2)}{numberInput('内边距','padding',16,2)}{numberInput('间距','gap',16,0)}
     </fieldset>
    </div>
    <div className="dashboard-values"><ResourceModuleEditor key={module.id} c={c} id={module.id} edit={change} close={()=>{}} disabled={disabled} gm={gm}/></div>
   </div>:null}
   <div ref={setSettingsTarget} hidden={!!module||config===attackId}/>
  </section>
  <aside className="dashboard-library"><div className="dashboard-library-heading"><strong>{module?'更换样式':'模块库'}</strong>{module?<small>点选即应用到「{module.name}」</small>:null}<button type="button" disabled={disabled} onClick={()=>choose('')}>新模块</button></div><ResourceTemplatePicker key={canvasEpoch} settingsTarget={settingsTarget} activeModule={module} activeStyle={selectedLayout?.style} drag={templateDrag.begin} hidden={c.quickbarLayout?.hidden.filter(id=>id.startsWith('resource:')).length||0} restore={()=>change(draft=>{if(draft.quickbarLayout)draft.quickbarLayout.hidden=draft.quickbarLayout.hidden.filter(id=>!id.startsWith('resource:'));})} disabled={disabled} choose={(template,values)=>{if(module)patch({style:template.style});else add(template,values);}}/></aside>
  {templateDrag.ghost}
 </section>;
}
