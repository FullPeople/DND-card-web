import type {Character} from './model';
import {sourceSpellResourceEnabled} from './automation/sourceSpellState';

export const WIDGET_STYLES=['ring','pips','pool','half','orbit','square','segments','reservoir','matrix','fraction','counter','poolchips','poolbars','poolpips','ready','diamond'] as const;
export type CanonicalWidgetStyle=typeof WIDGET_STYLES[number];
/** Old saves remain valid; presentation normalizes the two former style IDs. */
export type WidgetStyle=CanonicalWidgetStyle|'bar'|'icon';
export const WIDGET_ICONS=['spark','diamond','shield','flame','leaf','bottle'] as const;
export type WidgetIcon=typeof WIDGET_ICONS[number];
export type ResourceWidgetLayout={x:number;y:number;w:number;h:number;page:number;style:WidgetStyle;members?:string[];label?:string;color?:string;icon?:WidgetIcon};
export const WIDGET_COLS=12,WIDGET_ROWS=6,ATTACKS_WIDGET_ID='__attacks__';
export const widgetStyleNames:Record<WidgetStyle,string>={ring:'环形',pips:'图标',pool:'子资源',half:'半圆',orbit:'断环',square:'方框',segments:'分段槽',reservoir:'容器',matrix:'图标矩阵',fraction:'斜分数',counter:'计数牌',poolchips:'子资源铭牌',poolbars:'子资源条',poolpips:'子资源图标',ready:'单次状态',diamond:'菱形',bar:'分段槽',icon:'图标'};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.round(Number.isFinite(n)?n:min)));
const isColor=(v:unknown):v is string=>typeof v==='string'&&/^#[\da-f]{6}$/i.test(v);
const isIcon=(v:unknown):v is WidgetIcon=>WIDGET_ICONS.includes(v as WidgetIcon);
export function canonicalWidgetStyle(style?:WidgetStyle):CanonicalWidgetStyle{
 if(style==='icon')return 'pips';
 return WIDGET_STYLES.includes(style as CanonicalWidgetStyle)?style as CanonicalWidgetStyle:'segments';
}
export function normalizeWidget(input?:Partial<ResourceWidgetLayout>):ResourceWidgetLayout{
 const w=clamp(input?.w??4,2,WIDGET_COLS),h=clamp(input?.h??2,2,WIDGET_ROWS);
 return {w,h,x:clamp(input?.x??0,0,WIDGET_COLS-w),y:clamp(input?.y??0,0,WIDGET_ROWS-h),page:clamp(input?.page??0,0,2999),style:canonicalWidgetStyle(input?.style),...(input?.members?{members:[...input.members]}:{}),...(input?.label?{label:input.label}:{}),...(isColor(input?.color)?{color:input.color}:{}),...(isIcon(input?.icon)?{icon:input.icon}:{})};
}
export function validWidget(value:unknown):value is ResourceWidgetLayout{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as ResourceWidgetLayout;
 return ['x','y','w','h','page'].every(k=>Number.isInteger(v[k as keyof ResourceWidgetLayout]))&&v.x>=0&&v.y>=0&&v.w>=2&&v.h>=2&&v.x+v.w<=WIDGET_COLS&&v.y+v.h<=WIDGET_ROWS&&v.page>=0&&v.page<3000&&(v.style==='bar'||v.style==='icon'||WIDGET_STYLES.includes(v.style))&&(v.members===undefined||Array.isArray(v.members)&&v.members.length>=2&&v.members.length<=12&&new Set(v.members).size===v.members.length&&v.members.every(id=>typeof id==='string'&&id.length>0&&id.length<=2000))&&(v.label===undefined||typeof v.label==='string'&&v.label.length<=100)&&(v.color===undefined||isColor(v.color))&&(v.icon===undefined||isIcon(v.icon));
}
export function validWidgets(value:unknown){return value===undefined||!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length<=3000&&Object.values(value).every(validWidget);}
const overlaps=(a:ResourceWidgetLayout,b:ResourceWidgetLayout)=>a.page===b.page&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function place(input:ResourceWidgetLayout,placed:ResourceWidgetLayout[]){
 if(!placed.some(other=>overlaps(input,other)))return input;
 for(let offset=0;offset<3000;offset++)for(let y=0;y<=WIDGET_ROWS-input.h;y++)for(let x=0;x<=WIDGET_COLS-input.w;x++){
  const next={...input,page:(input.page+offset)%3000,x,y};if(!placed.some(other=>overlaps(next,other)))return next;
 }
 throw Error('仪表盘页数已达上限');
}
function compactPages(widgets:ResourceWidgetLayout[]){
 const pages=[...new Set(widgets.map(w=>w.page))].sort((a,b)=>a-b);
 for(const widget of widgets)widget.page=pages.indexOf(widget.page);
}
/** Identity-keyed presentation only; never reads or mutates resource counters. */
export function resourceWidgetLayout(ids:string[],saved:Record<string,ResourceWidgetLayout>={},priority?:string){
 const result:Record<string,ResourceWidgetLayout>=Object.create(null),placed:ResourceWidgetLayout[]=[];
 const ordered=[...new Set(ids)].sort((a,b)=>Number(b===priority)-Number(a===priority)||Number(Object.hasOwn(saved,b))-Number(Object.hasOwn(saved,a)));
 for(const id of ordered){const widget=place(normalizeWidget(Object.hasOwn(saved,id)?saved[id]:undefined),placed);result[id]=widget;placed.push(widget);}
 compactPages(placed);return result;
}
export function minimumWidgetSize(style:WidgetStyle):{w:number;h:number}{
 const id=canonicalWidgetStyle(style);
 if(['ring','orbit','square','reservoir'].includes(id))return {w:2,h:3};
 if(['pool','poolchips'].includes(id))return {w:4,h:2};
 if(['counter','poolbars','poolpips'].includes(id))return {w:4,h:3};
 if(['half','matrix','fraction','diamond'].includes(id))return {w:3,h:3};
 return {w:3,h:2};
}
export function moveWidget(widget:ResourceWidgetLayout,dx:number,dy:number,handle='move',minimum?:{w:number;h:number}):ResourceWidgetLayout{
 if(handle==='move')return normalizeWidget({...widget,x:widget.x+dx,y:widget.y+dy});
 let {x,y,w,h}=widget;
 // A legacy smaller box can still be resized without displacing its opposite edge.
 const min=minimum??minimumWidgetSize(widget.style),minW=Math.min(w,min.w),minH=Math.min(h,min.h);
 if(handle.includes('e'))w=clamp(w+dx,minW,WIDGET_COLS-x);
 if(handle.includes('s'))h=clamp(h+dy,minH,WIDGET_ROWS-y);
 if(handle.includes('w')){const right=x+w;x=clamp(x+dx,0,right-minW);w=right-x;}
 if(handle.includes('n')){const bottom=y+h;y=clamp(y+dy,0,bottom-minH);h=bottom-y;}
 return {...widget,x,y,w,h};
}

