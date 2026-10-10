import {expect,it} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {ignoreUnfilledSheetChoices,sheetChoices,sheetChoiceIgnored,sheetChoicePending,setSheetChoiceIgnored,setSheetChoiceSlot} from '../src/core/automation/choices';
import {validateCharacter} from '../src/core/validation';

function fixture(){
 const entries=normalizeData({class:[{name:'战士',ENG_name:'Fighter',source:'PHB',edition:'classic',classFeatures:['属性值提升|战士||4','属性值提升|战士||8']}],classFeature:[4,8].map(level=>({name:'属性值提升',ENG_name:'Ability Score Improvement',source:'PHB',className:'战士',classSource:'PHB',level,entries:['{@5etools 原创目录标签|feats.html}']})),feat:[{name:'原创专长',source:'PHB',entries:['原创记录。']}]},'import-ignore');
 const c=newCharacter('2014');c.automation=newAutomationState();c.selections=[{id:'owner',entry:entries.find(row=>row.kind==='class')!,level:4,quantity:1,equipped:false}];return {c,entries};
}
it('ignores ASI choices loaded after import, preserves mechanical data and leaves later level grants pending',()=>{
 const {c,entries}=fixture(),before=structuredClone(c);ignoreUnfilledSheetChoices(c,[]);
 const fourth=sheetChoices(c,entries).find(row=>row.grantLevel===4)!;expect(fourth).toBeTruthy();expect(sheetChoiceIgnored(c,fourth.id,fourth)).toBe(true);expect(sheetChoicePending(c,fourth)).toBe(false);
 expect(c.answers).toEqual(before.answers);expect(c.abilities).toEqual(before.abilities);expect(c.runtime).toEqual(before.runtime);expect(c.selections).toEqual(before.selections);
 c.selections[0].level=8;const eighth=sheetChoices(c,entries).find(row=>row.grantLevel===8)!;expect(sheetChoicePending(c,eighth)).toBe(true);expect(sheetChoiceIgnored(c,fourth.id,fourth)).toBe(true);
 expect(validateCharacter(JSON.parse(JSON.stringify(c))).featureLayout?.ignoredClassGrants?.owner.level).toBe(4);
});
it('explicitly restoring an ignored late choice allows filling it without changing other ignored grants',()=>{
 const {c,entries}=fixture();ignoreUnfilledSheetChoices(c,[]);const choice=sheetChoices(c,entries)[0];
 setSheetChoiceIgnored(c,choice.id,false,entries);expect(sheetChoicePending(c,choice)).toBe(true);
 const option=choice.options.find(row=>row.entry.raw._classAbilityRecord)!;setSheetChoiceSlot(c,choice.id,0,option.value,entries);
 expect(c.answers[choice.id]).toEqual([option.value]);expect(sheetChoiceIgnored(c,choice.id,choice)).toBe(false);expect(c.abilities.str).toBe(10);
});
it('rejects malformed imported choice bounds and preserves completed choices',()=>{
 const {c,entries}=fixture(),choice=sheetChoices(c,entries)[0],option=choice.options.find(row=>row.entry.raw._classAbilityRecord)!;setSheetChoiceSlot(c,choice.id,0,option.value,entries);ignoreUnfilledSheetChoices(c,entries);
 expect(sheetChoices(c,entries)[0].complete).toBe(true);expect(c.answers[choice.id]).toEqual([option.value]);
 const invalid=structuredClone(c);invalid.featureLayout!.ignoredClassGrants!.owner.level=21;expect(()=>validateCharacter(invalid)).toThrow(/范围/);
});
