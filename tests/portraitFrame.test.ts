import {describe,it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {readCharacter,validateCharacter,importOwlbear} from '../src/core/validation';
import {exportCharacter,exportLinkedOwlbear} from '../src/core/export';
import {evaluate} from '../src/core/engine';
import {displayCharacterEdit,applyDisplayCharacterEdit,sameCharacterMechanics} from '../src/core/displayCharacterEdit';
import {documentChanges,expandChanges} from '../src/platform/document-delta';
import {portraitCoverScale} from '../src/ui/portraitGeometry';
const image={data:'data:image/png;base64,aGVsbG8=',x:21,y:-17,zoom:2.5,frameWidth:104,frameHeight:110};
describe('per-character avatar frame preference',()=>{
 it('leaves old and new characters unchanged until explicitly toggled',()=>{
  const c=newCharacter(),before=structuredClone(c);
  expect(c.portraitFrameHidden).toBeUndefined();expect(validateCharacter(c)).toEqual(before);expect(readCharacter(c).repaired).toEqual([]);expect(c).toEqual(before);
 });
 it.each([true,false])('retains %s through native backup and linked Owlbear exchange',hidden=>{
  const c={...newCharacter(),portrait:image,illustration:{...image,zoom:1},portraitFrameHidden:hidden};
  expect(validateCharacter(JSON.parse(JSON.stringify(exportCharacter(c))))).toEqual(c);
  const linked=exportLinkedOwlbear(c,evaluate(c));expect(importOwlbear(JSON.parse(JSON.stringify(linked)))).toEqual(c);
 });
 it.each([null,0,1,'true',[],{}])('rejects invalid frame preference %j',invalid=>{
  expect(()=>validateCharacter({...newCharacter(),portraitFrameHidden:invalid})).toThrow('头像框显示设置无效');
 });
 it('changes only a display scalar, reuses expensive branches, and deduplicates identical intents',()=>{
  const c={...newCharacter(),portrait:image,illustration:image};c.runtime.resources.spent={current:1,max:5};const before=structuredClone(c);
  const action=displayCharacterEdit('portraitFrameHidden',true),next=applyDisplayCharacterEdit(c,action)!;
  expect(next.portraitFrameHidden).toBe(true);expect(c).toEqual(before);
  for(const key of ['portrait','illustration','selections','answers','profile','runtime','abilities'] as const)expect(next[key]).toBe(c[key]);
  expect(sameCharacterMechanics(c,next)).toBe(true);
  expect(applyDisplayCharacterEdit(next,displayCharacterEdit('portraitFrameHidden',true))).toBe(next);
  const normal=applyDisplayCharacterEdit(next,displayCharacterEdit('portraitFrameHidden',false))!;
  expect(normal.portrait).toBe(image);expect(normal.portraitFrameHidden).toBe(false);
  // The same typed intent also works with ordinary edit implementations.
  const draft=structuredClone(c);action(draft);expect(draft.portraitFrameHidden).toBe(true);
 });
 it('sends only the native preference delta, without serializing an avatar or changing resources',()=>{
  const c={...newCharacter(),portrait:image},next=applyDisplayCharacterEdit(c,displayCharacterEdit('portraitFrameHidden',true))!;
  const changes=documentChanges(c,next);expect(changes).toEqual([{path:['portraitFrameHidden'],before:undefined,after:true,observed:undefined,remove:false}]);
  expect(expandChanges(c,changes,'after')).toEqual(next);expect(expandChanges(next,changes,'before')).toEqual(c);
  expect(JSON.stringify(changes)).not.toContain(image.data);
 });
 it('retains preference without an image, after image replacement/removal, and during image repair',()=>{
  const c={...newCharacter(),portraitFrameHidden:true};expect(validateCharacter(c).portraitFrameHidden).toBe(true);
  const replaced={...c,portrait:image};expect(validateCharacter(replaced).portraitFrameHidden).toBe(true);
  const repaired=readCharacter({...c,portrait:{...image,data:'https://example.com/token.png'},illustration:image});
  expect(repaired.repaired).toEqual(['头像']);expect(repaired.character.portraitFrameHidden).toBe(true);expect(repaired.character.illustration).toEqual(image);
 });
});
describe('unclipped cover geometry',()=>{
 it.each([[240,80,100,100,3],[80,240,100,100,3],[400,200,200,100,1],[100,100,200,100,2],[100,100,100,200,2]])('preserves original cover scale for %s×%s in %s×%s',(w,h,fw,fh,scale)=>{
  expect(portraitCoverScale(w,h,fw,fh)).toBeCloseTo(scale);
  const contained=Math.min(fw/w,fh/h),cover=Math.max(fw/w,fh/h);
  expect(contained*portraitCoverScale(w,h,fw,fh)).toBeCloseTo(cover);
 });
 it.each([[0,10,10,10],[10,0,10,10],[10,10,0,10],[10,10,10,0],[NaN,10,10,10],[10,Infinity,10,10]])('handles an unloaded or hidden frame',(...size)=>expect(portraitCoverScale(...size as [number,number,number,number])).toBe(1));
});
