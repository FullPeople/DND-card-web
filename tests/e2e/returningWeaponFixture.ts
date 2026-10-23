import type {Entry} from '../../src/core/model';
import {enhancedWeaponFixture} from './enhancedWeaponFixture';

/** Source identity with original empty prose and authored test equipment. */
export function returningWeaponFixture(){
 const state=enhancedWeaponFixture(),{c,choiceId}=state;
 const entry:Entry={id:'returning-weapon-fixture:optionalfeature',kind:'feature',name:'回力武器',english:'Returning Weapon',source:'TCE',edition:'2014',packId:'fixture',revision:'1',entries:[],raw:{_category:'optionalfeature',name:'回力武器',ENG_name:'Returning Weapon',source:'TCE',featureType:['AI'],prerequisite:[{item:['一把具有投掷属性的简易武器或军用武器']}],entries:[]}};
 const dart:Entry={id:'returning-weapon-fixture:dart',kind:'item',name:'回力测试飞镖',english:'Authored Returning Dart',source:'PHB',edition:'2014',packId:'fixture',revision:'1',entries:[],raw:{_category:'item',name:'回力测试飞镖',source:'PHB',type:'R',weaponCategory:'simple',rarity:'none',dmg1:'1d4',property:['T','F'],dmgType:'P'}};
 c.name='回力武器交互验收';c.selections.push({id:'weapon-2',entry:dart,level:1,quantity:1,equipped:false});
 c.answers[choiceId]=[entry.id];c.classChoiceSnapshots={[entry.id]:entry};
 return {c,entry,choiceId,entries:[...state.entries,entry,dart],enhanced:state.entry,defense:state.defense};
}
