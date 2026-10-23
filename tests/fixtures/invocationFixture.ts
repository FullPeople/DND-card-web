import {invocationData} from './invocationData';
import {normalizeData} from '../../src/data/catalog';
import {newCharacter,type Character,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {setSheetChoiceSlot} from '../../src/core/automation/choices';
import {syncFeatures} from '../../src/core/sheet';
import {syncSourceSpells} from '../../src/core/automation/sourceSpells';

// Authored metadata fixtures reproduce the source-qualified reviewed shape;
// these are not a substitute for the separately hash-checked frozen replay.
export function invocationFixture(){
 const entries=normalizeData(structuredClone(invocationData),'authored-invocations');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'warlock',entry:entries.find(e=>e.kind==='class')!,level:5,quantity:1,equipped:false}];syncFeatures(c,entries);
 return {c,entries,choiceId:'warlock:class-optional:0',find:(name:string)=>entries.find(e=>e.english===name)!};
}
export function sync(c:Character,entries:Entry[]){syncFeatures(c,entries);syncSourceSpells(c,entries);}
export function learn(c:Character,entries:Entry[],entry:Entry,slot=0){setSheetChoiceSlot(c,'warlock:class-optional:0',slot,entry.id,entries);sync(c,entries);}
