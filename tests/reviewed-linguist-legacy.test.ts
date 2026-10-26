import 'fake-indexeddb/auto';
import {IDBFactory} from 'fake-indexeddb';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {frozenReviewedLinguistLegacy,reviewedLinguistLegacyUnavailable,REVIEWED_LINGUIST_LEGACY_COMMIT,REVIEWED_LINGUIST_LEGACY_SOURCE_TREE,type FrozenReviewedLinguistLegacy} from './helpers/frozenReviewedLinguistLegacy';
import {reviewedLinguistData,reviewedLinguistFixture} from './e2e/reviewedLinguistFixture';
import {reviewedPassiveFeatData} from './e2e/reviewedPassiveFeatFixture';
import {normalizeData} from '../src/data/catalog';
import {syncFeatures} from '../src/core/sheet';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {setReviewedLinguistIntent,reviewedLinguistStatus,reviewedLinguistLanguageRows} from '../src/core/automation/reviewedLinguist';
import {setReviewedFeatIntent} from '../src/core/automation/reviewedFeats';
import {evaluate} from '../src/core/engine';
import {validateCharacter} from '../src/core/validation';

describe.skipIf(!!reviewedLinguistLegacyUnavailable)('actual78e1 pre-Linguist: opaque retention is not safe editing compatibility',()=>{
 let old:FrozenReviewedLinguistLegacy;
 beforeAll(async()=>{vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('location',{search:'',hash:''});vi.stubGlobal('window',new EventTarget());vi.stubGlobal('BroadcastChannel',undefined);old=await frozenReviewedLinguistLegacy();},30000);
 afterAll(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
 function setup(){
  const c=reviewedLinguistFixture(),entries=normalizeData({...structuredClone(reviewedLinguistData),feat:[...reviewedLinguistData.feat,...reviewedPassiveFeatData.feat]},'linguist-legacy');c.selections[0].level=8;syncFeatures(c,entries);
  const choices=sheetChoices(c,entries).filter(row=>row.id.includes(':class-legacy-feat:')).sort((a,b)=>a.grantLevel!-b.grantLevel!),feat=entries.find(row=>row.english==='Linguist')!,tough=entries.find(row=>row.english==='Tough')!;
  setSheetChoiceSlot(c,choices[1].id,0,tough.id,entries);setReviewedFeatIntent(c,choices[1].id,tough.id,{kind:'tough',confirmedManualHpExcluded:true});const choice=choices[0];setSheetChoiceSlot(c,choice.id,0,feat.id,entries);setReviewedLinguistIntent(c,choice.id,feat.id,{kind:'linguist',languages:['Druidic|PHB',"Thieves' Cant|PHB",'Primordial|PHB'],dmAllowedLanguages:['Druidic|PHB',"Thieves' Cant|PHB",'Primordial|PHB'],confirmedManualAbilityExcluded:true},entries);return {c,entries,choice,feat};
 }
 it('loads exact accepted source, not current modules or a reimplemented old validator',()=>{expect(REVIEWED_LINGUIST_LEGACY_COMMIT).toBe('78e1fac62bddc52e36d5ad7a2cc4d18e8f0acc0e');expect(REVIEWED_LINGUIST_LEGACY_SOURCE_TREE).toBe('bbc6761e1bba50cba06315c2f8cb31c457cb5c63');expect(old.source('src/core/validation.ts')).not.toContain('validateReviewedLinguist');expect(old.source('src/core/automation/abilityAdvancements.ts')).not.toContain('linguist');expect(old.source('src/core/validation.ts')).toContain('validateReviewedSkilled');});
 it('old native, collection and linked transfers preserve new isolated intent while executing old Tough unchanged',()=>{
  const {c}=setup(),saved=structuredClone(c.reviewedLinguist),passive=structuredClone(c.reviewedFeats),native=old.exports.exportCharacter(c),linked=old.exports.exportLinkedOwlbear(c,old.engine.evaluate(c)),without={...c,reviewedLinguist:undefined};
  const cards=[old.validation.validateCharacter(native),old.validation.readCharacter(native).character,old.validation.importOwlbear(linked),...old.transfer.readCharacterTransfer([JSON.stringify(native)]),...old.transfer.readCharacterTransfer([JSON.stringify(linked)]),...old.transfer.readCharacterTransfer([JSON.stringify(old.exports.exportCharacters([c]))])];
  for(const card of cards){expect(card.reviewedLinguist).toEqual(saved);expect(card.reviewedFeats).toEqual(passive);expect(old.engine.evaluate(card)).toEqual(old.engine.evaluate(without));expect(old.engine.evaluate(card).abilities.int).toBe(19);expect(evaluate(validateCharacter(card)).abilities.int).toBe(20);expect(reviewedLinguistLanguageRows(card)).toHaveLength(3);expect(card.runtime.resources['manual-linguist'].current).toBe(2);}
 });
 it('ordinary old display/runtime edits and actual IndexedDB save/load backup preserve unknown intent without executing it',async()=>{
  const {c}=setup(),saved=structuredClone(c.reviewedLinguist),workspace={schemaVersion:1 as const,characters:[c],activeId:c.id,packs:[]};await old.storage.saveWorkspace(workspace);const display=old.display.applyDisplayCharacterEdit(c,old.display.displayCharacterEdit('name','Older display edit'))!,edited=old.runtime.applyRuntimeCharacterEdit(display,old.runtime.runtimeValueEdit('hp',5))!;edited.notes='Older notes';const normalized=old.validation.validateCharacter(old.exports.exportCharacter(edited));await old.storage.saveWorkspace({...workspace,characters:[normalized]});const restored=(await old.storage.loadWorkspace())!.characters[0];expect(await old.storage.restoreBackup()).toEqual(workspace);expect(restored.reviewedLinguist).toEqual(saved);expect(restored.runtime.hp).toBe(5);expect(old.engine.evaluate(restored).abilities.int).toBe(19);expect(evaluate(validateCharacter(restored)).abilities.int).toBe(20);
 });
 it.each(['clear','replace','toggle'] as const)('documents old %s→reselect stale permission: same final answers cannot prove safe editing; new client clears it',mode=>{
  const {c,entries,choice,feat}=setup(),saved=structuredClone(c.reviewedLinguist);if(mode==='toggle')old.choices.chooseSheetOption(c,choice.id,feat.id,entries);else old.choices.setSheetChoiceSlot(c,choice.id,0,mode==='clear'?undefined:entries.find(row=>row.english==='Authored Linguist Replacement')!.id,entries);expect(c.reviewedLinguist).toEqual(saved);expect(reviewedLinguistStatus(c,choice.id,feat.id).active).toBe(false);old.choices.setSheetChoiceSlot(c,choice.id,0,feat.id,entries);const reopened=validateCharacter(old.exports.exportCharacter(c));
  // No hidden migration, fake stale-history detector or automatic safe-edit claim.
  expect(reviewedLinguistStatus(reopened,choice.id,feat.id).active).toBe(true);setSheetChoiceSlot(reopened,choice.id,0,undefined,entries);setSheetChoiceSlot(reopened,choice.id,0,feat.id,entries);expect(reopened.reviewedLinguist?.bindings).toEqual([]);expect(reviewedLinguistStatus(reopened,choice.id,feat.id).active).toBe(false);
 });
 it('old downgrade cannot archive the unknown-owned source; recreated IDs never regain original authorization',()=>{
  const {c,entries,choice,feat}=setup(),saved=structuredClone(c.reviewedLinguist),id=saved!.bindings[0].selectionId;c.selections[0].level=3;old.sheet.syncFeatures(c,entries);expect(c.selections.some(row=>row.id===id)).toBe(false);expect(c.classChoiceArchive?.[id]).toBeUndefined();c.selections[0].level=8;old.sheet.syncFeatures(c,entries);expect(c.selections.some(row=>row.id===id)).toBe(false);expect(c.reviewedLinguist).toEqual(saved);expect(reviewedLinguistStatus(c,choice.id,feat.id).active).toBe(false);
 });
 it('old baseINT or manual-language edits remain observable only as current values; withdraw/reconfirm is the explicit boundary',()=>{
  const {c,choice,feat}=setup(),saved=structuredClone(c.reviewedLinguist);c.abilities.int=22;c.training!.languages='旧版手工语言';const reopened=validateCharacter(old.exports.exportCharacter(c));expect(reopened.reviewedLinguist).toEqual(saved);expect(evaluate(reopened).abilities.int).toBe(22);expect(reviewedLinguistLanguageRows(reopened)).toEqual([]);setReviewedLinguistIntent(reopened,choice.id,feat.id,null);expect(reviewedLinguistStatus(reopened,choice.id,feat.id).active).toBe(false);setReviewedLinguistIntent(reopened,choice.id,feat.id,saved!.bindings[0].intent);expect(reviewedLinguistStatus(reopened,choice.id,feat.id)).toMatchObject({active:true,abilityBonus:0,languagesActive:true});expect(reopened.training!.languages).toBe('旧版手工语言');
 });
 it('old manual feat answers do not silently turn into new owner intent after native roundtrip',()=>{
  const {c,entries,choice,feat}=setup();setReviewedLinguistIntent(c,choice.id,feat.id,null);c.selections.push({id:'old-manual-linguist',entry:structuredClone(feat),level:1,quantity:1,equipped:false});c.answers['old-manual-linguist:languages:0']=['Gith|MM'];const reopened=validateCharacter(old.exports.exportCharacter(c));expect(reopened.reviewedLinguist?.bindings).toEqual([]);expect(reopened.answers['old-manual-linguist:languages:0']).toEqual(['Gith|MM']);expect(reviewedLinguistStatus(reopened,choice.id,feat.id).eligible).toBe(false);expect(evaluate(reopened).abilities.int).toBe(19);
 });
});
