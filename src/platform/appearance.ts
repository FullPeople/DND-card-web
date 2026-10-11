import {isPaletteColor} from '../core/palette';
export const APPEARANCE_KEY='dnd-card/ui-palette:v1';
export const APPEARANCE_EVENT='dnd-card-palette-changed';
export const UI_COLORS={
 background:['页面背景','#e4ddd0'],surface:['内容区域','#f7f3ea'],heading:['工具栏','#ece6d8'],band:['切角标题带','#6e5a46'],bandInk:['切角标题文字','#fff8ec'],ink:['正文文字','#2d2a25'],muted:['次要文字','#625b4f'],line:['分隔线','#b8ad9b'],accent:['链接与强调','#8a5a2b'],button:['按钮底色','#fbf8f1'],buttonInk:['按钮文字','#2f2b25'],buttonLine:['按钮描边','#857a68'],selected:['选中区域','#4d5a6b'],selectedInk:['选中文字','#ffffff'],
} as const;
export const WIKI_COLORS={
 background:['Wiki 背景','#fbf8f1'],ink:['正文文字','#2d2a25'],muted:['来源与次要文字','#625b4f'],title:['标题文字','#3f362c'],link:['条目链接','#8a5a2b'],area:['区域底色','#f0eadd'],line:['区域描边','#bfb4a1'],entry:['条目底色','#f7f3ea'],entryInk:['条目文字','#2d2a25'],selected:['选中条目','#e0d6c2'],selectedInk:['选中条目文字','#221f1a'],feature:['特性与引文底色','#f1ebdf'],featureInk:['特性与引文文字','#2d2a25'],tableHeading:['表头底色','#e3dac8'],tableHeadingInk:['表头文字','#2d2a25'],tableCell:['表格底色','#fbf8f1'],tableAlternate:['表格交替行','#f1ebdf'],tableInk:['表格文字','#2d2a25'],tableLine:['表格描边','#bfb4a1'],
} as const;
export type UiKey=keyof typeof UI_COLORS;export type WikiKey=keyof typeof WIKI_COLORS;
export type PaletteSet={ui:Record<UiKey,string>;wiki:Record<WikiKey,string>};
const set=(ui:Record<UiKey,string>,wiki:Record<WikiKey,string>):PaletteSet=>({ui,wiki});
/** Ready-made schemes. 羊皮纸 is the default (the UI_COLORS / WIKI_COLORS
 * fallbacks are its values); 夜航 doubles as the night-mode fallback. */
