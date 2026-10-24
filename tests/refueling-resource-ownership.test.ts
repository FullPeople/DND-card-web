import {it,expect} from 'vitest';
import {radiantRefuelingFixture} from './fixtures/radiantRefuelingFixture';
import {syncAutoResources,setResource} from '../src/core/resources';
import {reconciledCardView} from '../src/platform/cardViewReconciliation';
import {entryNameIndex} from '../src/core/entryNameIndex';
import {validateCharacter} from '../src/core/validation';
function fixture(flag:'manual'|'missing'|'locked'='manual'){
 const f=radiantRefuelingFixture('Spell-Refueling Ring',3);f.c=structuredClone(f.c);
 f.c.spellSettings={mode:'prepared',ability:'int',capacity:3,attackBonus:0,dcBonus:0,prepared:[],slots:{'1':{max:9,used:7},'9':{max:5,used:4}}};
 for(const key of ['spell-slot:1','spell-slot:9','pact-slot:2','pact-slot:1'])f.c.runtime.resources[key]={name:'Player counter',current:2,max:9,type:'bar',...(flag==='manual'?{automatic:false}:flag==='locked'?{automatic:true,locked:true}:{})};
 return f;
}
it.each(['manual','missing','locked'] as const)('never adopts or rewrites existing %s ordinary/pact pools and mirrors',flag=>{
 const {c}=fixture(flag),pools=structuredClone(c.runtime.resources),mirrors=structuredClone(c.spellSettings!.slots);syncAutoResources(c);
 for(const [key,pool] of Object.entries(pools))expect(c.runtime.resources[key]).toEqual(pool);
 for(const [key,mirror] of Object.entries(mirrors))expect(c.spellSettings!.slots[key]).toEqual(mirror);
});
it.each(['manual','missing','locked'] as const)('before-based mirror reconciliation cannot overwrite a protected %s pool',flag=>{
 const {c}=fixture(flag),before=structuredClone(c),pool=structuredClone(c.runtime.resources['spell-slot:1']);c.spellSettings!.slots['1'].used=1;
 syncAutoResources(c,before);expect(c.runtime.resources['spell-slot:1']).toEqual(pool);expect(c.spellSettings!.slots['1']).toEqual({max:9,used:1});
});
it.each(['manual','missing','locked'] as const)('class removal cannot delete protected %s pools or their ordinary mirrors',flag=>{
 const {c}=fixture(flag),pools=structuredClone(c.runtime.resources),mirrors=structuredClone(c.spellSettings!.slots),before=structuredClone(c);c.selections=[];syncAutoResources(c,before);
 expect(c.runtime.resources).toEqual(pools);expect(c.spellSettings!.slots).toEqual(mirrors);
});
it.each(['manual','missing','locked'] as const)('a missing mirror stays absent for an existing %s ordinary pool',flag=>{
 const {c}=fixture(flag);delete c.spellSettings;const pool=structuredClone(c.runtime.resources['spell-slot:1']);syncAutoResources(c);expect(c.runtime.resources['spell-slot:1']).toEqual(pool);expect(c.spellSettings!.slots['1']).toBeUndefined();expect(c.spellSettings!.slots['9']).toBeUndefined();expect(c.spellSettings!.slots['2']).toEqual({max:2,used:0});
});
it.each(['manual','missing','locked'] as const)('actual initial-open/reopen/forget/class-removal reconciliation preserves %s ownership',flag=>{
 const f=fixture(flag);delete f.c.answers[f.choiceId];delete f.c.classChoiceSnapshots;const pools=structuredClone(f.c.runtime.resources),mirrors=structuredClone(f.c.spellSettings!.slots);
 const run=()=>{f.c=reconciledCardView(f.c,f.entries,entryNameIndex(f.entries),()=>false)||f.c;f.c=validateCharacter(JSON.parse(JSON.stringify(f.c)));for(const [key,pool] of Object.entries(pools))expect(f.c.runtime.resources[key]).toEqual(pool);for(const [key,mirror] of Object.entries(mirrors))expect(f.c.spellSettings!.slots[key]).toEqual(mirror);};
 run();run();f.c.selections.find(r=>r.id==='artificer')!.level=1;run();f.c.selections=[];run();
});
it('missing ordinary and pact pools are still normally created, and hit dice still initialize',()=>{const f=radiantRefuelingFixture('Spell-Refueling Ring',3);f.c=structuredClone(f.c);syncAutoResources(f.c);expect(f.c.runtime.resources['spell-slot:1']).toMatchObject({automatic:true,max:4,current:4});expect(f.c.runtime.resources['spell-slot:2']).toMatchObject({automatic:true,max:2,current:2});expect(f.c.runtime.resources['pact-slot:2']).toMatchObject({automatic:true,max:2,current:2});expect(f.c.runtime.resources['hit-die:8']).toMatchObject({automatic:true,max:9,current:9});});
it('existing automatic unlocked pools still synchronize levels, spending and cleanup',()=>{
 const f=radiantRefuelingFixture('Spell-Refueling Ring',3);f.c=structuredClone(f.c);syncAutoResources(f.c);setResource(f.c,'spell-slot:2',1);const before=structuredClone(f.c);f.c.spellSettings!.slots['1'].used=1;syncAutoResources(f.c,before);expect(f.c.runtime.resources['spell-slot:1'].current).toBe(3);
 f.c.selections.find(r=>r.id==='artificer')!.level=7;syncAutoResources(f.c);expect(f.c.runtime.resources['spell-slot:2']).toMatchObject({max:3,current:2});f.c.selections.find(r=>r.id==='warlock')!.level=5;syncAutoResources(f.c);expect(f.c.runtime.resources['pact-slot:2']).toBeUndefined();expect(f.c.runtime.resources['pact-slot:3']).toMatchObject({max:2,current:2});const beforeRemoval=structuredClone(f.c);f.c.selections=[];syncAutoResources(f.c,beforeRemoval);expect(Object.keys(f.c.runtime.resources)).toEqual(['manual-ring']);expect(f.c.spellSettings!.slots).toEqual({});
});
it.each(['manual','missing','locked'] as const)('explicit setResource still edits a %s slot and its mirror without changing ownership',flag=>{const {c}=fixture(flag),before=structuredClone(c.runtime.resources['spell-slot:1']);setResource(c,'spell-slot:1',1);expect(c.runtime.resources['spell-slot:1']).toEqual({...before,current:1});expect(c.spellSettings!.slots['1']).toEqual({max:9,used:8});});
it('non-slot sync policy and manual arbitrary resource data remain outside this correction',()=>{const {c}=fixture();c.runtime.resources['hit-die:8']={automatic:false,max:9,current:7};c.runtime.resources.custom={name:'Manual feature',current:3,max:11,automatic:false};syncAutoResources(c);expect(c.runtime.resources['hit-die:8']).toMatchObject({automatic:true,max:9,current:7});expect(c.runtime.resources.custom).toEqual({name:'Manual feature',current:3,max:11,automatic:false});});
