import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {type Character,type Ability} from '../src/core/model';
import {sheetChoices,setSheetChoiceSlot,chooseSheetOption} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
import {exportCharacter,exportLinkedOwlbear} from '../src/core/export';
import {validateCharacter,importOwlbear} from '../src/core/validation';
import {reviewedFeatRule,reviewedFeatStatus,setReviewedFeatIntent,type ReviewedArmorFeatKind,type ReviewedFeatIntent} from '../src/core/automation/reviewedFeats';
import {setAsiAllocation,asiAllocationStatus} from '../src/core/automation/asi';
import {effectiveTrainingDeclarations} from '../src/core/automation/training';
import {armorTraining} from '../src/core/automation/equipment';
import {activeEffectSelections} from '../src/core/automation/active';
import {reviewedArmorFeatData,reviewedArmorFeatFixture} from './e2e/reviewedArmorFeatFixture';
const names={'lightly-armored':'Lightly Armored','moderately-armored':'Moderately Armored','heavily-armored':'Heavily Armored'};
function setup(){
 const c=structuredClone(reviewedArmorFeatFixture()),entries=normalizeData(structuredClone(reviewedArmorFeatData),'armor-core');syncFeatures(c,entries);
 const choices=()=>sheetChoices(c,entries).filter(row=>row.id.includes(':class-legacy-feat:')).sort((a,b)=>a.grantLevel!-b.grantLevel!);
 const feat=(kind:ReviewedArmorFeatKind)=>entries.find(row=>row.english===names[kind])!;
 const select=(kind:ReviewedArmorFeatKind,slot=0)=>{const f=feat(kind),choice=choices()[slot];setSheetChoiceSlot(c,choice.id,0,f.id,entries);return {f,choice};};
 const confirm=(kind:ReviewedArmorFeatKind,slot=0,ability:'str'|'dex'='str')=>{const {f,choice}=select(kind,slot);setReviewedFeatIntent(c,choice.id,f.id,{kind,ability,confirmedManualAbilityExcluded:true});return {f,choice};};
 const training=()=>armorTraining(c,activeEffectSelections(c));
 return {c,entries,choices,feat,select,confirm,training};
}
const reopen=(c:Character)=>validateCharacter(JSON.parse(JSON.stringify(exportCharacter(c))));
it.each(['lightly-armored','moderately-armored','heavily-armored'] as const)('%s grants only its confirmed choice and category layer; evaluation is pure',kind=>{
 const {c,select,confirm,training}=setup();if(kind==='moderately-armored')c.training!.armor='light';if(kind==='heavily-armored')c.training!.armor='medium';
 const {f,choice}=select(kind);const before=JSON.stringify(c);expect(reviewedFeatRule(f)?.kind).toBe(kind);expect(evaluate(c).abilities.str).toBe(13);expect(reviewedFeatStatus(c,choice.id,f.id)).toMatchObject({eligible:true,active:false});
 const manual=JSON.stringify({...c,reviewedFeats:undefined});confirm(kind);expect(evaluate(c).abilities.str).toBe(14);expect(JSON.stringify({...c,reviewedFeats:undefined})).toBe(manual);
 const saved=JSON.stringify(c);for(let i=0;i<3;i++){expect(evaluate(c).abilities.str).toBe(14);expect(evaluate(reopen(c)).abilities.str).toBe(14);training();}expect(JSON.stringify(c)).toBe(saved);expect(saved).not.toBe(before);
 expect(c.abilities.str).toBe(13);expect(c.runtime.hp).toBe(7);expect(c.runtime.resources['manual-armor-check'].current).toBe(2);
});
it('valid earlier Lightly then Moderate then Heavy form an ordered chain, never add a save or extra shield AC',()=>{
 const {c,confirm,training}=setup();const ac=evaluate(c).ac;expect(evaluate(c).issues.some(row=>row.id==='armor-training:armor-shield')).toBe(true);
 confirm('lightly-armored');expect(training()).toEqual(new Set(['light']));confirm('moderately-armored',1);expect(training()).toEqual(new Set(['light','medium','shield']));expect(evaluate(c).ac).toBe(ac);expect(evaluate(c).issues.some(row=>row.id==='armor-training:armor-shield')).toBe(false);
 confirm('heavily-armored',2);expect(training()).toEqual(new Set(['light','medium','shield','heavy']));expect(evaluate(c).abilities.str).toBe(16);expect(evaluate(c).saves.dex.proficient).toBe(false);expect(evaluate(c).speed).toBe(35);
 c.reviewedFeats!.bindings.reverse();expect(evaluate(c).abilities.str).toBe(16);expect(effectiveTrainingDeclarations(reopen(c))).toEqual(['light','medium','shield','heavy']);
});
it.each(['','shield','{@item Shield|PHB}','{@item Light Armor|PHB}'])('manual armor override %s cannot satisfy a category it does not grant',manual=>{
 const {c,confirm,choices,feat,training}=setup();confirm('lightly-armored');c.training!.armor=manual;expect(training().has('light')).toBe(false);expect(choices()[1].options.find(o=>o.value===feat('moderately-armored').id)?.unavailable).toContain('轻甲');
 expect(()=>confirm('moderately-armored',1)).toThrow();expect(c.training!.armor).toBe(manual);expect(evaluate(c).abilities.str).toBe(14);
});
it('manual full training overrides derive without writes and removing an empty override restores saved dependent intents',()=>{
 const {c,confirm,training,choices,feat}=setup();confirm('lightly-armored');confirm('moderately-armored',1);confirm('heavily-armored',2);const intents=JSON.stringify(c.reviewedFeats);
 c.training!.armor='';expect(training()).toEqual(new Set());expect(evaluate(c).abilities.str).toBe(14);expect(reviewedFeatStatus(c,choices()[1].id,feat('moderately-armored').id).reason).toContain('轻甲');expect(JSON.stringify(c.reviewedFeats)).toBe(intents);
 c.training!.armor='light, medium, heavy, shield';expect(training()).toEqual(new Set(['light','medium','heavy','shield']));expect(evaluate(c).abilities.str).toBe(16);delete c.training!.armor;expect(training()).toEqual(new Set(['light','medium','shield','heavy']));expect(JSON.stringify(c.reviewedFeats)).toBe(intents);
});
it('future, self, unconfirmed and stopped source grants never satisfy an earlier prerequisite',()=>{
 const {c,entries,select,confirm,choices,feat,training}=setup();select('lightly-armored',0);expect(choices()[1].options.find(o=>o.value===feat('moderately-armored').id)?.unavailable).toContain('轻甲');
 setSheetChoiceSlot(c,choices()[0].id,0,undefined,entries);confirm('lightly-armored',2);expect(choices()[0].options.find(o=>o.value===feat('moderately-armored').id)?.unavailable).toContain('轻甲');
 // Retained imported intent is independently gated, even if a choice check was bypassed.
 const medium=feat('moderately-armored'),choice=choices()[0],source=c.selections.find(row=>row.entry.id===choice.id.split(':class-legacy-feat:')[1])!;
 c.answers[choice.id]=[medium.id];c.classChoiceSnapshots![medium.id]=medium;c.reviewedFeats!.bindings.push({selectionId:source.id,choiceId:choice.id,entryId:medium.id,intent:{kind:'moderately-armored',ability:'str',confirmedManualAbilityExcluded:true}});
 expect(evaluate(c).abilities.str).toBe(14);expect(training()).toEqual(new Set(['light']));expect(reviewedFeatStatus(c,choice.id,medium.id).reason).toContain('此前');
 c.profile.disabledEntries=[feat('lightly-armored').id];expect(training()).toEqual(new Set());expect(evaluate(c).abilities.str).toBe(13);
});
it.each(['unknown-source','wrong-edition','raw-name','raw-source','category','page','copy','ability-max','ability-choice','ability-amount','extra-training','prerequisite','effect','choices','repeatable','extra-field'] as const)('an altered reviewed armor source fails closed: %s',mode=>{
 const {c,confirm,training}=setup();const {f,choice}=confirm('lightly-armored'),e=c.classChoiceSnapshots![f.id];
 if(mode==='unknown-source')e.source='CUSTOM';if(mode==='wrong-edition')e.edition='2024';if(mode==='raw-name')e.raw.ENG_name='Unknown';if(mode==='raw-source')e.raw.source='CUSTOM';if(mode==='category')e.raw._category='feature';if(mode==='page')e.raw.page=999;if(mode==='copy')e.raw._copy={};if(mode==='ability-max')e.raw.ability[0].max=30;if(mode==='ability-choice')e.raw.ability[0].choose.from=['wis','cha'];if(mode==='ability-amount')e.raw.ability[0].choose.amount=2;if(mode==='extra-training')e.raw.armorProficiencies=[{light:true,heavy:true}];if(mode==='prerequisite')e.raw.prerequisite=[{proficiency:[{armor:'shield'}]}];if(mode==='effect')e.effects=[{op:'add',target:'ac',value:2}];if(mode==='choices')e.choices=[{} as any];if(mode==='repeatable')e.raw.repeatable=true;if(mode==='extra-field')e.raw.speed=10;
 expect(evaluate(c).abilities.str).toBe(13);expect(training()).toEqual(new Set());expect(reviewedFeatStatus(c,choice.id,f.id).active).toBe(false);
});
it.each(['owner-level','owner-source','source-level','source-disabled','source-dismissed','source-missing','owner-missing','cycle','disabled-source','feats-off','automation-off','future-protocol'] as const)('active training suspends for %s and retained intent remains unchanged',mode=>{
 const {c,confirm,training}=setup();const {f,choice}=confirm('lightly-armored'),binding=c.reviewedFeats!.bindings[0],source=c.selections.find(row=>row.id===binding.selectionId)!,saved=JSON.stringify(c.reviewedFeats);
 if(mode==='owner-level')c.selections[0].level=3;if(mode==='owner-source')c.selections[0].entry.raw.source='CUSTOM';if(mode==='source-level')source.entry.raw.level=20;if(mode==='source-disabled')c.profile.disabledEntries=[source.entry.id];if(mode==='source-dismissed')c.dismissedFeatures=[`${source.parentId}|${source.grantKey}`];if(mode==='source-missing')c.selections=c.selections.filter(row=>row.id!==source.id);if(mode==='owner-missing')c.selections.shift();if(mode==='cycle')c.selections[0].parentId=source.id;if(mode==='disabled-source')c.profile.enabledSources=[];if(mode==='feats-off')c.profile.optional.feats=false;if(mode==='automation-off')c.automation!.enabled=false;if(mode==='future-protocol')c.automation!.protocol=999;
 expect(evaluate(c).abilities.str).toBe(13);expect(training()).toEqual(new Set());expect(reviewedFeatStatus(c,choice.id,f.id).active).toBe(false);expect(JSON.stringify(c.reviewedFeats)).toBe(saved);
});
it('excluded source cannot leak training into equipment or source-order dependents',()=>{
 const {c,confirm}=setup();const {f}=confirm('lightly-armored');confirm('moderately-armored',1);const source=c.reviewedFeats!.bindings.find(row=>row.entryId===f.id)!.selectionId;
 const d=evaluate(c,new Set([source]));expect(d.abilities.str).toBe(13);expect(d.issues.some(row=>row.id==='armor-training:armor-shield')).toBe(true);expect(d.issues.filter(row=>row.id.startsWith('reviewed-feat:'))).toHaveLength(2);
});
it.each([20,22])('cap %s suspends the whole reviewed effect and never clamps manual scores',value=>{
 const {c,confirm,training,choices,feat}=setup();confirm('lightly-armored');confirm('moderately-armored',1);c.abilities.str=value;const saved=JSON.stringify(c.reviewedFeats);
 expect(evaluate(c).abilities.str).toBe(value);expect(training()).toEqual(new Set());expect(reviewedFeatStatus(c,choices()[0].id,feat('lightly-armored').id).reason).toContain('上限 20');expect(JSON.stringify(c.reviewedFeats)).toBe(saved);
 c.abilities.str=13;expect(training()).toEqual(new Set(['light','medium','shield']));
});
it.each(['lightly-armored','moderately-armored','heavily-armored'] as const)('%s rejects wrong ability/consent and malformed imports without mutation',kind=>{
 const {c,select}=setup();c.training!.armor='light,medium';const {f,choice}=select(kind);
 for(const ability of (kind==='heavily-armored'?['dex','con','wis']:['con','wis']) as Ability[]){const old=JSON.stringify(c);expect(()=>setReviewedFeatIntent(c,choice.id,f.id,{kind,ability,confirmedManualAbilityExcluded:true} as any)).toThrow();expect(JSON.stringify(c)).toBe(old);}
 expect(()=>setReviewedFeatIntent(c,choice.id,f.id,{kind,ability:'str',confirmedManualAbilityExcluded:false} as any)).toThrow();
 setReviewedFeatIntent(c,choice.id,f.id,{kind,ability:'str',confirmedManualAbilityExcluded:true});const bad=structuredClone(c);(bad.reviewedFeats!.bindings[0].intent as any).ability='int';expect(()=>validateCharacter(bad)).toThrow('确认记录');
});
it('manual dragged copies grant nothing and block ambiguous automatic copies',()=>{
 const {c,confirm,feat,training}=setup();const f=feat('lightly-armored');c.selections.push({id:'manual-light',entry:f,level:1,quantity:1,equipped:false});expect(training()).toEqual(new Set());expect(evaluate(c).abilities.str).toBe(13);expect(()=>confirm('lightly-armored')).toThrow('这个条目已经在角色卡中');c.selections.pop();confirm('lightly-armored');c.selections.push({id:'copy-light',entry:{...structuredClone(f),id:'manual-copy'},level:1,quantity:1,equipped:false});expect(training()).toEqual(new Set());expect(evaluate(c).abilities.str).toBe(13);
});
it('nonrepeatable duplicate answers and duplicate saved bindings never stack',()=>{
 const {c,confirm,choices,feat,training}=setup();confirm('lightly-armored');const f=feat('lightly-armored'),clone={...structuredClone(f),id:'duplicate-light'};c.answers[choices()[1].id]=[clone.id];c.classChoiceSnapshots![clone.id]=clone;expect(training()).toEqual(new Set());expect(evaluate(c).abilities.str).toBe(13);delete c.answers[choices()[1].id];c.reviewedFeats!.bindings.push(structuredClone(c.reviewedFeats!.bindings[0]));expect(training()).toEqual(new Set());expect(evaluate(c).abilities.str).toBe(13);
});
it.each(['clear','replace','toggle'] as const)('explicit %s withdraws its confirmation; dependents suspend and reopening preserves manual data',mode=>{
 const {c,entries,confirm,choices,feat,training}=setup();const {f,choice}=confirm('lightly-armored');confirm('moderately-armored',1);const runtime=structuredClone(c.runtime),manual=structuredClone(c.training);
 if(mode==='toggle')chooseSheetOption(c,choice.id,f.id,entries);else setSheetChoiceSlot(c,choice.id,0,mode==='clear'?undefined:entries.find(row=>row.english==='Authored Armor Replacement')!.id,entries);
 expect(c.reviewedFeats!.bindings).toHaveLength(1);expect(training()).toEqual(new Set());expect(evaluate(reopen(c)).abilities.str).toBe(13);expect(reviewedFeatStatus(c,choices()[1].id,feat('moderately-armored').id).reason).toContain('轻甲');setSheetChoiceSlot(c,choice.id,0,f.id,entries);expect(training()).toEqual(new Set());confirm('lightly-armored');expect(training()).toEqual(new Set(['light','medium','shield']));expect(c.runtime).toEqual(runtime);expect(c.training).toEqual(manual);
});
it.each([true,false])('ASI and armor feats share source-order cap: armor first=%s',armorFirst=>{
 const {c,entries,choices,confirm,feat,training}=setup();const featSlot=armorFirst?0:1,asiSlot=armorFirst?1:0;c.abilities.str=16;confirm('lightly-armored',featSlot);const asi=choices()[asiSlot];setSheetChoiceSlot(c,asi.id,0,asi.options.find(o=>o.entry.raw._classAbilityRecord)!.value,entries);setAsiAllocation(c,asi.id,{str:2});c.abilities.str=18;
 expect(evaluate(c).abilities.str).toBe(armorFirst?19:20);expect(asiAllocationStatus(c,asi.id).active).toBe(!armorFirst);expect(reviewedFeatStatus(c,choices()[featSlot].id,feat('lightly-armored').id).active).toBe(armorFirst);expect(training().has('light')).toBe(armorFirst);
 const restored=reopen(c);expect(evaluate(restored).abilities.str).toBe(armorFirst?19:20);
});
it('a new earlier advancement cannot silently disable a later confirmed allocation',()=>{
 const {c,entries,choices,select}=setup();c.abilities.str=18;const asi=choices()[1];setSheetChoiceSlot(c,asi.id,0,asi.options.find(o=>o.entry.raw._classAbilityRecord)!.value,entries);setAsiAllocation(c,asi.id,{str:2});const {f,choice}=select('lightly-armored');const before=JSON.stringify(c);expect(()=>setReviewedFeatIntent(c,choice.id,f.id,{kind:'lightly-armored',ability:'str',confirmedManualAbilityExcluded:true})).toThrow('已有属性提升');expect(JSON.stringify(c)).toBe(before);
});
it('level downgrade archives/reopens the original source and later restores the entire confirmed armor chain offline',()=>{
 const {c,confirm,training}=setup();confirm('lightly-armored');confirm('moderately-armored',1);confirm('heavily-armored',2);const saved=JSON.stringify(c.reviewedFeats),runtime=structuredClone(c.runtime);c.selections[0].level=4;syncFeatures(c,[]);expect(training()).toEqual(new Set(['light']));const restored=reopen(c);restored.selections[0].level=8;syncFeatures(restored,[]);expect(effectiveTrainingDeclarations(restored)).toEqual(['light','medium','shield','heavy']);expect(JSON.stringify(restored.reviewedFeats)).toBe(saved);expect(restored.runtime).toEqual(runtime);expect(syncFeatures(restored,[])).toBe(false);
});
it('linked export retains armor consent; unknown future versions remain inert, immutable and visible',()=>{
 const {c,confirm,training}=setup();confirm('lightly-armored');const restored=importOwlbear(JSON.parse(JSON.stringify(exportLinkedOwlbear(c,evaluate(c)))));expect(effectiveTrainingDeclarations(restored)).toEqual(['light']);(c as any).reviewedFeats={version:7,future:{keep:true}};const saved=JSON.stringify(c);expect(training()).toEqual(new Set());expect(evaluate(reopen(c)).abilities.str).toBe(13);expect(evaluate(c).issues.some(row=>row.id==='reviewed-feat-version')).toBe(true);expect(JSON.stringify(c)).toBe(saved);
});

