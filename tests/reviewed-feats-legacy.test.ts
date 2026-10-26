import 'fake-indexeddb/auto';
import {IDBFactory} from 'fake-indexeddb';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {frozenReviewedFeatLegacy,reviewedFeatLegacyUnavailable,REVIEWED_FEAT_LEGACY_COMMIT,REVIEWED_FEAT_LEGACY_SOURCE_TREE,type FrozenReviewedFeatLegacy} from './helpers/frozenReviewedFeatLegacy';
import {reviewedPassiveFeatData,reviewedPassiveFeatFixture} from './e2e/reviewedPassiveFeatFixture';
import {normalizeData} from '../src/data/catalog';
import {syncFeatures} from '../src/core/sheet';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {setReviewedFeatIntent,reviewedFeatStatus} from '../src/core/automation/reviewedFeats';
import {evaluate} from '../src/core/engine';
import {validateCharacter} from '../src/core/validation';

describe.skipIf(!!reviewedFeatLegacyUnavailable)('actual immutable pre-passive consumer: preservation and explicit old-client limits',()=>{
 let old:FrozenReviewedFeatLegacy;
 beforeAll(async()=>{vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('location',{search:'',hash:''});vi.stubGlobal('window',new EventTarget());vi.stubGlobal('BroadcastChannel',undefined);old=await frozenReviewedFeatLegacy();},30000);
 afterAll(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
 function setup(english='Tough'){
  const c=reviewedPassiveFeatFixture(),entries=normalizeData(structuredClone(reviewedPassiveFeatData),'legacy-passive');syncFeatures(c,entries);const choice=sheetChoices(c,entries).find(row=>row.id.includes(':class-legacy-feat:'))!,feat=entries.find(row=>row.english===english)!;setSheetChoiceSlot(c,choice.id,0,feat.id,entries);setReviewedFeatIntent(c,choice.id,feat.id,english==='Tough'?{kind:'tough',confirmedManualHpExcluded:true}:{kind:'resilient',ability:'dex',confirmedManualAbilityExcluded:true});return {c,entries,choice,feat};
 }
 it('executes the accepted a5c graph, never current implementations as an old parser substitute',()=>{
  expect(REVIEWED_FEAT_LEGACY_COMMIT).toBe('a5cdee8682a4b96fe77f946a55e95d76250c7118');expect(REVIEWED_FEAT_LEGACY_SOURCE_TREE).toBe('963323845dad24cc8cf2e406edc8a098f5ebd487');expect(old.sourceFiles).toContain('src/core/automation/asi.ts');expect(old.source('src/core/engine.ts')).not.toContain('reviewedFeats');const {c}=setup();expect(old.engine.evaluate(c).maxHp).toBe(28);expect(evaluate(c).maxHp).toBe(36);
 });
 it.each(['Tough','Resilient'])('old native, linked and collection transfers preserve opaque %s intent without executing it',english=>{
  const {c}=setup(english),store=structuredClone(c.reviewedFeats),native=old.exports.exportCharacter(c),linked=old.exports.exportLinkedOwlbear(c,old.engine.evaluate(c));
  const cards=[old.validation.validateCharacter(native),old.validation.readCharacter(native).character,old.validation.importOwlbear(linked),...old.transfer.readCharacterTransfer([JSON.stringify(native)]),...old.transfer.readCharacterTransfer([JSON.stringify(linked)]),...old.transfer.readCharacterTransfer([JSON.stringify(old.exports.exportCharacters([c]))])];
  for(const card of cards){expect(card.reviewedFeats).toEqual(store);expect(old.engine.evaluate(card).maxHp).toBe(28);expect(old.engine.evaluate(card).abilities.dex).toBe(13);expect(evaluate(validateCharacter(card))).toEqual(evaluate(c));}
 });
 it('old display, runtime, ordinary edit, workspace save/load and backup preserve the unknown field',async()=>{
  const {c}=setup(),store=structuredClone(c.reviewedFeats),workspace={schemaVersion:1 as const,characters:[c],activeId:c.id,packs:[]};await old.storage.saveWorkspace(workspace);
  const displayed=old.display.applyDisplayCharacterEdit(c,old.display.displayCharacterEdit('name','Older display edit'))!,runtime=old.runtime.applyRuntimeCharacterEdit(displayed,old.runtime.runtimeValueEdit('hp',5))!,ordinary=structuredClone(runtime);ordinary.notes='Older note edit';const read=old.validation.validateCharacter(old.exports.exportCharacter(ordinary));expect(read.reviewedFeats).toEqual(store);expect(read.runtime.hp).toBe(5);
  const updated={...workspace,characters:[read]};await old.storage.saveWorkspace(updated);expect(await old.storage.loadWorkspace()).toEqual(updated);expect(await old.storage.restoreBackup()).toEqual(workspace);
 });
 it.each(['clear','replace','toggle'] as const)('records, rather than conceals, the OLD consumer %s→reselect consent limitation',mode=>{
  const {c,entries,choice,feat}=setup(),store=structuredClone(c.reviewedFeats),manual=structuredClone(c.runtime);
  if(mode==='toggle')old.choices.chooseSheetOption(c,choice.id,feat.id,entries);else old.choices.setSheetChoiceSlot(c,choice.id,0,mode==='clear'?undefined:entries.find(row=>row.english==='Authored Replacement Record')!.id,entries);
  expect(c.reviewedFeats).toEqual(store);expect(reviewedFeatStatus(c,choice.id,feat.id).active).toBe(false);old.choices.setSheetChoiceSlot(c,choice.id,0,feat.id,entries);
  const reopened=validateCharacter(old.exports.exportCharacter(c));
  // Old code cannot invalidate a field it does not know. Identical restored
  // answers/snapshots cannot distinguish this from an untouched native backup.
  // Therefore old-client preservation is NOT authorization lifecycle safety.
  expect(reopened.reviewedFeats).toEqual(store);expect(reviewedFeatStatus(reopened,choice.id,feat.id).active).toBe(true);expect(reopened.runtime).toEqual(manual);
  // Current code's removal path DOES withdraw consent and requires re-confirm.
  setSheetChoiceSlot(reopened,choice.id,0,undefined,entries);setSheetChoiceSlot(reopened,choice.id,0,feat.id,entries);expect(reviewedFeatStatus(reopened,choice.id,feat.id).active).toBe(false);expect(evaluate(reopened).maxHp).toBe(28);
 });
 it('records the old manual-HP edit limitation and the explicit current-client withdrawal remedy',()=>{
  const {c,choice,feat}=setup();c.baseHp=36;const oldRead=old.validation.validateCharacter(old.exports.exportCharacter(c));expect(oldRead.reviewedFeats).toEqual(c.reviewedFeats);expect(old.engine.evaluate(oldRead).maxHp).toBe(36);const current=validateCharacter(oldRead);expect(evaluate(current).maxHp).toBe(44);setReviewedFeatIntent(current,choice.id,feat.id,null);expect(evaluate(current).maxHp).toBe(36);expect(current.baseHp).toBe(36);
 });
});
