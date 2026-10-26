import type {Entry} from '../../src/core/model';
import {infusionFixture} from './infusionFixture';

/** Original test items and source-qualified rule identity, not copied prose. */
export function enhancedWeaponFixture(){
 const state=infusionFixture(),{c,choiceId}=state;
 const data={optionalfeature:[{name:'增强武器',ENG_name:'Enhanced Weapon',source:'TCE',featureType:['AI'],prerequisite:[{item:['一把简易武器或军用武器']}],entries:[]}],item:[
  {name:'灌注测试长矛',source:'PHB',type:'M',weaponCategory:'simple',rarity:'none',dmg1:'1d6',dmg2:'1d8',property:['T','V'],dmgType:'P'},
  {name:'灌注测试长弓',source:'PHB',type:'R',weaponCategory:'martial',rarity:'none',dmg1:'1d8',property:['A','2H'],dmgType:'P'},
 ]};
 const additions:Entry[]=Object.entries(data).flatMap(([kind,rows])=>rows.map(raw=>({id:`enhanced-weapon-fixture:${kind}:${raw.name}`,kind:kind==='optionalfeature'?'feature':kind as Entry['kind'],name:raw.name,english:'ENG_name' in raw?raw.ENG_name:raw.name,source:raw.source,edition:'2014',packId:'fixture',revision:'1',entries:[],raw:{...raw,_category:kind}})));
 const entry=additions.find(row=>row.raw._category==='optionalfeature')!;
 c.name='增强武器交互验收';c.abilities.str=16;c.abilities.dex=14;c.training={weapons:'简易武器、军用武器'};
 c.selections.push(...additions.filter(row=>row.kind==='item').map((entry,index)=>({id:`weapon-${index}`,entry,level:1,quantity:1,equipped:index===0})));
 c.answers[choiceId]=[entry.id];c.classChoiceSnapshots={[entry.id]:entry};
 c.quickbarActions=[{id:'manual',name:'手写攻击',attack:'+12',damage:'3d6+8'}];
 return {c,choiceId,entry,entries:[...state.entries,...additions],defense:state.entry};
}
