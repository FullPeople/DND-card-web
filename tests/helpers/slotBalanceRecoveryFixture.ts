import {multiclassSlotEntries} from './multiclassSlotSources';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {spellState} from '../../src/core/characterDetails';
import {syncAutoResources} from '../../src/core/resources';
export function slotBalanceRecoveryFixture(edition:'2014'|'2024'='2014'){
 const entries=multiclassSlotEntries(),source=edition==='2014'?'PHB':'XPHB';
 const find=(name:string):Entry=>{const rows=entries.filter(e=>e.kind==='class'&&e.english===name&&e.source===source);if(rows.length!==1)throw Error('Unique exact recovery class required');return structuredClone(rows[0]);};
 const c=newCharacter(edition);delete c.runtime.slotCapacityReview;c.automation=newAutomationState();c.profile.enabledSources=[source];c.profile.optional.multiclass=true;
 for(const key of ['str','dex','con','int','wis','cha'] as const)c.abilities[key]=16;
 c.notes='Authored recovery sentinel';c.runtime.resources.manual={name:'Authored manual balance',max:9,current:2,locked:true};
 const owner={id:'recovery-class',entry:find('Paladin'),level:5,quantity:1,equipped:false};
 c.selections=[owner,{id:'recovery-noncaster',entry:find('Fighter'),level:1,quantity:1,equipped:false}];
 c.runtime.resources['spell-slot:1']={name:'Authored legacy automatic pool',max:3,current:1,automatic:true};c.spellSettings=structuredClone(spellState(c));c.spellSettings.slots={'1':{max:3,used:2}};
 syncAutoResources(c);return {c,entries,owner,key:'spell-slot:2',find};
}
