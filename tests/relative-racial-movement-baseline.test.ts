import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {relativeRacialMovementFixture} from './helpers/relativeRacialMovementFlowFixture';
import {relativeRacialMovementSpecs,relativeRacialMovementSnapshot,relativeRacialMovementSourceEvidence} from './helpers/relativeRacialMovementSourceFixture';

beforeAll(()=>{relativeRacialMovementSourceEvidence();},30000);
// Existing actual engine only: RED must show a missing walking-linked mode,
// not an absent future module, guessed ID or a mocked speed computation.
for(const spec of relativeRacialMovementSpecs)it(`actual current walking relation ${spec.id}`,()=>{
 for(const form of ['canonical','app']as const){
  const f=relativeRacialMovementFixture(spec.id,form),before=relativeRacialMovementSnapshot(f.c),d=evaluate(f.c),movement=(d as typeof d&{relativeMovement?:Partial<Record<'swim'|'climb',number>>}).relativeMovement;
  expect(d.speed).toBe(50);expect.soft(movement?.[spec.mode]).toBe(d.speed);
  // This also witnesses the existing fixed-only module's obsolete held warning
  // before any strict-source helper exception is considered by the bridge owner.
  expect.soft(d.issues.some(issue=>issue.id.startsWith('racial-movement:held:'))).toBe(false);
  expect(d.sourceMovement?.[spec.mode]===undefined).toBe(true);expect(relativeRacialMovementSnapshot(f.c)).toBe(before);
 }
});
