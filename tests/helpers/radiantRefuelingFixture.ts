import {infusionChargesFixture} from './infusionChargesFixture';
import {normalizeData} from '../../src/data/catalog';
export function radiantRefuelingFixture(name='Radiant Weapon',level=6){
 const f=infusionChargesFixture(name,level);
 const items=normalizeData({item:[{name:'Longsword',ENG_name:'Longsword',source:'PHB',type:'M',weaponCategory:'martial',rarity:'none',dmg1:'1d8',dmg2:'1d10',property:['V']},{name:'Signet Ring',ENG_name:'Signet Ring',source:'PHB',type:'G',rarity:'none'}]},'radiant-refueling-authored');
 f.c.selections.push(...items.map(entry=>({id:entry.english==='Longsword'?'weapon':'ring',entry,level:1,quantity:1,equipped:true,attuned:true})));
 f.targetId=name==='Radiant Weapon'?'weapon':'ring';return f;
}
