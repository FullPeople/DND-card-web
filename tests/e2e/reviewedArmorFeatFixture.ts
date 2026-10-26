import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';

// Authored prose and minimal source-qualified mechanical declarations only.
// Frozen-source tests separately verify the actual PHB records and hashes.
const text=['原创验收说明：训练授予与手工记录分离。',{type:'list',items:['原创验收项：只在玩家确认后计算所选属性；来源失效时保留选择，不覆盖历史字段。']}];
export const reviewedArmorFeatData={
 class:[{name:'战士',ENG_name:'Fighter',source:'PHB',edition:'classic',hd:{faces:10},proficiency:['str','con'],classFeatures:[4,6,8].map(level=>`属性值提升|战士|PHB|${level}`)}],
 classFeature:[4,6,8].map(level=>({name:'属性值提升',ENG_name:'Ability Score Improvement',source:'PHB',className:'战士',classSource:'PHB',level,entries:['{@5etools 专长|feats.html}']})),
 feat:[
  {name:'轻甲运用',ENG_name:'Lightly Armored',source:'PHB',page:167,ability:[{choose:{from:['str','dex'],amount:1}}],armorProficiencies:[{light:true}],entries:text},
  {name:'中甲运用',ENG_name:'Moderately Armored',source:'PHB',page:168,prerequisite:[{proficiency:[{armor:'light'}]}],ability:[{choose:{from:['str','dex'],amount:1}}],armorProficiencies:[{medium:true,shield:true}],entries:text},
  {name:'重甲运用',ENG_name:'Heavily Armored',source:'PHB',page:167,prerequisite:[{proficiency:[{armor:'medium'}]}],ability:[{str:1}],armorProficiencies:[{heavy:true}],entries:text},
  {name:'原创替代记录',ENG_name:'Authored Armor Replacement',source:'PHB',entries:[]},
 ],
};
export function reviewedArmorFeatFixture(){
 const raw=reviewedArmorFeatData.class[0],c=newCharacter('2014');
 const entry:Entry={id:'armor-fixture:fighter',kind:'class',name:raw.name,english:raw.ENG_name,source:raw.source,edition:'2014',packId:'authored-armor-feats',revision:'1',entries:[],raw:{...raw,_category:'class'}};
 c.name='护甲专长交互验收';c.automation=newAutomationState();c.profile.enabledSources=['PHB'];
 c.selections=[{id:'armor-fighter',entry,level:8,quantity:1,equipped:false},{id:'armor-shield',entry:{id:'armor-fixture:shield',kind:'item',name:'原创验收盾牌',english:'Authored Shield',source:'PHB',edition:'2014',packId:'authored-armor-feats',revision:'1',entries:[],raw:{_category:'item',type:'S',ac:2}},level:1,quantity:1,equipped:true}];
 c.abilities={str:13,dex:13,con:10,int:10,wis:10,cha:10};c.baseHp=40;c.sheetBonuses={hp:2,ac:1,speed:5};
 c.training={tools:'手工工具记录',languages:'手工语言记录'};c.notes='保留手工属性、训练、生命与已消耗资源。';
 c.runtime.hp=7;c.runtime.tempHp=3;c.runtime.resources['manual-armor-check']={name:'手工保留资源',max:7,current:2};
 return c;
}
