import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot,syncChoiceContent} from '../src/core/automation/choices';
import {optionalChoiceSupport} from '../src/core/automation/classChoiceSupport';
import {evaluate} from '../src/core/engine';
import {validateCharacter} from '../src/core/validation';

const data={class:[{name:'战士',ENG_name:'Fighter',source:'PHB',edition:'classic',classFeatures:['属性值提升|战士||4']}],classFeature:[{name:'属性值提升',ENG_name:'Ability Score Improvement',source:'PHB',className:'战士',classSource:'PHB',level:4,entries:['{@5etools 原创目录标签|feats.html}']}],feat:[{name:'原创替代记录',source:'PHB',entries:['原创测试记录。'],effects:[{op:'add',target:'str',value:2}]}]};
function setup(){const entries=normalizeData(data,'authored-support');entries.find(entry=>entry.kind==='feat')!.effects=[{op:'add',target:'str',value:2}];const c=newCharacter('2014');c.automation=newAutomationState();c.selections=[{id:'owner',entry:entries.find(entry=>entry.kind==='class')!,level:4,quantity:1,equipped:false}];return {c,entries};}
it('offers the verified legacy ASI rule as a manual record and works when optional feats are disabled',()=>{
 const {c,entries}=setup();c.profile.optional.feats=false;const choice=sheetChoices(c,entries).find(choice=>choice.id.includes(':class-legacy-feat:'))!;
 expect(choice.support).toMatchObject({rule:'verified',execution:'record-only',publication:'unverified'});
 const ability=choice.options.find(option=>option.entry.raw._classAbilityRecord)!;const before=JSON.stringify(c.abilities),runtime=JSON.stringify(c.runtime);
 setSheetChoiceSlot(c,choice.id,0,ability.value,entries);syncChoiceContent(c,entries);expect(c.selections).toHaveLength(1);expect(JSON.stringify(c.abilities)).toBe(before);expect(JSON.stringify(c.runtime)).toBe(runtime);
 expect(choice.options.find(option=>option.entry.kind==='feat')!.unavailable).toBeTruthy();
 expect(validateCharacter(JSON.parse(JSON.stringify(c))).answers[choice.id]).toEqual([ability.value]);
});
it('records a legacy alternative feat without activating its effects and keeps source evidence offline after downgrade',()=>{
 const {c,entries}=setup(),choice=sheetChoices(c,entries).find(choice=>choice.id.includes(':class-legacy-feat:'))!,feat=choice.options.find(option=>option.entry.kind==='feat')!;
 setSheetChoiceSlot(c,choice.id,0,feat.value,entries);syncChoiceContent(c,entries);expect(evaluate(c).abilities.str).toBe(10);expect(c.selections).toHaveLength(1);
 c.selections[0].level=3;const offline=sheetChoices(c,[]).find(row=>row.id===choice.id)!;expect(offline.count).toBe(0);expect(offline.slots).toEqual([feat.value]);expect(offline.selected).toEqual([]);
 c.selections[0].level=4;c.profile.enabledSources=[];expect(sheetChoices(c,[]).find(row=>row.id===choice.id)!.restricted).toBe(true);expect(c.answers[choice.id]).toEqual([feat.value]);
});
it('grades exact source identities and keeps unverified later infusion totals at source-declared',()=>{
 const [owner]=normalizeData({class:[{name:'魔契师',ENG_name:'Warlock',source:'XPHB'}]},'authored-support');
 expect(optionalChoiceSupport(owner,['ei'],3,2)).toMatchObject({rule:'verified',execution:'record-only',publication:'unverified'});
 expect(optionalChoiceSupport({...owner,source:'PHB'},['EI'],3,2).rule).toBe('source-declared');
 const [infuser]=normalizeData({class:[{name:'奇械师',ENG_name:'Artificer',source:'TCE'}]},'authored-support');
 expect(optionalChoiceSupport(infuser,['AI'],4,2).rule).toBe('verified');expect(optionalChoiceSupport(infuser,['AI'],6,6).rule).toBe('source-declared');
});
it('uses existing verified effect evaluation for a selected 2024 feat while ASI scores remain manual',()=>{
 const entries=normalizeData({class:[{name:'战士',ENG_name:'Fighter',source:'XPHB',classFeatures:['原创提升|战士|XPHB|4']}],classFeature:[{name:'原创提升',source:'XPHB',className:'战士',classSource:'XPHB',level:4,entries:['{@feat 原创属性提升|XPHB}']}],feat:[{name:'原创属性提升',source:'XPHB',category:'G',repeatable:true,ability:[{choose:{from:['str','dex'],amount:2}}],entries:[]},{name:'原创已适配效果',source:'XPHB',category:'G',entries:[]}]},'authored-effects');
 const c=newCharacter();c.automation=newAutomationState();c.notes='手工记录保留';c.selections=[{id:'owner',entry:entries.find(entry=>entry.kind==='class')!,level:4,quantity:1,equipped:false}];
 const choice=sheetChoices(c,entries).find(row=>row.id.includes(':class-typed-feat:'))!,ability=entries.find(entry=>entry.raw.repeatable===true)!,effect=entries.find(entry=>entry.name==='原创已适配效果')!;effect.effects=[{op:'add',target:'ac',value:2}];
 setSheetChoiceSlot(c,choice.id,0,ability.id,entries);syncChoiceContent(c,entries);expect(evaluate(c).abilities.str).toBe(10);
 setSheetChoiceSlot(c,choice.id,0,effect.id,entries);syncChoiceContent(c,entries);expect(evaluate(c).ac).toBe(12);
 c.selections[0].level=3;syncChoiceContent(c,entries);expect(evaluate(c).ac).toBe(10);expect(c.notes).toBe('手工记录保留');expect(c.answers[choice.id]).toEqual([effect.id]);
});