type ResourceValue=Character['runtime']['resources'][string];
/** Call only when a resource is created; readers use a deterministic fallback. */
export function chooseDefaultWidgetStyle(resource:Pick<ResourceValue,'max'|'unlimited'>,rng:()=>number=Math.random):CanonicalWidgetStyle{
 const max=resource.max;
 const choices:CanonicalWidgetStyle[]=resource.unlimited||!Number.isFinite(max)||max>100||!Number.isInteger(max)?['fraction']:max<=6?['orbit','diamond']:max<=12?['orbit','segments','diamond']:['segments','fraction'];
 return choices[Math.min(choices.length-1,Math.max(0,Math.floor((Number(rng())||0)*choices.length)))];
}
export type ResourceModule={id:string;name:string;rows:[string,ResourceValue][];slots:boolean};
export const isWidgetSpellSlot=(id:string)=>/^(spell|pact)-slot:[1-9]$/.test(id);
export const romanLevel=(id:string)=>['','I','II','III','IV','V','VI','VII','VIII','IX'][Number(id.split(':').at(-1))]||'';
/** A group is a projection over supplied visible rows; it never grants or totals runtime pools. */
export function resourceModules(rows:ResourceModule['rows'],saved:Record<string,ResourceWidgetLayout>={}):ResourceModule[]{
 const modules:ResourceModule[]=[],used=new Set<string>(),byId=new Map(rows),anchors=new Map<string,string>();
 const slots=rows.filter(([id])=>isWidgetSpellSlot(id)).sort(([a],[b])=>Number(a.startsWith('pact'))-Number(b.startsWith('pact'))||Number(a.split(':')[1])-Number(b.split(':')[1]));
 for(const [anchor,layout] of Object.entries(saved)){if(!byId.has(anchor)||isWidgetSpellSlot(anchor)||!layout.members?.includes(anchor)||layout.members.some(id=>anchors.has(id)))continue;for(const id of layout.members)if(byId.has(id)&&!isWidgetSpellSlot(id)&&!anchors.has(id))anchors.set(id,anchor);}
 for(const [key,value] of rows){if(used.has(key))continue;
  if(isWidgetSpellSlot(key)){const pact=key.startsWith('pact-'),pool=slots.filter(([id])=>id.startsWith('pact-')===pact);pool.forEach(([id])=>used.add(id));modules.push({id:pool[0][0],name:pact?'契约法术位':'法术位（共用）',rows:pool,slots:true});continue;}
  const id=anchors.get(key)||key,r=byId.get(id)||value;
  const children=rows.filter(([key])=>anchors.get(key)===id&&!used.has(key));
  const members=children.length>1?children:[[id,r] as ResourceModule['rows'][number]];members.forEach(([id])=>used.add(id));modules.push({id,name:members.length>1?saved[id].label||r.name||'组合资源':r.name||id,rows:members,slots:false});
 }
 return modules;
}

