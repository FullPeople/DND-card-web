import {expect,it} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {syncFeatures} from '../src/core/sheet';
import {sheetChoices,setSheetChoiceSlot} from '../src/core/automation/choices';
import {setReviewedFeatIntent,reviewedFeatStatus,type ReviewedFeatIntent} from '../src/core/automation/reviewedFeats';
import {evaluate} from '../src/core/engine';
import {readCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
import {reviewedArmorFeatData,reviewedArmorFeatFixture} from './e2e/reviewedArmorFeatFixture';

// This checks the original browser fixture's arithmetic and lifecycle expectations
// before remote browser execution. It is not a substitute for actual App tests.
it('the browser chain fixture has no implicit armor training and its planned real-slot transitions have the stated totals',()=>{
 const c=reviewedArmorFeatFixture(),catalog=normalizeData(reviewedArmorFeatData,'armor-browser-fixture');syncFeatures(c,catalog);const baseline=structuredClone(c);
 const choices=sheetChoices(c,catalog),choice=(level:number)=>choices.find(row=>row.grantLevel===level)!,feat=(english:string)=>catalog.find(row=>row.english===english)!;
 const apply=(level:number,english:string,intent:ReviewedFeatIntent)=>{const entry=feat(english);setSheetChoiceSlot(c,choice(level).id,0,entry.id,catalog);setReviewedFeatIntent(c,choice(level).id,entry.id,intent);};
 expect(evaluate(c)).toMatchObject({ac:14,maxHp:42,abilities:{str:13,dex:13}});expect(sheetChoices(c,catalog).find(row=>row.grantLevel===6)!.options.find(row=>row.value===feat('Moderately Armored').id)?.unavailable).toBeTruthy();
 apply(4,'Lightly Armored',{kind:'lightly-armored',ability:'dex',confirmedManualAbilityExcluded:true});expect(evaluate(c)).toMatchObject({ac:15,abilities:{str:13,dex:14}});
 apply(6,'Moderately Armored',{kind:'moderately-armored',ability:'str',confirmedManualAbilityExcluded:true});expect(evaluate(c)).toMatchObject({ac:15,abilities:{str:14,dex:14}});
 apply(8,'Heavily Armored',{kind:'heavily-armored',ability:'str',confirmedManualAbilityExcluded:true});expect(evaluate(c)).toMatchObject({ac:15,abilities:{str:15,dex:14}});expect(evaluate(c).issues.some(row=>row.id==='armor-training:armor-shield')).toBe(false);
 expect(evaluate(readCharacter(JSON.parse(JSON.stringify(exportCharacter(c)))).character)).toEqual(evaluate(c));
 setReviewedFeatIntent(c,choice(4).id,feat('Lightly Armored').id,null);expect(evaluate(c)).toMatchObject({ac:14,abilities:{str:13,dex:13}});expect(reviewedFeatStatus(c,choice(6).id,feat('Moderately Armored').id).active).toBe(false);expect(c.reviewedFeats?.bindings).toHaveLength(2);
 setReviewedFeatIntent(c,choice(4).id,feat('Lightly Armored').id,{kind:'lightly-armored',ability:'dex',confirmedManualAbilityExcluded:true});c.profile.enabledSources=[];expect(evaluate(c)).toMatchObject({ac:12,maxHp:42,abilities:{str:13,dex:13}});c.profile.enabledSources=['PHB'];
 c.selections.find(row=>row.id==='armor-fighter')!.level=6;syncFeatures(c,catalog);expect(evaluate(c)).toMatchObject({ac:15,abilities:{str:14,dex:14}});c.selections.find(row=>row.id==='armor-fighter')!.level=8;syncFeatures(c,catalog);expect(evaluate(c)).toMatchObject({ac:15,abilities:{str:15,dex:14}});expect(c.runtime).toEqual(baseline.runtime);
});
