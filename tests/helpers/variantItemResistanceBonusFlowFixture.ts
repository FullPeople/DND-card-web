import {newCharacter,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {variantItemResistanceBonusFind,variantItemResistanceBonusSpecs,variantItemResistanceBonusSourceEvidence} from './variantItemResistanceBonusSourceFixture';

// Character creation is independent from pure immutable source generation.
export function variantItemResistanceBonusFixture(keyOrId=variantItemResistanceBonusSpecs[0].key,form:'canonical'|'app'='canonical'){
 const entry=structuredClone(variantItemResistanceBonusFind(keyOrId,form)),rule=variantItemResistanceBonusSourceEvidence().rules.find(row=>row.id===entry.id)!,spec=variantItemResistanceBonusSpecs.find(row=>row.key===rule.key)!;
 const c=newCharacter(entry.edition==='2024'?'2024':'2014');c.automation=newAutomationState();
 // Concrete ownership policy: only the final Entry source and actual declared
 // dependencies. Base/template provenance is not a new source prerequisite.
 c.profile.enabledSources=[...new Set([entry.source,...(entry.dependencies||[])])];
 c.notes='Authored manual resistance note, not source authority';c.runtime.hp=3;c.runtime.tempHp=2;c.runtime.resources.manual={name:'Authored spent resource',max:7,current:1,locked:true};
 const owner:Selection={id:'physical-variant-resistance-owner',entry,quantity:1,level:1,equipped:true,attuned:true};c.selections.push(owner);
 // The flow's catalog slice is only this actual owner. The complete admitted
 // cohort remains available from the separate source fixture, not recopied for
 // each of the hundreds of independent owner workflows.
 return {c,owner,entry,entries:[structuredClone(entry)],spec,rule};
}
