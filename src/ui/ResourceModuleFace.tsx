import type {CSSProperties, ReactNode} from 'react';
import {romanLevel,canonicalWidgetStyle,countableResource, type ResourceModule, type ResourceWidgetLayout} from '../core/resourceWidgets';
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
const countableValue=(r:Resource)=>countableResource(r)&&Number.isInteger(r.current)&&r.current>=0&&r.current<=r.max;
const groupedStyles=new Set(['pool','poolchips','poolbars','poolpips']);

/** Discrete icons always correspond one-for-one to real resource units. */
function IconCount({resource,icon,columns}:{resource:Resource;icon?:string;columns?:number}) {
 if(!countableValue(resource))return <span className="rm-icon-summary"><ResourceDashboardIcon icon={icon}/><strong className="rm-count-fallback">{summary(resource)}</strong></span>;
 const cols=Math.min(resource.max,columns??(resource.max>5?Math.ceil(resource.max/2):resource.max));
 return <span className="rm-icons" style={{'--rm-columns':cols,'--rm-rows':Math.ceil(resource.max/cols)} as CSSProperties} aria-hidden="true">{Array.from({length:resource.max},(_,i)=><span key={i} className={`rm-icon-unit ${i<resource.current?'is-filled':'is-empty'}`} data-resource-unit={i+1}><ResourceDashboardIcon icon={icon}/></span>)}</span>;
}

function GroupFace({module,style,icon}:{module:ResourceModule;style:string;icon?:string}) {
 return <><span className="rm-name resource-group-title" title={module.name}>{module.name}</span>
  <span className={`rm-pools rm-pools-${style} ${module.slots?'is-spell-pool':''} ${module.rows.length>3?'has-many-pools':''}`} style={{'--rm-pool-count':module.rows.length,'--rm-pool-rows':Math.ceil(module.rows.length/3)} as CSSProperties}>
   {module.rows.map(([id,r])=>{const icons=style==='poolpips'&&countableValue(r);return <span key={id} className="rm-pool resource-subvalue" data-subresource-id={id} data-resource-current={r.current} data-unlimited={r.unlimited||undefined} data-icon-count={icons||undefined} data-large-values={String(r.current).length+String(r.max).length>8} title={`${r.name||id}：${summary(r)}`} aria-label={`${r.name||id}：${summary(r)}`} style={{'--rm-part':ratio(r),'--rm-row-fit':`${Math.min(22,140/Math.max(1,String(r.current).length+String(r.max).length))}cqw`} as CSSProperties}>
    <b className="rm-pool-label">{module.slots?romanLevel(id):r.name||id}</b>
    {icons?<IconCount resource={r} icon={icon}/>:<span className="rm-pool-values"><strong className="rm-pool-current">{format(r.current)}</strong>{!r.unlimited&&<small className="rm-pool-max"> / {maxText(r)}</small>}</span>}
    {(style==='poolbars'||style==='poolpips'&&!icons)&&!r.unlimited&&<span className="rm-mini-rail" aria-hidden="true"><i/></span>}
   </span>;})}
  </span></>;
}

