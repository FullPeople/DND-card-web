import {describe,it,expect} from 'vitest';
import {createCustomEntry} from '../src/core/customEntries';
import {trainingCategory} from '../src/ui/trainingData';
import {newCharacter,selectionAllowed} from '../src/core/model';
describe('authored content routing',()=>{
 it('retains external card records under shared book settings while honoring an explicit ban',()=>{
  const c=newCharacter(),entry=createCustomEntry({name:'旧角色职业',type:'class',body:''});entry.source='IMPORTED';entry.packId='imported';
  expect(selectionAllowed(c,entry)).toBe(true);c.profile.disabledEntries=[entry.id];expect(selectionAllowed(c,entry)).toBe(false);
 });
 it('retains one identity while editing its type, text and physical fields',()=>{
  const item=createCustomEntry({name:'水晶',type:'item',body:'第一段\n\n第二段',raw:{weight:2,value:500}});
  const spell=createCustomEntry({id:item.id,name:item.name,type:'spell',body:'新效果',raw:{level:3},revision:'2'});
  expect(item.entries).toEqual(['第一段','第二段']);expect(item.raw.weight).toBe(2);expect(spell.id).toBe(item.id);expect(spell.kind).toBe('spell');expect(spell.revision).toBe('2');
 });
 it('uses existing training categories rather than custom item names',()=>{
  const language=createCustomEntry({name:'旧语',type:'language',body:''});
  const tool=createCustomEntry({name:'织布针',type:'tool',body:''});
  expect(trainingCategory(language)).toBe('languages');expect(trainingCategory(tool)).toBe('tools');
  const weapon=createCustomEntry({name:'试制武器',type:'weapon',body:''});
  const changed=createCustomEntry({name:weapon.name,type:'tool',body:'',raw:weapon.raw});
  expect(trainingCategory(changed)).toBe('tools');
  const c=newCharacter();c.profile.enabledSources.push('CUSTOM');expect(selectionAllowed(c,language)).toBe(true);
 });
 it('rejects bad structures and cannot override the chosen kind/category with raw fields',()=>{
  expect(()=>createCustomEntry({name:'x',type:'invalid',body:''})).toThrow();
  expect(()=>createCustomEntry({name:'x',type:'item',body:'',raw:{weight:-1}})).toThrow();
  expect(()=>createCustomEntry({name:'x',type:'item',body:'',raw:[]})).toThrow();
  const e=createCustomEntry({name:'x',type:'condition',body:'',raw:{_customType:'item',_category:'language'}});
  expect(e.kind).toBe('condition');expect(e.raw._category).toBeUndefined();
 });
});
