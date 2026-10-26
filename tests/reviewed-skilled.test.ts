import {it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {EQUIPMENT_TRAINING_ENTRIES} from '../src/data/weaponTraining';
import {type Character,type Entry} from '../src/core/model';
import {sheetChoices,setSheetChoiceSlot,chooseSheetOption} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
import {exportCharacter,exportLinkedOwlbear,exportOwlbear} from '../src/core/export';
import {validateCharacter,importOwlbear} from '../src/core/validation';
import {reviewedSkilledRule,reviewedSkilledStatus,setReviewedSkilledIntent,reviewedSkilledOptions,reviewedSkilledReference,evaluateReviewedSkilled,reviewedSkilledToolLabels,type ReviewedSkilledIntent,type ReviewedSkilledChoice} from '../src/core/automation/reviewedSkilled';
import {reviewedSkilledIdentity} from '../src/core/automation/reviewedFeatIdentity';
import {activeEffectSelections} from '../src/core/automation/active';
import {setAsiAllocation} from '../src/core/automation/asi';
import {setReviewedFeatIntent} from '../src/core/automation/reviewedFeats';
import {reviewedSkilledData,reviewedSkilledFixture} from './e2e/reviewedSkilledFixture';
import {reviewedPassiveFeatData} from './e2e/reviewedPassiveFeatFixture';
import evidence from '../src/core/automation/reviewedSkilledEvidence.json';
const picks:ReviewedSkilledChoice[]=[{kind:'skill',reference:'perception'},{kind:'tool',reference:"Thieves' Tools|PHB"},{kind:'tool',reference:'Vehicles (Land)|PHB'}];
const intent=(choices=picks):ReviewedSkilledIntent=>({kind:'skilled',choices:structuredClone(choices),confirmed:true});
const reopen=(c:Character)=>validateCharacter(JSON.parse(JSON.stringify(exportCharacter(c))));
function setup(level=4){
 const c=reviewedSkilledFixture(),entries=normalizeData(structuredClone(reviewedSkilledData),'skilled-core');c.selections[0].level=level;syncFeatures(c,entries);
 const choices=()=>sheetChoices(c,entries).filter(x=>x.id.includes(':class-legacy-feat:')).sort((a,b)=>a.grantLevel!-b.grantLevel!);
 const feat=entries.find(x=>x.english==='Skilled')!,choice=choices()[0];
 const select=(slot=0)=>{const chosen=choices()[slot];setSheetChoiceSlot(c,chosen.id,0,feat.id,entries);return chosen;};
 const confirm=(value=intent(),slot=0)=>{const chosen=select(slot);setReviewedSkilledIntent(c,chosen.id,feat.id,value);return chosen;};
 return {c,entries,feat,choice,choices,select,confirm};
}
it('the independent explicitly confirmed intent derives both halves purely, with no ability or manual/runtime mutation',()=>{
 const {c,select,choice,feat,confirm}=setup();select();expect(reviewedSkilledRule(feat)).toEqual({kind:'skilled',reference:'Skilled|PHB',page:170});expect(reviewedSkilledStatus(c,choice.id,feat.id)).toMatchObject({eligible:true,active:false});expect(evaluate(c).skills.perception.proficient).toBe(false);
 const before=JSON.stringify(c);confirm();expect(JSON.stringify({...c,reviewedSkilled:undefined})).toBe(before);expect(c.reviewedFeats).toBeUndefined();expect(c.reviewedWeaponMaster).toBeUndefined();const saved=JSON.stringify(c);
 for(let n=0;n<3;n++){const d=evaluate(reopen(c));expect(d.skills.perception).toMatchObject({value:2,proficient:true,expertise:false});expect(d.passive).toBe(12);expect(d.abilities).toEqual(c.abilities);expect(reviewedSkilledToolLabels(c)).toEqual(['盗贼工具','陆上载具']);expect(evaluateReviewedSkilled(c).tools).toEqual(["Thieves' Tools|PHB",'Vehicles (Land)|PHB']);}
 expect(JSON.stringify(c)).toBe(saved);expect(c.runtime.resources['manual-skilled'].current).toBe(2);expect(c.runtime.hp).toBe(7);
});
it.each([0,1,2,3])('one shared quota permits %s skills and the remaining tools',skills=>{
 const {c,confirm}=setup(),choices:ReviewedSkilledChoice[]=[...['perception','insight','arcana'].slice(0,skills).map(reference=>({kind:'skill' as const,reference})),...["Thieves' Tools|PHB",'Vehicles (Land)|PHB','Vehicles (Water)|PHB'].slice(0,3-skills).map(reference=>({kind:'tool' as const,reference}))];confirm(intent(choices));expect(evaluateReviewedSkilled(c).skills).toHaveLength(skills);expect(evaluateReviewedSkilled(c).tools).toHaveLength(3-skills);
});
it.each(['zero','one','two','four','six','duplicate','skill-case','skill-chinese','tool-case','tool-chinese','wrong-kind','language','group','magic','unknown-source','air-vehicles','cart','wagon','boat','extra-field','no-confirm','other-kind'] as const)('invalid %s mixed intent is rejected atomically and fails import safely',mode=>{
 const {c,select,feat}=setup(),choice=select(),bad:any=intent();
 if(mode==='zero')bad.choices=[];if(mode==='one')bad.choices.length=1;if(mode==='two')bad.choices.length=2;if(mode==='four')bad.choices.push({kind:'skill',reference:'arcana'});if(mode==='six')bad.choices.push({kind:'skill',reference:'arcana'},{kind:'skill',reference:'history'},{kind:'tool',reference:'Vehicles (Water)|PHB'});
 if(mode==='duplicate')bad.choices[2]=bad.choices[0];if(mode==='skill-case')bad.choices[2]={kind:'skill',reference:'Perception'};if(mode==='skill-chinese')bad.choices[2]={kind:'skill',reference:'察觉'};if(mode==='tool-case')bad.choices[2]={kind:'tool',reference:"thieves' tools|phb"};if(mode==='tool-chinese')bad.choices[2]={kind:'tool',reference:'盗贼工具|PHB'};if(mode==='wrong-kind')bad.choices[2]={kind:'skill',reference:"Thieves' Tools|PHB"};
 const refs:Record<string,string>={language:'Common|PHB',group:"Artisan's Tools|PHB",magic:'Instrument of the Bards, Doss Lute|DMG','unknown-source':'Shawm|SCAG','air-vehicles':'Vehicles (Air)|PHB',cart:'Cart|PHB',wagon:'Wagon|PHB',boat:'Rowboat|PHB'};if(refs[mode])bad.choices[2]={kind:'tool',reference:refs[mode]};if(mode==='extra-field')bad.choices[0].effects=[{op:'proficiency',skill:'arcana'}];if(mode==='no-confirm')bad.confirmed=false;if(mode==='other-kind')bad.kind='tough';
 const saved=JSON.stringify(c);expect(()=>setReviewedSkilledIntent(c,choice.id,feat.id,bad)).toThrow();expect(JSON.stringify(c)).toBe(saved);(c as any).reviewedSkilled={version:1,bindings:[{selectionId:'bad',choiceId:choice.id,entryId:feat.id,intent:bad}]};expect(()=>reopen(c)).toThrow('熟习');expect(evaluate(c).skills.perception.proficient).toBe(false);
});
it.each(['proficient','false','expertise','source','total','bonus','empty-tools','named-tools'] as const)('manual/source %s data remains authoritative and survives withdrawal without stacking PB',mode=>{
 const {c,confirm,choice,feat}=setup();
 if(mode==='proficient')c.proficiencies!.perception=true;if(mode==='false')c.proficiencies!.perception=false;if(mode==='expertise')c.expertise!.perception=true;if(mode==='source')c.selections[0].entry.raw.startingProficiencies={skills:[{perception:true}]};if(mode==='total')c.adjustments=[{id:'manual-perception',target:'skill:perception',value:17,reason:'手工总值'}];if(mode==='bonus')c.skillBonuses!.perception=3;if(mode==='empty-tools')c.training!.tools='';if(mode==='named-tools')c.training!.tools='手工工具';
 confirm();const before=JSON.stringify(c),d=evaluate(c);expect(d.skills.perception.value).toBe(mode==='expertise'?4:mode==='total'?17:mode==='bonus'?5:2);expect(d.skills.perception.expertise).toBe(mode==='expertise');expect(reviewedSkilledToolLabels(c)).toEqual(mode.endsWith('tools')?[]:['盗贼工具','陆上载具']);expect(JSON.stringify(c)).toBe(before);
 setReviewedSkilledIntent(c,choice.id,feat.id,null);expect(evaluate(c).skills.perception.proficient).toBe(['proficient','expertise','source'].includes(mode));expect(c.training?.tools).toBe(mode==='empty-tools'?'':mode==='named-tools'?'手工工具':undefined);
});
it.each(['source-off','disabled-tool','disabled-skill','disabled-feat','source-missing','owner-missing','downgrade','dismissed','duplicate-owner','duplicate-source','owner-source','feature-source','feature-edition','cycle','automation-off','feats-off'] as const)('saved intent suspends on %s without deleting records or manual data',mode=>{
 const {c,confirm,feat,choice}=setup();confirm();const source=c.selections.find(row=>row.id===c.reviewedSkilled!.bindings[0].selectionId)!,saved=JSON.stringify(c.reviewedSkilled);
 if(mode==='source-off')c.profile.enabledSources=[];if(mode==='disabled-tool')c.profile.disabledEntries=[evidence.tools.find(row=>row.reference==="Thieves' Tools|PHB")!.entryId];if(mode==='disabled-skill')c.profile.disabledEntries=[evidence.skills.find(row=>row.reference==='perception')!.entryId];if(mode==='disabled-feat')c.profile.disabledEntries=[feat.id];if(mode==='source-missing')c.selections=c.selections.filter(row=>row.id!==source.id);if(mode==='owner-missing')c.selections.shift();if(mode==='downgrade')c.selections[0].level=3;if(mode==='dismissed')c.dismissedFeatures=[`${source.parentId}|${source.grantKey}`];if(mode==='duplicate-owner')c.selections.push(structuredClone(c.selections[0]));if(mode==='duplicate-source')c.selections.push(structuredClone(source));if(mode==='owner-source')c.selections[0].entry.raw.source='CUSTOM';if(mode==='feature-source')source.entry.raw.source='CUSTOM';if(mode==='feature-edition')source.entry.raw._classEdition='2024';if(mode==='cycle')c.selections[0].parentId=source.id;if(mode==='automation-off')c.automation!.enabled=false;if(mode==='feats-off')c.profile.optional.feats=false;
 expect(reviewedSkilledStatus(c,choice.id,feat.id).active).toBe(false);expect(evaluate(c).skills.perception.proficient).toBe(false);expect(reviewedSkilledToolLabels(c)).toEqual([]);expect(JSON.stringify(c.reviewedSkilled)).toBe(saved);
});
it.each(['source','raw-source','kind','edition','english','raw-name','raw-category','page','raw-page','copy','effects','raw-effects','choices','count','from','ability','repeatable','category','pack','dependency'] as const)('edited source feat %s cannot authorize the bounded mechanism',mode=>{
 const {c,confirm,feat}=setup();confirm();const e=c.classChoiceSnapshots![feat.id],saved=JSON.stringify(c.reviewedSkilled);
 if(mode==='source')e.source='XPHB';if(mode==='raw-source')e.raw.source='XPHB';if(mode==='kind')e.kind='feature';if(mode==='edition')e.edition='2024';if(mode==='english')e.english='Other';if(mode==='raw-name')e.raw.ENG_name='Other';if(mode==='raw-category')e.raw._category='feature';if(mode==='page')e.page=201;if(mode==='raw-page')e.raw.page=201;if(mode==='copy')e.raw._copy={};if(mode==='effects')e.effects=[{op:'proficiency',skill:'perception'}];if(mode==='raw-effects')e.raw.effects=[];if(mode==='choices')e.choices=[{} as any];if(mode==='count')e.raw.skillToolLanguageProficiencies[0].choose[0].count=4;if(mode==='from')e.raw.skillToolLanguageProficiencies[0].choose[0].from=['任意语言'];if(mode==='ability')e.raw.ability=[{int:1}];if(mode==='repeatable')e.raw.repeatable=true;if(mode==='category')e.raw.category='O';if(mode==='pack')e.packId='custom';if(mode==='dependency')e.dependencies=['PHB'];
 expect(reviewedSkilledRule(e)).toBeUndefined();expect(evaluate(c).skills.perception.proficient).toBe(false);expect(reviewedSkilledToolLabels(c)).toEqual([]);expect(JSON.stringify(c.reviewedSkilled)).toBe(saved);
});
it.each(['binding','answer','manual','alias-source'])('duplicate %s ownership suspends rather than stacks or chooses by array order',mode=>{
 const {c,confirm,choices,feat}=setup(8);confirm();if(mode==='binding')c.reviewedSkilled!.bindings.push(structuredClone(c.reviewedSkilled!.bindings[0]));if(mode==='answer'){const e={...structuredClone(feat),id:'alias-skilled'};c.classChoiceSnapshots![e.id]=e;c.answers[choices()[1].id]=[e.id];}if(mode==='manual')c.selections.push({id:'manual-skilled',entry:feat,level:1,quantity:1,equipped:false});if(mode==='alias-source'){const row=structuredClone(c.selections.find(row=>row.id===c.reviewedSkilled!.bindings[0].selectionId)!);row.id='alias-source';c.selections.push(row);}
 expect(evaluate(c).skills.perception.proficient).toBe(false);expect(evaluateReviewedSkilled(c).tools).toEqual([]);
});
it.each(['withdraw','clear','replace','toggle'])('new-client %s removes only owned confirmation; reselection requires fresh consent',mode=>{
 const {c,confirm,choice,feat,entries}=setup();confirm();const manual=JSON.stringify({runtime:c.runtime,training:c.training,proficiencies:c.proficiencies,expertise:c.expertise,actions:c.quickbarActions});
 if(mode==='withdraw')setReviewedSkilledIntent(c,choice.id,feat.id,null);else if(mode==='toggle')chooseSheetOption(c,choice.id,feat.id,entries);else setSheetChoiceSlot(c,choice.id,0,mode==='clear'?undefined:entries.find(row=>row.english==='Authored Skilled Replacement')!.id,entries);
 expect(c.reviewedSkilled!.bindings).toEqual([]);setSheetChoiceSlot(c,choice.id,0,feat.id,entries);expect(reviewedSkilledStatus(reopen(c),choice.id,feat.id).active).toBe(false);confirm();expect(evaluate(c).skills.perception.value).toBe(2);expect(JSON.stringify({runtime:c.runtime,training:c.training,proficiencies:c.proficiencies,expertise:c.expertise,actions:c.quickbarActions})).toBe(manual);
});
it('source toggling and 4→3→4 offline reopen preserve exact source identity, children and consumed resources',()=>{
 const {c,confirm,choice,feat}=setup();confirm();const id=c.reviewedSkilled!.bindings[0].selectionId,saved=JSON.stringify(c.reviewedSkilled),runtime=structuredClone(c.runtime);
 c.selections.push({id:'manual-child',parentId:id,entry:{...structuredClone(feat),id:'manual-child-entry',kind:'feature',english:'Authored child',raw:{},entries:[]},level:1,quantity:1,equipped:false});c.profile.enabledSources=[];expect(evaluate(c).skills.perception.proficient).toBe(false);c.profile.enabledSources=['PHB'];expect(evaluate(c).skills.perception.proficient).toBe(true);
 c.selections[0].level=3;syncFeatures(c,[]);expect(c.selections.some(row=>row.id===id)).toBe(false);expect(c.classChoiceArchive?.[id].selections.some(row=>row.id==='manual-child')).toBe(true);const restored=reopen(c);restored.selections[0].level=4;syncFeatures(restored,[]);expect(restored.selections.some(row=>row.id===id)).toBe(true);expect(restored.selections.some(row=>row.id==='manual-child')).toBe(true);expect(reviewedSkilledStatus(restored,choice.id,feat.id).active).toBe(true);expect(JSON.stringify(restored.reviewedSkilled)).toBe(saved);expect(restored.runtime).toEqual(runtime);expect(syncFeatures(restored,[])).toBe(false);
});
it('filtered source inputs cannot reactivate an excluded source, and evaluate remains pure',()=>{
 const {c,confirm}=setup();confirm();const id=c.reviewedSkilled!.bindings[0].selectionId;expect(evaluate(c,new Set([id])).skills.perception.proficient).toBe(false);expect(evaluateReviewedSkilled(c,activeEffectSelections(c).filter(row=>row.id!==id)).tools).toEqual([]);
});
it('future independent state stays opaque and cannot reject or suspend existing Tough or ASI',()=>{
 const {c,entries,choices,choice,feat,select}=setup(8);entries.push(...normalizeData(structuredClone(reviewedPassiveFeatData),'passive'));const tough=entries.find(row=>row.english==='Tough')!,later=choices()[1];setSheetChoiceSlot(c,later.id,0,tough.id,entries);setReviewedFeatIntent(c,later.id,tough.id,{kind:'tough',confirmedManualHpExcluded:true});select();const hp=evaluate(c).maxHp;(c as any).reviewedSkilled={version:2,future:{preserve:true}};const before=JSON.stringify(c);expect(evaluate(reopen(c)).maxHp).toBe(hp);expect(evaluate(c).issues.some(row=>row.id==='reviewed-skilled-version')).toBe(true);expect(()=>setReviewedSkilledIntent(c,choice.id,feat.id,intent())).toThrow('版本');expect(()=>setReviewedSkilledIntent(c,choice.id,feat.id,null)).toThrow('版本');expect(JSON.stringify(c)).toBe(before);
});
it('Skilled has no ability cap and does not disturb a separately confirmed ASI',()=>{
 const {c,confirm,entries,choices}=setup(8);c.abilities.int=22;confirm();const other=choices()[1];setSheetChoiceSlot(c,other.id,0,other.options.find(row=>row.entry.raw._classAbilityRecord)!.value,entries);setAsiAllocation(c,other.id,{str:2});expect(evaluate(c).abilities).toMatchObject({int:22,str:12});expect(evaluate(c).skills.perception.value).toBe(3);
});
it('native and linked full payloads retain independent intent; ordinary legacy Owlbear stays an explicitly thin projection',()=>{
 const {c,confirm}=setup();confirm();const restored=importOwlbear(JSON.parse(JSON.stringify(exportLinkedOwlbear(c,evaluate(c)))));expect(restored.reviewedSkilled).toEqual(c.reviewedSkilled);expect(evaluate(restored).skills.perception.value).toBe(2);expect((exportOwlbear(c,evaluate(c)) as any).identity.tool_proficiencies).toEqual([]);
});
it('exact finite registry has 18 skills, 37 individual tools and 2 vehicle kinds, never entire groups or per-vehicle objects',()=>{
 const {c}=setup(),options=reviewedSkilledOptions(c);expect(options).toHaveLength(57);expect(options.filter(row=>row.choice.kind==='skill')).toHaveLength(18);expect(options.filter(row=>row.choice.kind==='tool')).toHaveLength(39);expect(options.every(row=>!row.unavailable)).toBe(true);expect(new Set(options.map(row=>row.value)).size).toBe(57);
 for(const option of options.filter(row=>!evidence.vehicles.some(vehicle=>vehicle.reference===row.choice.reference)))expect(reviewedSkilledReference(option.entry)).toEqual(option.choice);
});
it.each(['id','pack','source','raw-source','edition','raw-edition','kind','raw-category','raw-name','page','rarity','magic','attune','bonus','copy','group','effects','raw-effects','extra'])('edited catalog kind %s cannot silently replace reviewed proficiency identity',mode=>{
 const {c}=setup(),e=structuredClone(reviewedSkilledOptions(c).find(row=>row.value==="tool:Thieves' Tools|PHB")!.entry);
 if(mode==='id')e.id='alias';if(mode==='pack')e.packId='custom';if(mode==='source')e.source='DMG';if(mode==='raw-source')e.raw.source='DMG';if(mode==='edition')e.edition='2024';if(mode==='raw-edition')e.raw.edition='one';if(mode==='kind')e.kind='feat';if(mode==='raw-category')e.raw._category='itemGroup';if(mode==='raw-name')e.raw.ENG_name='Unknown';if(mode==='page')e.raw.page=999;if(mode==='rarity')e.raw.rarity='rare';if(mode==='magic')e.raw.magic=true;if(mode==='attune')e.raw.reqAttune=true;if(mode==='bonus')e.raw.bonusWeapon='+1';if(mode==='copy')e.raw._copy={};if(mode==='group')e.raw.items=['Thieves\' Tools|PHB'];if(mode==='effects')e.effects=[{op:'add',target:'str',value:3}];if(mode==='raw-effects')e.raw.effects=[];if(mode==='extra')e.raw.speed=30;
 expect(reviewedSkilledReference(e)).toBeUndefined();const matching=reviewedSkilledOptions(c,[e]).find(row=>row.value==="tool:Thieves' Tools|PHB")!;if(mode!=='source')expect(matching.unavailable).toBeTruthy();
});
it.each(['feat','feature','race','item'] as const)('manual forged same-name %s raw/effects cannot bypass explicit PHB consent',kind=>{
 const {c,feat}=setup(),before=evaluate(c),e=structuredClone(feat);e.id='manual-forged';e.kind=kind;e.source='CUSTOM';e.raw.source='CUSTOM';e.raw.skillProficiencies=[{perception:true}];e.raw.toolProficiencies=[{"thieves' tools":true}];e.effects=[{op:'proficiency',skill:'perception'},{op:'add',target:'str',value:5},{op:'add',target:'hp',value:50},{op:'add',target:'ac',value:5},{op:'add',target:'speed',value:10}];c.profile.enabledSources.push('CUSTOM');c.selections.push({id:'manual-forged',entry:e,level:1,quantity:1,equipped:true});const after=evaluate(c);expect(after.abilities).toEqual(before.abilities);expect(after.maxHp).toBe(before.maxHp);expect(after.ac).toBe(before.ac);expect(after.speed).toBe(before.speed);expect(after.skills.perception.proficient).toBe(false);expect(sheetChoices(c,[e]).some(row=>row.ownerId==='manual-forged')).toBe(false);expect(reviewedSkilledIdentity(e)).toBe(true);
});
it('a legitimate imported instance alias retains canonical rule disable boundaries',()=>{
 const {c,select,feat}=setup(),choice=select(),entry=structuredClone(feat);entry.id='alias:skilled';c.classChoiceSnapshots![entry.id]=entry;c.answers[choice.id]=[entry.id];
 setReviewedSkilledIntent(c,choice.id,entry.id,intent());expect(evaluate(c).skills.perception.proficient).toBe(true);
 c.profile.disabledEntries=[feat.id];expect(evaluate(c).skills.perception.proficient).toBe(false);const before=JSON.stringify(c);expect(()=>setReviewedSkilledIntent(c,choice.id,entry.id,intent())).toThrow();expect(JSON.stringify(c)).toBe(before);
});
it.each(['extra-state','extra-binding','extra-intent','wrong-version','bindings-object','old-store'] as const)('invalid %s confirmation shape is rejected safely and cannot execute',mode=>{
 const {c,confirm}=setup();confirm();const bad:any=structuredClone(c),binding=bad.reviewedSkilled.bindings[0];if(mode==='extra-state')bad.reviewedSkilled.effects=[];if(mode==='extra-binding')binding.effects=[];if(mode==='extra-intent')binding.intent.ability='str';if(mode==='wrong-version')bad.reviewedSkilled.version=0;if(mode==='bindings-object')bad.reviewedSkilled.bindings={};if(mode==='old-store'){bad.reviewedFeats=bad.reviewedSkilled;delete bad.reviewedSkilled;}
 expect(()=>reopen(bad)).toThrow();if(mode!=='old-store')expect(evaluate(bad).skills.perception.proficient).toBe(false);
});
it('repeated confirmation stores exactly one owned binding and does not touch a second feat domain',()=>{
 const {c,confirm,choice,feat}=setup();confirm();const first=JSON.stringify(c);for(let i=0;i<3;i++)setReviewedSkilledIntent(c,choice.id,feat.id,intent());expect(c.reviewedSkilled!.bindings).toHaveLength(1);expect(JSON.stringify(c)).toBe(first);
});

// loadCatalog always injects these project-authored handles before remote rows.
// normalizeData-only fixtures previously omitted this real App integration seam.
it('the actual App catalog seed keeps both exact PHB vehicle kinds available, without accepting other authored groups',()=>{
 const {c}=setup(),catalog=structuredClone(EQUIPMENT_TRAINING_ENTRIES),options=reviewedSkilledOptions(c,catalog);
 expect(options).toHaveLength(57);expect(options.every(row=>!row.unavailable)).toBe(true);
 for(const key of ['land-vehicles','water-vehicles']){
  const entry=catalog.find(row=>row.id===`dnd-card.weapon-training:2014:${key}`)!;
  expect(reviewedSkilledReference(entry)).toEqual({kind:'tool',reference:`${entry.english}|PHB`});
 }
 expect(catalog.filter(row=>reviewedSkilledReference(row))).toHaveLength(2);
});
it.each(['id','pack','source','edition','kind','raw-category','raw-extra','effects','choices','dependencies','revision','english','effects-object','choices-object','dependencies-object'] as const)('a forged %s same-name authored vehicle handle stays blocked',mode=>{
 const {c}=setup(),entry=structuredClone(EQUIPMENT_TRAINING_ENTRIES.find(row=>row.id==='dnd-card.weapon-training:2014:land-vehicles')!);
 if(mode==='id')entry.id='forged';if(mode==='pack')entry.packId='custom';if(mode==='source')entry.source='XPHB';if(mode==='edition')entry.edition='2024';if(mode==='kind')entry.kind='item';if(mode==='raw-category')entry.raw._category='item';if(mode==='raw-extra')entry.raw.bonusWeapon='+1';if(mode==='effects')entry.effects=[{op:'add',target:'str',value:3}];if(mode==='choices')entry.choices=[{} as any];if(mode==='dependencies')entry.dependencies=[{} as any];if(mode==='revision')entry.revision='future';if(mode==='english')entry.english='Other';if(mode==='effects-object')(entry as any).effects={};if(mode==='choices-object')(entry as any).choices={};if(mode==='dependencies-object')(entry as any).dependencies={};
 expect(reviewedSkilledReference(entry)).toBeUndefined();
 // Reusing a canonical App handle ID conflicts even after English/source edits.
 expect(reviewedSkilledOptions(c,[entry]).find(row=>row.choice.reference==='Vehicles (Land)|PHB')!.unavailable).toBeTruthy();
});
it('both historic table-backed and actual App category disable IDs suspend vehicle proficiency, never a Cart item ID',()=>{
 for(const [key,reference] of [['land-vehicles','Vehicles (Land)|PHB'],['water-vehicles','Vehicles (Water)|PHB']])for(const id of [`reviewed-skilled:PHB:${key}`,`dnd-card.weapon-training:2014:${key}`]){
  const {c,confirm,choice,feat}=setup();confirm(intent([picks[0],picks[1],{kind:'tool',reference}]));const stored=JSON.stringify(c.reviewedSkilled);c.profile.disabledEntries=[id];
  expect(reviewedSkilledOptions(c,EQUIPMENT_TRAINING_ENTRIES).find(row=>row.choice.reference===reference)!.unavailable,id).toBeTruthy();
  expect(reviewedSkilledStatus(c,choice.id,feat.id).active,id).toBe(false);expect(evaluate(c).skills.perception.proficient,id).toBe(false);expect(JSON.stringify(c.reviewedSkilled)).toBe(stored);
  c.profile.disabledEntries=[];expect(reviewedSkilledStatus(c,choice.id,feat.id).active).toBe(true);
 }
 const {c,confirm,choice,feat}=setup();confirm();c.profile.disabledEntries=['kiwee:item:phb:cart::::::'];expect(reviewedSkilledStatus(c,choice.id,feat.id).active).toBe(true);
});

it('a valid authored handle never masks a duplicate conflicting row in either catalog order',()=>{
 const {c}=setup(),valid=structuredClone(EQUIPMENT_TRAINING_ENTRIES.find(row=>row.id==='dnd-card.weapon-training:2014:land-vehicles')!),bad=structuredClone(valid);bad.raw._copy={name:'Other'};
 for(const catalog of [[valid,bad],[bad,valid]])expect(reviewedSkilledOptions(c,catalog).find(row=>row.choice.reference==='Vehicles (Land)|PHB')!.unavailable).toBeTruthy();
});
