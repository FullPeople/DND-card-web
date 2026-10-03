import {describe,it,expect} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {entryDragIntent,entryDragPage} from '../src/ui/entryDragIntent';
import {dropRejection} from '../src/ui/dropRejection';
import {trainingCategory} from '../src/core/training';
import {readableEntries} from '../src/data/adapt';

const tool:Entry={id:'fixture-tool',name:'原创校准器',english:'Original Calibrator',kind:'item',source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:[],raw:{_category:'baseitem',type:'AT|XPHB'}};
describe('source-aware proficiency dragging',()=>{
 it('routes the same tool by source intent without changing its catalog identity',()=>{
  const before=structuredClone(tool),training=entryDragIntent(tool,{libraryTab:'weaponProperty'}),equipment=entryDragIntent(tool,{libraryTab:'item'});
  expect(training).toBe('training');expect(entryDragPage(tool,training)).toBe('主要');expect(equipment).toBe('entry');expect(entryDragPage(tool,equipment)).toBe('背包');expect(entryDragPage(tool,training,true)).toBeUndefined();expect(tool).toEqual(before);
 });
 it.each(['AT','T','INS','GS','VEH','SHP','AIR','LA','MA','HA','S','M','R'])('recognizes %s equipment training structurally, without matching labels',type=>{
  const entry={...tool,name:'任意改名',raw:{type}};expect(entryDragIntent(entry,{libraryTab:'weaponProperty'})).toBe('training');expect(entryDragIntent(entry,{libraryTab:'item'})).toBe('entry');
 });
 it('does not turn unrelated items or an ordinary equipment link into training',()=>{
  expect(entryDragIntent({...tool,raw:{type:'G'}},{libraryTab:'weaponProperty'})).toBe('entry');expect(entryDragIntent(tool)).toBe('entry');expect(entryDragIntent(tool,{trainingSource:true})).toBe('training');
 });
 it('accepts training only at training receivers and rejects inventory even with an item predicate',()=>{
  const c=newCharacter(),before=JSON.stringify(c),intent=entryDragIntent(tool,{libraryTab:'weaponProperty'}),inventory={kinds:['item'] as ['item'],allowExisting:true,accepts:(e:Entry)=>e.kind==='item'};
  expect(dropRejection(c,tool,inventory,intent)).toContain('熟练类别');expect(dropRejection(c,tool,inventory,'entry')).toBeUndefined();
  expect(dropRejection(c,tool,{kinds:['item'],training:true,allowExisting:true,accepts:e=>trainingCategory(e)==='tools'},intent)).toBeUndefined();
  expect(dropRejection(c,tool,{kinds:['item'],training:true,accepts:e=>trainingCategory(e)==='armor'},intent)).toContain('限定条件');expect(JSON.stringify(c)).toBe(before);
 });
 it('keeps duplicate inventory separate from proficiency and preserves restricted choice validation',()=>{
  const c=newCharacter();c.selections=[{id:'owned',entry:tool,quantity:2,level:1,equipped:false}];
  expect(dropRejection(c,tool,{training:true,allowExisting:true,accepts:e=>trainingCategory(e)==='tools'},'training')).toBeUndefined();
  expect(dropRejection(c,tool,{referenceOnly:true,accepts:e=>e.id===tool.id},'training')).toBeUndefined();
  expect(dropRejection(c,tool,{referenceOnly:true,accepts:()=>false,rejectReason:'限定熟练项'},'training')).toBe('限定熟练项');
  c.profile.disabledEntries=[tool.id];expect(dropRejection(c,tool,{training:true,allowExisting:true,accepts:()=>true},'training')).toContain('单独禁用');
 });
 it('marks only declared starting proficiencies as training, leaving equipment prose distinct',()=>{
  const sections=readableEntries({source:'XPHB',startingProficiencies:{tools:['{@item 原创校准器|XPHB}']},startingEquipment:{entries:['{@item 原创校准器|XPHB}']}},'class') as Record<string,unknown>[];
  expect(sections[0]._trainingSection).toBe(true);expect(sections[1]._trainingSection).toBeUndefined();
 });
});
