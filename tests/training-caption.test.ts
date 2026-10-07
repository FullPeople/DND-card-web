import {describe,it,expect} from 'vitest';
import {trainingCaption} from '../src/ui/trainingReferences';
describe('read-only training captions preserve reference ownership',()=>{
 it.each(["Tinker's Tools","TINKER’S TOOLS","tinkers tools"] )('shows the existing tool translation for %s',value=>{
  expect(trainingCaption(value,value,'tools')).toBe('修补工具');
 });
 it('preserves authored captions, unknown tools and typed spell/item identity',()=>{
  expect(trainingCaption("{@item Tinker's Tools|PHB|My repaired kit}",'My repaired kit','tools')).toBe('My repaired kit');
  expect(trainingCaption('Unknown homebrew tool','Unknown homebrew tool','tools')).toBe('Unknown homebrew tool');
  expect(trainingCaption('athletics','athletics','tools')).toBe('athletics');
  expect(trainingCaption('shield','shield','tools')).toBe('shield');
  expect(trainingCaption('{@spell Shield|PHB}','Shield','armor')).toBe('Shield');
  expect(trainingCaption('{@item Shield|PHB}','Shield','armor')).toBe('Shield');
  expect(trainingCaption("Tinker's Tools","Tinker's Tools",'languages')).toBe("Tinker's Tools");
 });
});
