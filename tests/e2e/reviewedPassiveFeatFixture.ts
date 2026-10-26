import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';

// Source-qualified mechanical metadata with authored/empty prose only.
// Exact upstream bytes and declarations are verified in the frozen-source tests.
const abilities=['str','dex','con','int','wis','cha'];
export const reviewedPassiveFeatData={
 class:[{name:'战士',ENG_name:'Fighter',source:'PHB',edition:'classic',hd:{faces:10},proficiency:['str','con'],classFeatures:[4,6].map(level=>`属性值提升|战士|PHB|${level}`)}],
 classFeature:[4,6].map(level=>({name:'属性值提升',ENG_name:'Ability Score Improvement',source:'PHB',className:'战士',classSource:'PHB',level,entries:['{@5etools 专长|feats.html}']})),
 feat:[
  {name:'健壮',ENG_name:'Tough',source:'PHB',page:170,entries:['原创验收说明：检查玩家确认后的派生生命值，不改写历史手工字段。']},
  {name:'强健',ENG_name:'Resilient',source:'PHB',page:168,ability:[{choose:{from:abilities,amount:1}}],savingThrowProficiencies:[{choose:{from:abilities}}],entries:['原创验收说明：检查所选属性与豁免的共同归属。',{type:'list',items:['原创验收项：保留手工字段、旧覆盖及已消耗资源。']}]},
  {name:'原创替代记录',ENG_name:'Authored Replacement Record',source:'PHB',entries:[]},
 ],
};
export function reviewedPassiveFeatFixture(){
 const raw=reviewedPassiveFeatData.class[0],c=newCharacter('2014');
 const entry:Entry={id:'passive-fixture:fighter',kind:'class',name:raw.name,english:raw.ENG_name,source:raw.source,edition:'2014',packId:'authored-passive-feats',revision:'1',entries:[],raw:{...raw,_category:'class'}};
 c.name='被动专长交互验收';c.automation=newAutomationState();c.profile.enabledSources=['PHB'];
 c.selections=[{id:'passive-fighter',entry,level:4,quantity:1,equipped:false}];
 c.abilities={str:20,dex:13,con:10,int:22,wis:12,cha:8};
 c.notes='保留手写属性、生命与豁免；不把重复历史加值再加一次。';
 c.baseHp=0;c.sheetBonuses={ac:2,speed:5};c.saveBonuses={cha:1};c.proficiencies={'save:wis':false};
 c.runtime.hp=7;c.runtime.tempHp=3;c.runtime.resources['manual-passive-check']={name:'手工保留资源',max:7,current:2};
 return c;
}
