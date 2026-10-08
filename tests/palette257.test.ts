import {describe,it,expect} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {validateCharacter,parseFile} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
import {evaluate} from '../src/core/engine';
import {sheetPaletteStyle} from '../src/core/palette';
import {applyDisplayCharacterEdit,displayCharacterEdit,sameCharacterMechanics} from '../src/core/displayCharacterEdit';
import {readAppearance} from '../src/platform/appearance';

describe('palette persistence and rules boundaries',()=>{
 it('roundtrips component colors in full JSON without refilling spent resources',()=>{
  const before=newCharacter();before.runtime.resources.spent={name:'Spent',current:1,max:5};before.runtime.hp=3;
  const next=applyDisplayCharacterEdit(before,displayCharacterEdit('componentPalette',{all:{headingInk:'#123456'},abilities:{surface:'#abcdef'},spells:{heading:'#345678'}}))!;
  expect(sameCharacterMechanics(before,next)).toBe(true);expect(evaluate(next)).toEqual(evaluate(before));expect(next.runtime).toBe(before.runtime);
  const restored=validateCharacter(parseFile(JSON.stringify(exportCharacter(next))));expect(restored.componentPalette).toEqual(next.componentPalette);expect(restored.runtime.resources.spent.current).toBe(1);expect(restored.runtime.hp).toBe(3);expect(before.componentPalette).toBeUndefined();
  expect(sheetPaletteStyle(restored.palette,restored.componentPalette)['--card-abilities-surface']).toBe('#abcdef');
 });
 it('rejects unknown components and non-color values before importing a character',()=>{
  const c=newCharacter();for(const componentPalette of [{spells:{heading:'url(https://invalid.example)'}},{future:{ink:'#123456'}},{spells:{unknown:'#123456'}},{all:['#123456']}])expect(()=>validateCharacter({...c,componentPalette})).toThrow();
  expect(readAppearance('{"ui":{"ink":"#123456","background":"url(x)","unknown":"#123456"},"wiki":{"tableInk":"#abcdef"}}')).toEqual({ui:{ink:'#123456'},wiki:{tableInk:'#abcdef'}});expect(readAppearance('broken')).toEqual({ui:{},wiki:{}});
 });
});

