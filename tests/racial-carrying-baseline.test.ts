import {beforeAll,expect,it} from 'vitest';
import {carrying} from '../src/core/carrying';
import {evaluate} from '../src/core/engine';
import {racialCarryingFixture} from './helpers/racialCarryingFlowFixture';
import {racialCarryingSpecs,racialCarryingSourceEvidence,racialCarryingSnapshot} from './helpers/racialCarryingSourceFixture';

beforeAll(()=>{racialCarryingSourceEvidence();},30000);
// Existing consumer and engine only: genuine missing carrying-capacity effect,
// not an absent future adapter, guessed ID or altered source snapshot.
for(const spec of racialCarryingSpecs)it(`actual one-size-larger racial carrying ${spec.key}`,()=>{
 for(const form of ['canonical','app']as const){const f=racialCarryingFixture(spec.key,form),before=racialCarryingSnapshot(f.c),d=evaluate(f.c),actual=carrying(f.c,d);expect(d.abilities.str).toBe(10);expect(f.c.size).toBe('M');expect(f.c.inventory?.capacityAdjustment).toBe('');expect.soft(actual.max).toBe(300);expect(racialCarryingSnapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.tempHp).toBe(2);}
});
