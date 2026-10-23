import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';

// Minimal source-qualified metadata and authored test content. No publisher prose.
const abilities=['str','dex','con','int','wis','cha'];
export const asiAllocationData={
 class:[{name:'战士',ENG_name:'Fighter',source:'XPHB',edition:'one',hd:{faces:10},classFeatures:[4,6].map(level=>`属性值提升|战士|XPHB|${level}`)}],
 classFeature:[4,6].map(level=>({name:'属性值提升',ENG_name:'Ability Score Improvement',source:'XPHB',className:'战士',classSource:'XPHB',level,entries:['{@feat 属性值提升|XPHB}']})),
 feat:[{name:'属性值提升',ENG_name:'Ability Score Improvement',source:'XPHB',category:'G',prerequisite:[{level:4}],repeatable:true,ability:[{choose:{from:abilities,amount:2},hidden:true},{choose:{from:abilities,count:2},hidden:true}],entries:[]},
 {name:'原创替代记录',ENG_name:'Authored Replacement Record',source:'XPHB',category:'G',prerequisite:[{level:4}],entries:[]}],
};
export function asiAllocationFixture(){
 const raw=asiAllocationData.class[0];
 const entry:Entry={id:'asi-fixture:fighter',kind:'class',name:raw.name,english:raw.ENG_name,source:raw.source,edition:'2024',packId:'fixture',revision:'1',entries:[],raw:{...raw,_category:'class'}};
 const c=newCharacter('2024');c.name='属性提升交互验收';c.automation=newAutomationState();c.profile.enabledSources=['XPHB'];
 c.selections=[{id:'asi-fighter',entry,level:6,quantity:1,equipped:false}];
 c.abilities={str:16,dex:14,con:19,int:10,wis:12,cha:8};c.notes='保留手写属性与笔记';c.runtime.hp=3;c.sheetBonuses={ac:2};
 return c;
}
