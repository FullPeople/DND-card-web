import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {racialResistanceFixture} from './helpers/racialResistanceFlowFixture';
import {racialResistanceSpecs,racialResistanceSourceEvidence,racialResistanceSnapshot} from './helpers/racialResistanceSourceFixture';

beforeAll(()=>{racialResistanceSourceEvidence();},30000);
// Existing actual engine only: a numerical RED must show the missing fixed
// resistance, never a missing new module or a synthetic source/identity import.
for(const spec of racialResistanceSpecs)it(`actual unconditional racial resistance ${spec.key}`,()=>{
 for(const form of ['canonical','app']as const){
  const f=racialResistanceFixture(spec.key,form),before=racialResistanceSnapshot(f.c),d=evaluate(f.c);
  for(const resistance of spec.resistances)expect.soft(d.resistances?.includes(resistance)===true).toBe(true);
 expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.tempHp).toBe(2);expect(racialResistanceSnapshot(f.c)).toBe(before);
 }
});
