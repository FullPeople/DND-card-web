import {it,expect} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {evaluate} from '../src/core/engine';
import {classSkillWarnings} from '../src/ui/skillChoiceWarnings';
function fixture(){
 const c=newCharacter('2014');c.automation=newAutomationState();
 const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']):Entry=>({id,kind,name:id,english:id,source:'PHB',edition:'2014',packId:'authored',revision:'1',entries:[],raw});
 c.selections=[{id:'class',entry:entry('Authored Class','class',{startingProficiencies:{skills:[{choose:{from:['history','athletics','perception'],count:2}}]}}),level:1,quantity:1,equipped:false},{id:'background',entry:entry('Authored Background','background',{skillProficiencies:[{history:true}]}),level:1,quantity:1,equipped:false}];
 c.answers['class:skills:0']=['history','perception'];
 return c;
}
it('reports an active background grant while excluding the choice itself and never mutates old answers',()=>{
 const c=fixture(),before=structuredClone(c),choice=sheetChoices(c)[0];
 expect(classSkillWarnings(c,choice)).toEqual({history:['Authored Background · PHB']});expect(c).toEqual(before);
});
it('includes manual proficiency and expertise, deduplicates origins and preserves distinct source labels',()=>{
 const c=fixture();c.proficiencies={athletics:true};c.expertise={perception:true};c.selections[1].entry.raw.skillProficiencies.push({history:true});
 expect(classSkillWarnings(c,sheetChoices(c)[0])).toEqual({history:['Authored Background · PHB'],athletics:['手动记录'],perception:['专精']});
});
it('does not warn from a disabled grant or its orphaned descendants',()=>{
 const c=fixture();c.profile.disabledEntries=[c.selections[1].entry.id];
 c.selections.push({...structuredClone(c.selections[1]),id:'child',parentId:'background',entry:{...c.selections[1].entry,id:'other-child',kind:'feature'}});
 expect(classSkillWarnings(c,sheetChoices(c)[0])).toEqual({});
});
it('leaves other editions, background choices and restricted owners outside this advisory',()=>{
 const c=fixture(),choice=sheetChoices(c)[0];c.edition='2024';expect(classSkillWarnings(c,choice)).toEqual({});
 c.edition='2014';expect(classSkillWarnings(c,{...choice,ownerId:'background'})).toEqual({});expect(classSkillWarnings(c,{...choice,restricted:true})).toEqual({});
});
it('keeps the duplicate answer until an explicit replacement, then retains the background grant and spent resources',()=>{
 const c=fixture();c.runtime.hp=7;c.runtime.resources['authored-spent']={current:1,max:3};
 const before=structuredClone(c),choice=sheetChoices(c)[0];classSkillWarnings(c,choice);
 expect(c).toEqual(before);setSheetChoiceSlot(c,choice.id,0,'athletics',[]);
 const next=sheetChoices(c)[0],warnings=classSkillWarnings(c,next);
 expect(next.selected).toEqual(['athletics','perception']);expect(next.selected.filter(id=>warnings[id])).toEqual([]);
 expect(evaluate(c).skills.history.sources).toEqual(['Authored Background · PHB']);expect(evaluate(c).skills.athletics.proficient).toBe(true);
 expect(c.abilities).toEqual(before.abilities);expect(c.selections).toEqual(before.selections);expect(c.runtime).toEqual(before.runtime);
});
