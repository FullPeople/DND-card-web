import {it,expect} from 'vitest';
import {trainingCaption,trainingDisplayText} from '../src/ui/trainingReferences';

it('shows known weapon names without a wiki while retaining reference identity',()=>{
 for(const [english,chinese] of [['battleaxe','战斧'],['handaxe','手斧'],['light hammer','轻锤'],['warhammer','战锤']]){
  expect(trainingDisplayText(english,'PHB','weapons')).toBe(`{@item ${english}|PHB|${chinese}}`);
  expect(trainingCaption(`${english}|PHB`,english,'weapons')).toBe(chinese);
  expect(trainingCaption(`{@item ${english}|PHB}`,english,'weapons')).toBe(chinese);
 }
 expect(trainingCaption("smith's tools|PHB","smith's tools",'tools')).toBe('铁匠工具');
 expect(trainingCaption('battleaxe','battleaxe','weapons','XPHB')).toBe('战斧');
});
it('preserves custom captions, translated catalog labels, unknown names and source identities',()=>{
 expect(trainingCaption('battleaxe|PHB|我的斧头','我的斧头','weapons')).toBe('我的斧头');
 expect(trainingCaption('battleaxe|PHB','资料中的战斧','weapons')).toBe('资料中的战斧');
 expect(trainingCaption('battleaxe|HOME','battleaxe','weapons')).toBe('battleaxe');
 expect(trainingCaption('battleaxe','battleaxe','weapons','HOME')).toBe('battleaxe');
 expect(trainingCaption('unknown weapon|PHB','unknown weapon','weapons')).toBe('unknown weapon');
 expect(trainingCaption('{@spell battleaxe|PHB}','battleaxe','weapons')).toBe('battleaxe');
 expect(trainingDisplayText('我的斧头','HOME','weapons')).toBe('我的斧头');
});
