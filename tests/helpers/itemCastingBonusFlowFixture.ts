import {newCharacter,type Selection,type Ability} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {itemCastingBonusEntries,itemCastingBonusFind,itemCastingBonusSpecs,itemCastingBonusClasses,itemCastingBonusClass,itemCastingBonusSourceEvidence,type ItemCastingBonusRole} from './itemCastingBonusSourceFixture';

// Character construction stays separate from immutable source IO/generation.
export function itemCastingBonusFixture(idOrSourceIndex:string|number=1,form:'canonical'|'app'='canonical'){
 const entry=structuredClone(itemCastingBonusFind(idOrSourceIndex,form)),rule=itemCastingBonusSourceEvidence().rules.find(row=>row.id===entry.id)!;
 const spec=itemCastingBonusSpecs.find(row=>row.sourceIndex===rule.sourceIndex)!,role:ItemCastingBonusRole=spec.scope==='sorcerer-spells'?'Sorcerer':spec.scope==='spells-using-charisma'?'Bard':spec.attunementClassRoles.includes('Cleric')?'Cleric':'Wizard',edition=spec.sourceIndex===1845?'2024':'2014';
 const classEntry=structuredClone(itemCastingBonusClass(role,edition)),ability=classEntry.raw.spellcastingAbility as Ability,c=newCharacter(edition);c.automation=newAutomationState();
 c.profile.enabledSources=[...new Set([entry.source,classEntry.source,...(entry.dependencies||[]),...(classEntry.dependencies||[])])];c.notes='Authored item casting notes';c.runtime.hp=3;c.runtime.tempHp=2;c.runtime.resources.manual={name:'Authored spent resource',max:7,current:1,locked:true};
 const caster:Selection={id:'casting-class-owner',entry:classEntry,quantity:1,level:5,equipped:false},owner:Selection={id:'physical-casting-item-owner',entry,quantity:1,level:1,equipped:true,attuned:true};c.selections.push(caster,owner);
 c.spellSettings={mode:'prepared',ability,abilityClassId:caster.id,capacity:3,attackBonus:7,dcBonus:11,prepared:[],slots:{}};
 return{c,owner,entry,entries:itemCastingBonusEntries(form).map(row=>structuredClone(row)),rule,spec,caster,ability,classEntries:itemCastingBonusClasses().map(row=>structuredClone(row))};
}
