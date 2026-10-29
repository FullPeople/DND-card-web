import {describe,expect,it} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {syncFeatures} from '../src/core/sheet';
import {setAsiAllocation} from '../src/core/automation/asi';
import {evaluate} from '../src/core/engine';
import {setReviewedAlertIntent} from '../src/core/automation/reviewedAlert';
import {alertDirectory,alertFrozenInput,alertIntent} from './helpers/reviewedAlertCore';
import {reviewedAlertFixture} from './e2e/reviewedAlertFixture';
import {ALERT_WIZARD_SHA256,ALERT_FEAT_INPUT_SHA256,canonicalJsonSha256} from './e2e/reviewedAlertArtifactPrivacy';

function setup(mixed=false){
 const c=reviewedAlertFixture(),wizard=alertFrozenInput('class/class-wizard.json',ALERT_WIZARD_SHA256),entries=[...normalizeData(wizard,'frozen-wizard-alert-browser'),...normalizeData(alertFrozenInput('feats.json',ALERT_FEAT_INPUT_SHA256),'frozen-alert-browser')];
 c.selections[0].entry=entries.find(row=>row.kind==='class'&&row.english==='Wizard'&&row.source==='PHB')!;
 if(mixed)c.selections[0].level=8;syncFeatures(c,entries);
 if(mixed){const choice=sheetChoices(c,entries).find(row=>row.sourceProgression==='feat'&&row.grantLevel===8)!,ability=choice.options.find(row=>row.entry.raw._classAbilityRecord===true)!;setSheetChoiceSlot(c,choice.id,0,ability.value,entries);setAsiAllocation(c,choice.id,{dex:2});}
 const choice=sheetChoices(c,entries).find(row=>row.grantLevel===4)!,entry=entries.find(row=>row.id==='kiwee:feat:phb:alert::::::')!;
 setSheetChoiceSlot(c,choice.id,0,entry.id,entries);
 return {c,entries,choice,entry,confirm:()=>setReviewedAlertIntent(c,choice.id,entry.id,alertIntent(),entries)};
}
describe.skipIf(!alertDirectory)('real-source App fixture predictions, not browser acceptance',()=>{
 it('uses actual Wizard4 and leaves all manual/runtime fields intact after explicit +5',()=>{
  const s=setup(),before=structuredClone(s.c);expect(evaluate(s.c).initiative).toBe(2);s.confirm();expect(evaluate(s.c).initiative).toBe(7);
  for(const key of ['abilities','training','runtime','proficiencies','expertise','skillBonuses','sheetBonuses','adjustments','selections'] as const)expect(canonicalJsonSha256([s.c[key]])).toBe(canonicalJsonSha256([before[key]]));
 });
 it('prepares genuine separate Wizard8 DEX ASI without granting an ability through Alert',()=>{
  const s=setup(true),asi=canonicalJsonSha256(s.c.asiAllocations);expect(evaluate(s.c)).toMatchObject({abilities:{dex:16},initiative:3});s.confirm();expect(evaluate(s.c)).toMatchObject({abilities:{dex:16},initiative:8});s.c.jackOfAllTrades=true;expect(evaluate(s.c).initiative).toBe(9);s.c.abilities.dex=16;expect(evaluate(s.c)).toMatchObject({abilities:{dex:18},initiative:10});expect(canonicalJsonSha256(s.c.asiAllocations)).toBe(asi);
 });
 it('retains manual absolute17 then offset2, including the signed-123 render recipe',()=>{
  const s=setup();s.c.adjustments=[{id:'manual-initiative',target:'initiative',value:17,reason:'手工先攻最终值'}];s.c.sheetBonuses!.initiative=2;s.confirm();expect(evaluate(s.c).initiative).toBe(19);s.c.sheetBonuses!.initiative=-140;expect(evaluate(s.c).initiative).toBe(-123);expect(s.c.adjustments[0].value).toBe(17);expect(s.c.abilities.dex).toBe(14);
 });
});
