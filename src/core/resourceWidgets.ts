import type {Character} from './model';
export const WIDGET_STYLES=['bar','ring','square','icon'] as const;
export type WidgetStyle=typeof WIDGET_STYLES[number];
export type ResourceWidgetLayout={x:number;y:number;w:number;h:number;page:number;style:WidgetStyle};
export const WIDGET_COLS=12,WIDGET_ROWS=6;
export const widgetStyleNames:Record<WidgetStyle,string>={bar:'条形',ring:'圆环',square:'方形',icon:'图标块'};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.round(Number.isFinite(n)?n:min)));
export function normalizeWidget(input?:Partial<ResourceWidgetLayout>):ResourceWidgetLayout{
 const w=clamp(input?.w??4,3,12),h=clamp(input?.h??2,2,6);
 return {w,h,x:clamp(input?.x??0,0,12-w),y:clamp(input?.y??0,0,6-h),page:clamp(input?.page??0,0,2999),style:WIDGET_STYLES.includes(input?.style as WidgetStyle)?input!.style!:'bar'};
}
export function validWidget(value:unknown):value is ResourceWidgetLayout{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as ResourceWidgetLayout;
 return ['x','y','w','h','page'].every(k=>Number.isInteger(v[k as keyof ResourceWidgetLayout]))&&v.x>=0&&v.y>=0&&v.w>=3&&v.h>=2&&v.x+v.w<=12&&v.y+v.h<=6&&v.page>=0&&v.page<3000&&WIDGET_STYLES.includes(v.style);
}
export function validWidgets(value:unknown){return value===undefined||!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length<=3000&&Object.values(value).every(validWidget);}
const overlaps=(a:ResourceWidgetLayout,b:ResourceWidgetLayout)=>a.page===b.page&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function place(input:ResourceWidgetLayout,placed:ResourceWidgetLayout[]){
 if(!placed.some(other=>overlaps(input,other)))return input;
 for(let offset=0;offset<3000;offset++)for(let y=0;y<=6-input.h;y++)for(let x=0;x<=12-input.w;x++){
  const next={...input,page:(input.page+offset)%3000,x,y};if(!placed.some(other=>overlaps(next,other)))return next;
 }
 return input;
}
/** Identity-keyed presentation only; never reads or mutates resource counters. */
export function resourceWidgetLayout(ids:string[],saved:Record<string,ResourceWidgetLayout>={},priority?:string){
 const result:Record<string,ResourceWidgetLayout>=Object.create(null),placed:ResourceWidgetLayout[]=[];
 const ordered=[...ids].sort((a,b)=>Number(b===priority)-Number(a===priority)||Number(!!saved[b])-Number(!!saved[a]));
 for(const id of ordered){const widget=place(normalizeWidget(Object.hasOwn(saved,id)?saved[id]:undefined),placed);result[id]=widget;placed.push(widget);}
 const pages=[...new Set(Object.values(result).map(w=>w.page))].sort((a,b)=>a-b);
 for(const widget of Object.values(result))widget.page=pages.indexOf(widget.page);
 return result;
}
export function moveWidget(widget:ResourceWidgetLayout,dx:number,dy:number,handle='move'):ResourceWidgetLayout{
 if(handle==='move')return normalizeWidget({...widget,x:widget.x+dx,y:widget.y+dy});
 let {x,y,w,h}=widget;
 if(handle.includes('e'))w=clamp(w+dx,3,12-x);
 if(handle.includes('s'))h=clamp(h+dy,2,6-y);
 if(handle.includes('w')){const right=x+w;x=clamp(x+dx,0,right-3);w=right-x;}
 if(handle.includes('n')){const bottom=y+h;y=clamp(y+dy,0,bottom-2);h=bottom-y;}
 return {...widget,x,y,w,h};
}
export function setResourceWidgetStyle(c:Character,id:string,style:WidgetStyle){
 const layout=c.quickbarLayout||={order:[],hidden:[]};
 const widgets=resourceWidgetLayout(Object.keys(c.runtime.resources),layout.widgets);
 if(widgets[id])layout.widgets={...Object.fromEntries(Object.entries(layout.widgets||{}).filter(([key])=>Object.hasOwn(c.runtime.resources,key))),[id]:{...widgets[id],style}};
}
