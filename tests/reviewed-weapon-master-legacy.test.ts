import 'fake-indexeddb/auto';
import {IDBFactory} from 'fake-indexeddb';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {frozenReviewedWeaponLegacy,reviewedWeaponLegacyUnavailable,REVIEWED_WEAPON_LEGACY_COMMIT,REVIEWED_WEAPON_LEGACY_SOURCE_TREE,type FrozenReviewedWeaponLegacy} from './helpers/frozenReviewedWeaponLegacy';
import {reviewedWeaponMasterData,reviewedWeaponMasterFixture,weaponMasterReferences} from './e2e/reviewedWeaponMasterFixture';
import {reviewedPassiveFeatData} from './e2e/reviewedPassiveFeatFixture';
import {reviewedArmorFeatData} from './e2e/reviewedArmorFeatFixture';
import {normalizeData} from '../src/data/catalog';
import {syncFeatures} from '../src/core/sheet';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {setReviewedFeatIntent,reviewedFeatStatus,reviewedFeatRule,type ReviewedFeatIntent} from '../src/core/automation/reviewedFeats';
import {evaluate} from '../src/core/engine';
import {validateCharacter} from '../src/core/validation';
import {automaticWeaponAttacks} from '../src/core/automation/weapons';
import {newCharacter} from '../src/core/model';
import {newAutomationState} from '../src/core/automation/state';
import {effectiveTrainingDeclarations} from '../src/core/automation/training';

const directory=process.env.REVIEWED_FEATS_FROZEN_DIR;
const frozenHashes:Record<string,string>={'feats.json':'0491b421f5f1db6628c3a8aeb86bbc3b72b56bf101a14ba96acbe19c829a56a6','class/class-wizard.json':'7533f3fb7bab70cd2d2f2b5dfb7e259dc66a2bfee24ee6ad3809042e53ba8a03'};
function frozen(name:string){const index=JSON.parse(readFileSync(`${directory}/index.json`,'utf8')),row=index.rows.find((value:any)=>value.url.endsWith(`/data/${name}`));expect(row,`Missing frozen Weapon Master input: ${name}`).toBeDefined();const data=JSON.parse(readFileSync(`${directory}/${row.path}`,'utf8'));expect(createHash('sha256').update(JSON.stringify(data)).digest('hex')).toBe(frozenHashes[name]);return data;}

/** These tests execute immutable d354 modules. The passing negative assertions
 * document known OLD-client limits, not safe authorization lifecycle support. */
