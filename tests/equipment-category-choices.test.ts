import {describe,expect,it} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {claimStartingEquipment,equipmentCandidates,equipmentTypeLabel,sheetChoices} from '../src/core/automation/choices';

describe('5etools starting equipment categories',()=>{
 const entries=normalizeData({
  background:[{name:'测试流浪者',source:'XPHB',entries:[],startingEquipment:[{A:[{equipmentType:'setGaming'},{equipmentType:'toolArtisan'},{equipmentType:'instrumentMusical'}]}]}],
  item:[
   {name:'测试赌具',source:'XPHB',type:'GS|XPHB',entries:[]},
   {name:'测试工匠工具',source:'XPHB',type:'AT|XPHB',entries:[]},
   {name:'测试乐器',source:'XPHB',type:'INS|XPHB',entries:[]},
   {name:'错误普通工具',source:'XPHB',type:'T',entries:[]},
  ],
 },'equipment-category-regression');
 const background=entries.find(entry=>entry.kind==='background')!;
 const catalog=entries.filter(entry=>entry.kind==='item');

 it('shows translated labels and only the matching item category',()=>{
  expect(['setGaming','toolArtisan','instrumentMusical'].map(equipmentTypeLabel)).toEqual(['赌具','工匠工具','乐器']);
  expect(equipmentCandidates('setGaming',background,catalog).map(entry=>entry.name)).toEqual(['测试赌具']);
  expect(equipmentCandidates('toolArtisan',background,catalog).map(entry=>entry.name)).toEqual(['测试工匠工具']);
  expect(equipmentCandidates('instrumentMusical',background,catalog).map(entry=>entry.name)).toEqual(['测试乐器']);
 });

 it('claims a background package after every category is selected',()=>{
  const c=newCharacter();c.automation=newAutomationState();c.selections.push({id:'background-owner',entry:background,level:1,quantity:1,equipped:false});
  const choice=sheetChoices(c,catalog).find(row=>row.channel==='equipment')!;
  const picks=Object.fromEntries(catalog.filter(entry=>entry.name.startsWith('测试')).map((entry,index)=>[`${index}:0`,entry.id]));
  claimStartingEquipment(c,choice.id,'A',catalog,picks);
  expect(c.selections.filter(row=>row.entry.kind==='item').map(row=>row.entry.name)).toEqual(['测试赌具','测试工匠工具','测试乐器']);
 });
});
