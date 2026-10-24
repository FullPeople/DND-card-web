import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {ABILITIES,type Ability} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot,chooseSheetOption} from '../src/core/automation/choices';
import {syncFeatures,removeSelection} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
import {validateCharacter,importOwlbear} from '../src/core/validation';
import {exportCharacter,exportLinkedOwlbear} from '../src/core/export';
import {reviewedFeatRule,reviewedFeatStatus,setReviewedFeatIntent,type ReviewedFeatIntent} from '../src/core/automation/reviewedFeats';
import {setAsiAllocation,asiAllocationStatus} from '../src/core/automation/asi';
import {reviewedPassiveFeatData,reviewedPassiveFeatFixture} from './e2e/reviewedPassiveFeatFixture';
function setup(english='Tough',level=4){
 const c=structuredClone(reviewedPassiveFeatFixture()),entries=normalizeData(structuredClone(reviewedPassiveFeatData),'passive-core');c.selections[0].level=level;syncFeatures(c,entries);
 const choices=sheetChoices(c,entries).filter(row=>row.id.includes(':class-legacy-feat:')),choice=choices[0],feat=entries.find(row=>row.english===english)!;
 setSheetChoiceSlot(c,choice.id,0,feat.id,entries);
 const intent:ReviewedFeatIntent=english==='Tough'?{kind:'tough',confirmedManualHpExcluded:true}:{kind:'resilient',ability:'dex',confirmedManualAbilityExcluded:true};
 return {c,entries,choice,choices,feat,intent,confirm:()=>setReviewedFeatIntent(c,choice.id,feat.id,intent)};
}
const reopen=(c:ReturnType<typeof setup>['c'])=>validateCharacter(JSON.parse(JSON.stringify(exportCharacter(c))));
it('Tough requires explicit valid consent and is a pure reversible maxHP layer over all manual HP fields',()=>{
 const {c,choice,feat,confirm}=setup();expect(evaluate(c).maxHp).toBe(28);expect(reviewedFeatStatus(c,choice.id,feat.id)).toMatchObject({eligible:true,active:false});
 expect(()=>setReviewedFeatIntent(c,choice.id,feat.id,{kind:'tough',confirmedManualHpExcluded:false} as any)).toThrow();
 c.baseHp=47;c.sheetBonuses!.hp=3;c.adjustments=[{id:'hp-manual',target:'hp',value:52,reason:'existing'}];const manual=JSON.stringify({...c,reviewedFeats:undefined});confirm();const saved=JSON.stringify(c);expect(evaluate(c).maxHp).toBe(63);expect(JSON.stringify(c)).toBe(saved);expect(JSON.stringify({...c,reviewedFeats:undefined})).toBe(manual);
 setReviewedFeatIntent(c,choice.id,feat.id,null);expect(evaluate(c).maxHp).toBe(55);expect(c.runtime).toMatchObject({hp:7,tempHp:3});
});
it('Tough scales with all active class levels, never owner-only, and reopening does not accumulate',()=>{
 const {c,confirm}=setup();confirm();expect(evaluate(c).maxHp).toBe(36);c.selections[0].level=5;expect(evaluate(c).maxHp).toBe(44);
 c.selections.push({...structuredClone(c.selections[0]),id:'second-class',level:2,entry:{...c.selections[0].entry,id:'second-class-entry',english:'Wizard',raw:{...c.selections[0].entry.raw,ENG_name:'Wizard',hd:{faces:6},classFeatures:[]}}});
 expect(evaluate(c).maxHp).toBe(56);let restored=reopen(c);for(let i=0;i<3;i++){syncFeatures(restored,[]);restored=reopen(restored);expect(evaluate(restored).maxHp).toBe(56);}expect(restored.runtime).toEqual(c.runtime);
});
it.each(ABILITIES)('Resilient couples exactly one %s increase to the same save and permits prior proficiency',ability=>{
 const {c,choice,feat}=setup('Resilient');for(const a of ABILITIES)c.abilities[a]=13;c.proficiencies={};c.saveBonuses={};
 setReviewedFeatIntent(c,choice.id,feat.id,{kind:'resilient',ability,confirmedManualAbilityExcluded:true});const d=evaluate(c);expect(d.abilities[ability]).toBe(14);expect(d.saves[ability]).toEqual({value:4,proficient:true});for(const a of ABILITIES.filter(a=>a!==ability))expect(d.abilities[a]).toBe(13);
 c.selections[0].level=5;expect(evaluate(c).saves[ability]).toEqual({value:5,proficient:true});c.proficiencies[`save:${ability}`]=true;expect(evaluate(c).saves[ability].value).toBe(5);
 c.proficiencies[`save:${ability}`]=false;expect(evaluate(c).saves[ability]).toEqual({value:2,proficient:false});expect(evaluate(c).trace[`save:${ability}`].join()).toContain('手工不熟练覆盖保留');
});
it('Resilient CON enters the existing per-level HP calculation once, while explicit HP overrides remain untouched',()=>{
 const {c,choice,feat}=setup('Resilient');c.abilities.con=13;expect(evaluate(c).maxHp).toBe(32);setReviewedFeatIntent(c,choice.id,feat.id,{kind:'resilient',ability:'con',confirmedManualAbilityExcluded:true});expect(evaluate(c).maxHp).toBe(36);expect(evaluate(reopen(c)).maxHp).toBe(36);
 c.baseHp=50;expect(evaluate(c).maxHp).toBe(50);c.sheetBonuses!.hp=4;expect(evaluate(c).maxHp).toBe(54);expect(c.abilities.con).toBe(13);expect(c.runtime.hp).toBe(7);
});
it.each([20,22])('Resilient never lowers or silently reselects an existing score of %s',score=>{
 const {c,choice,feat,confirm}=setup('Resilient');confirm();const saved=JSON.stringify(c.reviewedFeats);c.abilities.dex=score;expect(evaluate(c).abilities.dex).toBe(score);expect(evaluate(c).saves.dex.proficient).toBe(false);expect(reviewedFeatStatus(c,choice.id,feat.id).reason).toContain('上限 20');expect(JSON.stringify(c.reviewedFeats)).toBe(saved);expect(()=>confirm()).toThrow('上限 20');
});
it.each(['disable','optional','automation','protocol','source-entry','owner-entry','dismiss','owner-missing','source-missing','cycle','excluded'] as const)('suspends and visibly retains consent on %s without writing manual values',mode=>{
 const {c,choice,feat,confirm}=setup();confirm();const binding=c.reviewedFeats!.bindings[0],source=c.selections.find(row=>row.id===binding.selectionId)!;const saved=JSON.stringify(c.reviewedFeats);
 if(mode==='disable')c.profile.enabledSources=[];if(mode==='optional')c.profile.optional.feats=false;if(mode==='automation')c.automation!.enabled=false;if(mode==='protocol')c.automation!.protocol=99;if(mode==='source-entry')c.profile.disabledEntries=[feat.id];if(mode==='owner-entry')c.profile.disabledEntries=[c.selections[0].entry.id];if(mode==='dismiss')c.dismissedFeatures=[`${source.parentId}|${source.grantKey}`];if(mode==='owner-missing')c.selections=c.selections.filter(row=>row.id!==source.parentId);if(mode==='source-missing')c.selections=c.selections.filter(row=>row.id!==source.id);if(mode==='cycle')c.selections[0].parentId=source.id;
 const d=evaluate(c,mode==='excluded'?new Set([source.id]):undefined);expect(d.trace.hp.join()).not.toContain('角色总等级');expect(d.issues.some(row=>row.id.startsWith('reviewed-feat:'))).toBe(true);if(mode!=='excluded')expect(reviewedFeatStatus(c,choice.id,feat.id).active).toBe(false);expect(JSON.stringify(c.reviewedFeats)).toBe(saved);expect(c.runtime.hp).toBe(7);
});
it.each(['clear','replace','toggle'] as const)('explicit %s withdraws only its consent so reselect needs confirmation',mode=>{
 const {c,choice,feat,entries,confirm}=setup();confirm();if(mode==='toggle')chooseSheetOption(c,choice.id,feat.id,entries);else setSheetChoiceSlot(c,choice.id,0,mode==='clear'?undefined:entries.find(row=>row.english==='Authored Replacement Record')!.id,entries);
 expect(c.reviewedFeats!.bindings).toHaveLength(0);setSheetChoiceSlot(c,choice.id,0,feat.id,entries);expect(evaluate(c).maxHp).toBe(28);expect(reviewedFeatStatus(c,choice.id,feat.id).active).toBe(false);confirm();expect(evaluate(c).maxHp).toBe(36);
});
it('a manual dragged feat never gets an effect and a same-identity import blocks ambiguous automation',()=>{
 const {c,choice,feat,confirm}=setup();c.selections.push({id:'manual',entry:structuredClone(feat),level:1,quantity:1,equipped:false});expect(evaluate(c).maxHp).toBe(28);expect(()=>confirm()).toThrow('归属不明确');c.selections.pop();confirm();c.selections.push({id:'imported',entry:{...structuredClone(feat),id:'alternate-same-identity'},level:1,quantity:1,equipped:false});expect(evaluate(c).maxHp).toBe(28);expect(reviewedFeatStatus(c,choice.id,feat.id).reason).toContain('归属不明确');
});
it('same-identity legacy answers cannot stack even with different snapshot IDs, and saved duplicate intents remain visible',()=>{
 const {c,choice,choices,feat,confirm}=setup('Tough',6);confirm();const clone={...structuredClone(feat),id:'duplicate-feat'};c.classChoiceSnapshots![clone.id]=clone;c.answers[choices[1].id]=[clone.id];expect(evaluate(c).maxHp).toBe(40);expect(reviewedFeatStatus(c,choice.id,feat.id).reason).toContain('多份');delete c.answers[choices[1].id];c.reviewedFeats!.bindings.push(structuredClone(c.reviewedFeats!.bindings[0]));expect(evaluate(c).maxHp).toBe(40);expect(reviewedFeatStatus(c,choice.id,feat.id).reason).toContain('重复确认');
});
it.each(['raw-source','raw-english','edition','normalized-source','copy','unresolved','effects','choices','raw-mechanics','owner-raw','owner-copy','owner-category','owner-edition','source-raw','source-grant','source-owner','source-duplicate','source-class-edition'] as const)('fails closed for altered source qualification %s',mode=>{
 const {c,choice,feat,confirm}=setup();confirm();const saved=c.classChoiceSnapshots![feat.id],source=c.selections.find(row=>row.id===c.reviewedFeats!.bindings[0].selectionId)!;
 if(mode==='raw-source')saved.raw.source='CUSTOM';if(mode==='raw-english')saved.raw.ENG_name='Unknown';if(mode==='edition')saved.edition='2024';if(mode==='normalized-source')saved.source='CUSTOM';if(mode==='copy')saved.raw._copy={};if(mode==='unresolved')saved.raw._unresolvedParent=true;if(mode==='effects')saved.effects=[{op:'add',target:'hp',value:8}];if(mode==='choices')saved.choices=[{} as any];if(mode==='raw-mechanics')saved.raw.ability=[{con:2}];if(mode==='owner-raw')c.selections[0].entry.raw.source='CUSTOM';if(mode==='owner-copy')c.selections[0].entry.raw._copy={};if(mode==='owner-category')c.selections[0].entry.raw._category='monster';if(mode==='owner-edition')c.selections[0].entry.raw.edition='invented';if(mode==='source-raw')source.entry.raw.source='CUSTOM';if(mode==='source-grant')source.grantKey='ref:fake';if(mode==='source-owner')source.parentId='missing';if(mode==='source-class-edition')source.entry.raw._classEdition='2024';if(mode==='source-duplicate')c.selections.push({...structuredClone(source),id:'duplicate-source'});
 expect(evaluate(c).maxHp).toBe(28);expect(reviewedFeatStatus(c,choice.id,feat.id).active).toBe(false);
});
it.each(['clear-catalog','disabled-upgrade'] as const)('downgrade archives the exact source tree, then restores saved intent offline: %s',mode=>{
 const {c,entries,choices,feat}=setup('Tough',6);setSheetChoiceSlot(c,choices[0].id,0,undefined,entries);setSheetChoiceSlot(c,choices[1].id,0,feat.id,entries);setReviewedFeatIntent(c,choices[1].id,feat.id,{kind:'tough',confirmedManualHpExcluded:true});const id=c.reviewedFeats!.bindings[0].selectionId,source=c.selections.find(row=>row.id===id)!;c.selections.push({id:'manual-child',entry:{...source.entry,id:'manual-child-entry',english:'Manual',raw:{}},level:1,quantity:1,equipped:false,parentId:id});
 const tree=JSON.stringify(c.selections.filter(row=>row.id===id||row.parentId===id));c.selections[0].level=4;syncFeatures(c,[]);expect(evaluate(c).maxHp).toBe(28);expect(c.classChoiceArchive?.[id]).toBeDefined();const restored=reopen(c);restored.selections[0].level=6;
 if(mode==='disabled-upgrade'){restored.profile.enabledSources=[];syncFeatures(restored,entries);expect(restored.selections.some(row=>row.id===id)).toBe(false);restored.profile.enabledSources=['PHB'];}
 syncFeatures(restored,[]);expect(evaluate(restored).maxHp).toBe(52);expect(JSON.stringify(restored.selections.filter(row=>row.id===id||row.parentId===id))).toBe(tree);expect(syncFeatures(restored,[])).toBe(false);
});
it('native/linked saves retain versioned intent and unknown future intent never executes or mutates',()=>{
 const {c,choice,feat,confirm}=setup();confirm();const restored=importOwlbear(JSON.parse(JSON.stringify(exportLinkedOwlbear(c,evaluate(c)))));expect(restored.reviewedFeats).toEqual(c.reviewedFeats);expect(evaluate(restored).maxHp).toBe(36);
 (c as any).reviewedFeats={version:2,future:{keep:true}};const before=JSON.stringify(c);expect(evaluate(reopen(c)).maxHp).toBe(28);expect(()=>setReviewedFeatIntent(c,choice.id,feat.id,null)).toThrow('版本');expect(JSON.stringify(c)).toBe(before);
});
it('validates malformed known-version intents before mutation while preserving extension metadata',()=>{
 const {c,confirm}=setup();confirm();const bad=structuredClone(c);(bad.reviewedFeats!.bindings[0].intent as any).confirmedManualHpExcluded=false;expect(()=>validateCharacter(bad)).toThrow('确认记录');(c.reviewedFeats as any).futureNote='keep';expect((reopen(c).reviewedFeats as any).futureNote).toBe('keep');
});
it.each([false,true])('mixed ASI/Resilient cap follows source grant order, never imported array order, resilientFirst=%s',resilientFirst=>{
 const {c,entries,choices,feat}=setup('Resilient',6);c.abilities.dex=16;const featChoice=choices[resilientFirst?0:1],asiChoice=choices[resilientFirst?1:0];
 setSheetChoiceSlot(c,choices[0].id,0,undefined,entries);setSheetChoiceSlot(c,featChoice.id,0,feat.id,entries);setReviewedFeatIntent(c,featChoice.id,feat.id,{kind:'resilient',ability:'dex',confirmedManualAbilityExcluded:true});setSheetChoiceSlot(c,asiChoice.id,0,asiChoice.options.find(row=>row.entry.raw._classAbilityRecord)!.value,entries);setAsiAllocation(c,asiChoice.id,{dex:2});c.abilities.dex=18;
 for(const restored of [c,reopen(c),{...reopen(c),asiAllocations:{...c.asiAllocations!,bindings:[...c.asiAllocations!.bindings].reverse()},reviewedFeats:{...c.reviewedFeats!,bindings:[...c.reviewedFeats!.bindings].reverse()}}]){
  expect(evaluate(restored).abilities.dex).toBe(resilientFirst?19:20);expect(reviewedFeatStatus(restored,featChoice.id,feat.id).active).toBe(resilientFirst);expect(asiAllocationStatus(restored,asiChoice.id).active).toBe(!resilientFirst);expect(evaluate(restored).saves.dex.proficient).toBe(resilientFirst);
 }
});
it('setters refuse a new earlier advancement if it would silently deactivate an already valid later one',()=>{
 const {c,entries,choices,feat}=setup('Resilient',6);c.abilities.dex=18;setSheetChoiceSlot(c,choices[1].id,0,choices[1].options.find(row=>row.entry.raw._classAbilityRecord)!.value,entries);setAsiAllocation(c,choices[1].id,{dex:2});const before=JSON.stringify(c);expect(()=>setReviewedFeatIntent(c,choices[0].id,feat.id,{kind:'resilient',ability:'dex',confirmedManualAbilityExcluded:true})).toThrow('已有属性提升');expect(JSON.stringify(c)).toBe(before);
});

