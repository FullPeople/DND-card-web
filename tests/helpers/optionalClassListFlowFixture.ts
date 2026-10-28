import {newCharacter,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {syncFeatures} from '../../src/core/sheet';
import {syncAutoResources} from '../../src/core/resources';
import {casterProfiles} from '../../src/core/spellcastingRules';
import {optionalClassListEntries,optionalClassListOwners,optionalClassListAssociations} from './optionalClassListSourceFixture';

export const optionalClassListOwnerIds=['kiwee:class:phb:bard::::::','kiwee:class:phb:cleric::::::','kiwee:class:phb:druid::::::','kiwee:class:phb:paladin::::::','kiwee:class:phb:ranger::::::','kiwee:class:phb:warlock::::::','kiwee:class:phb:wizard::::::'];
export const optionalClassListManual=(c:ReturnType<typeof newCharacter>)=>JSON.stringify({abilities:c.abilities,notes:c.notes,baseHp:c.baseHp,hp:c.runtime.hp,tempHp:c.runtime.tempHp,manual:c.runtime.resources.manual,adjustments:c.adjustments,skillBonuses:c.skillBonuses,saveBonuses:c.saveBonuses,training:c.training});
export function optionalClassListFlowFixture(ownerId=optionalClassListOwnerIds[0]){
 const entries=structuredClone(optionalClassListEntries()),classes=optionalClassListOwners().filter(entry=>entry.id===ownerId);if(classes.length!==1)throw Error('Unique exact qualified PHB2014 class required');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=[...new Set(['PHB','TCE',...entries.filter(entry=>entry.kind==='spell').map(entry=>entry.source)])];c.abilities.int=c.abilities.wis=c.abilities.cha=16;c.baseHp=20;c.runtime.hp=7;c.runtime.tempHp=2;c.notes='Authored optional list manual sentinel';c.training={languages:'Authored retained manual languages'};c.adjustments=[{id:'manual-ac',target:'ac',value:15,reason:'Authored manual armor total'}];c.skillBonuses={arcana:2};c.saveBonuses={wis:3};c.runtime.resources.manual={name:'Authored spent manual resource',max:7,current:2,locked:true};
 const owner:Selection={id:'optional-class-owner',entry:structuredClone(classes[0]),level:9,quantity:1,equipped:false};c.selections.push(owner);syncFeatures(c,entries);syncAutoResources(c);
 const profile=casterProfiles(c).find(row=>row.owner.id===owner.id);if(!profile)throw Error('Actual native caster profile required');
 const associations=optionalClassListAssociations().filter(row=>row.owner.id===ownerId&&!row.baseOverlap&&Number(row.target.raw.level)>0&&Number(row.target.raw.level)<=profile.maxLevel).sort((a,b)=>Number(a.target.raw.level)-Number(b.target.raw.level)||a.target.id.localeCompare(b.target.id));
 if(!associations.length)throw Error('Actual qualified non-base paid target required');const association=associations[0],entry=structuredClone(association.target);
 return {c,owner,entries,entry,profile,association};
}
