import {newCharacter,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {relativeRacialMovementEntries,relativeRacialMovementFind,relativeRacialMovementSpecs,relativeRacialMovementSourceEvidence} from './relativeRacialMovementSourceFixture';

// Character construction remains separate from immutable-source IO/proof.
export function relativeRacialMovementFixture(idOrSourcePath=relativeRacialMovementSpecs[0].sourcePath,form:'canonical'|'app'='canonical'){
 const entry=structuredClone(relativeRacialMovementFind(idOrSourcePath,form)),spec=relativeRacialMovementSpecs.find(row=>row.id===entry.id)!,rule=relativeRacialMovementSourceEvidence().rules.find(row=>row.id===entry.id)!;
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=[...rule.requiredSources];
 c.notes='Authored manual swimming 777 note, not movement authority';c.externalSnapshot={authoredAncestralMovement:777};c.runtime.hp=3;c.runtime.tempHp=2;c.runtime.resources.manual={name:'Authored spent resource',max:7,current:1,locked:true};
 c.adjustments=[{id:'manual-walking',target:'speed',value:47,reason:'Authored walking total'}];c.sheetBonuses={speed:3,ac:2};c.skillBonuses={athletics:4};c.saveBonuses={str:5};
 const owner:Selection={id:'relative-movement-owner',entry,quantity:1,level:1,equipped:false};c.selections.push(owner);
 return {c,entry,owner,entries:relativeRacialMovementEntries(form).map(row=>structuredClone(row)),spec,rule};
}
