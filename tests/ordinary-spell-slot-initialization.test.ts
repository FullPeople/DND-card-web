import {expect,it as privateSourceIt} from 'vitest';
import {slotBalanceRecoveryFixture} from './helpers/slotBalanceRecoveryFixture';
import {runMulticlassSourceCheck} from './helpers/multiclassSlotSources';
import {newCharacter,type Character} from '../src/core/model';
import {readCharacter} from '../src/core/validation';
import {exportCharacter} from '../src/core/export';
import {syncAutoResources,setResource} from '../src/core/resources';
import {currentSlotCapacityReview} from '../src/core/automation/slotCapacityReview';
let index=0;
function it(name:string,run:()=>unknown){const n=++index;return privateSourceIt(name,()=>runMulticlassSourceCheck(n,run));}
function emptyLegacy(edition:'2014'|'2024'='2014'){
 const f=slotBalanceRecoveryFixture(edition);delete f.c.runtime.slotCapacityReview;
 for(const id of Object.keys(f.c.runtime.resources))if(/^spell-slot:/.test(id))delete f.c.runtime.resources[id];f.c.spellSettings!.slots={};return f;
}
for(const edition of ['2014','2024'] as const)it(`${edition} native legacy import with no remaining ordinary balance evidence stays unknown, including on reopen`,()=>{
 const {c}=emptyLegacy(edition),input=exportCharacter(c),before=structuredClone(input),restored=readCharacter(input).character;
 expect(input).toEqual(before);expect(restored.runtime.slotCapacityReview).toBeUndefined();syncAutoResources(restored);
 for(const [id,max] of [['spell-slot:1',4],['spell-slot:2',2]] as const){expect(restored.runtime.resources[id]).toBeUndefined();expect(currentSlotCapacityReview(restored)?.pending[id]).toEqual({max});}
 const once=structuredClone(restored),again=readCharacter(exportCharacter(restored)).character;syncAutoResources(again);expect(again).toEqual(once);expect(again.runtime.resources.manual).toEqual(c.runtime.resources.manual);
});
for(const edition of ['2014','2024'] as const)it(`${edition} a newly created card records an empty starting capacity before any class and initializes real first-time slots once`,()=>{
 const source=slotBalanceRecoveryFixture(edition),c=newCharacter(edition);
 expect(currentSlotCapacityReview(c)?.seen).toEqual([]);expect(currentSlotCapacityReview(c)?.previous['spell-slot:2']).toBe(0);
 c.automation=structuredClone(source.c.automation);c.profile=structuredClone(source.c.profile);c.selections=structuredClone(source.c.selections);syncAutoResources(c);
 expect(c.runtime.resources['spell-slot:2']).toMatchObject({max:2,current:2});setResource(c,'spell-slot:2',0);
 const restored=readCharacter(exportCharacter(c)).character;syncAutoResources(restored);expect(restored.runtime.resources['spell-slot:2']).toMatchObject({max:2,current:0});
});
it('a real recorded source-level unlock can initialize only the newly unlocked ring while older missing balances remain unknown',()=>{
 const {c}=emptyLegacy();c.selections[0].level=4;const before=structuredClone(c);c.selections[0].level=5;syncAutoResources(c,before);
 expect(c.runtime.resources['spell-slot:1']).toBeUndefined();expect(currentSlotCapacityReview(c)?.pending['spell-slot:1']).toEqual({max:4});expect(c.runtime.resources['spell-slot:2']).toMatchObject({max:2,current:2});
});
it('restoring missing casting metadata on the same legacy class is not evidence of a first-time slot unlock',()=>{
 const {c}=emptyLegacy(),before=structuredClone(c);for(const row of before.selections)if(row.entry.kind==='class')row.entry.raw={};syncAutoResources(c,before);
 expect(c.runtime.resources['spell-slot:1']).toBeUndefined();expect(c.runtime.resources['spell-slot:2']).toBeUndefined();expect(currentSlotCapacityReview(c)?.pending['spell-slot:2']).toEqual({max:2});
});
for(const id of ['spell-slot:1','pact-slot:1'])for(const marker of ['sourceSpellGrant','unlimited'])it(`normalization and class withdrawal preserve an existing ${marker} counter at ${id}`,()=>{
 const {c}=slotBalanceRecoveryFixture();c.runtime.resources[id]={name:'Authored protected non-ordinary counter',automatic:true,max:9,current:7,...(marker==='sourceSpellGrant'?{sourceSpellGrant:{usageKey:'authored-other-family'}}:{unlimited:true})};
 if(id.startsWith('spell-slot:'))c.spellSettings!.slots['1']={max:9,used:2};
 const restored=readCharacter(exportCharacter(c)).character,pool=structuredClone(restored.runtime.resources[id]),mirror=structuredClone(restored.spellSettings!.slots['1']);syncAutoResources(restored);expect(restored.runtime.resources[id]).toEqual(pool);expect(restored.spellSettings!.slots['1']).toEqual(mirror);
 const before=structuredClone(restored);restored.selections=[];syncAutoResources(restored,before);expect(restored.runtime.resources[id]).toEqual(pool);if(id.startsWith('spell-slot:'))expect(restored.spellSettings!.slots['1']).toEqual(mirror);
});
