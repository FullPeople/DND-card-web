import {newCharacter,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {itemResistanceBonusEntries,itemResistanceBonusFind,itemResistanceBonusSpecs,itemResistanceBonusSourceEvidence} from './itemResistanceBonusSourceFixture';

// Character construction stays separate from immutable-source normalization.
export function itemResistanceBonusFixture(idOrSourceIndex:string|number=213,form:'canonical'|'app'='canonical'){
 const entry=structuredClone(itemResistanceBonusFind(idOrSourceIndex,form)),rule=itemResistanceBonusSourceEvidence().rules.find(row=>row.id===entry.id)!;
 const spec=itemResistanceBonusSpecs.find(row=>row.sourceIndex===rule.sourceIndex)!,c=newCharacter(entry.edition==='2024'?'2024':'2014');
 c.automation=newAutomationState();c.profile.enabledSources=[...new Set([entry.source,...(entry.dependencies||[])])];
 c.notes='Authored resistance fixture notes';c.runtime.hp=3;c.runtime.tempHp=2;
 c.runtime.resources.manual={name:'Authored spent resource',max:7,current:1,locked:true};
 const owner:Selection={id:'physical-resistance-owner',entry,quantity:1,level:1,equipped:true,attuned:true};c.selections.push(owner);
 return {c,owner,entry,entries:itemResistanceBonusEntries(form).map(row=>structuredClone(row)),rule,spec};
}
