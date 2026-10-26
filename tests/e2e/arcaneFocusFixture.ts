import type {Entry} from '../../src/core/model';
import {infusionFixture} from './infusionFixture';

/** Reviewed source identities with original test labels and no source prose. */
export function arcaneFocusFixture(){
 const state=infusionFixture(),{c,choiceId}=state;
 const entry:Entry={id:'arcane-focus-fixture:optionalfeature',kind:'feature',name:'增强奥术法器',english:'Enhanced Arcane Focus',source:'TCE',edition:'2014',packId:'fixture',revision:'1',entries:[],raw:{_category:'optionalfeature',name:'增强奥术法器',ENG_name:'Enhanced Arcane Focus',source:'TCE',featureType:['AI'],entries:[]}};
 const items:Entry[]=['Rod','Staff','Wand','Crystal'].map((english,index)=>({id:`arcane-focus-fixture:item-${index}`,kind:'item',name:['法器测试权杖','法器测试法杖','法器测试魔杖','法器测试水晶'][index],english,source:'PHB',edition:'2014',packId:'fixture',revision:'1',entries:[],raw:{_category:'item',name:english,ENG_name:english,source:'PHB',type:'SCF',scfType:'arcane',rarity:'none'}}));
 c.name='增强法器交互验收';c.abilities.int=16;c.abilities.wis=14;
 c.spellSettings={mode:'prepared',ability:'int',abilityOverride:true,capacity:0,attackBonus:2,dcBonus:3,prepared:[],slots:{}};
 c.selections.find(row=>row.id==='infusion-owner')!.entry.raw.spellcastingAbility='int';
 c.selections.push(...items.map((entry,index)=>({id:`focus-${index}`,entry,level:1,quantity:1,equipped:index===0,attuned:index===0})));
 c.answers[choiceId]=[entry.id];c.classChoiceSnapshots={[entry.id]:entry};
 return {c,choiceId,entry,entries:[...state.entries,entry,...items],defense:state.entry};
}