describe.skipIf(!!reviewedWeaponLegacyUnavailable)('actual pre-Weapon-Master consumer: old effects retained, unknown intent lifecycle limits explicit',()=>{
 let old:FrozenReviewedWeaponLegacy;
 beforeAll(async()=>{vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('location',{search:'',hash:''});vi.stubGlobal('window',new EventTarget());vi.stubGlobal('BroadcastChannel',undefined);old=await frozenReviewedWeaponLegacy();},30000);
 afterAll(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
 const legacyIntents:Record<string,ReviewedFeatIntent>={Tough:{kind:'tough',confirmedManualHpExcluded:true},Resilient:{kind:'resilient',ability:'dex',confirmedManualAbilityExcluded:true},'Lightly Armored':{kind:'lightly-armored',ability:'dex',confirmedManualAbilityExcluded:true},'Moderately Armored':{kind:'moderately-armored',ability:'dex',confirmedManualAbilityExcluded:true},'Heavily Armored':{kind:'heavily-armored',ability:'str',confirmedManualAbilityExcluded:true}};
 function setup(legacy?:string){
  const c=reviewedWeaponMasterFixture(),data=structuredClone(reviewedWeaponMasterData);
  const entries=normalizeData({...data,feat:[...data.feat,...reviewedPassiveFeatData.feat,...reviewedArmorFeatData.feat]},'weapon-legacy-audit');
  c.selections[0].level=legacy?8:4;
  if(legacy==='Moderately Armored')c.selections[0].entry.raw.startingProficiencies.armor=['light'];
  if(legacy==='Heavily Armored')c.selections[0].entry.raw.startingProficiencies.armor=['medium'];
  syncFeatures(c,entries);
  const choices=sheetChoices(c,entries).filter(row=>row.id.includes(':class-legacy-feat:')).sort((a,b)=>a.grantLevel!-b.grantLevel!);
  const choice=choices[legacy?1:0],feat=entries.find(row=>row.english==='Weapon Master')!;
  let prior:{choiceId:string;entryId:string}|undefined;
  if(legacy){const previous=entries.find(row=>row.english===legacy)!;setSheetChoiceSlot(c,choices[0].id,0,previous.id,entries);setReviewedFeatIntent(c,choices[0].id,previous.id,legacyIntents[legacy]);prior={choiceId:choices[0].id,entryId:previous.id};}
  setSheetChoiceSlot(c,choice.id,0,feat.id,entries);
  const oldBefore=evaluate(c);
  setReviewedFeatIntent(c,choice.id,feat.id,{kind:'weapon-master',ability:'str',weapons:[...weaponMasterReferences],confirmedManualAbilityExcluded:true});
  return {c,entries,choice,feat,prior,oldBefore};
 }
 it('loads exactly accepted d354 source, not current modules pretending to be the old consumer',()=>{
  expect(REVIEWED_WEAPON_LEGACY_COMMIT).toBe('d3540abcf9f9600cdb683433e7b05a767a1dd0a8');
  expect(REVIEWED_WEAPON_LEGACY_SOURCE_TREE).toBe('a166aaddca3cf0f3d6d3c1a376a720e78b63943f');
  expect(old.source('src/core/automation/reviewedFeats.ts')).toContain('confirmedManualHpExcluded');
  expect(old.source('src/core/automation/reviewedFeats.ts')).not.toContain('reviewedWeaponMaster');
  expect(old.sourceFiles).toContain('src/core/automation/asi.ts');
 });
 it.each(Object.keys(legacyIntents))('old native/linked transfers and ordinary edits preserve existing %s without migrating its v1 store',async legacy=>{
  const {c,prior,oldBefore,choice,feat}=setup(legacy),saved=structuredClone(c.reviewedWeaponMaster),oldSaved=structuredClone(c.reviewedFeats);
  expect(c.reviewedFeats?.version).toBe(1);expect(old.rules.reviewedFeatStatus(c,prior!.choiceId,prior!.entryId).active).toBe(true);
  const withoutNew={...c,reviewedWeaponMaster:undefined};expect(old.engine.evaluate(c)).toEqual(old.engine.evaluate(withoutNew));
  expect(old.engine.evaluate(c).abilities).toEqual(oldBefore.abilities);expect(old.engine.evaluate(c).maxHp).toBe(oldBefore.maxHp);
  const native=old.exports.exportCharacter(c),linked=old.exports.exportLinkedOwlbear(c,old.engine.evaluate(c));
  const read=[old.validation.validateCharacter(native),old.validation.readCharacter(native).character,old.validation.importOwlbear(linked),...old.transfer.readCharacterTransfer([JSON.stringify(native)]),...old.transfer.readCharacterTransfer([JSON.stringify(linked)]),...old.transfer.readCharacterTransfer([JSON.stringify(old.exports.exportCharacters([c]))])];
  for(const card of read){expect(card.reviewedWeaponMaster).toEqual(saved);expect(card.reviewedFeats).toEqual(oldSaved);expect(old.rules.reviewedFeatStatus(card,prior!.choiceId,prior!.entryId).active).toBe(true);expect(old.engine.evaluate(card)).toEqual(old.engine.evaluate(withoutNew));}
  const workspace={schemaVersion:1 as const,characters:[c],activeId:c.id,packs:[]};await old.storage.saveWorkspace(workspace);
  const display=old.display.applyDisplayCharacterEdit(c,old.display.displayCharacterEdit('name','Older display edit'))!;
  const edited=old.runtime.applyRuntimeCharacterEdit(display,old.runtime.runtimeValueEdit('hp',5))!;edited.notes='Older ordinary note edit';
  const normalized=old.validation.validateCharacter(old.exports.exportCharacter(edited));
  const updated={...workspace,characters:[normalized]};await old.storage.saveWorkspace(updated);
  const restored=(await old.storage.loadWorkspace())!.characters[0];expect(await old.storage.restoreBackup()).toEqual(workspace);
  expect(restored.reviewedWeaponMaster).toEqual(saved);expect(restored.reviewedFeats).toEqual(oldSaved);expect(restored.runtime.hp).toBe(5);
  expect(old.rules.reviewedFeatStatus(restored,prior!.choiceId,prior!.entryId).active).toBe(true);
  expect(old.engine.evaluate(restored).abilities).toEqual(oldBefore.abilities);expect(old.engine.evaluate(restored).maxHp).toBe(oldBefore.maxHp);
  expect(reviewedFeatStatus(validateCharacter(restored),choice.id,feat.id).active).toBe(true);
 });
 it.each(['clear','replace','toggle'] as const)('documents OLD %s then reselect retaining stale authorization, while current removal withdraws it',mode=>{
  const {c,entries,choice,feat}=setup(),saved=structuredClone(c.reviewedWeaponMaster),runtime=structuredClone(c.runtime);
  if(mode==='toggle')old.choices.chooseSheetOption(c,choice.id,feat.id,entries);else old.choices.setSheetChoiceSlot(c,choice.id,0,mode==='clear'?undefined:entries.find(row=>row.english==='Authored Weapon Replacement')!.id,entries);
  expect(c.reviewedWeaponMaster).toEqual(saved);expect(reviewedFeatStatus(c,choice.id,feat.id).active).toBe(false);
  old.choices.setSheetChoiceSlot(c,choice.id,0,feat.id,entries);
  const reopened=validateCharacter(old.exports.exportCharacter(c));
  // Identical answers/snapshots after old re-selection cannot prove an unseen
  // withdrawal. Byte preservation is deliberately NOT called lifecycle safety.
  expect(reopened.reviewedWeaponMaster).toEqual(saved);expect(reviewedFeatStatus(reopened,choice.id,feat.id).active).toBe(true);expect(reopened.runtime).toEqual(runtime);
  setSheetChoiceSlot(reopened,choice.id,0,undefined,entries);setSheetChoiceSlot(reopened,choice.id,0,feat.id,entries);
  expect(reviewedFeatStatus(reopened,choice.id,feat.id).active).toBe(false);expect(reopened.reviewedWeaponMaster?.bindings).toHaveLength(0);expect(evaluate(reopened).abilities.str).toBe(13);
 });
 it('documents OLD downgrade losing unknown-owned ASI identity, never claiming that old re-upgrade restores authorization',()=>{
  const {c,entries,choice,feat}=setup(),saved=structuredClone(c.reviewedWeaponMaster),id=saved!.bindings[0].selectionId;
  c.selections[0].level=3;old.sheet.syncFeatures(c,entries);
  expect(c.reviewedWeaponMaster).toEqual(saved);expect(c.selections.some(row=>row.id===id)).toBe(false);expect(c.classChoiceArchive?.[id]).toBeUndefined();
  const reopened=validateCharacter(old.exports.exportCharacter(c));reopened.selections[0].level=4;old.sheet.syncFeatures(reopened,entries);
  expect(reopened.selections.some(row=>row.id===id)).toBe(false);expect(reopened.reviewedWeaponMaster).toEqual(saved);
  expect(reviewedFeatStatus(reopened,choice.id,feat.id).active).toBe(false);expect(evaluate(reopened).abilities.str).toBe(13);
 });
 it('documents OLD manual-score editing double-count risk and the current explicit withdrawal remedy',()=>{
  const {c,choice,feat}=setup(),saved=structuredClone(c.reviewedWeaponMaster);c.abilities.str=14;
  const reopened=validateCharacter(old.validation.validateCharacter(old.exports.exportCharacter(c)));
  expect(reopened.reviewedWeaponMaster).toEqual(saved);expect(old.engine.evaluate(reopened).abilities.str).toBe(14);expect(evaluate(reopened).abilities.str).toBe(15);
  setReviewedFeatIntent(reopened,choice.id,feat.id,null);expect(evaluate(reopened).abilities.str).toBe(14);expect(reopened.abilities.str).toBe(14);
 });
 it('does not misclassify ordinary edition-suspended named training as new Weapon Master training',()=>{
  const c=reviewedWeaponMasterFixture(),owner=c.selections[0],magic=c.selections.find(row=>row.id==='weapon-master-magic')!;
  c.edition='2024';c.profile.optional.legacy=false;c.profile.enabledSources=['PHB','ERLW'];
  owner.entry.raw.startingProficiencies.weapons=['Longsword|PHB'];
  // A non-core magic item with an explicit PHB base remains selectable while
  // the legacy PHB class is filtered out of ordinary attack training.
  magic.entry.source='ERLW';magic.entry.edition='both';magic.entry.raw.source='ERLW';delete magic.entry.raw.edition;
  c.selections=[owner,magic];expect(c.reviewedWeaponMaster).toBeUndefined();
  const previous=old.weapons.automaticWeaponAttacks(c,old.engine.evaluate(c)).attacks;
  expect(previous[0]?.attack_bonus).toBe(2);
  expect(automaticWeaponAttacks(c,evaluate(c)).attacks).toEqual(previous);
 });
 it.skipIf(!directory)('preserves the actual XPHB Wizard ASI4 Weapon Master selection and manual scores exactly as d354 without inventing 2024 mastery',()=>{
  const featData=frozen('feats.json'),raw=featData.feat.find((entry:any)=>entry.ENG_name==='Weapon Master'&&entry.source==='XPHB');
  expect(createHash('sha256').update(JSON.stringify(raw)).digest('hex')).toBe('d6b36cb6e97b236f32a5efe2db3d3a74ef83a4bcf95d7c23435bb5c6b320caa2');
  expect(raw).toMatchObject({source:'XPHB',page:209,category:'G',prerequisite:[{level:4}],ability:[{choose:{from:['str','dex']}}]});expect(raw.weaponProficiencies).toBeUndefined();
  const entries=[featData,frozen('class/class-wizard.json')].flatMap(data=>normalizeData(data,'modern-weapon-compat'));
  const c=newCharacter('2024');c.automation=newAutomationState();c.abilities.str=14;c.abilities.dex=13;c.runtime.hp=7;c.runtime.resources.manual={name:'Manual',max:5,current:2};c.training={weapons:'手工熟练原文'};
  c.selections=[{id:'modern-owner',entry:entries.find(entry=>entry.kind==='class'&&entry.english==='Wizard'&&entry.source==='XPHB')!,level:4,quantity:1,equipped:false}];
  old.sheet.syncFeatures(c,entries);
  const feat=entries.find(entry=>entry.kind==='feat'&&entry.english==='Weapon Master'&&entry.source==='XPHB')!;
  const choice=old.choices.sheetChoices(c,entries).find(row=>row.id.includes(':class-typed-feat:')&&row.grantLevel===4)!;
  expect(choice.options.find(row=>row.value===feat.id)?.unavailable).toBeUndefined();expect(sheetChoices(c,entries)).toEqual(old.choices.sheetChoices(c,entries));
  old.choices.setSheetChoiceSlot(c,choice.id,0,feat.id,entries);old.sheet.syncFeatures(c,entries);
  expect(c.selections.filter(row=>row.entry.id===feat.id)).toHaveLength(1);const saved=JSON.stringify(c),oldDerived=old.engine.evaluate(c);
  expect(oldDerived.abilities).toMatchObject({str:14,dex:13});expect(evaluate(c)).toEqual(oldDerived);expect(sheetChoices(c,entries)).toEqual(old.choices.sheetChoices(c,entries));
  expect(effectiveTrainingDeclarations(c,undefined,'weapons')).toEqual(old.training.effectiveTrainingDeclarations(c,undefined,'weapons'));expect(c.reviewedWeaponMaster).toBeUndefined();expect(c.reviewedFeats).toBeUndefined();
  expect(reviewedFeatRule(feat)).toBeUndefined();expect(()=>setReviewedFeatIntent(c,choice.id,feat.id,{kind:'weapon-master',ability:'str',weapons:[...weaponMasterReferences],confirmedManualAbilityExcluded:true})).toThrow();expect(JSON.stringify(c)).toBe(saved);
  const reopened=validateCharacter(old.exports.exportCharacter(c));syncFeatures(reopened,entries);expect(evaluate(reopened)).toEqual(oldDerived);expect(reopened.answers).toEqual(c.answers);expect(reopened.runtime).toEqual(c.runtime);expect(reopened.training).toEqual(c.training);
  const forged=structuredClone(feat);forged.source='PHB';forged.edition='2014';expect(reviewedFeatRule(forged)).toBeUndefined();
  // Legitimate current PHB consent is a separate path, not a renamed XPHB row.
  const legacy=setup();expect(reviewedFeatStatus(legacy.c,legacy.choice.id,legacy.feat.id).active).toBe(true);expect(evaluate(legacy.c).abilities.str).toBe(14);
 });
});
