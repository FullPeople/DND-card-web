import {invocationData} from './invocationData';
import {normalizeData} from '../../src/data/catalog';
import {newCharacter} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {sync} from './invocationFixture';

// Original metadata fixtures only. Exact frozen upstream inputs are tested
// separately; this file contains no publisher spell or invocation prose.
export const level9Invocations=[
 {name:'超凡跳跃',english:'Otherworldly Leap',spellName:'跳跃术',spell:'Jump',level:1,self:true},
 {name:'星移步法',english:'Ascendant Step',spellName:'浮空术',spell:'Levitate',level:2,self:true},
 {name:'坟墓低语',english:'Whispers of the Grave',spellName:'死者交谈',spell:'Speak with Dead',level:3,self:false},
] as const;
export const level9Prerequisite=[{level:{level:9,class:{ENG_name:'Warlock',name:'魔契师'}}}];
export function invocationLevel9Fixture(level=9){
 const data=structuredClone(invocationData);
 const entries=normalizeData({...data,optionalfeature:[...data.optionalfeature,...level9Invocations.map(row=>({name:row.name,ENG_name:row.english,source:'PHB',featureType:['EI'],prerequisite:structuredClone(level9Prerequisite),additionalSpells:[{innate:{_:[row.spellName]}}],entries:[]}))],spell:[...data.spell,...level9Invocations.map(row=>({name:row.spellName,ENG_name:row.spell,source:'PHB',level:row.level}))]},'authored-level9-invocations');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'warlock',entry:entries.find(e=>e.kind==='class')!,level,quantity:1,equipped:false}];sync(c,entries);
 return {c,entries,choiceId:'warlock:class-optional:0',find:(name:string)=>entries.find(e=>e.english===name)!};
}
