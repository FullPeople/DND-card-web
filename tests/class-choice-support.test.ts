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

function modernEffectSetup(){
 const entries=normalizeData({class:[{name:'战士',ENG_name:'Fighter',source:'XPHB',classFeatures:['原创提升|战士|XPHB|4']}],classFeature:[{name:'原创提升',source:'XPHB',className:'战士',classSource:'XPHB',level:4,entries:['{@feat 原创属性提升|XPHB}']}],feat:[{name:'原创属性提升',source:'XPHB',category:'G',repeatable:true,ability:[{choose:{from:['str','dex'],amount:2}}],entries:[]},{name:'原创已适配效果',source:'XPHB',category:'G',entries:[]}]},'direct-non-asi-effects');
 const c=newCharacter();c.automation=newAutomationState();c.notes='手工记录保留';c.runtime.hp=3;c.selections=[{id:'owner',entry:entries.find(entry=>entry.kind==='class')!,level:4,quantity:1,equipped:false}];
 const choice=sheetChoices(c,entries).find(row=>row.id.includes(':class-typed-feat:'))!,effect=entries.find(entry=>entry.name==='原创已适配效果')!;effect.effects=[{op:'add',target:'ac',value:2}];
 // Select the other feat directly: a previous ASI pick would mask missing evidence.
 setSheetChoiceSlot(c,choice.id,0,effect.id,entries);syncChoiceContent(c,entries);
 return {c,entries,choice,effect};
}
it.each(['empty','partial'] as const)('retains a directly selected non-ASI grant with a %s catalog through import and restoration',mode=>{
 const {c,entries,choice,effect}=modernEffectSetup(),catalog=mode==='empty'?[]:entries.filter(entry=>entry.raw.repeatable!==true);
 const imported=validateCharacter(JSON.parse(JSON.stringify(c))),before=JSON.stringify(imported),abilities=JSON.stringify(c.abilities),runtime=JSON.stringify(c.runtime);
 const offline=sheetChoices(imported,catalog).find(row=>row.id===choice.id);
 expect(offline,'grant identity must survive without the referenced ASI catalog definition').toBeDefined();expect(offline!.selected).toEqual([effect.id]);
 expect(syncChoiceContent(imported,catalog)).toBe(false);expect(evaluate(imported).ac).toBe(12);expect(JSON.stringify(imported)).toBe(before);
 expect(syncChoiceContent(imported,entries)).toBe(false);expect(imported.selections.filter(row=>row.entry.id===effect.id)).toHaveLength(1);
 expect(JSON.stringify(imported.abilities)).toBe(abilities);expect(JSON.stringify(imported.runtime)).toBe(runtime);expect(imported.notes).toBe('手工记录保留');
});
it('keeps direct non-ASI answers offline while source and level restrictions remove only the automatic grant',()=>{
 const {c,choice,effect}=modernEffectSetup(),saved=JSON.stringify(c.answers),sources=[...c.profile.enabledSources];
 c.profile.enabledSources=[];const disabled=sheetChoices(c,[]).find(row=>row.id===choice.id);expect(disabled).toBeDefined();expect(disabled!.restricted).toBe(true);
 syncChoiceContent(c,[]);expect(evaluate(c).ac).toBe(10);expect(JSON.stringify(c.answers)).toBe(saved);
 c.profile.enabledSources=sources;syncChoiceContent(c,[]);expect(evaluate(c).ac).toBe(12);
 c.selections[0].level=3;syncChoiceContent(c,[]);expect(evaluate(c).ac).toBe(10);expect(sheetChoices(c,[]).find(row=>row.id===choice.id)!.count).toBe(0);
 c.selections[0].level=4;syncChoiceContent(c,[]);expect(evaluate(c).ac).toBe(12);expect(c.selections.filter(row=>row.entry.id===effect.id)).toHaveLength(1);expect(JSON.stringify(c.answers)).toBe(saved);
});

