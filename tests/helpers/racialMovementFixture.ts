import {newCharacter,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {racialMovementSpecs,racialMovementAllEntries,racialMovementEntries} from './racialMovementSourceFixture';
export * from './racialMovementSourceFixture';

export function racialMovementFixture(id=racialMovementSpecs[0].id){
 const spec=racialMovementSpecs.find(row=>row.id===id);if(!spec)throw Error('Reviewed exact source movement spec required');
 const entries=racialMovementAllEntries(),entry=structuredClone(racialMovementEntries().find(row=>row.id===id)!);if(!entry)throw Error('Reviewed normalized movement source missing');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=[...spec.requiredSources];
 c.notes='Authored manual movement note: swimming 777 feet, not permission';c.externalSnapshot={authoredManualMovement:777};c.runtime.hp=3;c.runtime.tempHp=2;c.runtime.resources.manual={name:'Authored spent counter',max:7,current:1,locked:true};
 c.adjustments=[{id:'manual-speed',target:'speed',value:47,reason:'Authored walking total'}];c.sheetBonuses={speed:3,ac:2};c.skillBonuses={athletics:4};c.saveBonuses={str:5};
 const owner:Selection={id:'movement-owner',entry,quantity:1,level:1,equipped:false};c.selections.push(owner);return {c,entry,owner,entries,spec};
}
