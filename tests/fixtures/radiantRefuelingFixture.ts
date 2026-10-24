import {newCharacter} from '../../src/core/model';
import {normalizeData} from '../../src/data/catalog';
import {syncFeatures} from '../../src/core/sheet';
import {newAutomationState} from '../../src/core/automation/state';
import {sheetChoices,setSheetChoiceSlot} from '../../src/core/automation/choices';
import {radiantRefuelingData} from './radiantRefuelingData';
export function radiantRefuelingFixture(english='Radiant Weapon',warlockLevel=0){
 const entries=normalizeData(radiantRefuelingData,'authored-radiant-refueling'),c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['TCE','PHB'];c.name='光耀与法力恢复交互验收';c.notes='手工数据不得覆盖';c.runtime.resources['manual-ring']={name:'手写法力恢复戒指',current:2,max:7};
 const item=(id:string,english:string)=>({id,entry:entries.find(row=>row.english===english)!,level:1,quantity:1,equipped:true,attuned:true});
 c.selections=[{id:'artificer',entry:entries.find(row=>row.kind==='class'&&row.english==='Artificer')!,level:6,quantity:1,equipped:false},item('sword-a','Longsword'),item('sword-b','Longsword'),item('ring-a','Signet Ring'),item('ring-b','Signet Ring'),item('robes','Robes')];
 if(warlockLevel)c.selections.push({id:'warlock',entry:entries.find(row=>row.kind==='class'&&row.english==='Warlock')!,level:warlockLevel,quantity:1,equipped:false});
 syncFeatures(c,entries);const choice=sheetChoices(c,entries).find(row=>row.id==='artificer:class-optional:0')!,option=choice.options.find(row=>row.entry.english===english)!;setSheetChoiceSlot(c,choice.id,0,option.value,entries);return {c,entry:option.entry,entries,choiceId:choice.id};
}
