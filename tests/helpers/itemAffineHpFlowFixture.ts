import {newCharacter,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {createCustomEntry} from '../../src/core/customEntries';
import {itemAffineHpFind,itemAffineHpSpecs,itemAffineHpSourceEvidence} from './itemAffineHpSourceFixture';

// Character/ownership setup is independent of source qualification and imports
// no acknowledgement actor or HP projection. These are complete actual items,
// not copied prose fragments, synthetic effect fields or template owners.
export function itemAffineHpFixture(keyOrId=itemAffineHpSpecs[0].key,form:'canonical'|'app'='canonical'){
 const entry=structuredClone(itemAffineHpFind(keyOrId,form)),rule=itemAffineHpSourceEvidence().rules.find(row=>row.id===entry.id)!;
 if(!rule)throw Error('ITEM_AFFINE_HP_FIXTURE_NOT_ADMITTED');
 const spec=itemAffineHpSpecs.find(row=>row.key===rule.key)!,c=newCharacter(entry.edition==='2024'?'2024':'2014');c.automation=newAutomationState();c.profile.optional.multiclass=true;
 const classEntry=createCustomEntry({type:'class',name:'Authored first level context',english:'Authored first class',body:'',raw:{hd:{number:1,faces:8}}}),otherEntry=createCustomEntry({type:'class',name:'Authored second level context',english:'Authored second class',body:'',raw:{hd:{number:1,faces:6}}});
 const classOwner:Selection={id:'item-affine-hp-class-one',entry:classEntry,quantity:1,level:3,equipped:false},otherClass:Selection={id:'item-affine-hp-class-two',entry:otherEntry,quantity:1,level:4,equipped:false};
 const owner:Selection={id:'item-affine-hp-physical-owner',entry,quantity:1,level:1,equipped:rule.sourceCondition==='worn-and-attuned',attuned:true};
 c.selections=[classOwner,otherClass,owner];c.profile.enabledSources=[...new Set([entry.source,...(entry.dependencies||[]),'CUSTOM'])];
 c.baseHp=40;c.sheetBonuses={hp:2,ac:1};c.abilities.con=14;c.notes='Authored preserved HP notes, not source authority';c.size='M';c.runtime.hp=7;c.runtime.tempHp=2;c.runtime.resources.manual={name:'Authored spent resource',max:4,current:1,locked:true};
 c.inventory={view:'grid',order:[owner.id],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:7,pp:0},capacityAdjustment:''};
 return{c,owner,entry,rule,spec,classOwner,otherClass,catalog:[structuredClone(entry)]};
}
