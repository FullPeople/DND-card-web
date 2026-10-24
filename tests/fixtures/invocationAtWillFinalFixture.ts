import {invocationData} from './invocationData';
import {normalizeData} from '../../src/data/catalog';
import {newCharacter} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {sync} from './invocationFixture';

// Independently authored expectations and identity metadata, never publisher prose.
export const finalAtWillInvocations=[
 {name:'邪魔活力',english:'Fiendish Vigor',spellName:'虚假生命',spell:'False Life',level:1,required:2,self:true,materialWaived:true},
 {name:'万形之主',english:'Master of Myriad Forms',spellName:'变身术',spell:'Alter Self',level:2,required:15,self:true,materialWaived:false},
 {name:'穹宇尽视',english:'Visions of Distant Realms',spellName:'秘法眼',spell:'Arcane Eye',level:4,required:15,self:false,materialWaived:false},
] as const;
export const invocationAtWillFinalData={
 class:invocationData.class,
 classFeature:invocationData.classFeature,
 optionalfeature:[...invocationData.optionalfeature,...finalAtWillInvocations.map(row=>({name:row.name,ENG_name:row.english,source:'PHB',featureType:['EI'],...(row.required>2?{prerequisite:[{level:{level:row.required,class:{ENG_name:'Warlock',name:'魔契师'}}}]}:{}),additionalSpells:[{innate:{_:[row.spellName]}}],entries:[]}))],
 spell:[...invocationData.spell,...finalAtWillInvocations.map(row=>({name:row.spellName,ENG_name:row.spell,source:'PHB',level:row.level}))],
};
export function invocationAtWillFinalFixture(level=15){
 const entries=normalizeData(structuredClone(invocationAtWillFinalData),'authored-final-atwill-invocations');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'warlock',entry:entries.find(e=>e.kind==='class')!,level,quantity:1,equipped:false}];sync(c,entries);
 return {c,entries,choiceId:'warlock:class-optional:0',find:(name:string)=>entries.find(e=>e.english===name)!};
}
