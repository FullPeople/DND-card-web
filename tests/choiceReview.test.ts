import {expect,it} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {ignoreUnfilledSheetChoices,sheetChoices,sheetChoicePending,setSheetChoiceIgnored} from '../src/core/automation/choices';
import {validateCharacter} from '../src/core/validation';
import {acknowledgedView,recordReviewedRoots,reviewedLateChoices} from '../src/platform/choiceReview';

function fixture(){
 const entries=normalizeData({class:[{name:'游侠',ENG_name:'Ranger',source:'PHB',edition:'classic',startingProficiencies:{tools:[{any:1}]}}],race:[{name:'半精灵',ENG_name:'Half-Elf',source:'PHB',languageProficiencies:[{any:1}]}],item:[{name:'木工工具',ENG_name:"Carpenter's Tools",source:'PHB',type:'AT'},{name:'制图工具',ENG_name:"Cartographer's Tools",source:'PHB',type:'AT'}]},'choice-review');
 const c=newCharacter('2014');c.automation=newAutomationState();
 c.selections=[{id:'owner',entry:entries.find(row=>row.kind==='class')!,level:3,quantity:1,equipped:false},{id:'race',entry:entries.find(row=>row.kind==='race')!,level:1,quantity:1,equipped:false}];
 return {c,entries};
}
const pending=(c:ReturnType<typeof fixture>['c'],entries:ReturnType<typeof fixture>['entries'],id:string)=>{const choices=sheetChoices(c,entries),view=acknowledgedView(c,choices),choice=choices.find(row=>row.id===id)!;expect(choice).toBeTruthy();return sheetChoicePending(view,choice);};

it('a recorded tool answer is not a gap while the catalog has not loaded, but stays one once the catalog lacks it',()=>{
 const {c,entries}=fixture();const tool=entries.find(row=>row.kind==='item')!;c.answers['owner:tools:0']=[tool.id];
 expect(reviewedLateChoices(c,sheetChoices(c,[]))).toEqual(['owner:tools:0']);
 expect(pending(c,entries,'owner:tools:0')).toBe(false);
 const other=entries.filter(row=>row.kind!=='item'||row.id!==tool.id);expect(pending(c,other,'owner:tools:0')).toBe(true);
 const blank={...c,answers:{}};expect(reviewedLateChoices(blank,sheetChoices(blank,[]))).toEqual([]);
});
it('a sync records every root selection as reviewed and keeps the validated, exported shape',()=>{
 const {c,entries}=fixture();ignoreUnfilledSheetChoices(c,entries);recordReviewedRoots(c);
 expect(c.featureLayout?.ignoredClassGrants).toEqual({owner:{entryId:c.selections[0].entry.id,level:3},race:{entryId:c.selections[1].entry.id,level:1}});
 expect(validateCharacter(JSON.parse(JSON.stringify(c))).featureLayout?.ignoredClassGrants?.race.level).toBe(1);
});
it('gaps that surface after the sync under a reviewed root stay acknowledged until that class levels up',()=>{
 const {c,entries}=fixture();ignoreUnfilledSheetChoices(c,entries);recordReviewedRoots(c);
 // A second tool block and a second language block appear only later (later catalog or sync pass).
 c.selections[0].entry.raw.startingProficiencies.tools.push({any:1});c.selections[1].entry.raw.languageProficiencies.push({any:1});
 expect(c.featureLayout?.ignoredChoices).not.toContain('owner:tools:1');
 expect(pending(c,entries,'owner:tools:1')).toBe(false);expect(pending(c,entries,'race:languages:1')).toBe(false);
 // The stored character is never changed by the view.
 expect(acknowledgedView(c,sheetChoices(c,entries))).not.toBe(c);expect(c.featureLayout?.ignoredChoices).not.toContain('owner:tools:1');
 // A re-imported document with fresh row ids still matches the reviewed entries.
 c.selections[0].id='fresh';expect(pending(c,entries,'fresh:tools:1')).toBe(false);c.selections[0].id='owner';
 // Resuming one choice by hand reopens just that one.
 setSheetChoiceIgnored(c,'owner:tools:1',false,entries);expect(pending(c,entries,'owner:tools:1')).toBe(true);expect(pending(c,entries,'race:languages:1')).toBe(false);
 // Levelling the class past the reviewed level reopens its new gaps; the race stays acknowledged.
 c.selections[0].level=4;expect(pending(c,entries,'owner:tools:0')).toBe(false);
 c.selections[0].entry.raw.startingProficiencies.tools.push({any:1});expect(pending(c,entries,'owner:tools:2')).toBe(true);expect(pending(c,entries,'race:languages:1')).toBe(false);
});
it('without a sync nothing is acknowledged',()=>{
 const {c,entries}=fixture();expect(reviewedLateChoices(c,sheetChoices(c,entries))).toEqual([]);expect(acknowledgedView(c,sheetChoices(c,entries))).toBe(c);
});
