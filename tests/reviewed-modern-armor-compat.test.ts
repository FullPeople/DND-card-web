import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
import {activeEffectSelections} from '../src/core/automation/active';
import {effectiveTrainingDeclarations} from '../src/core/automation/training';
import {reviewedFeatRule,setReviewedFeatIntent} from '../src/core/automation/reviewedFeats';
const directory=process.env.REVIEWED_FEATS_FROZEN_DIR;
const sourceHashes:Record<string,string>={'feats.json':'0491b421f5f1db6628c3a8aeb86bbc3b72b56bf101a14ba96acbe19c829a56a6','class/class-wizard.json':'7533f3fb7bab70cd2d2f2b5dfb7e259dc66a2bfee24ee6ad3809042e53ba8a03','class/class-bard.json':'ac95dc8f1d795c0764ae6314e846d8efdcbbb4b42a8c721551265467885ed31c','class/class-cleric.json':'011edfef6c76cd0f70143d83db3b5e8b9b0d31ca1557b4c0954bedc619615344','items-base.json':'8933a3e70e47aa4fd6196bd7f1f2e3a57d6d8dbe7e781d37bb6a0519d7c4ffff'};
const source=(name:string)=>{const index=JSON.parse(readFileSync(`${directory}/index.json`,'utf8')),row=index.rows.find((r:any)=>r.url.endsWith(`/data/${name}`));expect(row,`Missing frozen modern armor input: ${name}`).toBeDefined();const data=JSON.parse(readFileSync(`${directory}/${row.path}`,'utf8'));expect(createHash('sha256').update(JSON.stringify(data)).digest('hex')).toBe(sourceHashes[name]);return data;};
function setup(name='Lightly Armored',owner='Wizard'){
 const entries=[source('feats.json'),source(`class/class-${owner.toLowerCase()}.json`),source('items-base.json')].flatMap(d=>normalizeData(d,'modern-armor-compat'));
 const c=newCharacter('2024');c.automation=newAutomationState();c.profile.enabledSources=['PHB','XPHB'];c.abilities.str=13;c.abilities.dex=13;c.runtime.hp=7;c.runtime.resources.manual={name:'Manual',max:3,current:1};
 const feat=entries.find(e=>e.kind==='feat'&&e.english===name&&e.source==='XPHB')!,shield=entries.find(e=>e.kind==='item'&&e.english==='Shield'&&e.source==='XPHB')!;
 c.selections=[{id:'owner',entry:entries.find(e=>e.kind==='class'&&e.english===owner&&e.source==='XPHB')!,level:4,quantity:1,equipped:false},{id:'shield',entry:shield,level:1,quantity:1,equipped:true}];syncFeatures(c,entries);
 const choice=sheetChoices(c,entries).find(row=>row.id.includes(':class-typed-feat:')&&row.grantLevel===4)!;
 return {c,entries,feat,choice};
}
it.skipIf(!directory)('actual XPHB Wizard ASI4 Lightly keeps its preexisting training without acquiring PHB intent or automatic ability',()=>{
 const {c,entries,feat,choice}=setup();expect(choice.options.find(row=>row.value===feat.id)?.unavailable).toBeUndefined();expect(evaluate(c).ac).toBe(11);
 setSheetChoiceSlot(c,choice.id,0,feat.id,entries);syncFeatures(c,entries);expect(c.selections.filter(row=>row.entry.id===feat.id)).toHaveLength(1);
 const saved=JSON.stringify(c);expect(effectiveTrainingDeclarations(c)).toEqual(expect.arrayContaining(['light','shield']));expect(evaluate(c).ac).toBe(13);expect(evaluate(c).abilities.dex).toBe(13);expect(c.reviewedFeats).toBeUndefined();expect(JSON.stringify(c)).toBe(saved);expect(reviewedFeatRule(feat)).toBeUndefined();expect(()=>setReviewedFeatIntent(c,choice.id,feat.id,{kind:'lightly-armored',ability:'dex',confirmedManualAbilityExcluded:true})).toThrow();
});
it.skipIf(!directory).each([['Moderately Armored','Bard','medium'],['Heavily Armored','Cleric','heavy']])('actual existing XPHB %s at lawful level4 keeps generic %s training', (name,owner,category)=>{
 const {c,feat}=setup(name,owner);expect(feat.raw.prerequisite[0].level).toBe(4);c.selections.push({id:'existing-modern-feat',entry:feat,level:1,quantity:1,equipped:false});const saved=JSON.stringify(c);expect(effectiveTrainingDeclarations(c)).toContain(category);expect(evaluate(c).abilities.str).toBe(13);expect(evaluate(c).abilities.dex).toBe(13);expect(c.reviewedFeats).toBeUndefined();expect(JSON.stringify(c)).toBe(saved);
});
it.skipIf(!directory).each(['Moderately Armored','Heavily Armored'])('preserving %s training does not newly authorize its unsupported typed prerequisite UI',name=>{
 const {choice,feat}=setup(name,name==='Moderately Armored'?'Bard':'Cleric');expect(choice.options.find(row=>row.value===feat.id)?.unavailable).toBeDefined();
});
it.skipIf(!directory)('a level1 probe is not a lawful modern feat and never restores shield AC merely to match old counts',()=>{
 const {c,feat}=setup();c.selections[0].level=1;c.selections.push({id:'unqualified-modern',entry:feat,level:1,quantity:1,equipped:false});expect(effectiveTrainingDeclarations(c)).toEqual([]);expect(evaluate(c).ac).toBe(11);
});
it.skipIf(!directory).each(['Tough','Resilient'])('real XPHB %s keeps baseline non-armor behavior and never borrows PHB consent',name=>{
 const {c,entries,feat,choice}=setup(name);const before=evaluate(c);setSheetChoiceSlot(c,choice.id,0,feat.id,entries);syncFeatures(c,entries);expect(c.selections.some(row=>row.entry.id===feat.id)).toBe(true);const after=evaluate(c);expect(after.abilities).toEqual(before.abilities);expect(after.maxHp).toBe(before.maxHp);expect(after.saves).toEqual(before.saves);expect(reviewedFeatRule(feat)).toBeUndefined();expect(()=>setReviewedFeatIntent(c,choice.id,feat.id,name==='Tough'?{kind:'tough',confirmedManualHpExcluded:true}:{kind:'resilient',ability:'dex',confirmedManualAbilityExcluded:true})).toThrow();
});
it.skipIf(!directory).each(['kind','edition','raw-source','normalized-source','page','copy','extra-mechanic','choice-from','choice-amount','training','prerequisite','effects','choice','entries-shape'] as const)('a forged modern exemption fails closed: %s',mode=>{
 const {c,feat}=setup();const row=structuredClone(feat);if(mode==='kind')row.kind='race';if(mode==='edition')row.edition='2014';if(mode==='raw-source')row.raw.source='PHB';if(mode==='normalized-source')row.source='PHB';if(mode==='page')row.page=167;if(mode==='copy')row.raw._copy={};if(mode==='extra-mechanic')row.raw.speed=10;if(mode==='choice-from')row.raw.ability[0].choose.from=['int'];if(mode==='choice-amount')row.raw.ability[0].choose.amount=1;if(mode==='training')row.raw.armorProficiencies=[{light:true,shield:true,heavy:true}];if(mode==='prerequisite')row.raw.prerequisite=[{level:1}];if(mode==='effects')row.effects=[{op:'add',target:'str',value:1}];if(mode==='choice')row.choices=[{} as any];if(mode==='entries-shape')row.raw.entries[1].type='list';c.selections.push({id:'forged-modern',entry:row,level:1,quantity:1,equipped:false});expect(effectiveTrainingDeclarations(c)).toEqual([]);expect(evaluate(c).abilities.str).toBe(13);expect(evaluate(c).ac).toBe(11);
});
it.skipIf(!directory).each(['Lightly Armored','Moderately Armored','Heavily Armored','Tough','Resilient'])('changing PHB %s labels alone cannot manufacture any XPHB compatibility or PHB authorization',name=>{
 const {c,entries}=setup();const row=structuredClone(entries.find(e=>e.kind==='feat'&&e.english===name&&e.source==='PHB')!);row.source='XPHB';row.raw.source='XPHB';row.edition='2024';expect(reviewedFeatRule(row)).toBeUndefined();const before=evaluate(c);c.selections.push({id:'relabeled-phb',entry:row,level:1,quantity:1,equipped:false});expect(effectiveTrainingDeclarations(c)).toEqual([]);expect(evaluate(c).abilities).toEqual(before.abilities);expect(evaluate(c).maxHp).toBe(before.maxHp);expect(evaluate(c).saves).toEqual(before.saves);
});
it.skipIf(!directory)('a retained modern feat suspends on source dismissal/downgrade and preserves manual overrides including empty',()=>{
 const {c,entries,feat,choice}=setup();setSheetChoiceSlot(c,choice.id,0,feat.id,entries);syncFeatures(c,entries);const stored=JSON.stringify(c.runtime);expect(effectiveTrainingDeclarations(c)).toEqual(['light','shield']);c.training={armor:''};expect(effectiveTrainingDeclarations(c)).toEqual([]);expect(evaluate(c).ac).toBe(11);delete c.training.armor;c.selections[0].level=3;expect(effectiveTrainingDeclarations(c)).toEqual([]);c.selections[0].level=4;expect(effectiveTrainingDeclarations(c)).toEqual(['light','shield']);const source=c.selections.find(row=>row.entry.id===choice.id.split(':class-typed-feat:')[1])!;c.dismissedFeatures=[`${source.parentId}|${source.grantKey}`];expect(effectiveTrainingDeclarations(c)).toEqual([]);c.dismissedFeatures=[];expect(effectiveTrainingDeclarations(c)).toEqual(['light','shield']);expect(JSON.stringify(c.runtime)).toBe(stored);
});

