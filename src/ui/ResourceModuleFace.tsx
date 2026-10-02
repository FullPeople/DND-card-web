import type {CSSProperties, ReactNode} from 'react';
import {romanLevel,suitableWidgetStyle,countableResource, type ResourceModule, type ResourceWidgetLayout} from '../core/resourceWidgets';
import './resourceDashboardFaces.css';

const iconPaths = {
 spark:'M12 2 14.5 8.5 21 11 14.5 13.5 12 20 9.5 13.5 3 11 9.5 8.5Z',
 diamond:'M12 2 21 11 12 21 3 11Z',
 shield:'M4 4 12 2 20 4 19 13Q17 18 12 21Q7 18 5 13Z',
 flame:'M13 2Q17 8 13 10Q19 8 19 14A7 7 0 0 1 5 14Q5 8 10 6Q8 11 11 12Q15 9 13 2Z',
 leaf:'M20 3Q2 2 4 14Q6 21 13 17Q19 13 20 3ZM5 19 15 8',
 bottle:'M9 2H15V5L14 7 18 13V19Q18 21 16 21H8Q6 21 6 19V13L10 7 9 5Z',
};
export function ResourceDashboardIcon({icon='spark',className}:{icon?:string;className?:string}) {
 return <svg className={`resource-dashboard-icon ${className||''}`} viewBox="0 0 24 24" aria-hidden="true"><path d={iconPaths[icon as keyof typeof iconPaths]||iconPaths.spark}/></svg>;
}

type Resource = ResourceModule['rows'][number][1];
const format=(value:number)=>String(value);
const ratio=(r:Resource)=>!r.unlimited&&r.max>0?Math.max(0,Math.min(1,r.current/r.max)):0;
const maxText=(r:Resource)=>format(r.max);
export const resourceAmount=(r:Pick<Resource,'current'|'max'|'unlimited'>)=>r.unlimited?format(r.current):`${format(r.current)} / ${format(r.max)}`;
const summary=resourceAmount;
const numericIcons=(r:Resource,limit=10)=>countableResource(r)&&r.max<=limit;
const groupedStyles=new Set(['pool','poolchips','poolbars','poolpips']);

function IconCount({resource,icon,limit=10,columns,showCount=true}:{resource:Resource;icon?:string;limit?:number;columns?:number;showCount?:boolean}) {
 if(!numericIcons(resource,limit))return <strong className="rm-count-fallback">{summary(resource)}</strong>;
 const cols=Math.min(resource.max,columns??(resource.max>5?Math.ceil(resource.max/2):resource.max));
 return <><span className="rm-icons" style={{'--rm-columns':cols,'--rm-rows':Math.ceil(resource.max/cols)} as CSSProperties} aria-hidden="true">{Array.from({length:resource.max},(_,i)=><span key={i} className={`rm-icon-unit ${i<resource.current?'is-filled':'is-empty'}`}><ResourceDashboardIcon icon={icon}/></span>)}</span>{showCount&&<strong className="rm-icon-count">{summary(resource)}</strong>}</>;
}

function GroupFace({module,style,icon}:{module:ResourceModule;style:string;icon?:string}) {
 return <><span className="rm-name resource-group-title" title={module.name}>{module.name}</span>
  <span className={`rm-pools rm-pools-${style} ${module.slots?'is-spell-pool':''} ${module.rows.length>3?'has-many-pools':''}`} style={{'--rm-pool-count':module.rows.length,'--rm-pool-rows':Math.ceil(module.rows.length/3)} as CSSProperties}>
   {module.rows.map(([id,r])=><span key={id} className="rm-pool resource-subvalue" data-subresource-id={id} data-resource-current={r.current} data-unlimited={r.unlimited||undefined} data-large-values={String(r.current).length+String(r.max).length>8} title={`${r.name||id}：${summary(r)}`} style={{'--rm-part':ratio(r),'--rm-row-fit':`${Math.min(22,140/Math.max(1,String(r.current).length+String(r.max).length))}cqw`} as CSSProperties}>
    <b className="rm-pool-label">{module.slots?romanLevel(id):r.name||id}</b>
    {style==='poolpips'&&numericIcons(r)&&<IconCount resource={r} icon={icon} showCount={false}/>}
    <span className="rm-pool-values"><strong className="rm-pool-current">{format(r.current)}</strong>{!r.unlimited&&<small className="rm-pool-max"> / {maxText(r)}</small>}</span>
    {(style==='poolbars'||style==='poolpips'&&!numericIcons(r))&&!r.unlimited&&<span className="rm-mini-rail" aria-hidden="true"><i/></span>}
   </span>)}
  </span></>;
}

