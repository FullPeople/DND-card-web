import {invocationData} from './invocationData';

// Source-checked, prose-free projections from tjliqy/5etools-cn at
// e2623b204ddbdf2bcfa8317acfc962de89c676e2. The independent UI expectations do not
// import the production evidence registry. Spell effects remain manual.
export const invocationAtwillFinalCases=[
 {name:'邪魔活力',english:'Fiendish Vigor',spell:'虚假生命',spellEnglish:'False Life',level:1,required:2,selfOnly:true,materialWaived:true,materialBoundary:'不消耗法术位和材料成分',manualBoundary:'不自动增加或替换临时生命值'},
 {name:'万形之主',english:'Master of Myriad Forms',spell:'变身术',spellEnglish:'Alter Self',level:2,required:15,selfOnly:true,materialWaived:false,materialBoundary:'本法术无材料成分',manualBoundary:'不自动改变形态或角色数值'},
 {name:'穹宇尽视',english:'Visions of Distant Realms',spell:'秘法眼',spellEnglish:'Arcane Eye',level:4,required:15,selfOnly:false,materialWaived:false,materialBoundary:'不豁免材料成分',manualBoundary:'不自动创建或移动传感器'},
] as const;
export const invocationAtwillFinalData={
 class:invocationData.class,
 classFeature:invocationData.classFeature,
 optionalfeature:[
  invocationData.optionalfeature.find(row=>row.ENG_name==='Eldritch Sight')!,
  ...invocationAtwillFinalCases.map(row=>({name:row.name,ENG_name:row.english,source:'PHB',featureType:['EI'],...(row.required>2?{prerequisite:[{level:{level:row.required,class:{ENG_name:'Warlock',name:'魔契师'}}}]}:{}),additionalSpells:[{innate:{_:[row.spell]}}],entries:[]})),
 ],
 spell:[
  invocationData.spell.find(row=>row.ENG_name==='Detect Magic')!,
  ...invocationAtwillFinalCases.map(row=>({name:row.spell,ENG_name:row.spellEnglish,source:'PHB',level:row.level})),
 ],
};
