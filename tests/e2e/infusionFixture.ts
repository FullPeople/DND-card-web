import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';

// Source-qualified identities with original minimal test data, no source prose.
export const infusionData={
 class:[{name:'奇械师',ENG_name:'Artificer',source:'TCE',edition:'classic',classFeatures:['物品注法|奇械师|TCE|2'],optionalfeatureProgression:[{name:'注法',featureType:['AI'],progression:[0,4,4,4,4,6,6,6,6,8,8,8,8,10,10,10,10,12,12,12]}]}],
 classFeature:[{name:'物品注法',ENG_name:'Infuse Item',source:'TCE',className:'奇械师',classSource:'TCE',level:2,entries:[]}],
 optionalfeature:[{name:'增强防御',ENG_name:'Enhanced Defense',source:'TCE',featureType:['AI'],prerequisite:[{item:['一套盔甲或一面盾牌']}],entries:[]}],
 item:[{name:'灌注测试皮甲',source:'PHB',type:'LA',ac:11,rarity:'none'},{name:'灌注测试盾牌',source:'PHB',type:'S',ac:2,rarity:'none'}],
};
export function infusionFixture(){
 const entries:Entry[]=Object.entries(infusionData).flatMap(([kind,rows])=>rows.map(raw=>({id:`infusion-fixture:${kind}:${raw.name}`,kind:kind==='classFeature'||kind==='optionalfeature'?'feature':kind as Entry['kind'],name:raw.name,english:'ENG_name' in raw?raw.ENG_name:raw.name,source:raw.source,edition:'2014',packId:'fixture',revision:'1',entries:[],raw:{...raw,_category:kind}}))),owner=entries.find(entry=>entry.kind==='class')!,entry=entries.find(entry=>entry.raw._category==='optionalfeature')!;
 const c=newCharacter('2014');c.name='灌注交互验收';c.automation=newAutomationState();c.profile.enabledSources=['TCE','PHB'];c.notes='保留手工记录';c.runtime.hp=3;c.sheetBonuses={ac:2};
 c.selections=[{id:'infusion-owner',entry:owner,level:2,quantity:1,equipped:false},...entries.filter(row=>row.kind==='item').map((entry,index)=>({id:`infusion-item-${index}`,entry,level:1,quantity:1,equipped:index===0}))];
 c.selections.push({id:'infusion-feature',entry:entries.find(row=>row.raw._category==='classFeature')!,level:2,quantity:1,equipped:false,parentId:'infusion-owner',grantKey:'ref:物品注法|奇械师|TCE|2'});
 const choiceId='infusion-owner:class-optional:0';c.answers[choiceId]=[entry.id];c.classChoiceSnapshots={[entry.id]:entry};
 return {c,entries,entry,choiceId};
}
