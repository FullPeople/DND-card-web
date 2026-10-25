import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
import {armorTraining} from '../src/core/automation/equipment';
import {setReviewedFeatIntent,reviewedFeatStatus,type ReviewedArmorFeatKind} from '../src/core/automation/reviewedFeats';
import {activeSelections} from '../src/core/automation/active';
const directory=process.env.REVIEWED_FEATS_FROZEN_DIR;
const hashes={'feats.json':'0491b421f5f1db6628c3a8aeb86bbc3b72b56bf101a14ba96acbe19c829a56a6','class/class-fighter.json':'a4c5afc0e7ec7a444d1418a04ab4fe392b9a7a25907ac0fb9b8618a79d1ee509'};
function setup(english:string,owner='Fighter',level=4){
 const index=JSON.parse(readFileSync(`${directory}/index.json`,'utf8'));
 const selectedHashes=owner==='Fighter'?hashes:{'feats.json':hashes['feats.json'],...(owner==='Wizard'?{'class/class-wizard.json':'7533f3fb7bab70cd2d2f2b5dfb7e259dc66a2bfee24ee6ad3809042e53ba8a03'}:{'class/class-artificer.json':'c65cad57eebdfff6508a0cfb821ec670a41cc3f057512cadd19f3805cf1a01d7'})};
 const entries=Object.entries(selectedHashes).flatMap(([suffix,expected])=>{const row=index.rows.find((r:any)=>r.url.endsWith(`/data/${suffix}`));expect(row).toBeDefined();const data=JSON.parse(readFileSync(`${directory}/${row.path}`,'utf8'));expect(createHash('sha256').update(JSON.stringify(data)).digest('hex')).toBe(expected);return normalizeData(data,'reviewed-armor-frozen');});
 const c=newCharacter('2014');c.profile.enabledSources=['PHB','TCE'];c.automation=newAutomationState();c.abilities.dex=13;c.abilities.str=13;c.runtime.hp=7;c.runtime.tempHp=3;
 c.selections=[{id:'fighter',entry:entries.find(e=>e.kind==='class'&&e.english===owner&&e.source===(owner==='Artificer'?'TCE':'PHB'))!,level,quantity:1,equipped:false}];syncFeatures(c,entries);
 const choice=sheetChoices(c,entries).find(x=>x.id.includes(':class-legacy-feat:')&&x.grantLevel===4)!,feat=entries.find(e=>e.kind==='feat'&&e.english===english&&e.source==='PHB')!;
 const source=c.selections.find(row=>row.parentId==='fighter'&&row.entry.id===choice.id.split(':class-legacy-feat:')[1])!;
 return {c,entries,choice,feat,source};
}
it.skipIf(!directory)('real PHB Fighter ASI4 Lightly Armored applies only confirmed DEX +1 and light training',()=>{
 const {c,entries,choice,feat,source}=setup('Lightly Armored');setSheetChoiceSlot(c,choice.id,0,feat.id,entries);expect(evaluate(c).abilities.dex).toBe(13);
 (c as any).reviewedFeats={version:1,bindings:[{selectionId:source.id,choiceId:choice.id,entryId:feat.id,intent:{kind:'lightly-armored',ability:'dex',confirmedManualAbilityExcluded:true}}]};
 expect(evaluate(c).abilities.dex).toBe(14);expect(armorTraining(c,activeSelections(c)).has('light')).toBe(true);expect(c.runtime).toMatchObject({hp:7,tempHp:3});
});
it.skipIf(!directory)('real PHB Fighter ASI4 permits Moderately Armored with actual starting light proficiency',()=>{
 const {c,entries,choice,feat}=setup('Moderately Armored');expect(armorTraining(c,activeSelections(c)).has('light')).toBe(true);expect(choice.options.find(row=>row.value===feat.id)?.unavailable).toBeUndefined();
 setSheetChoiceSlot(c,choice.id,0,feat.id,entries);expect(c.answers[choice.id]).toEqual([feat.id]);
});

it.skipIf(!directory)('real PHB Wizard ASI4/8/12 grants the whole Light/Medium/Heavy prerequisite chain in order',()=>{
 const {c,entries}=setup('Lightly Armored','Wizard',12);const cases:[string,ReviewedArmorFeatKind,number][]=[['Lightly Armored','lightly-armored',4],['Moderately Armored','moderately-armored',8],['Heavily Armored','heavily-armored',12]];
 expect(armorTraining(c,activeSelections(c))).toEqual(new Set());
 for(const [name,kind,level] of cases){const f=entries.find(e=>e.kind==='feat'&&e.english===name&&e.source==='PHB')!,choice=sheetChoices(c,entries).find(row=>row.id.includes(':class-legacy-feat:')&&row.grantLevel===level)!;expect(choice.options.find(row=>row.value===f.id)?.unavailable).toBeUndefined();setSheetChoiceSlot(c,choice.id,0,f.id,entries);setReviewedFeatIntent(c,choice.id,f.id,{kind,ability:'str',confirmedManualAbilityExcluded:true});expect(reviewedFeatStatus(c,choice.id,f.id).active).toBe(true);}
 expect(evaluate(c).abilities.str).toBe(16);expect(armorTraining(c,activeSelections(c))).toEqual(new Set(['light','medium','shield','heavy']));expect(c.runtime).toMatchObject({hp:7,tempHp:3});
});
it.skipIf(!directory)('real TCE2014 Artificer ASI4 can confirm Heavy using actual medium proficiency',()=>{
 const {c,entries,choice,feat}=setup('Heavily Armored','Artificer');expect(armorTraining(c,activeSelections(c)).has('medium')).toBe(true);setSheetChoiceSlot(c,choice.id,0,feat.id,entries);setReviewedFeatIntent(c,choice.id,feat.id,{kind:'heavily-armored',ability:'str',confirmedManualAbilityExcluded:true});expect(reviewedFeatStatus(c,choice.id,feat.id).active).toBe(true);expect(evaluate(c).abilities.str).toBe(14);expect(armorTraining(c,activeSelections(c)).has('heavy')).toBe(true);
});