/** Presentation only. Capacity updates never replace a player's chosen artwork. */
export function ResourceModuleFace({module,style,layout}:{module:ResourceModule;style:ResourceWidgetLayout['style'];layout?:ResourceWidgetLayout}) {
 if(!module.rows.length)return <span className="resource-module-art rm-empty">{module.name}</span>;
 const [id,r]=module.rows[0],face=canonicalWidgetStyle(style),multiple=module.rows.length>1||module.slots,countable=countableValue(r);
 const value=summary(r),name=<span className="rm-name" title={module.name||r.name||id}>{module.name||r.name||id}</span>;
 const readout=<span className="rm-readout"><strong>{format(r.current)}</strong>{!r.unlimited&&<small><span className="rm-value-slash">/</span> {maxText(r)}</small>}</span>;
 const gauge=(body:ReactNode,viewBox='0 0 60 60')=><>{name}<span className="rm-shape"><svg viewBox={viewBox} aria-hidden="true">{body}</svg>{readout}</span></>;
 let content:ReactNode;
 if(multiple||groupedStyles.has(face))content=<GroupFace module={module} style={groupedStyles.has(face)?face:'pool'} icon={layout?.icon}/>;
 else if(face==='ring')content=gauge(<><circle className="rm-track" cx="30" cy="30" r="25"/>{!r.unlimited&&<circle className="rm-arc" cx="30" cy="30" r="25" pathLength="100"/>}</>);
 else if(face==='orbit')content=gauge(countable?<>{Array.from({length:r.max},(_,i)=>{const length=100/r.max,offset=i*length,dash=length*.74;return <g key={i} className={`rm-orbit-unit ${i<r.current?'is-filled':'is-empty'}`} data-resource-unit={i+1}><circle className="rm-track rm-orbit-section" cx="30" cy="30" r="25" pathLength="100" strokeDasharray={`${dash} ${100-dash}`} strokeDashoffset={-offset}/>{i<r.current&&<circle className="rm-orbit-on" cx="30" cy="30" r="25" pathLength="100" strokeDasharray={`${dash} ${100-dash}`} strokeDashoffset={-offset}/>}</g>;})}</>:<circle className="rm-track rm-orbit-section" cx="30" cy="30" r="25" pathLength="100" strokeDasharray="18 7"/>);
 else if(face==='square')content=gauge(<><rect className="rm-track" x="7" y="7" width="46" height="46" rx="6"/>{!r.unlimited&&<rect className="rm-arc" x="7" y="7" width="46" height="46" rx="6" pathLength="100"/>}</>);
 else if(face==='diamond')content=gauge(<><path className="rm-track" d="M30 3 57 30 30 57 3 30Z"/>{!r.unlimited&&<path className="rm-arc" pathLength="100" d="M30 3 57 30 30 57 3 30Z"/>}</>);
 else if(face==='half')content=gauge(<><path className="rm-track" d="M8 52A42 42 0 0 1 92 52"/>{!r.unlimited&&<><path className="rm-arc" pathLength="100" d="M8 52A42 42 0 0 1 92 52"/><path className="rm-needle" d="M50 52V17" transform={`rotate(${ratio(r)*180-90} 50 52)`}/></>}</>,'0 0 100 62');
 else if(face==='segments')content=<><span className="rm-heading">{name}<strong className="rm-inline-value">{format(r.current)}{!r.unlimited&&<small> / {maxText(r)}</small>}</strong></span>{countable?<span className="rm-segments" aria-hidden="true">{Array.from({length:r.max},(_,i)=><i key={i} className={i<r.current?'is-filled':'is-empty'} data-resource-unit={i+1} style={{'--rm-segment':i<r.current?1:0} as CSSProperties}/>)}</span>:<span className="rm-segments rm-segments-summary" aria-hidden="true"><i/></span>}</>;
 else if(face==='reservoir')content=<>{name}<span className="rm-vessel">{!r.unlimited&&<span className="rm-vessel-fill" aria-hidden="true"/>}{readout}</span></>;
 else if(face==='pips'||face==='matrix')content=<>{name}<IconCount resource={r} icon={layout?.icon} columns={face==='matrix'?Math.min(5,Math.ceil(Math.sqrt(r.max))):undefined}/></>;
 else if(face==='fraction')content=<>{name}<span className="rm-fraction"><strong>{format(r.current)}</strong>{!r.unlimited&&<><i aria-hidden="true"/><small>{maxText(r)}</small></>}</span></>;
 else if(face==='counter')content=<>{name}<span className="rm-counter">{format(r.current).split('').map((character,i)=>/\d/.test(character)?<b key={i}>{character}</b>:<em key={i}>{character}</em>)}</span>{!r.unlimited&&<small className="rm-counter-max">/ {maxText(r)}</small>}</>;
 else if(face==='ready')content=<>{name}<span className={`rm-ready ${r.current>0?'':'is-empty'}`} aria-label={r.current>0?'可用':'已消耗'}><ResourceDashboardIcon icon={layout?.icon||'shield'}/></span>{(!countable||r.max!==1)&&<strong className="rm-ready-count">{value}</strong>}</>;
 else content=<>{name}{readout}</>;
 const digits=Math.max(String(r.current).length,r.unlimited?0:String(r.max).length),ringWidth=String(r.current).length*.62+(r.unlimited?0:String(r.max).length*.4+.45);
 const contentScale=Number.isFinite(layout?.contentScale)?Math.max(.5,Math.min(2,layout!.contentScale!)):1;
 return <span className={`resource-module-art rm-${face} ${value.length>8?'rm-large-number':''} ${multiple?'rm-group':''}`} data-module-style={face} data-module-unlimited={!multiple&&r.unlimited||undefined} data-content-scale={contentScale} style={{'--rm-icon-tone':layout?.color||'#527880','--rm-ratio':ratio(r),'--rm-content-scale':contentScale,'--rm-value-fit':`${Math.min(30,62/(digits*.65))}cqw`,'--rm-ring-fit':`${76/ringWidth}cqw`,'--rm-pool-digits':Math.max(...module.rows.map(([,row])=>String(row.current).length+String(row.max).length))} as CSSProperties} title={multiple?module.rows.map(([key,resource])=>`${resource.name||key}：${summary(resource)}`).join('\n'):`${module.name}：${value}`}>
  <span className="rm-content">{content}</span>{!multiple&&r.locked&&<span className="rm-lock" aria-label="已锁定">▣</span>}
 </span>;
}
