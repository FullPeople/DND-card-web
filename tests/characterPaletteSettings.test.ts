import {describe,it,expect} from 'vitest';
import {parseCharacterPaletteSettings} from '../src/platform/characterPaletteSettings';
import {parseSitePaletteSettings} from '../src/platform/paletteSettings';
import {newCharacter} from '../src/core/model';
import {applyDisplayCharacterEdit,displayCharacterPaletteEdit,sameCharacterMechanics} from '../src/core/displayCharacterEdit';
import {CARD_PALETTE_PRESETS,cardPalettePreset} from '../src/ui/cardPalettePresets';
import {sheetPaletteStyle,validCardPalette} from '../src/core/palette';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';

const card={palette:{paper:'#CCDDEE'},components:{all:{heading:'#AABBCC'},abilities:{surface:'#BBCCDD'}}};
const combined={format:'dnd-card-palette',version:1,appearance:{ui:{background:'#223344'},wiki:{entry:'#BBCDAA'}},card};
describe('independent character and website palettes',()=>{
 it('imports each domain of a legacy combined file independently',()=>{
  expect(parseSitePaletteSettings(JSON.stringify(combined))).toEqual({format:'dnd-card-palette',version:1,appearance:combined.appearance});
  expect(parseCharacterPaletteSettings(JSON.stringify(combined))).toEqual({format:'dnd-character-palette',version:1,card});
  expect(parseSitePaletteSettings(JSON.stringify({...combined,card:{invalid:true}})).appearance).toEqual(combined.appearance);
  expect(parseCharacterPaletteSettings(JSON.stringify({...combined,appearance:{invalid:true}})).card).toEqual(card);
 });
 it('roundtrips the character-only format and rejects unrelated or invalid data',()=>{
  const settings={format:'dnd-character-palette',version:1,card};expect(parseCharacterPaletteSettings(JSON.stringify(settings))).toEqual(settings);
  for(const value of [null,{...settings,version:2},{...settings,card:undefined},{...settings,appearance:{}},{...settings,card:{palette:{paper:'red'},components:{}}},{...settings,card:{palette:{},components:{future:{ink:'#123456'}}}},{...combined,card:undefined}])expect(()=>parseCharacterPaletteSettings(JSON.stringify(value))).toThrow();
  expect(()=>parseSitePaletteSettings(JSON.stringify(settings))).toThrow();
 });
 it.each(['dnd-character-palette','dnd-card-palette'])('reopens %s title colours through full character JSON without changing precedence or mechanics',format=>{
  for(const explicitAll of [false,true]){
   const legacy={paper:'#CCDDEE',surface:'#EEEEEE',frame:'#334455',heading:'#445566',ink:'#223344',badge:'#556677',headingInk:'#123456'};
   const components={all:{heading:'#AABBCC',...(explicitAll?{headingInk:'#654321'}:{})},abilities:{surface:'#BBCCDD',headingInk:'#ABCDEF'}};
   const file={format,version:1,...(format==='dnd-card-palette'?{appearance:{invalid:true}}:{}),card:{palette:legacy,components}},original=structuredClone(file);
   const imported=parseCharacterPaletteSettings(JSON.stringify(file));
   const before=newCharacter();before.runtime.hp=3;before.runtime.resources.spent={name:'Spent',current:1,max:5};
   const next=applyDisplayCharacterEdit(before,displayCharacterPaletteEdit({palette:imported.card.palette,componentPalette:imported.card.components}))!;
   const reopened=readCharacter(JSON.parse(JSON.stringify(exportCharacter(next)))).character;
   const {headingInk,...legacySix}=legacy;
   expect(imported.card.palette).toEqual(legacySix);expect(imported.card.components).toEqual({...components,all:{...components.all,headingInk:explicitAll?'#654321':headingInk}});
   const style=sheetPaletteStyle(reopened.palette,reopened.componentPalette);expect(style['--card-all-headingInk']).toBe(explicitAll?'#654321':'#123456');expect(style['--card-abilities-headingInk']).toBe('#ABCDEF');
   expect(reopened.palette).toEqual(legacySix);expect(reopened.componentPalette).toEqual(imported.card.components);expect(reopened.runtime).toEqual(before.runtime);expect(sameCharacterMechanics(before,next)).toBe(true);expect(before.palette).toBeUndefined();expect(file).toEqual(original);
   expect(parseCharacterPaletteSettings(JSON.stringify(imported))).toEqual(imported);
  }
 });
 it.each([
  {palette:{headingInk:'red'},components:{all:{headingInk:'#123456'}}},
  {palette:{headingInk:'#123456'},components:{all:{headingInk:'red'}}},
 ])('rejects invalid title colours before resolving competing layers: %j',invalid=>{
  for(const format of ['dnd-character-palette','dnd-card-palette'])expect(()=>parseCharacterPaletteSettings(JSON.stringify({format,version:1,appearance:format==='dnd-card-palette'?combined.appearance:undefined,card:invalid}))).toThrow('角色卡配色设置无效');
 });
 it('applies both colour fields atomically without touching mechanics or resources',()=>{
  const before=newCharacter();before.runtime.resources.spent={name:'Spent',current:1,max:5};before.runtime.hp=3;
  const next=applyDisplayCharacterEdit(before,displayCharacterPaletteEdit({palette:card.palette,componentPalette:card.components}))!;
  expect(next.palette).toBe(card.palette);expect(next.componentPalette).toBe(card.components);expect(next.runtime).toBe(before.runtime);expect(sameCharacterMechanics(before,next)).toBe(true);
  const reset=applyDisplayCharacterEdit(next,displayCharacterPaletteEdit({palette:undefined,componentPalette:undefined}))!;
  expect(reset.palette).toBeUndefined();expect(reset.componentPalette).toBeUndefined();expect(reset.runtime.resources.spent.current).toBe(1);
  expect(applyDisplayCharacterEdit(next,displayCharacterPaletteEdit({palette:next.palette,componentPalette:next.componentPalette}))).toBe(next);
 });
 it('provides valid complete examples and recognizes inherited original colours',()=>{
  expect(CARD_PALETTE_PRESETS.length).toBeGreaterThanOrEqual(5);expect(cardPalettePreset(newCharacter())).toBe('graphite');
  for(const preset of CARD_PALETTE_PRESETS){expect(validCardPalette(preset.colors)).toBe(true);expect(cardPalettePreset({componentPalette:{all:preset.colors}})).toBe(preset.id);expect(sheetPaletteStyle({}, {all:preset.colors})['--card-all-paper']).toBe(preset.colors.paper);}
  expect(cardPalettePreset({componentPalette:{abilities:{ink:'#123456'}}})).toBeUndefined();
 });
});