it.skipIf(!directory).each(['missing-ref','forged-ref','owner-raw-source','owner-raw-name','owner-edition','owner-copy','source-raw-source','source-raw-name','source-edition','source-copy','source-category','duplicate-source'] as const)('modern typed training cannot claim an earlier source with %s',mode=>{
 const {c,entries,feat,choice}=setup();setSheetChoiceSlot(c,choice.id,0,feat.id,entries);syncFeatures(c,entries);const owner=c.selections[0],source=c.selections.find(row=>row.entry.id===choice.id.split(':class-typed-feat:')[1])!,boundary={level:8,choiceId:'later-legacy'};
 expect(effectiveTrainingDeclarations(c,activeEffectSelections(c),'armor',boundary)).toEqual(['light','shield']);
 if(mode==='missing-ref')owner.entry.raw.classFeatures=[];if(mode==='forged-ref')source.grantKey='ref:forged';if(mode==='owner-raw-source')owner.entry.raw.source='CUSTOM';if(mode==='owner-raw-name')owner.entry.raw.ENG_name='Custom';if(mode==='owner-edition')owner.entry.raw.edition='classic';if(mode==='owner-copy')owner.entry.raw._copy={};if(mode==='source-raw-source')source.entry.raw.source='PHB';if(mode==='source-raw-name')source.entry.raw.ENG_name='Custom';if(mode==='source-edition')source.entry.edition='2014';if(mode==='source-copy')source.entry.raw._copy={};if(mode==='source-category')source.entry.raw._category='monster';if(mode==='duplicate-source')c.selections.push({...structuredClone(source),id:'alias-source',entry:{...structuredClone(source.entry),id:'alias-source-entry'}});
 expect(effectiveTrainingDeclarations(c,activeEffectSelections(c),'armor',boundary)).toEqual([]);expect(effectiveTrainingDeclarations(c)).toEqual([]);expect(evaluate(c).ac).toBe(11);
});
it.skipIf(!directory)('modern exact training cannot bootstrap itself, future PHB prerequisites, or missing category prerequisites',()=>{
 const {c,entries,feat,choice}=setup();setSheetChoiceSlot(c,choice.id,0,feat.id,entries);syncFeatures(c,entries);expect(effectiveTrainingDeclarations(c,activeEffectSelections(c),'armor',{level:4,choiceId:'earlier'})).toEqual([]);
 for(const name of ['Moderately Armored','Heavily Armored']){const row=structuredClone(entries.find(e=>e.kind==='feat'&&e.english===name&&e.source==='XPHB')!);const manual=structuredClone(c);manual.selections=manual.selections.filter(r=>r.entry.id!==feat.id);manual.selections.push({id:'missing-prerequisite',entry:row,level:1,quantity:1,equipped:false});expect(effectiveTrainingDeclarations(manual)).toEqual([]);}
});