it.each(['future','self','dismissed','under-level'] as const)('raw class training cannot satisfy a prior feat when %s',mode=>{
 const {c,entries,choices,feat}=setup(),owner=c.selections[0],at=mode==='self'?4:6,raw={name:'原创护甲课程',ENG_name:'Authored Armor Lesson',source:'PHB',className:owner.entry.raw.name,classSource:'PHB',level:at,armorProficiencies:[{light:true}],entries:[]};
 const [entry]=normalizeData({classFeature:[raw]},'armor-lesson');const ref=`${raw.name}|${raw.className}|PHB|${at}`;owner.entry.raw.classFeatures.push(ref);entries.push(entry);syncFeatures(c,entries);
 const source=c.selections.find(row=>row.entry.id===entry.id)!;expect(source).toBeDefined();
 if(mode==='self'){const target=choices()[0];const targetSource=c.selections.find(row=>row.entry.id===target.id.split(':class-legacy-feat:')[1])!;targetSource.entry.raw.armorProficiencies=[{light:true}];}
 if(mode==='dismissed')c.dismissedFeatures=[`${source.parentId}|${source.grantKey}`];
 if(mode==='under-level')owner.level=4;
 const choice=choices()[0],medium=feat('moderately-armored');expect(choice.options.find(row=>row.value===medium.id)?.unavailable).toBeDefined();
});

