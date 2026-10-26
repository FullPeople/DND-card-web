import {invocationData} from './invocationData';
import {normalizeData} from '../../src/data/catalog';
import {newCharacter} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {sync} from './invocationFixture';
import {syncAutoResources} from '../../src/core/resources';

// Authored metadata only. Frozen upstream identities and hashes are verified separately.
export const dualInvocations=[
 {name:'惑人低语',english:'Bewitching Whispers',spellName:'强迫术',spell:'Compulsion',level:4,required:7},
 {name:'恐惧箴言',english:'Dreadful Word',spellName:'困惑术',spell:'Confusion',level:4,required:7},
 {name:'混沌手下',english:'Minions of Chaos',spellName:'咒唤元素',spell:'Conjure Elemental',level:5,required:9},
 {name:'心灵泥沼',english:'Mire the Mind',spellName:'缓慢术',spell:'Slow',level:3,required:5},
 {name:'重塑血肉',english:'Sculptor of Flesh',spellName:'变形术',spell:'Polymorph',level:4,required:7},
 {name:'凶兆符记',english:'Sign of Ill Omen',spellName:'降咒',spell:'Bestow Curse',level:3,required:5},
 {name:'命运窃贼',english:'Thief of Five Fates',spellName:'灾祸术',spell:'Bane',level:1,required:2},
] as const;
export function invocationDualPaymentFixture(level=9){
 const data=structuredClone(invocationData);
 data.class[0].classFeatures.unshift('契约魔法|魔契师||1');
 data.classFeature.push({name:'契约魔法',ENG_name:'Pact Magic',source:'PHB',className:'魔契师',classSource:'PHB',level:1,entries:[]});
 const entries=normalizeData({...data,optionalfeature:[...data.optionalfeature,...dualInvocations.map(row=>({name:row.name,ENG_name:row.english,source:'PHB',featureType:['EI'],...(row.required>2?{prerequisite:[{level:{level:row.required,class:{ENG_name:'Warlock',name:'魔契师'}}}]}:{}),additionalSpells:[{innate:{_:{daily:{'1e':[row.spellName]}}}}],entries:[]}))],spell:[...data.spell,...dualInvocations.map(row=>({name:row.spellName,ENG_name:row.spell,source:'PHB',level:row.level}))]},'authored-dual-payment-invocations');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'warlock',entry:entries.find(e=>e.kind==='class')!,level,quantity:1,equipped:false}];sync(c,entries);syncAutoResources(c);
 return {c,entries,choiceId:'warlock:class-optional:0',find:(name:string)=>entries.find(e=>e.english===name)!};
}
