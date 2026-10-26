import {invocationData} from './invocationData';

// Authored identity and structural metadata only, with no publisher rule prose.
// These expectations are independent of the production evidence registry.
export const invocationDualPaymentCases=[
 {name:'命运窃贼',english:'Thief of Five Fates',spell:'灾祸术',spellEnglish:'Bane',level:1,required:2},
 {name:'心灵泥沼',english:'Mire the Mind',spell:'缓慢术',spellEnglish:'Slow',level:3,required:5},
 {name:'凶兆符记',english:'Sign of Ill Omen',spell:'降咒',spellEnglish:'Bestow Curse',level:3,required:5},
 {name:'惑人低语',english:'Bewitching Whispers',spell:'强迫术',spellEnglish:'Compulsion',level:4,required:7},
 {name:'恐惧箴言',english:'Dreadful Word',spell:'困惑术',spellEnglish:'Confusion',level:4,required:7},
 {name:'重塑血肉',english:'Sculptor of Flesh',spell:'变形术',spellEnglish:'Polymorph',level:4,required:7},
 {name:'混沌手下',english:'Minions of Chaos',spell:'咒唤元素',spellEnglish:'Conjure Elemental',level:5,required:9},
] as const;
export const invocationDualPaymentData={
 class:invocationData.class.map(row=>({...row,classFeatures:['契约魔法|魔契师||1',...row.classFeatures]})),
 classFeature:[...invocationData.classFeature,{name:'契约魔法',ENG_name:'Pact Magic',source:'PHB',className:'魔契师',classSource:'PHB',level:1,entries:[]}],
 optionalfeature:invocationDualPaymentCases.map(row=>({name:row.name,ENG_name:row.english,source:'PHB',featureType:['EI'],...(row.required>2?{prerequisite:[{level:{level:row.required,class:{ENG_name:'Warlock',name:'魔契师'}}}]}:{}),additionalSpells:[{innate:{_:{daily:{'1e':[row.spell]}}}}],entries:[]})),
 spell:invocationDualPaymentCases.map(row=>({name:row.spell,ENG_name:row.spellEnglish,source:'PHB',level:row.level})),
};
