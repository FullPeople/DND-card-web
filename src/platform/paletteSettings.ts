import {CARD_COMPONENTS,validCardPalette,type CardComponent,type CardPalette} from '../core/palette';
import {UI_COLORS,WIKI_COLORS,type Appearance} from './appearance';

export type PaletteSettings={format:'dnd-card-palette';version:1;appearance:Appearance;card?:{palette:CardPalette;components:Partial<Record<CardComponent,CardPalette>>}};
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
/** Validate the complete file before touching browser preferences or a character. */
export function parsePaletteSettings(text:string):PaletteSettings{
 const value:unknown=JSON.parse(text);
 if(!record(value)||value.format!=='dnd-card-palette'||value.version!==1||!record(value.appearance))throw Error('这不是支持的配色设置文件。');
 const appearance:Appearance={ui:{},wiki:{}};
 for(const group of ['ui','wiki'] as const){const colors=value.appearance[group],definitions=group==='ui'?UI_COLORS:WIKI_COLORS;
  if(!record(colors)||!Object.entries(colors).every(([key,color])=>Object.hasOwn(definitions,key)&&typeof color==='string'&&/^#[\da-f]{6}$/i.test(color)))throw Error('配色设置中包含无效的颜色，原设置保留。');
  appearance[group]={...colors} as Record<string,string>;
 }
 const result:PaletteSettings={format:'dnd-card-palette',version:1,appearance};
 if(value.card!==undefined){const card=value.card;if(!record(card)||!validCardPalette(card.palette)||!record(card.components)||!Object.entries(card.components).every(([key,colors])=>(key==='all'||CARD_COMPONENTS.includes(key as typeof CARD_COMPONENTS[number]))&&validCardPalette(colors)))throw Error('角色卡配色设置无效，原设置保留。');
  result.card={palette:{...card.palette},components:structuredClone(card.components)};
 }
 return result;
}

export function hexToHsv(hex:string){
 const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255,max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
 let h=delta===0?0:max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;
 return {h:(h*60+360)%360,s:max===0?0:delta/max,v:max};
}
export function hsvToHex({h,s,v}:{h:number;s:number;v:number}){
 const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
 const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
 return '#'+[r,g,b].map(value=>Math.round((value+m)*255).toString(16).padStart(2,'0')).join('').toUpperCase();
}
