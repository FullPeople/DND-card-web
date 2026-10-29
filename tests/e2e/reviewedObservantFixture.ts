import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
// Only source-qualified mechanical metadata; every sentence below is authored.
export const reviewedObservantData={
 class:[{name:'法师',ENG_name:'Wizard',source:'PHB',edition:'classic',hd:{faces:6},proficiency:['int','wis'],classFeatures:[4,8].map(level=>`属性值提升|法师|PHB|${level}`)}],
 classFeature:[4,8].map(level=>({name:'属性值提升',ENG_name:'Ability Score Improvement',source:'PHB',className:'法师',classSource:'PHB',level,entries:['{@5etools 专长|feats.html}']})),
 feat:[{name:'观察力',ENG_name:'Observant',source:'PHB',page:168,reprintedAs:['观察力|XPHB'],ability:[{choose:{from:['int','wis'],amount:1}}],entries:['原创验收说明：选择智力或感知提升并分别确认手工值排除。',{type:'list',items:['原创边界：读唇条件和执行仍手工核对。','原创范围：两种指定被动值分别增加五，不改变主动检定。']}]},{name:'原创替代记录',ENG_name:'Authored Observant Replacement',source:'PHB',entries:[]},{name:'观察力',ENG_name:'Observant',source:'XPHB',page:205,category:'G',prerequisite:[{level:4,ability:[{int:13}]},{level:4,ability:[{wis:13}]}],ability:[{choose:{from:['int','wis']}}],skillProficiencies:[{choose:{from:['洞悉','调查','察觉']}}],entries:['原创现代版本说明；不授予PHB两项被动加值。',{ENG_name:'Keen Observer',name:'原创敏锐观察',type:'entries',entries:['原创现代技能选择说明。']},{ENG_name:'Quick Search',name:'原创快速搜索',type:'entries',entries:['原创现代搜索说明。']}]}],
};
export function reviewedObservantFixture(intelligence=19,wisdom=10){
 const c=newCharacter('2014'),raw=reviewedObservantData.class[0],entry:Entry={id:'kiwee:class:phb:wizard::::::',kind:'class',name:raw.name,english:raw.ENG_name,source:'PHB',edition:'2014',packId:'kiwee',revision:'authored-observant',entries:[],raw:{...raw,_category:'class'}};
 c.name='观察力交互验收';c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'observant-wizard',entry,level:4,quantity:1,equipped:false}];
 c.abilities={str:10,dex:10,con:10,int:intelligence,wis:wisdom,cha:10};c.baseHp=30;c.sheetBonuses={hp:2,ac:1,speed:5};c.training={tools:'手工工具记录',languages:'手工语言记录'};c.proficiencies={athletics:true};c.expertise={athletics:true};c.skillBonuses={athletics:1};
 c.quickbarActions=[{id:'manual-observant',name:'手写攻击',attack:'+12',damage:'3d6+8'}];c.notes='保留手工基础属性、技能、训练、被动调整、生命与消耗资源；读唇仍手工。';c.runtime.hp=7;c.runtime.tempHp=3;c.runtime.resources['manual-observant']={name:'手工保留资源',max:7,current:2};return c;
}
