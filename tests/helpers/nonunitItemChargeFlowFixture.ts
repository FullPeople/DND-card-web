import {newCharacter,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {nonunitItemChargeEntries,nonunitItemChargeFind} from './nonunitItemChargeSourceFixture';

/** Authored Character factory is intentionally separate from pure source IO. */
export function nonunitItemChargeFixture(id:string,form:'canonical'|'merged'='canonical'){
 const entries=nonunitItemChargeEntries(form),entry=structuredClone(nonunitItemChargeFind(id,form)),c=newCharacter(entry.edition==='2024'?'2024':'2014');
 c.automation=newAutomationState();c.profile.enabledSources=[...new Set([entry.source,...(entry.dependencies||[])])];
 c.notes='Authored nonunit accounting sentinel';c.runtime.hp=7;c.runtime.resources.manual={name:'Authored spent counter',max:7,current:2,locked:true};
 const owner:Selection={id:'physical-nonunit-owned-item',entry,level:1,quantity:1,equipped:true,attuned:true};c.selections.push(owner);
 return {c,entry,owner,entries};
}
