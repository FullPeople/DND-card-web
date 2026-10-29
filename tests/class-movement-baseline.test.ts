import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {syncFeatures} from '../src/core/sheet';
import {classMovementFixture} from './helpers/classMovementFlowFixture';
import {classMovementSpecs,classMovementSourceEvidence,classMovementSnapshot as snapshot} from './helpers/classMovementSourceFixture';

beforeAll(()=>{classMovementSourceEvidence();},30000);
// Existing real engine and declared-content synchronization only. Missing new
// imports, mocked projections or manually invented grant IDs cannot be RED.
for(const spec of classMovementSpecs)it(`actual owned class movement ${spec.key}`,()=>{
 for(const form of ['canonical','app']as const){
  const f=classMovementFixture(spec.key,form),off=structuredClone(f.c);off.selections.find(row=>row.id===f.owner.id)!.level=spec.minLevel-1;syncFeatures(off,f.entries);
  const before=snapshot(f.c),offBefore=snapshot(off),baseline=evaluate(off),actual=evaluate(f.c),initial=spec.levelBonuses?spec.levelBonuses[spec.minLevel-1]:spec.walkingBonus;
  expect.soft(actual.speed-baseline.speed).toBe(initial);
  if(spec.relativeModes.length){const modes=(actual as typeof actual&{classMovement?:Partial<Record<'swim'|'climb',number>>}).classMovement;for(const mode of spec.relativeModes)expect.soft(modes?.[mode]).toBe(actual.speed);}
  expect(snapshot(f.c)).toBe(before);expect(snapshot(off)).toBe(offBefore);
 }
});
