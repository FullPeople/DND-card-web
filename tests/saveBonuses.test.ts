import {describe,expect,it} from 'vitest';
import {ABILITIES,newCharacter,type Edition,type Entry} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {exportCharacter,exportLinkedOwlbear,exportOwlbear} from '../src/core/export';
import {importOwlbear,validateCharacter} from '../src/core/validation';
import {documentChanges,expandChanges} from '../src/platform/document-delta';
import {setAutomationEnabled} from '../src/core/automation/state';

function fixture(edition:Edition='2024'){
 const c=newCharacter(edition),source=edition==='2014'?'PHB':'XPHB';
 const entry:Entry={id:'save-bonus-class',name:'原创豁免职业',english:'Authored Save Class',kind:'class',source,edition,packId:'fixture',revision:'1',entries:[],raw:{hd:{faces:8},proficiency:['str','wis']}};
 c.selections=[{id:'class',entry,level:5,quantity:1,equipped:false}];c.abilities={str:16,dex:14,con:12,int:10,wis:8,cha:18};c.proficiencies={'save:con':true};c.skillBonuses={perception:2};c.runtime.tempHp=4;c.runtime.resources={spent:{name:'原创已用资源',current:1,max:4}};return c;
}
describe('saving throw manual offsets',()=>{
 it.each(['2014','2024'] as const)('adds signed offsets once after the existing %s calculations without changing skills or proficiency',edition=>{
  const c=fixture(edition),base=evaluate(c);c.saveBonuses={str:3,dex:-2,con:0,int:9999,wis:-9999,cha:1};const before=structuredClone(c),d=evaluate(c);
  for(const ability of ABILITIES){expect(d.saves[ability].value).toBe(base.saves[ability].value+(c.saveBonuses[ability]||0));expect(d.saves[ability].proficient).toBe(base.saves[ability].proficient);}
  expect(d.trace['save:str']).toContain('豁免额外调整 +3');expect(d.trace['save:dex']).toContain('豁免额外调整 -2');expect(d.trace['save:con'].join('')).not.toContain('额外调整');expect(d.skills).toEqual(base.skills);expect(d.passive).toBe(base.passive);expect(c).toEqual(before);expect(evaluate(c)).toEqual(d);
 });
 it('supplements legacy final-value overrides, and zero/removal restores the original result',()=>{
  const c=fixture();c.adjustments=[{id:'old',target:'save:str',value:9,reason:'保留原卡总值'}];c.saveBonuses={str:-3};expect(evaluate(c).saves.str.value).toBe(6);expect(evaluate(c).trace['save:str']).toEqual(['力量调整值 3','熟练加值 +3','人工覆盖 9：保留原卡总值','豁免额外调整 -3']);
  c.saveBonuses.str=0;expect(evaluate(c).saves.str.value).toBe(9);delete c.saveBonuses.str;expect(evaluate(c).saves.str.value).toBe(9);expect(c.adjustments[0].value).toBe(9);
 });
 it('retains the offset through source disable/restore, automation switches and native/linked imports without refilling resources',()=>{
  const c=fixture();c.saveBonuses={str:3,dex:-2,con:0};const before=structuredClone(c);c.profile.disabledEntries=['save-bonus-class'];expect(evaluate(c).saves.str).toEqual({value:6,proficient:false});delete c.profile.disabledEntries;
  for(const enabled of [false,true,false]){setAutomationEnabled(c,enabled);let restored=validateCharacter(exportCharacter(c));for(let i=0;i<3;i++)restored=importOwlbear(exportLinkedOwlbear(restored,evaluate(restored)));expect(restored.saveBonuses).toEqual(before.saveBonuses);expect(restored.runtime).toEqual(before.runtime);expect(restored.proficiencies).toEqual(before.proficiencies);expect(evaluate(restored).saves).toEqual(evaluate(before).saves);}
 });
 it('projects the final total and independently applies native and legacy deltas, including zero/removal',()=>{
  let before=fixture();const after=structuredClone(before);after.saveBonuses={str:4,dex:-1};
  for(const next of [after,{...after,saveBonuses:{str:-3,dex:2}},{...after,saveBonuses:{str:0}},{...after,saveBonuses:undefined}]){
   const projectedBefore=exportOwlbear(before,evaluate(before)),projectedAfter=exportOwlbear(next,evaluate(next));
   const native=expandChanges(before,documentChanges(before,next,before),'after'),legacy=expandChanges(projectedBefore,documentChanges(projectedBefore,projectedAfter,projectedBefore),'after');
   expect(native.saveBonuses).toEqual(next.saveBonuses);expect(legacy.abilities.str.save.bonus).toBe(evaluate(next).saves.str.value);expect(legacy.abilities.dex.save.bonus).toBe(evaluate(next).saves.dex.value);expect(importOwlbear(exportLinkedOwlbear(native,evaluate(native))).saveBonuses).toEqual(next.saveBonuses);
   const legacyOnly=importOwlbear(legacy);expect(evaluate(legacyOnly).saves).toEqual(evaluate(next).saves);expect(evaluate(importOwlbear(exportOwlbear(legacyOnly,evaluate(legacyOnly)))).saves).toEqual(evaluate(next).saves);before=next;
  }
 });
 it.each([{unknown:1},{str:0.5},{str:10000},{str:-10000},{str:NaN},{str:Infinity},{str:'2'},[],null].map(value=>[value]))('rejects invalid imported offsets before mutation: %j',saveBonuses=>{
  const c=fixture(),before=structuredClone(c);expect(()=>validateCharacter({...c,saveBonuses})).toThrow(/豁免额外调整值/);expect(c).toEqual(before);
 });
 it('keeps old cards with an absent field unchanged and accepts explicit signed integer boundaries and zero',()=>{
  const c=fixture();expect(validateCharacter(exportCharacter(c)).saveBonuses).toBeUndefined();c.saveBonuses={str:-9999,dex:9999,con:0};expect(validateCharacter(exportCharacter(c)).saveBonuses).toEqual(c.saveBonuses);
 });
});
