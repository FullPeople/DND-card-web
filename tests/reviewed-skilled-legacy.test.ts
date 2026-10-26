import 'fake-indexeddb/auto';
import {IDBFactory} from 'fake-indexeddb';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {frozenReviewedSkilledLegacy,reviewedSkilledLegacyUnavailable,REVIEWED_SKILLED_LEGACY_COMMIT,REVIEWED_SKILLED_LEGACY_SOURCE_TREE,type FrozenReviewedSkilledLegacy} from './helpers/frozenReviewedSkilledLegacy';
import {reviewedSkilledData,reviewedSkilledFixture} from './e2e/reviewedSkilledFixture';
import {reviewedPassiveFeatData} from './e2e/reviewedPassiveFeatFixture';
import {normalizeData} from '../src/data/catalog';
import {syncFeatures} from '../src/core/sheet';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {setReviewedSkilledIntent,reviewedSkilledStatus} from '../src/core/automation/reviewedSkilled';
import {setReviewedFeatIntent} from '../src/core/automation/reviewedFeats';
import {evaluate} from '../src/core/engine';
import {validateCharacter} from '../src/core/validation';

describe.skipIf(!!reviewedSkilledLegacyUnavailable)('actual pre-Skilled consumer: opaque preservation is not unknown confirmation lifecycle safety',()=>{
 let old:FrozenReviewedSkilledLegacy;
 beforeAll(async()=>{vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('location',{search:'',hash:''});vi.stubGlobal('window',new EventTarget());vi.stubGlobal('BroadcastChannel',undefined);old=await frozenReviewedSkilledLegacy();},30000);
 afterAll(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
 function setup(){
  const c=reviewedSkilledFixture(),entries=normalizeData({...structuredClone(reviewedSkilledData),feat:[...reviewedSkilledData.feat,...reviewedPassiveFeatData.feat]},'skilled-legacy');c.selections[0].level=8;syncFeatures(c,entries);
  const choices=sheetChoices(c,entries).filter(row=>row.id.includes(':class-legacy-feat:')).sort((a,b)=>a.grantLevel!-b.grantLevel!),feat=entries.find(row=>row.english==='Skilled')!,tough=entries.find(row=>row.english==='Tough')!;
  setSheetChoiceSlot(c,choices[1].id,0,tough.id,entries);setReviewedFeatIntent(c,choices[1].id,tough.id,{kind:'tough',confirmedManualHpExcluded:true});const choice=choices[0];setSheetChoiceSlot(c,choice.id,0,feat.id,entries);setReviewedSkilledIntent(c,choice.id,feat.id,{kind:'skilled',choices:[{kind:'skill',reference:'perception'},{kind:'tool',reference:"Thieves' Tools|PHB"},{kind:'tool',reference:'Vehicles (Land)|PHB'}],confirmed:true});return {c,entries,choice,feat};
 }
 it('loads exact accepted 52d5 source modules, not current modules or a reimplemented old validator',()=>{
  expect(REVIEWED_SKILLED_LEGACY_COMMIT).toBe('52d5be10e161464d5e0846d1dc2202ea1169754b');expect(REVIEWED_SKILLED_LEGACY_SOURCE_TREE).toBe('4d40c102e1ecd0617c39dd9b33d711d34e9c5103');expect(old.source('src/core/validation.ts')).not.toContain('validateReviewedSkilled');expect(old.source('src/core/automation/reviewedFeats.ts')).toContain('reviewedWeaponMaster');
 });
 it('old native, book and linked transfers preserve the isolated new domain and execute old Tough unchanged',()=>{
  const {c}=setup(),saved=structuredClone(c.reviewedSkilled),passive=structuredClone(c.reviewedFeats),native=old.exports.exportCharacter(c),linked=old.exports.exportLinkedOwlbear(c,old.engine.evaluate(c)),without={...c,reviewedSkilled:undefined};
  const cards=[old.validation.validateCharacter(native),old.validation.readCharacter(native).character,old.validation.importOwlbear(linked),...old.transfer.readCharacterTransfer([JSON.stringify(native)]),...old.transfer.readCharacterTransfer([JSON.stringify(linked)]),...old.transfer.readCharacterTransfer([JSON.stringify(old.exports.exportCharacters([c]))])];
  for(const card of cards){expect(card.reviewedSkilled).toEqual(saved);expect(card.reviewedFeats).toEqual(passive);expect(old.engine.evaluate(card)).toEqual(old.engine.evaluate(without));expect(old.engine.evaluate(card).skills.perception.proficient).toBe(false);expect(evaluate(validateCharacter(card)).skills.perception.value).toBe(3);}
 });
 it('old ordinary display/runtime edits, IndexedDB save/load and backup preserve unknown intent without applying it',async()=>{
  const {c}=setup(),saved=structuredClone(c.reviewedSkilled),workspace={schemaVersion:1 as const,characters:[c],activeId:c.id,packs:[]};await old.storage.saveWorkspace(workspace);
  const display=old.display.applyDisplayCharacterEdit(c,old.display.displayCharacterEdit('name','Older display edit'))!,edited=old.runtime.applyRuntimeCharacterEdit(display,old.runtime.runtimeValueEdit('hp',5))!;edited.notes='Older note edit';const normalized=old.validation.validateCharacter(old.exports.exportCharacter(edited));await old.storage.saveWorkspace({...workspace,characters:[normalized]});
  const restored=(await old.storage.loadWorkspace())!.characters[0];expect(await old.storage.restoreBackup()).toEqual(workspace);expect(restored.reviewedSkilled).toEqual(saved);expect(restored.runtime.hp).toBe(5);expect(old.engine.evaluate(restored).skills.perception.proficient).toBe(false);expect(evaluate(validateCharacter(restored)).skills.perception.value).toBe(3);
 });
 it.each(['clear','replace','toggle'] as const)('documents OLD %s then reselect retaining unobservable stale consent; current edits withdraw it',mode=>{
  const {c,entries,choice,feat}=setup(),saved=structuredClone(c.reviewedSkilled);
  if(mode==='toggle')old.choices.chooseSheetOption(c,choice.id,feat.id,entries);else old.choices.setSheetChoiceSlot(c,choice.id,0,mode==='clear'?undefined:entries.find(row=>row.english==='Authored Skilled Replacement')!.id,entries);
  expect(c.reviewedSkilled).toEqual(saved);expect(reviewedSkilledStatus(c,choice.id,feat.id).active).toBe(false);old.choices.setSheetChoiceSlot(c,choice.id,0,feat.id,entries);const reopened=validateCharacter(old.exports.exportCharacter(c));
  // The old client cannot invalidate an unknown field. Identical restored
  // answers do not disclose its intervening edits; players must reconfirm.
  expect(reviewedSkilledStatus(reopened,choice.id,feat.id).active).toBe(true);setSheetChoiceSlot(reopened,choice.id,0,undefined,entries);setSheetChoiceSlot(reopened,choice.id,0,feat.id,entries);expect(reopened.reviewedSkilled?.bindings).toEqual([]);expect(reviewedSkilledStatus(reopened,choice.id,feat.id).active).toBe(false);
 });
 it('documents OLD downgrade losing an unknown-owned ASI source instance, which cannot silently regain authorization',()=>{
  const {c,entries,choice,feat}=setup(),saved=structuredClone(c.reviewedSkilled),id=saved!.bindings[0].selectionId;c.selections[0].level=3;old.sheet.syncFeatures(c,entries);expect(c.selections.some(row=>row.id===id)).toBe(false);expect(c.classChoiceArchive?.[id]).toBeUndefined();c.selections[0].level=8;old.sheet.syncFeatures(c,entries);expect(c.selections.some(row=>row.id===id)).toBe(false);expect(c.reviewedSkilled).toEqual(saved);expect(reviewedSkilledStatus(c,choice.id,feat.id).active).toBe(false);
 });
});
