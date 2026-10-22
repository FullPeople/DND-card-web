import {describe,it,expect} from 'vitest';
import {parseCharacterPaletteSettings} from '../src/platform/characterPaletteSettings';
import {parseSitePaletteSettings} from '../src/platform/paletteSettings';
import {newCharacter} from '../src/core/model';
import {applyDisplayCharacterEdit,displayCharacterPaletteEdit,sameCharacterMechanics} from '../src/core/displayCharacterEdit';
import {CARD_PALETTE_PRESETS,cardPalettePreset} from '../src/ui/cardPalettePresets';
import {sheetPaletteStyle,validCardPalette} from '../src/core/palette';

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
