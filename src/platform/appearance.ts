import {isPaletteColor} from '../core/palette';
export const APPEARANCE_KEY='dnd-card/ui-palette:v1';
export const APPEARANCE_EVENT='dnd-card-palette-changed';
export const UI_COLORS={
 background:['页面背景','#d1d1d1'],surface:['内容区域','#f5f5f3'],heading:['工具栏','#e5e5e5'],band:['切角标题带','#7c7c7c'],bandInk:['切角标题文字','#ffffff'],ink:['正文文字','#343532'],muted:['次要文字','#666666'],line:['描边','#a5a5a5'],accent:['链接与强调','#50525b'],button:['按钮底色','#e5e5e5'],buttonInk:['按钮文字','#303239'],selected:['选中区域','#50525b'],selectedInk:['选中文字','#ffffff'],
} as const;
export const WIKI_COLORS={
 background:['Wiki 背景','#fafaf8'],ink:['正文文字','#343532'],muted:['来源与次要文字','#707070'],title:['标题文字','#454545'],link:['条目链接','#50525b'],area:['区域底色','#eeeeec'],line:['区域描边','#b8b8b4'],entry:['条目底色','#f5f5f3'],entryInk:['条目文字','#343532'],selected:['选中条目','#d8d8d4'],selectedInk:['选中条目文字','#252525'],feature:['特性与引文底色','#eeeeea'],featureInk:['特性与引文文字','#343532'],tableHeading:['表头底色','#deded9'],tableHeadingInk:['表头文字','#343532'],tableCell:['表格底色','#fafaf8'],tableAlternate:['表格交替行','#eeeee9'],tableInk:['表格文字','#343532'],tableLine:['表格描边','#b2b2ad'],
} as const;
export type AppearanceGroup='ui'|'wiki';
export type Appearance={ui:Record<string,string>;wiki:Record<string,string>};
export function readAppearance(value?:string|null):Appearance{
 const result:Appearance={ui:{},wiki:{}};
 try{const saved=JSON.parse(value||'{}');for(const group of ['ui','wiki'] as const)for(const key of Object.keys(group==='ui'?UI_COLORS:WIKI_COLORS))if(isPaletteColor(saved?.[group]?.[key]))result[group][key]=saved[group][key];}catch{/* 保留默认配色。 */}
 return result;
}
let current:Appearance={ui:{},wiki:{}};
export const appearance=()=>current;
export function applyAppearance(value=current){
 if(typeof document==='undefined')return;
 for(const [name,key] of Object.entries({'suite-tone':'accent','suite-paper':'surface','suite-surface':'heading','suite-ink':'ink','suite-muted':'muted','suite-line':'line',ink:'ink',muted:'muted',line:'line',accent:'accent'}))document.documentElement.style.setProperty('--'+name,'var(--ui-'+key+')');
 const night=document.documentElement.dataset.suiteNight==='true';
 const dark:Record<AppearanceGroup,Record<string,string>>={ui:{background:'#1c2028',surface:'#262c35',heading:'#303846',ink:'#e2e6ea',muted:'#aeb7c2',line:'#525c68',button:'#303846',buttonInk:'#e2e6ea'},wiki:{background:'#262c35',ink:'#e2e6ea',muted:'#aeb7c2',title:'#e2e6ea',link:'#b8c5d3',area:'#303846',line:'#525c68',entry:'#262c35',entryInk:'#e2e6ea',selected:'#424b57',selectedInk:'#ffffff',feature:'#303846',featureInk:'#e2e6ea',tableHeading:'#424b57',tableHeadingInk:'#ffffff',tableCell:'#262c35',tableAlternate:'#303846',tableInk:'#e2e6ea',tableLine:'#525c68'}};
 for(const [group,definitions] of [['ui',UI_COLORS],['wiki',WIKI_COLORS]] as const)for(const [key,definition] of Object.entries(definitions))document.documentElement.style.setProperty(`--${group}-${key}`,value[group][key]||(night?dark[group][key]:undefined)||definition[1]);
}
function restore(){try{current=readAppearance(localStorage.getItem(APPEARANCE_KEY));const tone=localStorage.getItem('full-suite/ui-tone');if(!localStorage.getItem(APPEARANCE_KEY)&&isPaletteColor(tone)){current.ui={accent:tone,selected:tone};current.wiki={link:tone,selected:tone,selectedInk:'#ffffff'};}}catch{current=readAppearance();}applyAppearance();}
export function saveAppearance(group:AppearanceGroup,key:string,color?:string){
 const definitions=group==='ui'?UI_COLORS:WIKI_COLORS;if(!Object.hasOwn(definitions,key)||color!==undefined&&!isPaletteColor(color))return false;
 current={...current,[group]:{...current[group]}};if(color)current[group][key]=color;else delete current[group][key];applyAppearance();
 let saved=true;try{localStorage.setItem(APPEARANCE_KEY,JSON.stringify(current));}catch{saved=false;}
 window.dispatchEvent(new Event(APPEARANCE_EVENT));return saved;
}
export function resetAppearance(group:AppearanceGroup){current={...current,[group]:{}};applyAppearance();let saved=true;try{localStorage.setItem(APPEARANCE_KEY,JSON.stringify(current));}catch{saved=false;}window.dispatchEvent(new Event(APPEARANCE_EVENT));return saved;}
export function replaceAppearance(value:Appearance){current=readAppearance(JSON.stringify(value));applyAppearance();let saved=true;try{localStorage.setItem(APPEARANCE_KEY,JSON.stringify(current));}catch{saved=false;}window.dispatchEvent(new Event(APPEARANCE_EVENT));return saved;}
if(typeof window!=='undefined'){restore();window.addEventListener('storage',event=>{if(event.key===APPEARANCE_KEY||event.key==='full-suite/ui-tone'||event.key==='full-suite/ui-night'||event.key===null){restore();window.dispatchEvent(new Event(APPEARANCE_EVENT));}});new MutationObserver(()=>applyAppearance()).observe(document.documentElement,{attributes:true,attributeFilter:['data-suite-night']});}
