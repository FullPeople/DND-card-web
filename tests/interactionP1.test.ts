import {describe,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {newCharacter,type Entry} from '../src/core/model';
import {entryApplyDescription,EntryApplyAction} from '../src/ui/EntryApplyAction';
import {QuickStart} from '../src/ui/QuickStart';

const entry=(kind:Entry['kind'],id:string=kind,raw:Entry['raw']={}):Entry=>({id,kind,name:id,english:id,source:'PHB',edition:'2014',packId:'authored-p1',revision:'1',entries:[],raw});
describe('explicit inspect and apply',()=>{
 it('leaves the character unchanged while presenting an action and its replacement target',()=>{
  const c=newCharacter('2014'),old=entry('race','existing');c.selections=[{id:'s1',entry:old,level:1,quantity:1,equipped:false}];const before=structuredClone(c);
  expect(entryApplyDescription(c,entry('race','candidate'))).toMatchObject({replace:true,note:'将替换「existing」'});
  expect(c).toEqual(before);
 });
 it('makes adding another class level explicit instead of presenting it as a generic add',()=>{
  const c=newCharacter('2014'),job=entry('class');c.selections=[{id:'job',entry:job,level:3,quantity:1,equipped:false}];
  expect(entryApplyDescription(c,job)).toMatchObject({label:'职业等级 +1',note:'3 → 4 级',replace:false});
 });
 it('does not describe an unrelated subclass as a replacement',()=>{
  const c=newCharacter('2014'),a=entry('class','a',{name:'a'}),b=entry('class','b',{name:'b'});c.selections=[{id:'a',entry:a,level:3,quantity:1,equipped:false},{id:'b',entry:b,level:3,quantity:1,equipped:false},{id:'sub-a',entry:entry('subclass','sub-a',{className:'a',classSource:'PHB'}),parentId:'a',level:1,quantity:1,equipped:false}];
  expect(entryApplyDescription(c,entry('subclass','sub-b',{className:'b',classSource:'PHB'})).replace).toBe(false);
 });
 it.each(['只读角色','连接已断开','上一项修改尚未确认'])('keeps the reason visible and cannot offer a write when %s',reason=>{
  const apply=vi.fn(),html=renderToStaticMarkup(createElement(EntryApplyAction,{entry:entry('item'),character:newCharacter('2014'),disabledReason:reason,editing:true,editReady:true,enableEditing:vi.fn(),apply}));
  expect(html).toContain(reason);expect(html).toContain('disabled=""');expect(apply).not.toHaveBeenCalled();
 });
 it('offers enabling editing separately, while an item can be added in play mode',()=>{
  const props={character:newCharacter('2014'),editing:false,editReady:true,enableEditing:vi.fn(),apply:vi.fn()};
  expect(renderToStaticMarkup(createElement(EntryApplyAction,{...props,entry:entry('spell')}))).toContain('开启编辑以填入');
  expect(renderToStaticMarkup(createElement(EntryApplyAction,{...props,entry:entry('item')}))).toContain('加入背包');
  expect(props.apply).not.toHaveBeenCalled();
 });
});
describe('light first-use view',()=>{
 it('offers the current edition, filling and import without eagerly rendering source settings',()=>{
  const html=renderToStaticMarkup(createElement(QuickStart,{edition:'2014',locked:false,start:vi.fn(),importCard:vi.fn(),settings:vi.fn()}));
  expect(html).toContain('aria-checked="true"><strong>2014');expect(html).toContain('开始填写');expect(html).toContain('导入已有角色');expect(html).not.toContain('配置码');expect(html).not.toContain('type="checkbox"');
 });
 it('preserves room ownership and hides unavailable room import',()=>{
  const html=renderToStaticMarkup(createElement(QuickStart,{edition:'2024',locked:true,canImport:false,start:vi.fn(),importCard:vi.fn(),settings:vi.fn()}));
  expect(html).toContain('规则由 DM 管理');expect(html.match(/role="radio"[^>]*disabled=""/g)).toHaveLength(2);expect(html).not.toContain('导入已有角色');
 });
});
