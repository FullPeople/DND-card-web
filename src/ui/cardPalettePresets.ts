import type {Character} from '../core/model';
import {CARD_COLORS,CARD_COMPONENTS,type CardPalette} from '../core/palette';

export const CARD_PALETTE_PRESETS:ReadonlyArray<{id:string;name:string;description:string;colors:Required<CardPalette>}>= [
 {id:'graphite',name:'原色灰阶',description:'浅灰纸面、深灰边框和白字标题',colors:{...CARD_COLORS}},
 {id:'parchment',name:'暖纸棕墨',description:'暖米色纸面和棕色标题，适合旅行手记',colors:{paper:'#F1EBDD',surface:'#EAE2CE',frame:'#625747',heading:'#796B55',headingInk:'#FFFFFF',ink:'#353027',badge:'#746147'}},
 {id:'moss',name:'林地苔绿',description:'灰绿纸面和墨绿标题，适合自然主题',colors:{paper:'#E7EBE1',surface:'#DBE2D4',frame:'#4C5A48',heading:'#5B7055',headingInk:'#FFFFFF',ink:'#293326',badge:'#4D6747'}},
 {id:'celadon',name:'青瓷蓝灰',description:'青灰纸面和黛青标题，适合清晰阅读',colors:{paper:'#E3ECEB',surface:'#D8E5E3',frame:'#455F61',heading:'#527678',headingInk:'#FFFFFF',ink:'#263637',badge:'#42696D'}},
 {id:'violet',name:'暮色紫灰',description:'浅紫灰纸面和深紫标题，保留深色边框',colors:{paper:'#EAE6ED',surface:'#DED7E4',frame:'#5B4E65',heading:'#756181',headingInk:'#FFFFFF',ink:'#342C3B',badge:'#6B557A'}},
 {id:'night',name:'夜航蓝墨',description:'深蓝灰纸面、浅色文字和清晰边框',colors:{paper:'#232A33',surface:'#303B47',frame:'#9CAABC',heading:'#56697E',headingInk:'#FFFFFF',ink:'#ECF0F5',badge:'#B1C6DE'}},
];

/** Presets are display data only and are loaded with the editor, never on a card switch. */
export function cardPalettePreset(character?:Pick<Character,'palette'|'componentPalette'>){
 if(!character||CARD_COMPONENTS.some(component=>Object.keys(character.componentPalette?.[component]||{}).length))return;
 return CARD_PALETTE_PRESETS.find(preset=>Object.entries(preset.colors).every(([key,color])=>(character.componentPalette?.all?.[key as keyof CardPalette]||character.palette?.[key as keyof CardPalette]||CARD_COLORS[key as keyof typeof CARD_COLORS]).toLowerCase()===color.toLowerCase()))?.id;
}