function legacySixSetup(){
 const entries=normalizeData({...data,class:[{...data.class[0],classFeatures:['属性值提升|战士||4','属性值提升|战士||6']}],classFeature:[data.classFeature[0],{...data.classFeature[0],level:6}]},'legacy-six-grants');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'owner',entry:entries.find(entry=>entry.kind==='class')!,level:6,quantity:1,equipped:false}];
 const choices=sheetChoices(c,entries).filter(choice=>choice.id.includes(':class-legacy-feat:')),feat=entries.find(entry=>entry.kind==='feat')!;expect(choices).toHaveLength(2);
 return {c,entries,choices,feat};
}
it('rejects a new nonrepeatable legacy feat across active ASI records without mutating either answer',()=>{
 const {c,entries,choices,feat}=legacySixSetup();setSheetChoiceSlot(c,choices[0].id,0,feat.id,entries);const before=JSON.stringify(c);
 expect(sheetChoices(c,entries).find(choice=>choice.id===choices[1].id)!.options.find(option=>option.value===feat.id)!.unavailable).toBeTruthy();
 expect(()=>setSheetChoiceSlot(c,choices[1].id,0,feat.id,entries)).toThrow();expect(JSON.stringify(c)).toBe(before);
 const ability=choices[1].options.find(option=>option.entry.raw._classAbilityRecord)!;setSheetChoiceSlot(c,choices[1].id,0,ability.value,entries);expect(sheetChoices(c,entries).every(choice=>choice.complete)).toBe(true);
});
it('retains old duplicate legacy answers with one inactive warning, and frees the feat when the other grant is inactive',()=>{
 const {c,entries,choices,feat}=legacySixSetup();setSheetChoiceSlot(c,choices[0].id,0,feat.id,entries);setSheetChoiceSlot(c,choices[1].id,0,choices[1].options.find(option=>option.entry.raw._classAbilityRecord)!.value,entries);c.answers[choices[1].id]=[feat.id];const answers=JSON.stringify(c.answers);
 const rows=sheetChoices(c,[]);expect(rows.find(choice=>choice.id===choices[0].id)!.complete).toBe(true);expect(rows.find(choice=>choice.id===choices[1].id)!.complete).toBe(false);
 expect(rows.find(choice=>choice.id===choices[1].id)!.options.find(option=>option.value===feat.id)!.unavailable).toBeTruthy();syncChoiceContent(c,[]);expect(JSON.stringify(c.answers)).toBe(answers);expect(c.selections).toHaveLength(1);
 c.selections[0].level=4;c.answers[choices[0].id]=[];const available=sheetChoices(c,entries).find(choice=>choice.id===choices[0].id)!.options.find(option=>option.value===feat.id)!;expect(available.unavailable).toBeUndefined();
 setSheetChoiceSlot(c,choices[0].id,0,feat.id,entries);expect(c.answers[choices[1].id]).toEqual([feat.id]);
});
it('allows explicitly repeatable legacy feats and repeated manual ability plans',()=>{
 const {c,entries,choices,feat}=legacySixSetup();feat.raw.repeatable=true;
 for(const choice of choices)setSheetChoiceSlot(c,choice.id,0,feat.id,entries);expect(sheetChoices(c,entries).every(choice=>choice.complete)).toBe(true);
 for(const choice of choices)setSheetChoiceSlot(c,choice.id,0,choice.options.find(option=>option.entry.raw._classAbilityRecord)!.value,entries);expect(sheetChoices(c,entries).every(choice=>choice.complete)).toBe(true);expect(c.selections).toHaveLength(1);expect(evaluate(c).abilities.str).toBe(10);
});
it('reserves a nonrepeatable legacy feat across different active class owners and releases inactive owners',()=>{
 const {c,entries,choices,feat}=legacySixSetup(),other=normalizeData({class:[{name:'游荡者',ENG_name:'Rogue',source:'PHB',classFeatures:['属性值提升|游荡者||4']}],classFeature:[{name:'属性值提升',ENG_name:'Ability Score Improvement',source:'PHB',className:'游荡者',classSource:'PHB',level:4,entries:['{@5etools 原创目录标签|feats.html}']}]},'other-legacy-owner');
 entries.push(...other);c.profile.optional.multiclass=true;c.selections.push({id:'other-owner',entry:other.find(entry=>entry.kind==='class')!,level:4,quantity:1,equipped:false});
 setSheetChoiceSlot(c,choices[0].id,0,feat.id,entries);const otherChoice=sheetChoices(c,entries).find(choice=>choice.ownerId==='other-owner'&&choice.sourceProgression==='feat')!;
 expect(otherChoice.options.find(option=>option.value===feat.id)!.unavailable).toBeTruthy();expect(()=>setSheetChoiceSlot(c,otherChoice.id,0,feat.id,entries)).toThrow();
 c.profile.disabledEntries=[c.selections[0].entry.id];expect(sheetChoices(c,entries).find(choice=>choice.id===otherChoice.id)!.options.find(option=>option.value===feat.id)!.unavailable).toBeUndefined();
 setSheetChoiceSlot(c,otherChoice.id,0,feat.id,entries);expect(c.answers[choices[0].id]).toEqual([feat.id]);expect(sheetChoices(c,entries).find(choice=>choice.id===otherChoice.id)!.complete).toBe(true);
});
