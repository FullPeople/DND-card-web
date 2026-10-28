import {newCharacter,type Selection,type SpecialSpell} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {chargedItemSpellEntries,chargedItemSpellTargets,chargedItemSpellFindOwner,chargedItemSpellFindTarget,chargedItemSpellSourceRules} from './chargedItemSpellSourceFixture';

/** Authored Character factory stays separate from immutable source IO. */
export function chargedItemSpellFixture(id:string,form:'canonical'|'final'='canonical'){
 const rule=chargedItemSpellSourceRules().find(row=>row.id===id);if(!rule)throw Error('CHARGED_ITEM_SPELL_FLOW_REVIEWED_OWNER_REQUIRED');
 const entry=structuredClone(chargedItemSpellFindOwner(id,form)),target=structuredClone(chargedItemSpellFindTarget(rule.branch.targetEntryId)),edition=rule.branch.requiredCardEdition||target.edition,c=newCharacter(edition==='2024'?'2024':'2014');
 c.automation=newAutomationState();c.profile.enabledSources=[...new Set([entry.source,target.source,...(entry.dependencies||[]),...(target.dependencies||[]),...rule.branch.requiredSources])];
 c.notes='Authored charged-item spell sentinel';c.runtime.hp=7;c.runtime.resources.manual={name:'Authored spent counter',max:7,current:2,locked:true};c.runtime.resources['spell-slot:9']={name:'Authored untouched slot',max:9,current:7,automatic:true};
 const owner:Selection={id:'physical-charged-spell-owner',entry,level:1,quantity:1,equipped:true,attuned:rule.requiresAttunement},manual:Selection={id:'authored-manual-same-spell',entry:structuredClone(target),level:1,quantity:1,equipped:false};
 const manualConfig:SpecialSpell={mode:'uses',max:5,recovery:'manual',label:'Authored unrelated manual spell'};
 c.selections.push(owner,manual);c.spellSettings={mode:'prepared',ability:'int',capacity:3,attackBonus:41,dcBonus:42,prepared:[manual.id],slots:{'9':{max:9,used:2}},special:{[manual.id]:manualConfig}};c.runtime.resources[`innate-spell:${manual.id}`]={name:'Authored spent manual spell',max:5,current:1};
 const entries=[...chargedItemSpellEntries(form),...chargedItemSpellTargets()].map(row=>structuredClone(row));
 return {c,entry,target,owner,manual,manualConfig,entries,rule};
}
