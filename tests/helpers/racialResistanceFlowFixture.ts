import {newCharacter,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {racialResistanceEntries,racialResistanceFind,racialResistanceSpecs,racialResistanceSourceEvidence} from './racialResistanceSourceFixture';

// Character construction is separate from immutable original-source proof.
export function racialResistanceFixture(key=racialResistanceSpecs[0].key,form:'canonical'|'app'='canonical'){
 const entry=structuredClone(racialResistanceFind(key,form)),spec=racialResistanceSpecs.find(row=>row.key===key)!,rule=racialResistanceSourceEvidence().rules.find(row=>row.key===key)!;
 const c=newCharacter(entry.edition==='2024'?'2024':'2014');c.automation=newAutomationState();c.profile.enabledSources=[...new Set([entry.source,...(entry.dependencies||[])])];
 c.notes='Authored manual resistance 777 note, not source authority';c.externalSnapshot={authoredResistance:777};c.runtime.hp=3;c.runtime.tempHp=2;c.runtime.resources.manual={name:'Authored spent resource',max:7,current:1,locked:true};
 c.sheetBonuses={ac:2,speed:3};c.skillBonuses={athletics:4};c.saveBonuses={con:5};
 const owner:Selection={id:'racial-resistance-owner',entry,quantity:1,level:1,equipped:false};c.selections.push(owner);
 // Cached complete source entries are immutable by convention. Clone explicitly
 // only if a consumer needs to mutate a catalog entry rather than the owned row.
 return {c,owner,entry,entries:racialResistanceEntries(form),spec,rule};
}
