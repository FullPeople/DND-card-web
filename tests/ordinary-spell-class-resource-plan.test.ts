import {expect,it} from 'vitest';
import {multiclassSlotEntries,runMulticlassSourceCheck} from './helpers/multiclassSlotSources';
import {newCharacter} from '../src/core/model';
import {classResourcePlan} from '../src/core/classResources';
const padded=(row:number[])=>Array.from({length:9},(_,i)=>row[i]||0);

it('the actual previous and current class capacities are independent of missing or spent runtime mirrors',()=>runMulticlassSourceCheck(1,()=>{
 const entries=multiclassSlotEntries(),pick=(name:string)=>{const rows=entries.filter(e=>e.kind==='class'&&e.source==='PHB'&&e.english===name);if(rows.length!==1)throw Error('Unique exact class required');return rows[0];};
 const c=newCharacter('2014');c.profile.enabledSources=['PHB'];c.selections=[{id:'plan-main',entry:pick('Paladin'),level:5,quantity:1,equipped:false},{id:'plan-other',entry:pick('Fighter'),level:1,quantity:1,equipped:false}];
 c.runtime.resources['spell-slot:1']={max:3,current:0,automatic:true};const original=structuredClone(c),plan=classResourcePlan(c);
 expect(padded(plan.slots)).toEqual(padded([4,2]));expect(plan.dice).toEqual({'10':6});expect(c).toEqual(original);
 const previous=structuredClone(c);previous.selections[0].level=4;expect(padded(classResourcePlan(previous).slots)).toEqual(padded([3]));
 delete c.runtime.resources['spell-slot:1'];expect(padded(classResourcePlan(c).slots)).toEqual(padded([4,2]));
 plan.slots[0]=99;expect(padded(classResourcePlan(c).slots)).toEqual(padded([4,2]));expect(c.selections).toEqual(original.selections);
}));
