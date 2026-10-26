import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
// Source-qualified identities/mechanical metadata only; prose is authored.
// Frozen-source tests separately authenticate the publisher records.
export const linguistLanguageData=[
 {
  "ENG_name": "Abyssal",
  "name": "深渊语",
  "type": "exotic",
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "{@filter 恶魔|bestiary|tag=恶魔}"
  ],
  "script": "炼狱语"
 },
 {
  "ENG_name": "Celestial",
  "name": "天界语",
  "type": "exotic",
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "{@filter 天族|bestiary|type=celestial}"
  ],
  "script": "天界语"
 },
 {
  "ENG_name": "Common",
  "name": "通用语",
  "type": "standard",
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "{@filter 人类|bestiary|type=humanoid|tag=任意种族;人类}"
  ],
  "script": "通用语",
  "fonts": [
   "fonts/languages/PHB/Human/Harpers.ttf"
  ]
 },
 {
  "ENG_name": "Deep Speech",
  "name": "深潜语",
  "type": "exotic",
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "{@creature 夺心魔||夺心魔们}",
   "{@creature 眼魔||眼魔}"
  ],
  "script": "none"
 },
 {
  "ENG_name": "Draconic",
  "name": "龙语",
  "type": "exotic",
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "{@filter 龙|bestiary|type=dragon}",
   "{@race 龙裔}"
  ],
  "script": "龙语"
 },
 {
  "ENG_name": "Druidic",
  "name": "德鲁伊语",
  "type": "secret",
  "source": "PHB",
  "page": 64,
  "typicalSpeakers": [
   "{@class 德鲁伊||德鲁伊}/{@creature 德鲁伊||德鲁伊}",
   "{@creature 树人||树人}"
  ]
 },
 {
  "ENG_name": "Dwarvish",
  "name": "矮人语",
  "type": "standard",
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "{@filter 矮人|bestiary|type=humanoid|tag=任意种族;矮人}"
  ],
  "script": "矮人语"
 },
 {
  "ENG_name": "Elvish",
  "name": "精灵语",
  "type": "standard",
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "{@filter 精灵|bestiary|type=humanoid|tag=任意种族;精灵}"
  ],
  "script": "精灵语"
 },
 {
  "ENG_name": "Giant",
  "name": "巨人语",
  "type": "standard",
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "{@creature 食人魔||食人魔}",
   "{@filter 巨人|bestiary|type=giant}"
  ],
  "script": "矮人语"
 },
 {
  "ENG_name": "Gnomish",
  "name": "侏儒语",
  "type": "standard",
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "{@filter 侏儒|bestiary|type=humanoid|tag=任意种族;侏儒}"
  ],
  "script": "矮人语"
 },
 {
  "ENG_name": "Goblin",
  "name": "地精语",
  "type": "standard",
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "{@filter 类地精|bestiary|tag=类地精}"
  ],
  "script": "矮人语"
 },
 {
  "ENG_name": "Halfling",
  "name": "半身人语",
  "type": "standard",
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "{@filter 半身人|bestiary|type=humanoid|tag=任意种族;半身人语}"
  ],
  "script": "通用语"
 },
 {
  "ENG_name": "Infernal",
  "name": "炼狱语",
  "type": "exotic",
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "{@filter 魔鬼|bestiary|tag=魔鬼}"
  ],
  "script": "炼狱语"
 },
 {
  "ENG_name": "Orc",
  "name": "兽人语",
  "type": "standard",
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "{@filter 兽人|bestiary|tag=兽人语}"
  ],
  "script": "矮人语"
 },
 {
  "ENG_name": "Primordial",
  "name": "原初语",
  "type": "exotic",
  "dialects": [
   "气族语",
   "水族语",
   "火族语",
   "土族语"
  ],
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "{@filter 元素|bestiary|type=elemental}"
  ],
  "script": "矮人语"
 },
 {
  "ENG_name": "Sylvan",
  "name": "木族语",
  "type": "exotic",
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "{@filter 精类生物|bestiary|type=fey}"
  ],
  "script": "精灵语"
 },
 {
  "ENG_name": "Thieves' Cant",
  "name": "盗贼黑话",
  "type": "secret",
  "source": "PHB",
  "page": 94,
  "typicalSpeakers": [
   "{@creature 刺客||刺客}",
   "{@class 游荡者||游荡者}"
  ]
 },
 {
  "ENG_name": "Undercommon",
  "name": "地底通用语",
  "type": "exotic",
  "source": "PHB",
  "page": 123,
  "typicalSpeakers": [
   "幽暗地域商人"
  ],
  "script": "精灵语"
 }
];
export const linguistNeighborLanguages=[
 {name:'深渊语',ENG_name:'Abyssal',source:'GGR',page:9,type:'standard'},
 {name:'深渊语',ENG_name:'Abyssal',source:'XPHB',page:37,type:'rare',edition:'one'},
 {name:'吉斯语',ENG_name:'Gith',source:'MM',page:158,type:'exotic',dialects:['吉斯洋基语','吉斯泽莱语']},
 {name:'气族语',ENG_name:'Auran',source:'MM',page:12,type:'exotic'},
];
export const reviewedLinguistData={
 class:[{name:'法师',ENG_name:'Wizard',source:'PHB',edition:'classic',hd:{faces:6},proficiency:['int','wis'],classFeatures:[4,8].map(level=>`属性值提升|法师|PHB|${level}`)}],
 classFeature:[4,8].map(level=>({name:'属性值提升',ENG_name:'Ability Score Improvement',source:'PHB',className:'法师',classSource:'PHB',level,entries:['{@5etools 专长|feats.html}']})),
 feat:[{name:'语言学家',ENG_name:'Linguist',source:'PHB',page:167,ability:[{int:1}],languageProficiencies:[{any:3}],entries:['原创验收说明：固定智力提升与三个语言种类需分别核对。',{type:'list',items:['原创语言选择说明。','原创密码手工处理说明。']}]},{name:'原创替代记录',ENG_name:'Authored Linguist Replacement',source:'PHB',entries:[]}],
 language:[...linguistLanguageData,...linguistNeighborLanguages],
};
export const linguistValues=['Dwarvish|PHB','Elvish|PHB','Giant|PHB'];
export const linguistRestrictedValues=['Druidic|PHB',"Thieves' Cant|PHB",'Primordial|PHB'];
export function reviewedLinguistFixture(intelligence=19){
 const c=newCharacter('2014'),raw=reviewedLinguistData.class[0],entry:Entry={id:'kiwee:class:phb:wizard::::::',kind:'class',name:raw.name,english:raw.ENG_name,source:'PHB',edition:'2014',packId:'kiwee',revision:'authored-linguist',entries:[],raw:{...raw,_category:'class'}};
 c.name='语言学家交互验收';c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.selections=[{id:'linguist-wizard',entry,level:4,quantity:1,equipped:false}];
 c.abilities={str:10,dex:10,con:10,int:intelligence,wis:10,cha:10};c.baseHp=30;c.sheetBonuses={hp:2,ac:1,speed:5};c.training={tools:'手工工具记录'};c.proficiencies={athletics:true};c.expertise={athletics:true};c.skillBonuses={athletics:1};
 c.quickbarActions=[{id:'manual-linguist',name:'手写攻击',attack:'+12',damage:'3d6+8'}];c.notes='保留手工基础属性、训练、生命与已消耗资源。密码创建、教学、破解和魔法解读仍手工。';c.runtime.hp=7;c.runtime.tempHp=3;c.runtime.resources['manual-linguist']={name:'手工保留资源',max:7,current:2};return c;
}
