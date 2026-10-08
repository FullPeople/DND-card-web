import {describe,it,expect} from 'vitest';
import {customCopy,createCustomEntry} from '../src/core/customEntries';
import {customEntryExample,parseCustomEntryJson,validateCustomFields} from '../src/core/customEntrySchema';
import {resourceModuleMinimum,normalizeModuleWidget,type ResourceModule} from '../src/core/resourceWidgets';
import {customVisibilityAllows} from '../src/ui/customVisibility';
import {matchesLibraryTab} from '../src/ui/libraryData';
import {dropRejection} from '../src/ui/dropRejection';
import {newCharacter} from '../src/core/model';

describe('custom document authoring and compact resource groups',()=>{
 it('copies identity, full structured content and edition without sharing source objects',()=>{
  const original=parseCustomEntryJson(JSON.stringify(customEntryExample('spell')));original.id='spell:official';original.source='XPHB';original.packId='core';original.edition='2024';delete original.raw._custom;delete original.raw._workbenchCustom;original.raw.components.m={text:'星石',cost:25,consume:true};
  const before=structuredClone(original),copy=customCopy(original);expect(copy.id).not.toBe(original.id);expect(copy).toMatchObject({kind:'spell',edition:'2024',source:'CUSTOM',packId:'custom'});expect(copy.entries).toEqual(original.entries);expect(copy.raw.components).toEqual(original.raw.components);copy.raw.components.m.text='修改材料';(copy.entries[1] as any).entries.push('新正文');expect(original).toEqual(before);
  expect(matchesLibraryTab(copy,'spell')).toBe(true);expect(matchesLibraryTab(copy,'custom')).toBe(true);expect(customVisibilityAllows(copy,'native')).toBe(false);expect(customVisibilityAllows(original,'custom')).toBe(false);
 });
 it('retains monster traits, lair content and base body in a fresh editable monster',()=>{
  const source=parseCustomEntryJson(JSON.stringify(customEntryExample('monster')));source.source='MM';source.raw._legendaryGroup={lairActions:['真实结构']};const copy=customCopy(source);expect(copy.raw.action).toEqual(source.raw.action);expect(copy.raw._legendaryGroup).toEqual(source.raw._legendaryGroup);expect(copy.raw.entries).toEqual(copy.entries);expect(()=>validateCustomFields('monster',copy.raw,copy.entries)).not.toThrow();
  copy.raw.hp.average=30;expect(source.raw.hp.average).toBe(22);expect(()=>validateCustomFields('monster',{...copy.raw,str:0},copy.entries)).toThrow(/六项属性/);expect(()=>validateCustomFields('monster',{...copy.raw,action:'broken'},copy.entries)).toThrow(/必须是数组/);
 });
 it('allows copying an existing or unselected-version source without granting it to the character',()=>{
  const c=newCharacter(),entry=createCustomEntry({name:'已有条目',type:'feat',body:'内容',edition:'2014'});c.selections.push({id:'selection',entry,level:1,quantity:1,equipped:false});const before=structuredClone(c);expect(dropRejection(c,entry,{authoring:true,accepts:()=>true})).toBeUndefined();expect(c).toEqual(before);
 });
 it('scales grouped minima by actual child count and preserves deliberately saved geometry and counters',()=>{
  const module=(count:number):ResourceModule=>({id:'spell-slot:1',name:'法术位',slots:true,rows:Array.from({length:count},(_,i)=>[`spell-slot:${i+1}`,{name:'法术位',current:1,max:4}] as ResourceModule['rows'][number])});
  expect(resourceModuleMinimum(module(1),'poolpips')).toEqual({w:3,h:2});expect(normalizeModuleWidget(module(1))).toMatchObject({w:3,h:2});expect(resourceModuleMinimum(module(3),'poolpips')).toEqual({w:4,h:3});expect(resourceModuleMinimum(module(6),'poolpips')).toEqual({w:6,h:4});expect(resourceModuleMinimum(module(9),'poolpips')).toEqual({w:8,h:5});
  const m=module(1),before=structuredClone(m);expect(normalizeModuleWidget(m,{style:'poolpips',w:7,h:5})).toMatchObject({w:7,h:5});expect(m).toEqual(before);
 });
});
