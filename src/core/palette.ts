export const CARD_COLORS = {paper:'#ededeb',surface:'#e8e8e8',frame:'#595959',heading:'#7c7c7c',ink:'#343532',badge:'#555555'};
export type CardColor = keyof typeof CARD_COLORS;
export type CardPalette = Partial<Record<CardColor,string>>;
export const CARD_COMPONENTS = ['identity','abilities','skills','vitals','features','spells','inventory','background','resources','portrait'] as const;
export type CardComponent = typeof CARD_COMPONENTS[number];
export const isPaletteColor = (value:unknown):value is string => typeof value==='string'&&/^#[\da-f]{6}$/i.test(value);
export const validCardPalette = (value:unknown):value is CardPalette => !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).every(([key,color])=>Object.hasOwn(CARD_COLORS,key)&&isPaletteColor(color));
export function sheetPaletteStyle(palette:CardPalette={},components:Partial<Record<CardComponent,CardPalette>>={}){
 const values:Record<string,string>={};
 for(const key of Object.keys(CARD_COLORS) as CardColor[]){values[`--card-all-${key}`]=palette[key]||CARD_COLORS[key];values[`--paper-${key}`]=`var(--card-all-${key})`;}
 for(const component of CARD_COMPONENTS)for(const [key,value] of Object.entries(components[component]||{}))if(isPaletteColor(value))values[`--card-${component}-${key}`]=value;
 return values;
}
