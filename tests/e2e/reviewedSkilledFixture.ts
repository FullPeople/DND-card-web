import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
// Authored prose with the reviewed source-qualified mechanical identity only.
// Real frozen-source tests authenticate the full PHB record and target domain.
export const reviewedSkilledData={
 class:[{name:'法师',ENG_name:'Wizard',source:'PHB',edition:'classic',hd:{faces:6},proficiency:['int','wis'],classFeatures:[4,8].map(level=>`属性值提升|法师|PHB|${level}`)}],
 classFeature:[4,8].map(level=>({name:'属性值提升',ENG_name:'Ability Score Improvement',source:'PHB',className:'法师',classSource:'PHB',level,entries:['{@5etools 专长|feats.html}']})),
 feat:[{name:'熟习',ENG_name:'Skilled',source:'PHB',page:170,reprintedAs:['熟习|XPHB'],skillToolLanguageProficiencies:[{choose:[{from:['任意技能','任意工具'],count:3}]}],entries:['原创验收说明：混合选择三个技能或工具熟练并明确确认，不改写手工值。']},{name:'原创替代记录',ENG_name:'Authored Skilled Replacement',source:'PHB',entries:[]}],
};
export const skilledValues=['skill:perception',"tool:Thieves' Tools|PHB",'tool:Vehicles (Land)|PHB'];
export function reviewedSkilledFixture(){
 const c=newCharacter('2014'),raw=reviewedSkilledData.class[0],entry:Entry={id:'kiwee:class:phb:wizard::::::',kind:'class',name:raw.name,english:raw.ENG_name,source:'PHB',edition:'2014',packId:'kiwee',revision:'authored-skilled',entries:[],raw:{...raw,_category:'class'}};
 c.name='熟习交互验收';c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'skilled-wizard',entry,level:4,quantity:1,equipped:false}];
 c.abilities={str:10,dex:10,con:10,int:10,wis:10,cha:10};c.baseHp=30;c.sheetBonuses={hp:2,ac:1,speed:5};c.training={languages:'手工语言记录'};c.proficiencies={athletics:true};c.expertise={athletics:true};c.skillBonuses={athletics:1};
 c.quickbarActions=[{id:'manual-skilled',name:'手写攻击',attack:'+12',damage:'3d6+8'}];c.notes='保留手工属性、技能、专精、训练、生命与已消耗资源。';c.runtime.hp=7;c.runtime.tempHp=3;c.runtime.resources['manual-skilled']={name:'手工保留资源',max:7,current:2};return c;
}
