import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {itemResistanceBonusFixture} from './helpers/itemResistanceBonusFlowFixture';
import {itemResistanceBonusSpecs,itemResistanceBonusSnapshot,itemResistanceBonusSourceEvidence} from './helpers/itemResistanceBonusSourceFixture';

beforeAll(()=>{itemResistanceBonusSourceEvidence();},30000);
// Existing actual evaluate consumer only: missing source-derived resistance,
// never an absent future projection import, mocked defense or invented ID.
for(const spec of itemResistanceBonusSpecs)it(`actual worn source resistance ${spec.source}:${spec.english}`,()=>{
 for(const form of ['canonical','app']as const){
  const f=itemResistanceBonusFixture(spec.sourceIndex,form),off=structuredClone(f.c);off.selections.find(row=>row.id===f.owner.id)!.attuned=false;
  const before=itemResistanceBonusSnapshot(f.c),offBefore=itemResistanceBonusSnapshot(off),baseline=evaluate(off),actual=evaluate(f.c);
  expect(baseline.resistances?.includes(spec.resistance)??false).toBe(false);
  expect(actual.resistances?.includes(spec.resistance)??false).toBe(true);
  expect(actual.resistances?.filter(type=>type===spec.resistance).length).toBe(1);
  expect(itemResistanceBonusSnapshot(f.c)).toBe(before);expect(itemResistanceBonusSnapshot(off)).toBe(offBefore);
 }
});