export const PRESETS:ReadonlyArray<{id:string;name:string;description:string;dark?:boolean;colors:PaletteSet}>=[
 {id:'parchment',name:'羊皮纸',description:'暖米色纸面、乌木色标题带、青铜色链接（默认）',colors:set(Object.fromEntries(Object.entries(UI_COLORS).map(([k,v])=>[k,v[1]])) as Record<UiKey,string>,Object.fromEntries(Object.entries(WIKI_COLORS).map(([k,v])=>[k,v[1]])) as Record<WikiKey,string>)},
 {id:'graphite',name:'石墨',description:'中性灰面、深灰标题带，早期版本的配色',colors:set({background:'#d1d1d1',surface:'#f5f5f3',heading:'#e5e5e5',band:'#747474',bandInk:'#ffffff',ink:'#343532',muted:'#666666',line:'#a5a5a5',accent:'#50525b',button:'#f7f7f5',buttonInk:'#303239',buttonLine:'#6f6f6f',selected:'#50525b',selectedInk:'#ffffff'},{background:'#fafaf8',ink:'#343532',muted:'#606060',title:'#454545',link:'#50525b',area:'#eeeeec',line:'#b8b8b4',entry:'#f5f5f3',entryInk:'#343532',selected:'#d8d8d4',selectedInk:'#252525',feature:'#eeeeea',featureInk:'#343532',tableHeading:'#deded9',tableHeadingInk:'#343532',tableCell:'#fafaf8',tableAlternate:'#eeeee9',tableInk:'#343532',tableLine:'#b2b2ad'})},
 {id:'moss',name:'苔原',description:'灰绿纸面、墨绿标题带，适合森林与野外战役',colors:set({background:'#dfe3da',surface:'#f4f6f0',heading:'#e8ebe3',band:'#4f6050',bandInk:'#f4f8f0',ink:'#262b25',muted:'#5a6457',line:'#a9b2a4',accent:'#3f6b4a',button:'#f8faf5',buttonInk:'#262b25',buttonLine:'#7d8a79',selected:'#3f5a47',selectedInk:'#ffffff'},{background:'#f8faf5',ink:'#262b25',muted:'#5a6457',title:'#33402f',link:'#3f6b4a',area:'#e9ede4',line:'#b5bfb0',entry:'#f4f6f0',entryInk:'#262b25',selected:'#d4dccd',selectedInk:'#1f261d',feature:'#ebf0e6',featureInk:'#262b25',tableHeading:'#dbe3d5',tableHeadingInk:'#262b25',tableCell:'#f8faf5',tableAlternate:'#ebf0e6',tableInk:'#262b25',tableLine:'#b5bfb0'})},
 {id:'celadon',name:'青瓷',description:'青灰纸面、黛青标题带，偏冷静的阅读配色',colors:set({background:'#d9e3e3',surface:'#f1f7f6',heading:'#e3ecec',band:'#3f6668',bandInk:'#f1f8f7',ink:'#22302f',muted:'#546766',line:'#a3b7b6',accent:'#2f6f72',button:'#f6fbfa',buttonInk:'#22302f',buttonLine:'#74908f',selected:'#2f5f66',selectedInk:'#ffffff'},{background:'#f6fbfa',ink:'#22302f',muted:'#546766',title:'#2c3f3f',link:'#2f6f72',area:'#e6efee',line:'#aec1c0',entry:'#f1f7f6',entryInk:'#22302f',selected:'#cfe0de',selectedInk:'#1a2726',feature:'#e8f1f0',featureInk:'#22302f',tableHeading:'#d8e5e4',tableHeadingInk:'#22302f',tableCell:'#f6fbfa',tableAlternate:'#e8f1f0',tableInk:'#22302f',tableLine:'#aec1c0'})},
 {id:'night',name:'夜航',description:'深蓝灰底、浅色文字，夜间模式使用的方案',dark:true,colors:set({background:'#1c2028',surface:'#262c35',heading:'#303846',band:'#4b5565',bandInk:'#ffffff',ink:'#e2e6ea',muted:'#aeb7c2',line:'#525c68',accent:'#aebbcf',button:'#3a4354',buttonInk:'#e2e6ea',buttonLine:'#8a94a6',selected:'#5b6b84',selectedInk:'#ffffff'},{background:'#262c35',ink:'#e2e6ea',muted:'#aeb7c2',title:'#e2e6ea',link:'#b8c5d3',area:'#303846',line:'#525c68',entry:'#262c35',entryInk:'#e2e6ea',selected:'#424b57',selectedInk:'#ffffff',feature:'#303846',featureInk:'#e2e6ea',tableHeading:'#424b57',tableHeadingInk:'#ffffff',tableCell:'#262c35',tableAlternate:'#303846',tableInk:'#e2e6ea',tableLine:'#525c68'})},
 {id:'ember',name:'炉火',description:'深褐底、暖金强调，适合地下城与炉边夜谈',dark:true,colors:set({background:'#231f1c',surface:'#2d2824',heading:'#363029',band:'#7a5a3a',bandInk:'#fff2e2',ink:'#ece4d8',muted:'#b8ab9b',line:'#5a4f45',accent:'#e0a46b',button:'#3b332c',buttonInk:'#ece4d8',buttonLine:'#8a7b6b',selected:'#8a5a2b',selectedInk:'#ffffff'},{background:'#2d2824',ink:'#ece4d8',muted:'#b8ab9b',title:'#f3e9da',link:'#e0a46b',area:'#363029',line:'#5a4f45',entry:'#2d2824',entryInk:'#ece4d8',selected:'#4a3f35',selectedInk:'#ffffff',feature:'#363029',featureInk:'#ece4d8',tableHeading:'#4a3f35',tableHeadingInk:'#ffffff',tableCell:'#2d2824',tableAlternate:'#363029',tableInk:'#ece4d8',tableLine:'#5a4f45'})},
];
/** Effective value for a key: the saved one, else the night fallback, else the default. */
export function effectiveColor(group:AppearanceGroup,key:string,value=current):string{
 const night=typeof document!=='undefined'&&document.documentElement.dataset.suiteNight==='true',fallback=PRESETS.find(p=>p.id==='night')!.colors[group] as Record<string,string>,definitions=(group==='ui'?UI_COLORS:WIKI_COLORS) as Record<string,readonly [string,string]>;
 return value[group][key]||(night?fallback[key]:undefined)||definitions[key][1];
}
export const currentPreset=(value=current)=>PRESETS.find(p=>(['ui','wiki'] as const).every(group=>Object.entries(p.colors[group]).every(([key,color])=>effectiveColor(group,key,value).toLowerCase()===color.toLowerCase())))?.id;
export function applyPreset(id:string){const preset=PRESETS.find(p=>p.id===id);if(!preset)return false;return replaceAppearance(structuredClone(preset.colors));}
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
 const dark=PRESETS.find(p=>p.id==='night')!.colors as Record<AppearanceGroup,Record<string,string>>;
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
if(typeof window!=='undefined'){restore();window.addEventListener('storage',event=>{if(event.key==='full-suite/ui-theme'){if(['night','graphite','parchment','celadon'].includes(event.newValue||''))applyPreset(event.newValue!);return;}if(event.key===APPEARANCE_KEY||event.key==='full-suite/ui-tone'||event.key==='full-suite/ui-night'||event.key===null){restore();window.dispatchEvent(new Event(APPEARANCE_EVENT));}});new MutationObserver(()=>applyAppearance()).observe(document.documentElement,{attributes:true,attributeFilter:['data-suite-night']});}
