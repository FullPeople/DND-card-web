import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {inheritedRacialResistanceFixture} from './helpers/inheritedRacialResistanceFlowFixture';
import {inheritedRacialResistanceSpecs,inheritedRacialResistanceSourceEvidence,inheritedRacialResistanceSnapshot} from './helpers/inheritedRacialResistanceSourceFixture';

beforeAll(()=>{inheritedRacialResistanceSourceEvidence();},30000);
// Existing actual engine only: a numerical RED must show the missing fixed
// resistance, never a missing new module or a synthetic source/identity import.
// The existing production projector must not import the new evidence until RED.
for(const spec of inheritedRacialResistanceSpecs)it(`actual inherited unconditional racial resistance ${spec.key}`,()=>{
 for(const form of ['canonical','app']as const){
  const f=inheritedRacialResistanceFixture(spec.key,form),before=inheritedRacialResistanceSnapshot(f.c),d=evaluate(f.c);
  for(const resistance of spec.resistances)expect.soft(d.resistances?.includes(resistance)===true).toBe(true);
 expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.tempHp).toBe(2);expect(inheritedRacialResistanceSnapshot(f.c)).toBe(before);
 }
});
