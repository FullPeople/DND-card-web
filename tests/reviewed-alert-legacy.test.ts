import 'fake-indexeddb/auto';
import {IDBFactory} from 'fake-indexeddb';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {frozenReviewedAlertLegacy,reviewedAlertLegacyUnavailable,REVIEWED_ALERT_LEGACY_COMMIT,REVIEWED_ALERT_LEGACY_SOURCE_TREE,type FrozenReviewedAlertLegacy} from './helpers/frozenReviewedAlertLegacy';
import {alertDirectory,setupAlert,alertIntent,alertSnapshot,alertManualSnapshot} from './helpers/reviewedAlertCore';
import {setReviewedAlertIntent,reviewedAlertStatus} from '../src/core/automation/reviewedAlert';
import {setReviewedFeatIntent} from '../src/core/automation/reviewedFeats';
import {setSheetChoiceSlot,sheetChoices} from '../src/core/automation/choices';
import {evaluate} from '../src/core/engine';
import {validateCharacter,importOwlbear} from '../src/core/validation';
import {exportOwlbear} from '../src/core/export';

// Dedicated compatibility gate must execute, never silently skip a missing fixture.
if(process.env.REVIEWED_ALERT_LEGACY_REQUIRED==='1'&&!alertDirectory)throw Error('Required Alert legacy gate needs REVIEWED_FEATS_FROZEN_DIR');
describe.skipIf(!alertDirectory||!!reviewedAlertLegacyUnavailable)('actual8e48 old consumer: unknown Alert retention is not safe editing compatibility',()=>{
 let old:FrozenReviewedAlertLegacy;
 beforeAll(async()=>{vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('location',{search:'',hash:''});vi.stubGlobal('window',new EventTarget());vi.stubGlobal('BroadcastChannel',undefined);old=await frozenReviewedAlertLegacy();},30000);
 afterAll(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
 function setup(){const s=setupAlert(8),tough=s.entries.find(r=>r.english==='Tough'&&r.source==='PHB')!,second=s.choices()[1];setSheetChoiceSlot(s.c,second.id,0,tough.id,s.entries);setReviewedFeatIntent(s.c,second.id,tough.id,{kind:'tough',confirmedManualHpExcluded:true});s.confirm();return s;}
 it('loads exact accepted8e48 sourceae3, with existing Observant and no Alert implementation or current-module substitute',()=>{
  expect(REVIEWED_ALERT_LEGACY_COMMIT).toBe('8e48bbbe801b21a57fbb9072b4d4c324379448ea');expect(REVIEWED_ALERT_LEGACY_SOURCE_TREE).toBe('ae3ae366ea3e70d096426410b5badc711164353e');
  expect(old.source('src/core/validation.ts')).toContain('validateReviewedObservant');expect(old.source('src/core/validation.ts')).not.toContain('validateReviewedAlert');expect(old.source('src/core/engine.ts')).not.toContain('evaluateReviewedAlert');expect(old.sourceFiles).toContain('src/core/automation/reviewedObservant.ts');expect(old.sourceFiles.some(path=>path.includes('reviewedAlert'))).toBe(false);
 });
 it('old native/book/linked transfer retains the full character, executes existing Tough only, and current reopen adds exactly +5 once',()=>{
  const s=setup(),saved=alertSnapshot(s.c.reviewedAlert),native=old.exports.exportCharacter(s.c),linked=old.exports.exportLinkedOwlbear(s.c,old.engine.evaluate(s.c)),baseline=old.validation.validateCharacter(native),without={...baseline,reviewedAlert:undefined};
  const cards=[old.validation.validateCharacter(native),old.validation.readCharacter(native).character,old.validation.importOwlbear(linked),...old.transfer.readCharacterTransfer([JSON.stringify(native)]),...old.transfer.readCharacterTransfer([JSON.stringify(linked)]),...old.transfer.readCharacterTransfer([JSON.stringify(old.exports.exportCharacters([s.c]))])];
  for(const c of cards){
   // Transfer deliberately makes a new card identity/revision; every other field is retained.
   expect(alertSnapshot({...c,id:baseline.id,revision:baseline.revision,updatedAt:baseline.updatedAt})).toBe(alertSnapshot(baseline));expect(alertSnapshot(c.reviewedAlert)).toBe(saved);expect(alertSnapshot(old.engine.evaluate(c))).toBe(alertSnapshot(old.engine.evaluate(without)));expect(old.engine.evaluate(c).initiative).toBe(2);expect(old.engine.evaluate(c).maxHp).toBe(49);
   const reopened=validateCharacter(c),before=alertSnapshot(reopened);for(let i=0;i<3;i++){expect(evaluate(reopened).initiative).toBe(7);expect(evaluate(reopened).maxHp).toBe(49);}expect(alertSnapshot(reopened)).toBe(before);
  }
 });
 it('old actual IndexedDB save/load/backup and display/runtime/resource edits retain unknown intent without executing +5',async()=>{
  const s=setup(),workspace={schemaVersion:1 as const,characters:[s.c],activeId:s.c.id,packs:[]},saved=alertSnapshot(s.c.reviewedAlert),original=alertSnapshot(workspace);await old.storage.saveWorkspace(workspace);
  const display=old.display.applyDisplayCharacterEdit(s.c,old.display.displayCharacterEdit('name','Older display edit'))!,hp=old.runtime.applyRuntimeCharacterEdit(display,old.runtime.runtimeValueEdit('hp',5))!,runtime=old.runtime.applyRuntimeCharacterEdit(hp,old.runtime.resourceBalanceEdit('manual',1))!;runtime.notes='Older notes';const normalized=old.validation.validateCharacter(old.exports.exportCharacter(runtime));await old.storage.saveWorkspace({...workspace,characters:[normalized]});
  const c=(await old.storage.loadWorkspace())!.characters[0];expect(alertSnapshot(await old.storage.restoreBackup())).toBe(original);expect(alertSnapshot(c)).toBe(alertSnapshot(normalized));expect(alertSnapshot(c.reviewedAlert)).toBe(saved);expect(c.name).toBe('Older display edit');expect(c.runtime.hp).toBe(5);expect(c.runtime.resources.manual.current).toBe(1);expect(old.engine.evaluate(c).initiative).toBe(2);expect(evaluate(validateCharacter(c)).initiative).toBe(7);
 });
 it.each(['clear','replace','toggle'] as const)('old %s→reselect preserves unobservable stale consent; supporting-client clear/reselect withdraws it',mode=>{
  const s=setup(),saved=alertSnapshot(s.c.reviewedAlert);if(mode==='toggle')old.choices.chooseSheetOption(s.c,s.choice.id,s.feat.id,s.entries);else old.choices.setSheetChoiceSlot(s.c,s.choice.id,0,mode==='clear'?undefined:s.entries.find(r=>r.english==='Resilient'&&r.source==='PHB')!.id,s.entries);
  expect(alertSnapshot(s.c.reviewedAlert)).toBe(saved);expect(reviewedAlertStatus(s.c,s.choice.id,s.feat.id).active).toBe(false);expect(old.engine.evaluate(s.c).initiative).toBe(2);old.choices.setSheetChoiceSlot(s.c,s.choice.id,0,s.feat.id,s.entries);
  const c=validateCharacter(old.exports.exportCharacter(s.c));expect(reviewedAlertStatus(c,s.choice.id,s.feat.id).active).toBe(true);expect(evaluate(c).initiative).toBe(7);setSheetChoiceSlot(c,s.choice.id,0,undefined,s.entries);setSheetChoiceSlot(c,s.choice.id,0,s.feat.id,s.entries);expect(c.reviewedAlert!.bindings).toEqual([]);expect(evaluate(c).initiative).toBe(2);
 });
 it('old 4→3→4 loses unknown-owned source identity without automatic rebind; setter requires narrow withdrawal before new consent',()=>{
  const s=setupAlert();s.confirm();const saved=alertSnapshot(s.c.reviewedAlert),id=s.c.reviewedAlert!.bindings[0].selectionId,resource=alertSnapshot(s.c.runtime);s.c.selections[0].level=3;old.sheet.syncFeatures(s.c,s.entries);expect(s.c.selections.some(row=>row.id===id)).toBe(false);expect(s.c.classChoiceArchive?.[id]).toBeUndefined();s.c.selections[0].level=4;old.sheet.syncFeatures(s.c,s.entries);
  expect(s.c.selections.some(row=>row.id===id)).toBe(false);expect(alertSnapshot(s.c.reviewedAlert)).toBe(saved);expect(reviewedAlertStatus(s.c,s.choice.id,s.feat.id).active).toBe(false);expect(evaluate(s.c).initiative).toBe(2);const before=alertSnapshot(s.c);expect(()=>setReviewedAlertIntent(s.c,s.choice.id,s.feat.id,alertIntent(),s.entries)).toThrow('撤回');expect(alertSnapshot(s.c)).toBe(before);
  const manual=alertManualSnapshot(s.c);setReviewedAlertIntent(s.c,s.choice.id,s.feat.id,null);setReviewedAlertIntent(s.c,s.choice.id,s.feat.id,alertIntent(),s.entries);expect(s.c.reviewedAlert!.bindings[0].selectionId).not.toBe(id);expect(evaluate(s.c).initiative).toBe(7);expect(alertManualSnapshot(s.c)).toBe(manual);expect(alertSnapshot(s.c.runtime)).toBe(resource);
 });
 it.each(['dex','total','offset'] as const)('old manual %s edits remain intact without invented stale-consent detection',mode=>{
  const s=setup(),saved=alertSnapshot(s.c.reviewedAlert);if(mode==='dex')s.c.abilities.dex=18;if(mode==='total')s.c.adjustments=[{id:'manual-total',target:'initiative',value:17,reason:'Retained manual total'}];if(mode==='offset')s.c.sheetBonuses!.initiative=3;
  const c=validateCharacter(old.exports.exportCharacter(s.c)),manual=alertManualSnapshot(c);expect(alertSnapshot(c.reviewedAlert)).toBe(saved);expect(reviewedAlertStatus(c,s.choice.id,s.feat.id).active).toBe(true);expect(old.engine.evaluate(c).initiative).toBe(mode==='dex'?4:mode==='total'?17:5);expect(evaluate(c).initiative).toBe(mode==='dex'?9:mode==='total'?17:10);
  setReviewedAlertIntent(c,s.choice.id,s.feat.id,null);expect(evaluate(c).initiative).toBe(old.engine.evaluate(c).initiative);setReviewedAlertIntent(c,s.choice.id,s.feat.id,alertIntent(),s.entries);expect(evaluate(c).initiative).toBe(mode==='dex'?9:mode==='total'?17:10);expect(alertManualSnapshot(c)).toBe(manual);
 });
 it('thin Owlbear totals are manual and unowned in both clients, never reconstructed as editable Alert consent',()=>{
  const s=setup();for(const [exported,total] of [[old.exports.exportOwlbear(s.c,old.engine.evaluate(s.c)),2],[exportOwlbear(s.c,evaluate(s.c)),7]] as const){for(const importer of [old.validation.importOwlbear,importOwlbear]){const c=importer(exported),saved=alertSnapshot(c);expect(c.reviewedAlert).toBeUndefined();expect(c.adjustments?.find(row=>row.target==='initiative')?.value).toBe(total);expect(evaluate(c).initiative).toBe(total);expect(old.engine.evaluate(c).initiative).toBe(total);expect(reviewedAlertStatus(c,s.choice.id,s.feat.id).active).toBe(false);expect(()=>setReviewedAlertIntent(c,s.choice.id,s.feat.id,alertIntent(),s.entries)).toThrow();expect(alertSnapshot(c)).toBe(saved);}}
 });
 it('genuine authenticated XPHB Alert retains full old output and generic choices, not the independent PHB +5',()=>{
  const s=setupAlert(),modern=s.entries.find(row=>row.english==='Alert'&&row.source==='XPHB')!;s.c.edition='2024';s.c.profile.enabledSources=['XPHB'];s.c.selections=[{id:'modern',entry:modern,level:1,quantity:1,equipped:false}];const before=alertSnapshot(s.c);expect(alertSnapshot(evaluate(s.c))).toBe(alertSnapshot(old.engine.evaluate(s.c)));expect(alertSnapshot(sheetChoices(s.c,s.entries))).toBe(alertSnapshot(old.choices.sheetChoices(s.c,s.entries)));expect(evaluate(s.c).initiative).toBe(2);expect(s.c.reviewedAlert).toBeUndefined();expect(alertSnapshot(s.c)).toBe(before);
 });
});
