import {beforeAll,expect,it} from 'vitest';
import {spellValues} from '../src/core/characterDetails';
import {evaluate} from '../src/core/engine';
import {itemCastingBonusFixture} from './helpers/itemCastingBonusFlowFixture';
import {itemCastingBonusSpecs,itemCastingBonusSnapshot,itemCastingBonusSourceEvidence} from './helpers/itemCastingBonusSourceFixture';

beforeAll(()=>{itemCastingBonusSourceEvidence();},30000);
// Existing consumer imports only. Genuine RED must be a missing actual numeric
// capability, never a missing future projection module, mocked stat or actor.
for(const spec of itemCastingBonusSpecs)it(`actual worn source casting numbers ${spec.source}:${spec.english}`,()=>{
 const f=itemCastingBonusFixture(spec.sourceIndex),off=structuredClone(f.c);off.selections.find(row=>row.id===f.owner.id)!.attuned=false;
 const before=itemCastingBonusSnapshot(f.c),offBefore=itemCastingBonusSnapshot(off),baseline=spellValues(off,evaluate(off),f.ability),actual=spellValues(f.c,evaluate(f.c),f.ability);
 expect(actual.attack-baseline.attack).toBe(spec.attackBonus);expect(actual.dc-baseline.dc).toBe(spec.dcBonus);expect(itemCastingBonusSnapshot(f.c)).toBe(before);expect(itemCastingBonusSnapshot(off)).toBe(offBefore);
});
