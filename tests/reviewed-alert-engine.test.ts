import {describe,it,expect} from 'vitest';
import {evaluate} from '../src/core/engine';
import {setSheetChoiceSlot,sheetChoices} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {setupObservant,observantDirectory,observantSnapshot} from './helpers/reviewedObservantCore';

// Actual frozen PHB Wizard 4 and Alert; no synthesized publisher rule bodies.
function selectedAlert(level=4){
 const s=setupObservant(level),feat=s.entries.find(e=>e.english==='Alert'&&e.source==='PHB')!;
 s.c.abilities.dex=14;setSheetChoiceSlot(s.c,s.choice.id,0,feat.id,s.entries);
 const source=s.c.selections.find(row=>row.entry.id===s.choice.id.split(':class-legacy-feat:')[1])!;
 (s.c as any).reviewedAlert={version:1,bindings:[{selectionId:source.id,choiceId:s.choice.id,entryId:feat.id,intent:{kind:'alert',confirmedManualInitiativeExcluded:true}}]};
 return {...s,feat,source};
}
describe.skipIf(!observantDirectory)('actual-source Alert fixed initiative engine regression',()=>{
 it('PHB Wizard 4 explicit independent intent derives DEX14 initiative 2→7 without mutating saved state or other stats',()=>{
  const s=selectedAlert(),before=observantSnapshot(s.c),plain=structuredClone(s.c);delete (plain as any).reviewedAlert;
  const natural=evaluate(plain),actual=evaluate(s.c);expect(natural.initiative).toBe(2);expect(actual.initiative).toBe(7);
  expect({...actual,initiative:natural.initiative,trace:natural.trace,issues:natural.issues}).toEqual(natural);expect(observantSnapshot(s.c)).toBe(before);
 });
 it.each([[-3,4],[2,9]])('signed initiative sheet offset %s remains additive after fixed source +5', (offset,want)=>{
  const s=selectedAlert();s.c.sheetBonuses={...s.c.sheetBonuses,initiative:offset};expect(evaluate(s.c).initiative).toBe(want);
 });
 it('Jack of All Trades and final proficiency remain natural operands of the flat +5',()=>{
  const s=selectedAlert(8);s.c.jackOfAllTrades=true;expect(evaluate(s.c).initiative).toBe(8);
  s.c.sheetBonuses={...s.c.sheetBonuses,proficiency:1};expect(evaluate(s.c).initiative).toBe(9);
 });
 it('manual absolute initiative 17 replaces natural Alert result, then independent sheet+2 gives19',()=>{
  const s=selectedAlert();s.c.adjustments=[{id:'absolute-init',target:'initiative',value:17,reason:'旧手工总值'}];s.c.sheetBonuses={...s.c.sheetBonuses,initiative:2};
  expect(evaluate(s.c).initiative).toBe(19);expect(evaluate(s.c).trace.initiative.some(s=>s.includes('警觉')&&s.includes('+5'))).toBe(true);
 });
 it('automation pause retains intent and restores the same flat+5 on resume',()=>{
  const s=selectedAlert(),saved=JSON.stringify((s.c as any).reviewedAlert);s.c.automation!.enabled=false;expect(evaluate(s.c).initiative).toBe(2);
  s.c.automation!.enabled=true;expect(evaluate(s.c).initiative).toBe(7);expect(JSON.stringify((s.c as any).reviewedAlert)).toBe(saved);
 });
 it('source disable and 4→3→4 retain actual source identity without resource reset',()=>{
  const s=selectedAlert(),saved=JSON.stringify((s.c as any).reviewedAlert),runtime=structuredClone(s.c.runtime);
  s.c.profile.enabledSources=[];expect(evaluate(s.c).initiative).toBe(2);s.c.profile.enabledSources=['PHB','TCE'];expect(evaluate(s.c).initiative).toBe(7);
  s.c.selections[0].level=3;syncFeatures(s.c,[]);expect(evaluate(s.c).initiative).toBe(2);expect(s.c.classChoiceArchive?.[s.source.id]).toBeDefined();
  s.c.selections[0].level=4;syncFeatures(s.c,[]);expect(evaluate(s.c).initiative).toBe(7);expect(JSON.stringify((s.c as any).reviewedAlert)).toBe(saved);expect(s.c.runtime).toEqual(runtime);
 });
 it('plain unsupported PHB Alert stays manual and creates no generic choice or initiative bonus',()=>{
  const s=selectedAlert();delete (s.c as any).reviewedAlert;expect(evaluate(s.c).initiative).toBe(2);
  expect(sheetChoices(s.c,s.entries).some(row=>row.ownerId===s.feat.id)).toBe(false);
 });
});