export const RESOURCE_TEMPLATES=[
 {id:'ring',name:'环形',description:'',style:'ring',w:3,h:3,multi:false},
 {id:'pips',name:'图标',description:'',style:'pips',w:4,h:2,multi:false},
 {id:'pool',name:'子资源',description:'',style:'pool',w:6,h:3,multi:true},
 {id:'half',name:'半圆',description:'',style:'half',w:4,h:3,multi:false},
 {id:'orbit',name:'断环',description:'',style:'orbit',w:3,h:3,multi:false},
 {id:'square',name:'方框',description:'',style:'square',w:3,h:3,multi:false},
 {id:'segments',name:'分段槽',description:'',style:'segments',w:4,h:2,multi:false},
 {id:'reservoir',name:'容器',description:'',style:'reservoir',w:3,h:3,multi:false},
 {id:'matrix',name:'图标矩阵',description:'',style:'matrix',w:3,h:3,multi:false},
 {id:'fraction',name:'斜分数',description:'',style:'fraction',w:4,h:3,multi:false},
 {id:'counter',name:'计数牌',description:'',style:'counter',w:4,h:3,multi:false},
 {id:'poolchips',name:'子资源铭牌',description:'',style:'poolchips',w:6,h:3,multi:true},
 {id:'poolbars',name:'子资源条',description:'',style:'poolbars',w:6,h:4,multi:true},
 {id:'poolpips',name:'子资源图标',description:'',style:'poolpips',w:6,h:4,multi:true},
 {id:'ready',name:'单次状态',description:'',style:'ready',w:4,h:2,multi:false},
 {id:'diamond',name:'菱形',description:'',style:'diamond',w:3,h:3,multi:false},
] as const;
export type ResourceTemplate=typeof RESOURCE_TEMPLATES[number];
export type ResourceTemplateValues={name:string;current:number;max:number;unlimited:boolean};
/** A group needs room for every actual resource pool, not only its first row. */
export function resourceModuleMinimum(module:ResourceModule,style:WidgetStyle):{w:number;h:number}{
 const min=minimumWidgetSize(style),multi=module.slots||module.rows.length>1,wide=multi&&module.rows.length>4;
 const multiHeight=!multi?2:module.rows.length>9?6:module.rows.length>6?5:module.rows.length>3?4:['poolbars','poolpips'].includes(canonicalWidgetStyle(style))?4:module.slots?2:3;
 return {w:Math.max(min.w,multi?(wide?8:4):2),h:Math.max(min.h,multiHeight)};
}
/** Changes only this module when growing resource data requires more room.
 * Any resulting collision remains visible for the user to resolve. */
