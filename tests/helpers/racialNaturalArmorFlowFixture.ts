import {newCharacter,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {planRacialAbilities} from '../../src/core/racialAbilities';
import {racialNaturalArmorFind,racialNaturalArmorSpecs,racialNaturalArmorSourceEvidence} from './racialNaturalArmorSourceFixture';

// Characters are authored separately from immutable full-source normalization.
export function racialNaturalArmorFixture(key=racialNaturalArmorSpecs[0].key,form:'canonical'|'app'='canonical'){
 const entry=structuredClone(racialNaturalArmorFind(key,form)),spec=racialNaturalArmorSpecs.find(row=>row.key===key)!,rule=racialNaturalArmorSourceEvidence().rules.find(row=>row.key===key)!;
 const c=newCharacter(entry.edition==='2024'?'2024':'2014');c.automation=newAutomationState();c.profile.enabledSources=[...new Set([entry.source,...(entry.dependencies||[])])];
 c.size='M';c.notes='Authored natural armor preservation note; not source authority';c.runtime.hp=3;c.runtime.tempHp=2;c.runtime.resources.manual={name:'Authored spent resource',max:7,current:1,locked:true};
 c.inventory={view:'grid',order:[],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:7,pp:0},capacityAdjustment:''};c.sheetBonuses={ac:2,speed:3};c.skillBonuses={athletics:4};c.saveBonuses={con:5};
 // Race ownership is not an equipped/attuned item stack. No artificial class,
 // parent, quantity gate, saved confirmation or direct rule effect is attached.
 const owner:Selection={id:'racial-natural-armor-owner',entry,quantity:1,level:1,equipped:false};c.selections.push(owner);
 // Retain real existing fixed racial abilities. Calibrate authored base scores,
 // not the source snapshot or engine, to make actual derived Dex14 and Con16.
 const racial=planRacialAbilities(c,owner);c.abilities.dex=14-(racial.bonuses.dex||0);c.abilities.con=16-(racial.bonuses.con||0);
 return{c,owner,entry,spec,rule};
}
