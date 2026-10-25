import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareBody,specificMagicItems} from '../src/data/expand';
import {reviewedWeaponOptions,reviewedWeaponNeedsFirearmsConsent,reviewedWeaponReference,reviewedWeaponTrainingMatches} from '../src/core/automation/reviewedWeapons';
import {setReviewedFeatIntent,reviewedFeatRule} from '../src/core/automation/reviewedFeats';
import evidence from '../src/core/automation/reviewedWeaponEvidence.json';
import {normalizeData} from '../src/data/catalog';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {evaluate} from '../src/core/engine';
import {effectiveTrainingDeclarations} from '../src/core/automation/training';
import {automaticWeaponAttacks} from '../src/core/automation/weapons';
const directory=process.env.REVIEWED_FEATS_FROZEN_DIR;
const hashes={'feats.json':'0491b421f5f1db6628c3a8aeb86bbc3b72b56bf101a14ba96acbe19c829a56a6','class/class-wizard.json':'7533f3fb7bab70cd2d2f2b5dfb7e259dc66a2bfee24ee6ad3809042e53ba8a03','items-base.json':'8933a3e70e47aa4fd6196bd7f1f2e3a57d6d8dbe7e781d37bb6a0519d7c4ffff'};
function input(suffix:string,expected:string){const index=JSON.parse(readFileSync(`${directory}/index.json`,'utf8')),row=index.rows.find((r:any)=>r.url.endsWith(`/data/${suffix}`));expect(row).toBeDefined();const data=JSON.parse(readFileSync(`${directory}/${row.path}`,'utf8'));expect(createHash('sha256').update(JSON.stringify(data)).digest('hex')).toBe(expected);return data;}
function setup(){
 const entries=Object.entries(hashes).flatMap(([suffix,expected])=>normalizeData(input(suffix,expected),'reviewed-weapon-frozen'));
 const c=newCharacter('2014');c.profile.enabledSources=['PHB','DMG','ERLW','DSOTDQ','TOA','OOTA'];c.automation=newAutomationState();c.abilities.str=13;c.abilities.dex=13;c.runtime.hp=7;c.runtime.tempHp=3;
 c.selections=[{id:'wizard',entry:entries.find(e=>e.kind==='class'&&e.english==='Wizard'&&e.source==='PHB')!,level:4,quantity:1,equipped:false}];syncFeatures(c,entries);
 const choice=sheetChoices(c,entries).find(x=>x.id.includes(':class-legacy-feat:')&&x.grantLevel===4)!,feat=entries.find(e=>e.kind==='feat'&&e.english==='Weapon Master'&&e.source==='PHB')!;
 setSheetChoiceSlot(c,choice.id,0,feat.id,entries);expect(c.selections.some(row=>row.entry.kind==='feat')).toBe(false);
 const source=c.selections.find(row=>row.parentId==='wizard'&&row.entry.id===choice.id.split(':class-legacy-feat:')[1])!;
 return {c,entries,choice,feat,source};
}
it.skipIf(!directory)('real Wizard ASI4 Weapon Master explicitly grants STR+1 and four weapon kinds, including Net, with PB in actual attacks',()=>{
 const {c,entries,choice,feat,source}=setup();expect(evaluate(c).abilities.str).toBe(13);
 const weapons=['Longsword|PHB','Longbow|PHB','Spear|PHB','Net|PHB'];
 for(const ref of weapons){const english=ref.split('|')[0];c.selections.push({id:`weapon-${english}`,entry:entries.find(e=>e.kind==='item'&&e.english===english&&e.source==='PHB')!,level:1,quantity:1,equipped:true});}
 (c as any).reviewedWeaponMaster={version:1,bindings:[{selectionId:source.id,choiceId:choice.id,entryId:feat.id,intent:{kind:'weapon-master',ability:'str',weapons,confirmedManualAbilityExcluded:true}}]};
 expect(evaluate(c).abilities.str).toBe(14);
 expect(effectiveTrainingDeclarations(c,undefined,'weapons')).toEqual(expect.arrayContaining(weapons));
 const attacks=automaticWeaponAttacks(c,evaluate(c));expect(attacks.attacks.find(row=>row.key==='auto-weapon:weapon-Longsword:main')?.attack_bonus).toBe(4);expect(attacks.issues.some(row=>row.selectionId==='weapon-Net'&&row.id.startsWith('weapon-training:'))).toBe(false);expect(c.runtime).toMatchObject({hp:7,tempHp:3});
});