export function normalizeModuleWidget(module:ResourceModule,input?:Partial<ResourceWidgetLayout>):ResourceWidgetLayout{
 const savedStyle=input?canonicalWidgetStyle(input.style):undefined;
 const style=module.slots?(['pool','poolchips','poolbars','poolpips'].includes(savedStyle||'')?savedStyle!:'pool'):savedStyle??(module.rows.length>1?'pool':chooseDefaultWidgetStyle(module.rows[0][1],()=>0));
 const template=RESOURCE_TEMPLATES.find(t=>t.id===style)!;
 const widget=normalizeWidget(input??{style,w:template.w,h:module.slots?2:template.h}),min=resourceModuleMinimum(module,style);
 return normalizeWidget({...widget,style,w:Math.max(widget.w,min.w),h:Math.max(widget.h,min.h)});
}
function moduleDefaults(modules:ResourceModule[],saved:Record<string,ResourceWidgetLayout>){
 const defaults:Record<string,ResourceWidgetLayout>=Object.create(null);
 for(const module of modules)defaults[module.id]=normalizeModuleWidget(module,Object.hasOwn(saved,module.id)?saved[module.id]:undefined);
 return defaults;
}
export function moduleLayout(modules:ResourceModule[],saved:Record<string,ResourceWidgetLayout>={},priority?:string){
 return resourceWidgetLayout(modules.map(m=>m.id),moduleDefaults(modules,saved),priority);
}
/** The attacks box shares the canvas but has no resource identity or balance. */
export function dashboardLayout(modules:ResourceModule[],saved:Record<string,ResourceWidgetLayout>={},attacks?:ResourceWidgetLayout,priority?:string):{widgets:Record<string,ResourceWidgetLayout>;attacks:ResourceWidgetLayout}{
 const defaults=moduleDefaults(modules,saved),widgets:Record<string,ResourceWidgetLayout>=Object.create(null),placed:ResourceWidgetLayout[]=[];
 const items=[{id:ATTACKS_WIDGET_ID,attacks:true,layout:normalizeWidget(attacks??{x:0,y:0,w:3,h:6,style:'segments'})},...modules.map(m=>({id:m.id,attacks:false,layout:defaults[m.id]}))];
 items.sort((a,b)=>Number(b.id===priority)-Number(a.id===priority)||Number(b.attacks)-Number(a.attacks)||Number(Object.hasOwn(saved,b.id))-Number(Object.hasOwn(saved,a.id)));
 let attacksLayout:ResourceWidgetLayout=items[0].layout;
 for(const item of items){const widget=place(item.layout,placed);placed.push(widget);if(item.attacks)attacksLayout=widget;else widgets[item.id]=widget;}
 // Explicit pages are user choices: dragging to a new page must not compact it back.
 return {widgets,attacks:attacksLayout};
}
export type DashboardLayout={widgets:Record<string,ResourceWidgetLayout>;attacks:ResourceWidgetLayout};
/** Draft coordinates are intentional. Only previously unplaced modules search for
 * free space. A group can grow to fit new rows, but never repacks its neighbours. */
