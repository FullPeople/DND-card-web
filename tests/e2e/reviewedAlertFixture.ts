import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
// Authored metadata only. Actual browser acceptance replaces class and both
// Alert rows with hash-verified frozen originals; no authored fallback grants.
export const reviewedAlertData={
 class:[{name:'法师',ENG_name:'Wizard',source:'PHB',edition:'classic',hd:{faces:6},proficiency:['int','wis'],classFeatures:[4,8].map(level=>`属性值提升|法师|PHB|${level}`)}],
 classFeature:[4,8].map(level=>({name:'属性值提升',ENG_name:'Ability Score Improvement',source:'PHB',className:'法师',classSource:'PHB',level,entries:['{@5etools 专长|feats.html}']})),
 feat:[{name:'原创替代记录',ENG_name:'Authored Alert Replacement',source:'PHB',entries:[]}],
};
export function reviewedAlertFixture(dexterity=14){
 const c=newCharacter('2014'),raw=reviewedAlertData.class[0],entry:Entry={id:'kiwee:class:phb:wizard::::::',kind:'class',name:raw.name,english:raw.ENG_name,source:'PHB',edition:'2014',packId:'kiwee',revision:'authored-alert',entries:[],raw:{...raw,_category:'class'}};
 c.name='警觉交互验收';c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'alert-wizard',entry,level:4,quantity:1,equipped:false}];
 c.abilities={str:10,dex:dexterity,con:10,int:10,wis:10,cha:10};c.baseHp=30;c.sheetBonuses={hp:2,ac:1,speed:5};c.training={tools:'手工工具记录',languages:'手工语言记录'};c.proficiencies={athletics:true};c.expertise={athletics:true};c.skillBonuses={athletics:1};
 c.quickbarActions=[{id:'manual-alert',name:'手写攻击',attack:'+12',damage:'3d6+8'}];c.notes='保留手工敏捷、先攻、训练与消耗资源；突袭和不可见攻击者裁定仍手工。';c.runtime.hp=7;c.runtime.tempHp=3;c.runtime.resources['manual-alert']={name:'手工保留资源',max:7,current:2};return c;
}
