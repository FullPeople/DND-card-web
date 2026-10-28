import {newCharacter,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {planRacialAbilities} from '../../src/core/racialAbilities';
import {racialCarryingEntries,racialCarryingFind,racialCarryingSpecs,racialCarryingSourceEvidence} from './racialCarryingSourceFixture';

// Character construction stays separate from immutable source normalization.
export function racialCarryingFixture(key=racialCarryingSpecs[0].key,form:'canonical'|'app'='canonical'){
 const entry=structuredClone(racialCarryingFind(key,form)),spec=racialCarryingSpecs.find(row=>row.key===key)!,rule=racialCarryingSourceEvidence().rules.find(row=>row.key===key)!;
 const c=newCharacter(entry.edition==='2024'?'2024':'2014');c.automation=newAutomationState();c.profile.enabledSources=[...new Set([entry.source,...(entry.dependencies||[])])];c.size='M';
 c.notes='Authored manual carrying note, not source authority';c.runtime.hp=3;c.runtime.tempHp=2;c.runtime.resources.manual={name:'Authored spent resource',max:7,current:1,locked:true};
 c.inventory={view:'grid',order:[],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:7,pp:0},capacityAdjustment:''};c.sheetBonuses={ac:2,speed:3};c.skillBonuses={athletics:4};c.saveBonuses={con:5};
 const owner:Selection={id:'racial-carrying-owner',entry,quantity:1,level:1,equipped:false};c.selections.push(owner);
 // Preserve actual existing racial ability mechanics while choosing an authored
 // base that makes the REAL derived STR exactly ten on every source route.
 c.abilities.str=10-(planRacialAbilities(c,owner).bonuses.str||0);
 return {c,owner,entry,entries:racialCarryingEntries(form),spec,rule};
}