it.each([13,20])('a cyclic score-effect source never disagrees between status, equipment and the engine: base %s',base=>{
 const {c,confirm,training}=setup();const {f,choice}=confirm('lightly-armored',0,'dex');c.abilities.dex=base;
 c.selections.push({id:'cycle',parentId:'cycle',level:1,quantity:1,equipped:false,entry:{...structuredClone(f),id:'cyclic-effect',kind:'feature',english:'Authored cyclic effect',raw:{},effects:[{op:'set',target:'dex',value:base===20?12:20}]}});
 expect(evaluate(c).abilities.dex).toBe(base===20?20:14);expect(reviewedFeatStatus(c,choice.id,f.id).active).toBe(base<20);expect(training().has('light')).toBe(base<20);
});

it.each(['duplicate-source-id','duplicate-owner-id','disabled-ancestor','cycle-ancestor','excluded-owner'] as const)('ambiguous or inactive ancestry is shared by engine/status/training: %s',mode=>{
 const {c,confirm,training}=setup();const {f,choice}=confirm('lightly-armored'),binding=c.reviewedFeats!.bindings[0],source=c.selections.find(row=>row.id===binding.selectionId)!;
 if(mode==='duplicate-source-id')c.selections.push(structuredClone(source));
 if(mode==='duplicate-owner-id')c.selections.push(structuredClone(c.selections[0]));
 if(mode==='disabled-ancestor')c.profile.disabledEntries=[c.selections[0].entry.id];
 if(mode==='cycle-ancestor')c.selections[0].parentId=source.id;
 const before=JSON.stringify(c),excluded=mode==='excluded-owner'?new Set([c.selections[0].id]):new Set<string>();
 expect(evaluate(c,excluded).abilities.str).toBe(13);expect(evaluate(c,excluded).issues.some(row=>row.id==='armor-training:armor-shield')).toBe(true);
 if(mode!=='excluded-owner'){expect(reviewedFeatStatus(c,choice.id,f.id).active).toBe(false);expect(training()).toEqual(new Set());}
 expect(JSON.stringify(c)).toBe(before);
});
it('saved source effects retain their original edition and use one safe projection after the sheet edition changes',()=>{
 const {c,confirm,training}=setup();const {f,choice}=confirm('lightly-armored');c.edition='2024';c.profile.optional.legacy=false;
 expect(evaluate(c).abilities.str).toBe(14);expect(reviewedFeatStatus(c,choice.id,f.id).active).toBe(true);expect(training()).toEqual(new Set(['light']));expect(effectiveTrainingDeclarations(c)).toEqual(['light']);
});

