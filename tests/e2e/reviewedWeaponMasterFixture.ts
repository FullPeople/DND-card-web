import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';

// Authored prose and source-qualified mechanical identities only. The separate
// frozen-input tests authenticate the original records; these drive real App UI.
export const reviewedWeaponMasterData={
 class:[{name:'法师',ENG_name:'Wizard',source:'PHB',edition:'classic',hd:{faces:6},proficiency:['int','wis'],startingProficiencies:{weapons:['dagger|PHB']},classFeatures:[4,8].map(level=>`属性值提升|法师|PHB|${level}`)}],
 classFeature:[4,8].map(level=>({name:'属性值提升',ENG_name:'Ability Score Improvement',source:'PHB',className:'法师',classSource:'PHB',level,entries:['{@5etools 专长|feats.html}']})),
 feat:[{name:'武器大师',ENG_name:'Weapon Master',source:'PHB',page:170,reprintedAs:['军用武器训练|XPHB'],ability:[{choose:{from:['str','dex'],amount:1}}],weaponProficiencies:[{choose:{fromFilter:'type=军用武器;寻常武器|miscellaneous=平凡的',count:4}}],entries:['原创验收说明：按实际来源选择武器训练。',{type:'list',items:['原创验收项：确认四种不同武器后派生，不改写手工字段。']}]},{name:'原创替代记录',ENG_name:'Authored Weapon Replacement',source:'PHB',entries:[]}],
 baseitem:[
  {"name":"长剑","ENG_name":"Longsword","source":"PHB","page":149,"edition":"classic","type":"M","rarity":"none","weight":3,"value":1500,"weaponCategory":"martial","property":["V"],"dmg1":"1d8","dmgType":"S","dmg2":"1d10","sword":true,"weapon":true},
  {"name":"长弓","ENG_name":"Longbow","source":"PHB","page":149,"edition":"classic","type":"R","rarity":"none","weight":2,"value":5000,"weaponCategory":"martial","property":["A","H","2H"],"range":"150/600","dmg1":"1d8","dmgType":"P","bow":true,"weapon":true,"ammoType":"箭|phb"},
  {"name":"矛","ENG_name":"Spear","source":"PHB","page":149,"edition":"classic","type":"M","rarity":"none","weight":3,"value":100,"weaponCategory":"simple","property":["T","V"],"range":"20/60","dmg1":"1d6","dmgType":"P","dmg2":"1d8","spear":true,"weapon":true},
  {"name":"捕网","ENG_name":"Net","source":"PHB","page":149,"edition":"classic","type":"R","rarity":"none","weight":3,"value":100,"weaponCategory":"martial","property":["S","T"],"range":"5/15","net":true,"weapon":true},
  {"name":"匕首","ENG_name":"Dagger","source":"PHB","page":149,"edition":"classic","type":"M","rarity":"none","weight":1,"value":200,"weaponCategory":"simple","property":["F","L","T"],"range":"20/60","dmg1":"1d4","dmgType":"P","dagger":true,"weapon":true},
  {"name":"手枪","ENG_name":"Pistol","source":"DMG","page":268,"edition":"classic","type":"R","rarity":"none","weight":3,"value":25000,"weaponCategory":"martial","age":"文艺复兴","property":["AF|DMG","LD"],"range":"30/90","dmg1":"1d10","dmgType":"P","firearm":true,"weapon":true,"ammoType":"文艺复兴子弹"}
 ],
};
export const weaponMasterReferences=['Longsword|PHB','Longbow|PHB','Spear|PHB','Net|PHB'];
export function reviewedWeaponMasterFixture(){
 const c=newCharacter('2014'),catalog:Entry[]=Object.entries(reviewedWeaponMasterData).flatMap(([category,rows])=>rows.map(raw=>({id:`kiwee:${category==='baseitem'?'item':category==='classFeature'?'feature':category}:${raw.source.toLowerCase()}:${encodeURIComponent(raw.ENG_name.toLowerCase())}::::::`,kind:category==='baseitem'?'item':category==='classFeature'?'feature':category as Entry['kind'],name:raw.name,english:raw.ENG_name,source:raw.source,edition:'2014',packId:'kiwee',revision:'authored-weapon-master','page':'page' in raw?raw.page:undefined,entries:'entries' in raw?raw.entries:[],raw:{...raw,_category:category}})));
 c.name='武器大师交互验收';c.automation=newAutomationState();c.profile.enabledSources=['PHB','DMG'];
 const entry=catalog.find(row=>row.kind==='class')!;
 c.selections=[{id:'weapon-master-wizard',entry,level:4,quantity:1,equipped:false},...catalog.filter(row=>row.kind==='item').map(entry=>({id:`weapon-master-${entry.english.toLowerCase()}`,entry,level:1,quantity:1,equipped:true}))];
 const sword=catalog.find(row=>row.english==='Longsword')!;
 const magic:Entry={...structuredClone(sword),id:'weapon-master:magic-sword',name:'原创魔法长剑',english:'Authored Magic Longsword',raw:{...sword.raw,name:'原创魔法长剑',ENG_name:'Authored Magic Longsword',_category:'item',baseItem:'longsword|phb',rarity:'uncommon',bonusWeapon:'+1'}};
 c.selections.push({id:'weapon-master-magic',entry:magic,level:1,quantity:1,equipped:true});
 c.abilities={str:13,dex:13,con:10,int:16,wis:10,cha:10};c.baseHp=30;c.sheetBonuses={hp:2,ac:1,speed:5};
 c.training={tools:'手工工具记录',languages:'手工语言记录'};c.notes='保留手工属性、武器、训练、生命与已消耗资源。';
 c.quickbarActions=[{id:'manual-weapon-master',name:'手写攻击',attack:'+12',damage:'3d6+8'}];
 c.runtime.hp=7;c.runtime.tempHp=3;c.runtime.resources['manual-weapon-master']={name:'手工保留资源',max:7,current:2};return c;
}
