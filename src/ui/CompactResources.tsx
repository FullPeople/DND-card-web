import {ResourceDisplayContext} from './resourceDisplay';
import {useCallback,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import type {ResourceValue} from './resourcePresets';
import {freeDashboardLayout,normalizeWidget,normalizeModuleWidget,type WidgetStyle,type ResourceWidgetLayout,type ResourceModule} from '../core/resourceWidgets';
import {ResourceModuleFace,resourceAmount} from './ResourceModuleFace';
import './resourceWidgets.css';
import './compactResources.css';
function ResourceOperation({id,change,children}:{id:string;change:(id:string,value:number)=>void;children:ReactNode}){
 const display=useCallback((value:number)=>change(id,value),[id,change]);
 return <ResourceDisplayContext.Provider value={display}>{children}</ResourceDisplayContext.Provider>;
}
/** The original ResourceRows remain mounted, including grouped pools and hidden pages:
 * closing a detail never discards their pending ACK state. */
export function CompactResource({resource:r,style='bar',layout,module:group,render,children}:{resource:ResourceValue;style?:WidgetStyle;layout?:Partial<ResourceWidgetLayout>;module?:ResourceModule;render?:(row:ResourceValue)=>ReactNode;children?:ReactNode}){
 const panel=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),[opened,setOpened]=useState(false),[shown,setShown]=useState(r.current),[shownRows,setShownRows]=useState<Record<string,number>>({});
 const display=useCallback((id:string,value:number)=>setShownRows(before=>before[id]===value?before:{...before,[id]:value}),[]);
 const requested=layout?.style||style,presentation=group?normalizeModuleWidget(group,layout):normalizeWidget({...layout,style:requested}),shape=!group&&(requested==='bar'||requested==='icon')?requested:presentation.style;
 const module:ResourceModule=group?{...group,rows:group.rows.map(([id,row])=>[id,{...row,current:shownRows[id]??row.current}])}:{id:r.id||'resource',name:r.name||'资源',slots:false,rows:[[r.id||'resource',{...r,current:shown}]]};
 const multiple=module.slots||module.rows.length>1,name=module.name,current=group?module.rows[0][1].current:shown;
 const summary=multiple?module.rows.map(([id,row])=>`${row.name||id}：${resourceAmount(row)}`).join('，'):resourceAmount({...r,current});
 function show(){const node=panel.current,anchor=button.current;if(!node||!anchor)return;if(node.matches(':popover-open')){node.hidePopover();return;}node.showPopover();const rect=anchor.getBoundingClientRect(),width=Math.min(310,innerWidth-24);node.style.width=`${width}px`;node.style.left=`${Math.max(12,Math.min(rect.left,innerWidth-width-12))}px`;node.style.top=`${Math.max(8,Math.min(rect.bottom+5,innerHeight-node.offsetHeight-8))}px`;}
 return <div className={`compact-resource widget-${shape} ${multiple?'compact-resource-group':''}`} data-resource-id={module.id} data-resource-name={name} data-resource-current={current} data-resource-pool={module.slots?'spell':undefined} style={{'--resource-ratio':r.unlimited?1:r.max?Math.max(0,Math.min(1,current/r.max)):0,'--compact-pool-rows':Math.ceil(module.rows.length/3)} as CSSProperties}><button ref={button} className="resource-widget-face" aria-label={`${name}：${summary}，打开资源操作`} title={`${name} · ${summary}`} aria-expanded={opened} onClick={show}><ResourceModuleFace module={module} style={presentation.style} layout={presentation}/></button><div ref={panel} popover="auto" className="compact-resource-popover" role="dialog" aria-label={`${name}资源操作`} onClickCapture={e=>{if(e.target instanceof Element&&e.target.closest('button.resource-configure:not(:disabled)'))panel.current?.hidePopover();}} onToggle={e=>setOpened((e.nativeEvent as ToggleEvent).newState==='open')}><button type="button" className="compact-resource-close" aria-label="关闭资源操作" onClick={()=>{panel.current?.hidePopover();button.current?.focus();}}>×</button>{group&&render?group.rows.map(([id,row])=><ResourceOperation key={id} id={id} change={display}>{render({...row,id})}</ResourceOperation>):<ResourceDisplayContext.Provider value={setShown}>{children}</ResourceDisplayContext.Provider>}</div></div>;
}
export function CompactResourceGrid<T extends {id?:string}>({rows,render,label,span}:{rows:T[];render:(r:T)=>ReactNode;label:string;span?:(r:T)=>number}){
 const [page,setPage]=useState(0),pages=Math.max(1,Math.ceil(rows.length/9)),current=Math.min(page,pages-1);
 return <section className="compact-resources" aria-label={label}><div className="compact-resource-pages">{pages>1&&<nav aria-label={`${label}分页`}><button aria-label="上一页资源" disabled={!current} onClick={()=>setPage(current-1)}>‹</button><output>{current+1} / {pages}</output><button aria-label="下一页资源" disabled={current>=pages-1} onClick={()=>setPage(current+1)}>›</button></nav>}</div><div className="compact-resource-grid">{rows.map((r,index)=><div key={r.id} hidden={Math.floor(index/9)!==current} style={span?{gridColumn:`span ${span(r)}`} :undefined}>{render(r)}</div>)}</div></section>;
}

/** Render the persisted dashboard geometry while keeping every operation row mounted. */
export function CompactResourceCanvas({modules,widgets,attacks,label,render}:{modules:ResourceModule[];widgets?:Record<string,ResourceWidgetLayout>;attacks?:ResourceWidgetLayout;label:string;render:(module:ResourceModule,layout:ResourceWidgetLayout)=>ReactNode}){
 const layout=freeDashboardLayout(modules,widgets,attacks),bands=Math.max(1,...Object.values(layout.widgets).map(w=>w.page+1));
 return <section className="compact-resource-dashboard" aria-label={label}><div className="compact-resource-dashboard-canvas" style={{height:`${bands*210}px`}}>{modules.map(module=>{const w=layout.widgets[module.id];return <div className="compact-resource-dashboard-widget" key={module.id} data-grid-x={w.x} data-grid-y={w.y} data-grid-w={w.w} data-grid-h={w.h} data-grid-page={w.page} style={{left:`${w.x/12*100}%`,top:(w.page*6+w.y)*35,width:`${w.w/12*100}%`,height:w.h*35}}>{render(module,w)}</div>;})}</div></section>;
}