it.each(['feature','race','item','feat'] as const)('a manual known armor identity cannot escape consent by changing kind to %s',kind=>{
 const {c,feat,training,choices}=setup();const e=structuredClone(feat('heavily-armored'));e.kind=kind;e.raw.armorProficiencies=[{light:true}];e.effects=[{op:'add',target:'str',value:5}];c.selections.push({id:'forged-identity',entry:e,level:1,quantity:1,equipped:true});
 expect(training()).toEqual(new Set());expect(evaluate(c).abilities.str).toBe(13);expect(choices()[0].options.find(row=>row.value===feat('moderately-armored').id)?.unavailable).toContain('轻甲');expect(validateCharacter(structuredClone(c)).abilities.str).toBe(13);
});
it('an unknown source or later edition cannot fall back to raw training for a known reviewed armor identity',()=>{
 const {c,feat,training}=setup();const e=structuredClone(feat('lightly-armored'));e.source='CUSTOM';e.raw.source='CUSTOM';e.edition='2024';c.profile.enabledSources.push('CUSTOM');c.edition='2024';c.selections.push({id:'unknown-light',entry:e,level:1,quantity:1,equipped:false});expect(training()).toEqual(new Set());expect(evaluate(c).abilities.str).toBe(13);
});

it.each(['self-child','future-child','dismissed-child','under-level-child'] as const)('unlevelled descendants cannot launder %s training into an earlier prerequisite',mode=>{
 const {c,choices,feat}=setup(),choice=choices()[0],at=mode==='self-child'?4:6,source=c.selections.find(row=>row.entry.kind==='feature'&&row.entry.raw.level===at)!;
 const entry={...structuredClone(feat('lightly-armored')),id:'unlevelled-training',kind:'feature' as const,english:'Authored training child',raw:{_category:'optionalfeature',armorProficiencies:[{light:true}]}};
 c.selections.push({id:'training-child',parentId:source.id,entry,level:1,quantity:1,equipped:false});
 if(mode==='dismissed-child')c.dismissedFeatures=[`${source.parentId}|${source.grantKey}`];if(mode==='under-level-child')c.selections[0].level=4;
 expect(choices()[0].options.find(row=>row.value===feat('moderately-armored').id)?.unavailable).toContain('轻甲');
 const medium=feat('moderately-armored');c.answers[choice.id]=[medium.id];c.classChoiceSnapshots={...c.classChoiceSnapshots,[medium.id]:medium};const before=JSON.stringify(c);
 expect(()=>setReviewedFeatIntent(c,choice.id,medium.id,{kind:'moderately-armored',ability:'str',confirmedManualAbilityExcluded:true})).toThrow('轻甲');expect(JSON.stringify(c)).toBe(before);
});