/** Presentation only. Every displayed value comes from its actual runtime resource pool. */
export function ResourceModuleFace({module,style,layout}:{module:ResourceModule;style:ResourceWidgetLayout['style'];layout?:ResourceWidgetLayout}) {
 if(!module.rows.length)return <span className="resource-module-art rm-empty">{module.name}</span>;
 const [id,r]=module.rows[0];
 let face:string=suitableWidgetStyle(style,module.rows);
 const multiple=module.rows.length>1||module.slots;
 if(multiple&&!groupedStyles.has(face))face='pool';
 // An unbounded counter cannot truthfully display a fill percentage or a finite number of icons.
 if(!multiple&&r.unlimited)face='number';
 const value=summary(r),name=<span className="rm-name" title={module.name||r.name||id}>{module.name||r.name||id}</span>;
 const readout=<span className="rm-readout"><strong>{format(r.current)}</strong>{!r.unlimited&&<small>/ {maxText(r)}</small>}</span>;
 const gauge=(body:ReactNode,viewBox='0 0 60 60')=><>{name}<span className="rm-shape"><svg viewBox={viewBox} aria-hidden="true">{body}</svg>{readout}</span></>;
 let content:ReactNode;
 if(multiple||groupedStyles.has(face))content=<GroupFace module={module} style={groupedStyles.has(face)?face:'pool'} icon={layout?.icon}/>;
 else if(face==='ring')content=gauge(<><circle className="rm-track" cx="30" cy="30" r="25"/><circle className="rm-arc" cx="30" cy="30" r="25" pathLength="100"/></>);
 else if(face==='orbit')content=gauge(<>{Array.from({length:r.max},(_,i)=>{const length=100/r.max,offset=i*length,dash=length*.74;return <g key={i} className={`rm-orbit-unit ${i<r.current?'is-filled':'is-empty'}`} data-resource-unit={i+1}><circle className="rm-track rm-orbit-section" cx="30" cy="30" r="25" pathLength="100" strokeDasharray={`${dash} ${100-dash}`} strokeDashoffset={-offset}/>{i<r.current&&<circle className="rm-orbit-on" cx="30" cy="30" r="25" pathLength="100" strokeDasharray={`${dash} ${100-dash}`} strokeDashoffset={-offset}/>}</g>;})}</>);
 else if(face==='square')content=gauge(<><rect className="rm-track" x="7" y="7" width="46" height="46" rx="6"/><rect className="rm-arc" x="7" y="7" width="46" height="46" rx="6" pathLength="100"/></>);
 else if(face==='diamond')content=gauge(<><path className="rm-track" d="M30 3 57 30 30 57 3 30Z"/><path className="rm-arc" pathLength="100" d="M30 3 57 30 30 57 3 30Z"/></>);
 else if(face==='half')content=gauge(<><path className="rm-track" d="M8 52A42 42 0 0 1 92 52"/><path className="rm-arc" pathLength="100" d="M8 52A42 42 0 0 1 92 52"/><path className="rm-needle" d="M50 52V17" transform={`rotate(${ratio(r)*180-90} 50 52)`}/></>,'0 0 100 62');
 else if(face==='segments')content=<><span className="rm-heading">{name}<strong className="rm-inline-value">{format(r.current)}<small> / {maxText(r)}</small></strong></span><span className="rm-segments" aria-hidden="true">{Array.from({length:r.max},(_,i)=><i key={i} className={i<r.current?'is-filled':'is-empty'} data-resource-unit={i+1} style={{'--rm-segment':i<r.current?1:0} as CSSProperties}/>)}</span></>;
 else if(face==='reservoir')content=<>{name}<span className="rm-vessel"><span className="rm-vessel-fill" aria-hidden="true"/>{readout}</span></>;
 else if(face==='pips'||face==='matrix')content=<>{name}<IconCount resource={r} icon={layout?.icon} columns={face==='matrix'?Math.min(5,Math.ceil(Math.sqrt(r.max))):undefined}/></>;
 else if(face==='fraction')content=<>{name}<span className="rm-fraction"><strong>{format(r.current)}</strong><i aria-hidden="true"/><small>{maxText(r)}</small></span></>;
 else if(face==='counter')content=<>{name}<span className="rm-counter">{format(r.current).split('').map((character,i)=>/\d/.test(character)?<b key={i}>{character}</b>:<em key={i}>{character}</em>)}</span><small className="rm-counter-max">/ {maxText(r)}</small></>;
 else if(face==='ready')content=<>{name}<span className={`rm-ready ${r.current>0?'':'is-empty'}`} aria-label={r.current>0?'可用':'已消耗'}><ResourceDashboardIcon icon={layout?.icon||'shield'}/></span></>;
 else content=<>{name}{readout}</>;
 const digits=Math.max(String(r.current).length,String(r.max).length);
 return <span className={`resource-module-art rm-${face} ${value.length>8?'rm-large-number':''} ${multiple?'rm-group':''}`} data-module-style={face} data-module-unlimited={!multiple&&r.unlimited||undefined} style={{'--rm-icon-tone':layout?.color||'#527880','--rm-ratio':ratio(r),'--rm-value-fit':`${Math.min(30,62/(digits*.65))}cqw`,'--rm-pool-digits':Math.max(...module.rows.map(([,row])=>String(row.current).length+String(row.max).length))} as CSSProperties} title={multiple?module.rows.map(([key,resource])=>`${resource.name||key}：${summary(resource)}`).join('\n'):`${module.name}：${value}`}>
  {content}{!multiple&&r.locked&&<span className="rm-lock" aria-label="已锁定">▣</span>}
 </span>;
}