it.skipIf(!directory)('all52 frozen pre-2024 mundane kinds match the semantic adapter, with precise source hashes and only ten gated firearms',()=>{
 const {c,entries}=setup(),weapons=reviewedWeaponOptions(c,entries);expect(weapons).toHaveLength(52);expect(weapons.filter(row=>row.unavailable)).toEqual([]);
 const data=input('items-base.json',hashes['items-base.json']);
 for(const row of weapons){const proof=evidence.rules.find(value=>value.reference===row.value)!,raw=data.baseitem.find((value:any)=>value.ENG_name===proof.english&&value.source===proof.rawSource);expect(createHash('sha256').update(JSON.stringify(raw)).digest('hex')).toBe(proof.entryHash);expect(reviewedWeaponReference(row.entry)).toBe(row.value);}
 expect(weapons.filter(row=>row.entry.source==='PHB')).toHaveLength(37);expect(weapons.filter(row=>row.entry.edition==='both')).toHaveLength(5);expect(weapons.filter(row=>row.entry.raw.rarity==='unknown')).toHaveLength(2);expect(weapons.filter(row=>reviewedWeaponNeedsFirearmsConsent([row.value]))).toHaveLength(10);
 expect(entries.filter(row=>row.edition==='2024').some(row=>reviewedWeaponReference(row))).toBe(false);
});
it.skipIf(!directory)('real magical variant expansion inherits the actual localized PHB baseItem, not its displayed name, and grants PB once',()=>{
 const {c,choice,feat}=setup(),base=input('items-base.json',hashes['items-base.json']),variants=input('magicvariants.json','4a4b0f3c8b268d8b134386f16e705df9b14d60419b2f2fa160da45b78bd4967d');
 const magic=normalizeData({item:specificMagicItems(prepareBody({...base,...variants}))},'reviewed-real-magic').find(row=>row.english==='Longsword (+1 Weapon)'&&row.source==='DMG')!;
 expect(magic).toBeDefined();expect(magic.raw.baseItem).toBe('长剑|PHB');expect(reviewedWeaponTrainingMatches(magic,'Longsword|PHB')).toBe(true);c.selections.push({id:'real-magic',entry:magic,level:1,quantity:1,equipped:true});
 expect(automaticWeaponAttacks(c,evaluate(c)).attacks.find(row=>row.key==='auto-weapon:real-magic:main')?.attack_bonus).toBe(2);
 setReviewedFeatIntent(c,choice.id,feat.id,{kind:'weapon-master',ability:'str',weapons:['Longsword|PHB','Longbow|PHB','Spear|PHB','Net|PHB'],confirmedManualAbilityExcluded:true});
 const attacks=automaticWeaponAttacks(c,evaluate(c)).attacks;expect(attacks.find(row=>row.key==='auto-weapon:real-magic:main')?.attack_bonus).toBe(5);expect(attacks.find(row=>row.key==='auto-weapon:real-magic:two-handed')?.attack_bonus).toBe(5);
});
it.skipIf(!directory)('the real XPHB Weapon Master retains its distinct mastery identity and is never the PHB four-proficiency rule',()=>{
 const {c,entries}=setup(),modern=entries.find(row=>row.kind==='feat'&&row.english==='Weapon Master'&&row.source==='XPHB')!;expect(modern).toBeDefined();expect(modern.raw.weaponProficiencies).toBeUndefined();expect(modern.raw.category).toBe('G');expect(reviewedFeatRule(modern)).toBeUndefined();
 c.edition='2024';c.profile.enabledSources=['XPHB'];c.selections=[{id:'modern',entry:modern,level:1,quantity:1,equipped:false}];expect(evaluate(c).abilities.str).toBe(13);expect(effectiveTrainingDeclarations(c,undefined,'weapons')).toEqual([]);expect(c.reviewedWeaponMaster).toBeUndefined();
});