export function freeDashboardLayout(modules:ResourceModule[],saved:Record<string,ResourceWidgetLayout>={},attacks?:ResourceWidgetLayout):DashboardLayout{
 const widgets:Record<string,ResourceWidgetLayout>=Object.create(null),placed:ResourceWidgetLayout[]=[],defaults=moduleDefaults(modules,saved);
 for(const module of modules)if(Object.hasOwn(saved,module.id)){widgets[module.id]=defaults[module.id];placed.push(widgets[module.id]);}
 const attacksLayout=attacks?normalizeWidget({...attacks,w:Math.max(3,attacks.w),h:Math.max(3,attacks.h)}):place(normalizeWidget({x:0,y:0,w:3,h:6,style:'segments'}),placed);
 placed.push(attacksLayout);
 for(const module of modules)if(!Object.hasOwn(widgets,module.id)){widgets[module.id]=place(defaults[module.id],placed);placed.push(widgets[module.id]);}
 return {widgets,attacks:attacksLayout};
}
/** Resource IDs are opaque: a resource named __attacks__ is not the attack box. */
export function dashboardOverlaps(layout:DashboardLayout):{resources:string[];attacks:boolean;count:number}{
 const items=[{kind:'attacks' as const,id:'',widget:layout.attacks},...Object.entries(layout.widgets).map(([id,widget])=>({kind:'resource' as const,id,widget}))];
 const resources=new Set<string>();let attacks=false,count=0;
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)if(overlaps(items[i].widget,items[j].widget)){
  count++;for(const item of [items[i],items[j]])if(item.kind==='attacks')attacks=true;else resources.add(item.id);
 }
 return {resources:[...resources],attacks,count};
}
export function setResourceWidgetStyle(c:Character,id:string,style:WidgetStyle){
 const layout=c.quickbarLayout||={order:[],hidden:[]};
 const modules=resourceModules(resourceCanvasRows(c),layout.widgets),current=freeDashboardLayout(modules,layout.widgets,layout.attacks);
 if(!current.widgets[id])return;
 const next=freeDashboardLayout(modules,{...current.widgets,[id]:normalizeWidget({...current.widgets[id],style})},current.attacks);
 layout.widgets={...Object.fromEntries(Object.entries(layout.widgets||{}).filter(([key])=>Object.hasOwn(c.runtime.resources,key))),...next.widgets};layout.attacks=next.attacks;
}
/** Persist a chosen default once. Reading/rendering a card never consumes randomness. */
export function ensureResourceWidget(c:Character,id:string,rng:()=>number=Math.random){
 if(!Object.hasOwn(c.runtime.resources,id))return;
 const layout=c.quickbarLayout||={order:[],hidden:[]};
 if(Object.hasOwn(layout.widgets||{},id))return;
 const modules=resourceModules(resourceCanvasRows(c),layout.widgets),module=modules.find(m=>m.rows.some(([key])=>key===id));
 if(!module||Object.hasOwn(layout.widgets||{},module.id))return;
 const style=module.slots?'pool':chooseDefaultWidgetStyle(c.runtime.resources[id],rng),template=RESOURCE_TEMPLATES.find(t=>t.id===style)!;
 const current=freeDashboardLayout(modules.filter(m=>m.id!==module.id),layout.widgets,layout.attacks);
 const defaults=moduleDefaults([module],{[module.id]:normalizeWidget({style,w:template.w,h:template.h})});
 const widget=place(defaults[module.id],[current.attacks,...Object.values(current.widgets)]);
 layout.widgets={...layout.widgets,...current.widgets,[module.id]:widget};layout.attacks=current.attacks;
}
export function resourceCanvasRows(c:Character){return Object.entries(c.runtime.resources).filter(([id])=>!id.startsWith('hit-die:')&&sourceSpellResourceEnabled(c,id)&&!c.quickbarLayout?.hidden.includes(`resource:${id}`));}
/** Explicit creation only. Existing values, locks and automatic resources remain untouched. */
export function addResourceModule(c:Character,template:ResourceTemplate|undefined,page:number,newId:()=>string,rng:()=>number=Math.random,placement?:{x:number;y:number},values?:ResourceTemplateValues){
 const chosen=template??RESOURCE_TEMPLATES.find(t=>t.id===chooseDefaultWidgetStyle({max:3},rng))!;
 if(values&&(!values.name.trim()||values.name.trim().length>100||!Number.isInteger(values.current)||values.current<0||values.current>999999999||!Number.isInteger(values.max)||values.max<0||values.max>99999||!values.unlimited&&values.current>values.max))throw Error('检查名称、当前值与上限');
 const ids=Array.from({length:chosen.multi?3:1},()=>newId());if(new Set(ids).size!==ids.length||ids.some(id=>!id||id.length>2000||Object.hasOwn(c.runtime.resources,id)))throw Error('资源标识重复');
 const layout=c.quickbarLayout||={order:[],hidden:[]},saved=layout.widgets||={},before=resourceModules(resourceCanvasRows(c),saved),current=freeDashboardLayout(before,saved,layout.attacks),occupied=[current.attacks,...Object.values(current.widgets)];
 const initial=normalizeWidget({style:chosen.style,w:chosen.w,h:chosen.h,page,...placement,...(ids.length>1?{members:ids,label:values?.name.trim()||'组合资源'}:{})});
 const placed=placement?initial:place(initial,occupied);
 ids.forEach((id,i)=>Object.defineProperty(c.runtime.resources,id,{value:values?{name:ids.length>1?`${values.name.trim()} ${i+1}`:values.name.trim(),current:values.current,max:values.max,unlimited:values.unlimited,type:values.unlimited?'number':'count'}:{name:ids.length>1?`子资源 ${i+1}`:'新资源',current:chosen.id==='ready'?1:3,max:chosen.id==='ready'?1:3,type:'count'},enumerable:true,writable:true,configurable:true}));
 layout.widgets={...saved,...current.widgets,[ids[0]]:placed};layout.attacks=current.attacks;
 return {id:ids[0],page:placed.page};
}
