import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {variantItemResistanceBonusFixture} from './helpers/variantItemResistanceBonusFlowFixture';
import {variantItemResistanceBonusSpecs,variantItemResistanceBonusSourceEvidence,variantItemResistanceBonusSnapshot as snapshot} from './helpers/variantItemResistanceBonusSourceFixture';

beforeAll(()=>{variantItemResistanceBonusSourceEvidence();},30000);
// Source links name the cases; actual concrete Entry IDs come from the real
// normalizer. RED uses only the existing engine, never a missing future module.
for(const spec of variantItemResistanceBonusSpecs)it(`actual worn armor variant resistance ${spec.key}`,()=>{
 for(const form of ['canonical','app']as const){
  const f=variantItemResistanceBonusFixture(spec.key,form),off=structuredClone(f.c);off.selections[0].attuned=false;
  const before=snapshot(f.c),offBefore=snapshot(off),d=evaluate(f.c),inactive=evaluate(off);
  expect(inactive.resistances?.includes(spec.resistance)??false).toBe(false);
  expect.soft(d.resistances?.includes(spec.resistance)??false).toBe(true);
  expect.soft(d.issues.some(issue=>issue.id===`item-resistance-bonus:unproved:${f.owner.id}`)).toBe(false);
  expect(snapshot(f.c)).toBe(before);expect(snapshot(off)).toBe(offBefore);
 }
});
