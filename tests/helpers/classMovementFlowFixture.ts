import {newCharacter,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {syncFeatures} from '../../src/core/sheet';
import {classMovementEntries,classMovementFind,classMovementOwner,classMovementSpecs,classMovementSourceEvidence} from './classMovementSourceFixture';

// Genuine declared-content ownership is created by the existing synchronizer,
// separately from pure original-source IO and evidence generation.
export function classMovementFixture(key=classMovementSpecs[0].key,form:'canonical'|'app'='canonical'){
 const spec=classMovementSpecs.find(row=>row.key===key);if(!spec)throw Error('CLASS_MOVEMENT_FIXTURE_UNREVIEWED_KEY');
 const classEntry=structuredClone(classMovementOwner(key,form)),entry=structuredClone(classMovementFind(key,form)),entries=classMovementEntries(form).map(row=>structuredClone(row)),rule=classMovementSourceEvidence().rules.find(row=>row.key===key)!;
 const c=newCharacter(classEntry.edition==='2024'?'2024':'2014');c.automation=newAutomationState();c.profile.enabledSources=[...new Set([classEntry.source,entry.source,...(classEntry.dependencies||[]),...(entry.dependencies||[])])];
 c.notes='Authored movement notes, not class-feature ownership';c.runtime.hp=3;c.runtime.tempHp=2;c.runtime.resources.manual={name:'Authored spent resource',max:7,current:1,locked:true};c.sheetBonuses={speed:3,ac:2};c.skillBonuses={athletics:4};c.saveBonuses={str:5};
 const owner:Selection={id:'class-movement-owner',entry:classEntry,quantity:1,level:spec.minLevel,equipped:false};c.selections.push(owner);syncFeatures(c,entries);
 const matches=c.selections.filter(row=>row.parentId===owner.id&&row.grantKey===rule.grantKey&&row.entry.id===entry.id);if(matches.length!==1)throw Error('CLASS_MOVEMENT_FIXTURE_EXACT_DECLARED_GRANT');const feature=matches[0];
 return {c,owner,feature,entry:feature.entry,entries,spec,rule,classEntry:owner.entry};
}
