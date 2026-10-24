import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {infusionData} from './infusionFixture';

// Original fixture descriptions, retaining only the reviewed canonical identities.
export const attunedInfusionData={
 class:infusionData.class,classFeature:infusionData.classFeature,
 optionalfeature:[
  {name:'连发射击',ENG_name:'Repeating Shot',source:'TCE',featureType:['AI'],entries:[]},
  {name:'斥力盾牌',ENG_name:'Repulsion Shield',source:'TCE',featureType:['AI'],entries:[]},
  {name:'抗性护甲',ENG_name:'Resistant Armor',source:'TCE',featureType:['AI'],entries:[]},
 ],
 item:[
  {name:'原创抗性皮甲',source:'PHB',type:'LA',ac:11,rarity:'none'},
  {name:'原创斥力盾牌',source:'PHB',type:'S',ac:2,rarity:'none'},
  {name:'原创弹药短弓',source:'PHB',type:'R',weaponCategory:'simple',property:['A','2H'],dmg1:'1d6',dmgType:'P',rarity:'none'},
  {name:'原创备用盾牌',source:'PHB',type:'S',ac:2,rarity:'none'},
 ],
};
export function attunedInfusionFixture(learned=true){
 const entries:Entry[]=Object.entries(attunedInfusionData).flatMap(([kind,rows])=>rows.map(raw=>({id:`attuned-fixture:${kind}:${raw.name}`,kind:kind==='classFeature'||kind==='optionalfeature'?'feature':kind as Entry['kind'],name:raw.name,english:'ENG_name' in raw?raw.ENG_name:raw.name,source:raw.source,edition:'2014',packId:'fixture',revision:'1',entries:[],raw:{...raw,_category:kind}})));
 const c=newCharacter('2014');c.name='同调灌注交互验收';c.automation=newAutomationState();c.profile.enabledSources=['TCE','PHB'];c.notes='原创手写备注不变';c.runtime.hp=3;c.sheetBonuses={ac:2};
 c.selections=[{id:'attuned-owner',entry:entries.find(row=>row.kind==='class')!,level:6,quantity:1,equipped:false},...entries.filter(row=>row.kind==='item').map((entry,index)=>({id:`attuned-item-${index}`,entry,level:1,quantity:1,equipped:index<3,attuned:index<3}))];
 c.selections.push({id:'attuned-feature',entry:entries.find(row=>row.raw._category==='classFeature')!,level:2,quantity:1,equipped:false,parentId:'attuned-owner',grantKey:'ref:物品注法|奇械师|TCE|2'});
 const choiceId='attuned-owner:class-optional:0',options=entries.filter(row=>row.raw._category==='optionalfeature');
 c.answers[choiceId]=learned?options.map(row=>row.id):[];c.classChoiceSnapshots=Object.fromEntries(options.map(row=>[row.id,row]));
 return {c,entries,options,choiceId};
}
