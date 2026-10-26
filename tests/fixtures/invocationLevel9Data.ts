import {invocationData} from './invocationData';

// Authored identity/shape metadata, not copied spell or invocation rule prose.
// Expectations are separate from the production evidence so a changed adapter
// cannot silently change what these player-facing tests assert.
export const invocationLevel9Cases=[
 {name:'超凡跳跃',english:'Otherworldly Leap',spell:'跳跃术',spellEnglish:'Jump',level:1,selfOnly:true,manualBoundary:'跳跃距离与持续时间仍手动处理'},
 {name:'星移步法',english:'Ascendant Step',spell:'浮空术',spellEnglish:'Levitate',level:2,selfOnly:true,manualBoundary:'升降移动、专注与持续时间仍手动处理'},
 {name:'坟墓低语',english:'Whispers of the Grave',spell:'死者交谈',spellEnglish:'Speak with Dead',level:3,selfOnly:false,manualBoundary:'尸体条件、目标、十日限制、提问、回答与持续时间仍手动处理'},
] as const;

export const invocationLevel9Data={
 class:invocationData.class,
 classFeature:invocationData.classFeature,
 optionalfeature:[
  // A previously supported, ungated choice provides a real replacement target.
  invocationData.optionalfeature.find(row=>row.ENG_name==='Eldritch Sight')!,
  ...invocationLevel9Cases.map(row=>({name:row.name,ENG_name:row.english,source:'PHB',featureType:['EI'],prerequisite:[{level:{level:9,class:{ENG_name:'Warlock',name:'魔契师'}}}],additionalSpells:[{innate:{_:[row.spell]}}],entries:[]})),
 ],
 spell:[
  invocationData.spell.find(row=>row.ENG_name==='Detect Magic')!,
  ...invocationLevel9Cases.map(row=>({name:row.spell,ENG_name:row.spellEnglish,source:'PHB',level:row.level})),
 ],
};
