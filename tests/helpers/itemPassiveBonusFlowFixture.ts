import {newCharacter,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {itemPassiveBonusEntries,itemPassiveBonusFind,itemPassiveBonusSpecs,itemPassiveBonusSourceEvidence} from './itemPassiveBonusSourceFixture';
// Character construction is separate from pure immutable source IO/generation.
export function itemPassiveBonusFixture(idOrSourceIndex:string|number=453,form:'canonical'|'app'='canonical'){
 const entry=structuredClone(itemPassiveBonusFind(idOrSourceIndex,form)),rule=itemPassiveBonusSourceEvidence().rules.find(r=>r.id===entry.id)!;
 const spec=itemPassiveBonusSpecs.find(row=>row.sourceIndex===rule.sourceIndex)!,c=newCharacter(entry.edition==='2024'?'2024':'2014');c.automation=newAutomationState();c.profile.enabledSources=[...new Set([entry.source,...(entry.dependencies||[])])];
 c.notes='Authored passive item notes';c.runtime.hp=3;c.runtime.tempHp=2;c.runtime.resources.manual={name:'Authored spent resource',max:7,current:1,locked:true};
 const owner:Selection={id:'physical-passive-owner',entry,quantity:1,level:1,equipped:rule.sourceCondition!=='attuned-only',attuned:true};c.selections.push(owner);
 return {c,owner,entry,entries:itemPassiveBonusEntries(form).map(row=>structuredClone(row)),rule,spec};
}