it.skipIf(!directory).each(['Moderately Armored','Heavily Armored'])('a fabricated unsupported %s typed grant cannot borrow future raw training or supply a later PHB prerequisite',name=>{
 const {c,entries,feat,choice}=setup();setSheetChoiceSlot(c,choice.id,0,feat.id,entries);syncFeatures(c,entries);const row=c.selections.find(value=>value.entry.id===feat.id)!,modern=entries.find(value=>value.kind==='feat'&&value.english===name&&value.source==='XPHB')!;
 c.selections[0].level=8;row.entry=modern;c.answers[choice.id]=[modern.id];row.grantKey=`choice:${choice.id}:${modern.id}`;c.classChoiceSnapshots={...c.classChoiceSnapshots,[modern.id]:modern};
 const category=name==='Moderately Armored'?'light':'medium',raw={name:'Authored future training',ENG_name:'Authored Future Training',source:'XPHB',className:c.selections[0].entry.raw.name,classSource:'XPHB',level:6,armorProficiencies:[{[category]:true}],entries:[]},future=normalizeData({classFeature:[raw]},'modern-future-attack')[0],ref=`${raw.name}|${raw.className}|XPHB|6`;
 c.selections[0].entry.raw.classFeatures.push(ref);c.selections.push({id:'future-training',entry:future,level:1,quantity:1,equipped:false,parentId:c.selections[0].id,grantKey:`ref:${ref}`});
 expect(effectiveTrainingDeclarations(c)).toEqual([category]);expect(effectiveTrainingDeclarations(c,activeEffectSelections(c),'armor',{level:8,choiceId:'later-phb'})).toEqual([category]);expect(sheetChoices(c,entries).find(value=>value.id===choice.id)?.options.find(value=>value.value===modern.id)?.unavailable).toBeDefined();
});
