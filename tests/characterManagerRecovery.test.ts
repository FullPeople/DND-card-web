import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CharacterManager,characterDeleteFailure} from '../src/ui/CharacterManager';

describe('role directory batch-delete recovery',()=>{
 it('removes only acknowledged successes and preserves failed/unattempted IDs',()=>{
  expect(characterDeleteFailure(['a','b','c'],{completedIds:['a'],uncertain:false})).toEqual({completedIds:['a'],remainingIds:['b','c'],uncertainIds:[]});
 });
 it('locks only the dispatched uncertain item, not later unattempted items',()=>{
  expect(characterDeleteFailure(['a','b','c'],{completedIds:['a'],uncertain:true,uncertainIds:['b']})).toEqual({completedIds:['a'],remainingIds:['b','c'],uncertainIds:['b']});
 });
 it('never treats a 404 as successful removal or cleanup authority',()=>{
  expect(characterDeleteFailure(['a','b'],Object.assign(Error('404'),{status:404,diagnostic:{code:'DOCUMENT_UNAVAILABLE'}}))).toEqual({completedIds:[],remainingIds:['a','b'],uncertainIds:[]});
 });
 it('ignores completion and uncertainty IDs outside the requested batch',()=>{
  expect(characterDeleteFailure(['a','b'],{completedIds:['outside','a','a'],uncertain:true,uncertainIds:['a','b','outside']})).toEqual({completedIds:['a'],remainingIds:['b'],uncertainIds:['b']});
 });
 it('conservatively blocks unresolved items when an older caller lacks uncertainty IDs',()=>{
  expect(characterDeleteFailure(['a','b','c'],{completedIds:['a'],uncertain:true})).toEqual({completedIds:['a'],remainingIds:['b','c'],uncertainIds:['b','c']});
 });
 it('retains a conservative lock when an uncertain caller supplies only unrelated IDs',()=>{
  expect(characterDeleteFailure(['a','b'],{uncertain:true,uncertainIds:['outside']})).toEqual({completedIds:[],remainingIds:['a','b'],uncertainIds:['a','b']});
 });
 it('does not turn malformed completions or a string uncertainty flag into success',()=>{
  expect(characterDeleteFailure(['a'],{completedIds:'a',uncertain:'false'})).toEqual({completedIds:[],remainingIds:['a'],uncertainIds:[]});
 });
});

describe('role directory pending-state presentation',()=>{
 const render=(extra:Record<string,unknown>)=>renderToStaticMarkup(createElement(CharacterManager,{rows:[{id:'a',name:'Authored fixture',write:true}],currentId:'a',disabled:false,open:()=>{},read:async()=>[],remove:async()=>{},create:async()=>{},review:()=>{},...extra}));
 it('distinguishes a dispatched delete from an unknown outcome across component mounts',()=>{
  const html=render({pendingDeleteIds:['a']});expect(html).toContain('删除处理中');expect(html).toContain('正在等待宿主确认');expect(html).not.toContain('删除结果尚未确认');expect(html).not.toContain('删除待核对');
 });
 it('shows an unknown outcome only from the retained uncertainty lock',()=>{
  const html=render({blockedDeleteIds:['a']});expect(html).toContain('删除待核对');expect(html).toContain('删除结果尚未确认');expect(html).not.toContain('删除处理中');expect(html).not.toContain('正在等待宿主确认');
 });
});