it.skipIf(!directory)('the five exact supplementary both-edition kinds inherit into real classic DMG magic variants, never modern variants',()=>{
 const {c,choice,feat}=setup(),base=input('items-base.json',hashes['items-base.json']),variants=input('magicvariants.json','4a4b0f3c8b268d8b134386f16e705df9b14d60419b2f2fa160da45b78bd4967d');
 const magic=normalizeData({item:specificMagicItems(prepareBody({...base,...variants}))},'reviewed-real-supplement-magic');
 for(const proof of evidence.rules.filter(row=>row.edition==='both')){
  const entry=magic.find(row=>row.english===`${proof.english} (+1 Weapon)`&&row.source==='DMG')!;expect(entry,proof.reference).toBeDefined();expect(entry.edition).toBe('2014');expect(reviewedWeaponTrainingMatches(entry,proof.reference)).toBe(true);
  setReviewedFeatIntent(c,choice.id,feat.id,{kind:'weapon-master',ability:'str',weapons:[proof.reference,'Longsword|PHB','Longbow|PHB','Net|PHB'],confirmedManualAbilityExcluded:true});c.selections=c.selections.filter(row=>row.id!=='real-supplement');c.selections.push({id:'real-supplement',entry,level:1,quantity:1,equipped:true});
  expect(automaticWeaponAttacks(c,evaluate(c)).attacks.filter(row=>row.origin.selectionId==='real-supplement').every(row=>row.trace.some(line=>line.includes('熟练 2')))).toBe(true);
  const modern={...entry,edition:'2024' as const,source:'XDMG',raw:{...entry.raw,source:'XDMG',edition:'one'}};expect(reviewedWeaponTrainingMatches(modern,proof.reference)).toBe(false);
 }
});
it.skipIf(!directory)('actual magic attacks cannot inherit reviewed PB by stripping a forged type namespace or extra baseItem segment',()=>{
 const {c,choice,feat}=setup(),base=input('items-base.json',hashes['items-base.json']),variants=input('magicvariants.json','4a4b0f3c8b268d8b134386f16e705df9b14d60419b2f2fa160da45b78bd4967d');
 const magic=normalizeData({item:specificMagicItems(prepareBody({...base,...variants}))},'reviewed-real-magic-type').find(row=>row.english==='Longsword (+1 Weapon)'&&row.source==='DMG')!;
 setReviewedFeatIntent(c,choice.id,feat.id,{kind:'weapon-master',ability:'str',weapons:['Longsword|PHB','Longbow|PHB','Spear|PHB','Net|PHB'],confirmedManualAbilityExcluded:true});
 c.selections.push({id:'real-type-magic',entry:magic,level:1,quantity:1,equipped:true});
 expect(automaticWeaponAttacks(c,evaluate(c)).attacks.find(row=>row.key==='auto-weapon:real-type-magic:main')?.attack_bonus).toBe(5);
 for(const type of ['M|XPHB','M|XDMG','M|PHB','M|UNKNOWN','M|XPHB|DMG']){
  magic.raw.type=type;const report=automaticWeaponAttacks(c,evaluate(c));expect(report.attacks.find(row=>row.key==='auto-weapon:real-type-magic:main')?.attack_bonus,type).toBe(3);expect(report.issues.some(row=>row.id==='weapon-training:real-type-magic')).toBe(true);expect(reviewedWeaponTrainingMatches(magic,'Longsword|PHB')).toBe(false);
 }
 magic.raw.type='M';
 for(const baseItem of ['长剑','Longsword','长剑|','|PHB','长剑|PHB|XPHB','长剑|XPHB','长剑|PHB|']){magic.raw.baseItem=baseItem;expect(automaticWeaponAttacks(c,evaluate(c)).attacks.find(row=>row.key==='auto-weapon:real-type-magic:main')?.attack_bonus,baseItem).toBe(3);expect(reviewedWeaponTrainingMatches(magic,'Longsword|PHB')).toBe(false);}
 magic.raw.baseItem='长剑|PHB';magic.raw.weaponCategory='martial|PHB';expect(reviewedWeaponTrainingMatches(magic,'Longsword|PHB')).toBe(false);
});
