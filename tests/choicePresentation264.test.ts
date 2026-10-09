import {describe,expect,it} from 'vitest';
import {newCharacter,type Character,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {builtinOptionsVisible,chooseSheetOption,setBuiltinOptionsVisible,setSheetChoiceIgnored,setSheetChoiceSlot,sheetChoiceIgnored,sheetChoicePending,sheetChoices} from '../src/core/automation/choices';
import {cardSyncCopies} from '../src/platform/cardSyncCopies';
import {validateCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
import {evaluate} from '../src/core/engine';

function card():Character{
 const c=newCharacter();c.automation=newAutomationState();
 const entry:Entry={id:'authored-class',name:'原创验收职业',english:'Authored Class',kind:'class',source:'XPHB',edition:'2024',packId:'fixture',revision:'1',entries:[],raw:{startingProficiencies:{skills:[{choose:{from:['athletics','history','perception'],count:2}}]}}},feature:Entry={...entry,id:'authored-feature',kind:'feature',name:'原创验收特性',raw:{},choices:[{id:'flavor',label:'原创选项',count:1,options:['A','B']}]};
 c.selections=[{id:'owner',entry,quantity:1,level:1,equipped:false},{id:'feature',entry:feature,quantity:1,level:1,equipped:false,parentId:'owner'}];
 c.runtime.hp=7;c.runtime.resources.test={name:'原创资源',max:3,current:1};return c;
}
describe('choice presentation acknowledgements',()=>{
 it('ignores only the outline and visibility, retaining the real partial answer and effects',()=>{
  const c=card(),id=sheetChoices(c)[0].id;setSheetChoiceSlot(c,id,0,'athletics');const original=structuredClone(c),before=evaluate(c);
  setSheetChoiceIgnored(c,id,true);const choice=sheetChoices(c)[0];expect(choice.selected).toEqual(['athletics']);expect(choice.complete).toBe(false);expect(sheetChoicePending(c,choice)).toBe(false);expect(evaluate(c)).toEqual(before);expect(c.answers).toEqual(original.answers);expect(c.runtime).toEqual(original.runtime);expect(builtinOptionsVisible(c,'owner')).toBe(true);
 });
 it('hides the whole source only after every option is filled or ignored, including an explicit show override',()=>{
  const c=card(),[skill,feature]=sheetChoices(c);setBuiltinOptionsVisible(c,'owner',true);setSheetChoiceIgnored(c,skill.id,true);expect(builtinOptionsVisible(c,'owner')).toBe(true);chooseSheetOption(c,feature.id,'A');expect(builtinOptionsVisible(c,'owner')).toBe(false);expect(sheetChoices(c)[0]).toMatchObject({selected:[],complete:false});
  setBuiltinOptionsVisible(c,'owner',true);expect(builtinOptionsVisible(c,'owner')).toBe(true);expect(sheetChoicePending(c,sheetChoices(c)[0])).toBe(false);
 });
 it('can restore a gap without destroying answers, and keeps acknowledgements across JSON export/import',()=>{
  const c=card(),[skill]=sheetChoices(c);setSheetChoiceSlot(c,skill.id,0,'athletics');setSheetChoiceIgnored(c,skill.id,true);const restored=validateCharacter(exportCharacter(c));expect(sheetChoiceIgnored(restored,skill.id)).toBe(true);setSheetChoiceIgnored(restored,skill.id,false);expect(restored.answers).toEqual(c.answers);expect(sheetChoicePending(restored,sheetChoices(restored)[0])).toBe(true);expect(builtinOptionsVisible(restored,'owner')).toBe(true);
 });
 it('rejects malformed or duplicate acknowledgement IDs before import mutation',()=>{
  for(const ignoredChoices of [['x','x'],[false],['x'.repeat(2001)],{},Array.from({length:10001},(_,i)=>String(i))]){const c=card();c.featureLayout={order:[],expanded:[],ignoredChoices:ignoredChoices as string[]};expect(()=>validateCharacter(c)).toThrow(/忽略选项/);}
  const c=card(),before=structuredClone(c);expect(()=>setSheetChoiceIgnored(c,'missing',true)).toThrow();expect(c).toEqual(before);
 });
 it('synchronizes the current identity and hides unfilled choices without changing its backup or balances',()=>{
  const original=card(),migrated=structuredClone(original);migrated.id='preview-copy';migrated.edition='2014';migrated.profile.optional.legacy=true;setBuiltinOptionsVisible(migrated,'owner',true);const before=structuredClone(original),{backup,current}=cardSyncCopies(original,migrated);
  expect(original).toEqual(before);expect(backup.answers).toEqual(before.answers);expect(backup.featureLayout).toEqual(before.featureLayout);expect(backup.id).not.toBe(original.id);expect(current.id).toBe(original.id);expect(current.createdAt).toBe(original.createdAt);expect(current.answers).toEqual(original.answers);expect(current.runtime).toEqual(original.runtime);expect(sheetChoices(current).every(choice=>!sheetChoicePending(current,choice))).toBe(true);expect(sheetChoices(current).every(choice=>!choice.complete&&choice.selected.length===0)).toBe(true);expect(builtinOptionsVisible(current,'owner')).toBe(false);
 });
 it('does not enable disabled automation or pre-acknowledge future choices during legacy sync',()=>{
  const original=card();original.automation!.enabled=false;const {current}=cardSyncCopies(original,original);expect(current.automation!.enabled).toBe(false);current.automation!.enabled=true;expect(sheetChoices(current).every(choice=>!sheetChoicePending(current,choice))).toBe(true);
  current.selections[1].entry.choices!.push({id:'new-level-option',label:'新增等级选项',count:1,options:['C']});expect(sheetChoices(current).find(choice=>choice.label==='新增等级选项')).toMatchObject({complete:false,selected:[]});expect(sheetChoicePending(current,sheetChoices(current).at(-1)!)).toBe(true);expect(original.selections[1].entry.choices).toHaveLength(1);
 });
});
