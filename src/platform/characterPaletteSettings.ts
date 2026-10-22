import type {CardComponent,CardPalette} from '../core/palette';
import {parsePaletteSettings} from './paletteSettings';

export type CharacterPaletteSettings={format:'dnd-character-palette';version:1;card:{palette:CardPalette;components:Partial<Record<CardComponent,CardPalette>>}};

/** Legacy character palettes have six keys; title ink belongs to the component layer. */
function normalizeTitleInk(card:CharacterPaletteSettings['card']):CharacterPaletteSettings['card']{
 const {headingInk,...palette}=card.palette;
 if(headingInk===undefined)return card;
 return {palette,components:{...card.components,all:{headingInk,...card.components.all}}};
}

/** Accept old combined files, but return only this character's colours. */
export function parseCharacterPaletteSettings(text:string):CharacterPaletteSettings{
 const value:unknown=JSON.parse(text);
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('这不是支持的角色卡配色文件。');
 const source=value as Record<string,unknown>;
 if(source.format==='dnd-card-palette'){
  const legacy=parsePaletteSettings(JSON.stringify({format:source.format,version:source.version,appearance:{ui:{},wiki:{}},card:source.card}));
  if(!legacy.card)throw Error('文件中没有角色卡配色，请选择角色卡配色文件。');
  return {format:'dnd-character-palette',version:1,card:normalizeTitleInk(legacy.card)};
 }
 if(source.format!=='dnd-character-palette'||source.version!==1||source.appearance!==undefined)throw Error('这不是支持的角色卡配色文件。');
 const parsed=parsePaletteSettings(JSON.stringify({format:'dnd-card-palette',version:1,appearance:{ui:{},wiki:{}},card:source.card}));
 if(!parsed.card)throw Error('角色卡配色文件缺少颜色，原设置保留。');
 return {format:'dnd-character-palette',version:1,card:normalizeTitleInk(parsed.card)};
}