it('one declared class source cannot be aliased into two independent feat choices',()=>{
 const {c,choice,feat,confirm,entries}=setup();confirm();const original=c.selections.find(row=>row.id===c.reviewedFeats!.bindings[0].selectionId)!,alias={...structuredClone(original),id:'alias-selection',entry:{...structuredClone(original.entry),id:'alias-entry'}},resilient=entries.find(row=>row.english==='Resilient')!;c.selections.push(alias);const aliasChoice=`${alias.parentId}:class-legacy-feat:${alias.entry.id}`;c.answers[aliasChoice]=[resilient.id];c.classChoiceSnapshots![resilient.id]=resilient;c.reviewedFeats!.bindings.push({selectionId:alias.id,choiceId:aliasChoice,entryId:resilient.id,intent:{kind:'resilient',ability:'dex',confirmedManualAbilityExcluded:true}});expect(evaluate(c).maxHp).toBe(28);expect(evaluate(c).abilities.dex).toBe(13);expect(reviewedFeatStatus(c,choice.id,feat.id).active).toBe(false);expect(reviewedFeatStatus(c,aliasChoice,resilient.id).active).toBe(false);
});

it.each(['same-class','reference-alias'] as const)('imports retain but suspend duplicate canonical source %s',mode=>{
 const {c,choice,feat,confirm,entries}=setup();confirm();const source=c.selections.find(row=>row.id===c.reviewedFeats!.bindings[0].selectionId)!,owner=c.selections[0],alias={...structuredClone(source),id:'alias-source',entry:{...structuredClone(source.entry),id:'alias-source-entry'}};
 if(mode==='same-class'){const duplicate={...structuredClone(owner),id:'alias-owner',entry:{...structuredClone(owner.entry),id:'alias-owner-entry'}};c.selections.push(duplicate);alias.parentId=duplicate.id;}else{const ref='属性值提升|战士||4';owner.entry.raw.classFeatures.push(ref);alias.grantKey=`ref:${ref}`;}
 c.selections.push(alias);const duplicateChoice=`${alias.parentId}:class-legacy-feat:${alias.entry.id}`,resilient=entries.find(row=>row.english==='Resilient')!;c.classChoiceSnapshots![resilient.id]=resilient;c.answers[duplicateChoice]=[resilient.id];c.reviewedFeats!.bindings.push({selectionId:alias.id,choiceId:duplicateChoice,entryId:resilient.id,intent:{kind:'resilient',ability:'dex',confirmedManualAbilityExcluded:true}});const before=JSON.stringify(c);expect(evaluate(c).trace.hp.join()).not.toContain('角色总等级');expect(evaluate(c).abilities.dex).toBe(13);expect(reviewedFeatStatus(c,choice.id,feat.id).reason).toContain('归属不明确');expect(()=>setReviewedFeatIntent(c,duplicateChoice,resilient.id,{kind:'resilient',ability:'dex',confirmedManualAbilityExcluded:true})).toThrow();expect(JSON.stringify(c)).toBe(before);
});
it('genuine distinct multiclass owners can each use one reviewed ASI alternative',()=>{
 const {c,entries,choice,feat,confirm}=setup();confirm();const extra=normalizeData({class:[{name:'法师',ENG_name:'Wizard',source:'PHB',edition:'classic',hd:{faces:6},classFeatures:['属性值提升|法师||4']}],classFeature:[{name:'属性值提升',ENG_name:'Ability Score Improvement',source:'PHB',className:'法师',classSource:'PHB',level:4,entries:[]}]},'multiclass-passive');c.profile.optional.multiclass=true;c.selections.push({id:'wizard',entry:extra.find(row=>row.kind==='class')!,level:4,quantity:1,equipped:false});const catalog=[...entries,...extra];syncFeatures(c,catalog);const second=sheetChoices(c,catalog).find(row=>row.ownerId==='wizard'&&row.id.includes(':class-legacy-feat:'))!,resilient=entries.find(row=>row.english==='Resilient')!;setSheetChoiceSlot(c,second.id,0,resilient.id,catalog);setReviewedFeatIntent(c,second.id,resilient.id,{kind:'resilient',ability:'dex',confirmedManualAbilityExcluded:true});expect(reviewedFeatStatus(c,choice.id,feat.id).active).toBe(true);expect(reviewedFeatStatus(c,second.id,resilient.id).active).toBe(true);expect(evaluate(c)).toMatchObject({maxHp:60,abilities:{dex:14},saves:{dex:{proficient:true,value:5}}});
});
it('an unsupported ASI version never unlocks an archived ASI source, even beside a known reviewed feat',()=>{
 const {c,entries,choices,confirm}=setup('Tough',6);confirm();setSheetChoiceSlot(c,choices[1].id,0,choices[1].options.find(row=>row.entry.raw._classAbilityRecord)!.value,entries);setAsiAllocation(c,choices[1].id,{wis:2});const sourceId=c.asiAllocations!.bindings[0].selectionId;c.selections[0].level=4;syncFeatures(c,[]);expect(c.classChoiceArchive?.[sourceId]).toBeDefined();(c as any).asiAllocations={version:77,future:{keep:true}};const future=JSON.stringify(c.asiAllocations),archive=JSON.stringify(c.classChoiceArchive);c.selections[0].level=6;syncFeatures(c,entries);expect(c.selections.some(row=>row.id===sourceId)).toBe(false);expect(JSON.stringify(c.classChoiceArchive)).toBe(archive);expect(JSON.stringify(c.asiAllocations)).toBe(future);expect(evaluate(c).abilities.wis).toBe(12);
});
