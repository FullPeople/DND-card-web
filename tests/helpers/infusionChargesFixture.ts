import {newCharacter} from '../../src/core/model';
import {normalizeData} from '../../src/data/catalog';
import {newAutomationState} from '../../src/core/automation/state';

/** Deliberately authored mechanics fixture; exact frozen-source tests are separate. */
export function infusionChargesFixture(name='Repulsion Shield',level=name==='Mind Sharpener'?2:6){
 const entries=normalizeData({class:[{name:'奇械师',ENG_name:'Artificer',source:'TCE',edition:'classic',classFeatures:['物品注法|奇械师|TCE|2'],optionalfeatureProgression:[{name:'注法',featureType:['AI'],progression:[0,4,4,4,4,6,6,6,6,8,8,8,8,10,10,10,10,12,12,12]}]}],classFeature:[{name:'物品注法',ENG_name:'Infuse Item',source:'TCE',className:'奇械师',classSource:'TCE',level:2,entries:[]}],optionalfeature:[{name,ENG_name:name,source:'TCE',featureType:['AI'],entries:[]}],item:[{name:'皮甲',ENG_name:'Leather Armor',source:'PHB',type:'LA',ac:11,rarity:'none'},{name:'盾牌',ENG_name:'Shield',source:'PHB',type:'S',ac:2,rarity:'none'},{name:'长袍',ENG_name:'Robes',source:'PHB',type:'G',rarity:'none'}]},'authored-charge');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['TCE','PHB'];
 const infusion=entries.find(e=>e.raw._category==='optionalfeature')!,choiceId='owner:class-optional:0';
 c.selections=[{id:'owner',entry:entries.find(e=>e.kind==='class')!,level,quantity:1,equipped:false},{id:'infuse-feature',entry:entries.find(e=>e.raw._category==='classFeature')!,parentId:'owner',grantKey:'ref:物品注法|奇械师|TCE|2',level:2,quantity:1,equipped:false},...entries.filter(e=>e.kind==='item').map((entry,i)=>({id:['armor','shield','robes'][i],entry,level:1,quantity:1,equipped:i<2,attuned:i===1}))];
 c.answers[choiceId]=[infusion.id];c.classChoiceSnapshots={[infusion.id]:infusion};
 return {c,infusion,choiceId,entries,targetId:name==='Mind Sharpener'?'armor':'shield'};
}
