import {describe,it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {validateCharacter,importOwlbear} from '../src/core/validation';
import {exportCharacter,exportLinkedOwlbear} from '../src/core/export';
import {evaluate} from '../src/core/engine';
import {applyDisplayCharacterEdit,displayCharacterEdit,sameCharacterMechanics} from '../src/core/displayCharacterEdit';
describe('page portrait framing persistence',()=>{
 it('preserves separate geometry through native and linked exchange without duplicating image bytes or regranting resources',()=>{
  const c=newCharacter();c.portrait={data:'data:image/png;base64,aGVsbG8=',x:2,y:3,zoom:1.3};c.runtime.resources.used={current:1,max:5};const next=applyDisplayCharacterEdit(c,displayCharacterEdit('portraitPageFraming',{overview:{x:22,y:12,zoom:2},spells:{x:-15,y:5,zoom:1.5}}))!;
  expect(next.portrait).toBe(c.portrait);expect(next.runtime).toBe(c.runtime);expect(sameCharacterMechanics(c,next)).toBe(true);expect(validateCharacter(JSON.parse(JSON.stringify(exportCharacter(next))))).toEqual(next);expect(importOwlbear(exportLinkedOwlbear(next,evaluate(next)))).toEqual(next);
 });
 it.each([{unknown:{x:0,y:0,zoom:1}},{overview:{x:301,y:0,zoom:1}},{spells:{x:0,y:0,zoom:0}},{features:{x:0,y:0,zoom:1,data:'private'}},{inventory:null}])('rejects malformed preferences before mutation %j',framing=>{const c=newCharacter(),before=structuredClone(c);expect(()=>validateCharacter({...c,portraitPageFraming:framing})).toThrow('逐页头像');expect(c).toEqual(before);});
});
