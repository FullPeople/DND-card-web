import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {inheritedRacialResistanceFixture} from './helpers/inheritedRacialResistanceFlowFixture';
import {inheritedRacialResistanceSourceEvidence,inheritedRacialResistanceSnapshot as snapshot} from './helpers/inheritedRacialResistanceSourceFixture';
import {variantItemResistanceBonusFixture} from './helpers/variantItemResistanceBonusFlowFixture';
import {variantItemResistanceBonusSourceEvidence,variantItemResistanceBonusSpecs} from './helpers/variantItemResistanceBonusSourceFixture';

beforeAll(()=>{inheritedRacialResistanceSourceEvidence();variantItemResistanceBonusSourceEvidence();});

it('composes an authenticated inherited root with a distinct worn attuned Armor variant without changing manual state or borrowing either source authority',()=>{
 for(const form of ['canonical','app']as const){
  const f=inheritedRacialResistanceFixture('subrace/1',form);
  const spec=variantItemResistanceBonusSpecs.find(row=>!f.spec.resistances.some(type=>type===row.resistance));
  expect(spec!==undefined).toBe(true);
  const armor=variantItemResistanceBonusFixture(spec!.key,form),physical=structuredClone(armor.owner);
  f.c.selections.push(physical);
  f.c.profile.enabledSources=[...new Set([...f.c.profile.enabledSources,...armor.c.profile.enabledSources])];
  const expected=[...new Set([...f.spec.resistances,spec!.resistance])].sort(),before=snapshot(f.c);
  expect([...evaluate(f.c).resistances!].sort()).toEqual(expected);
  expect(snapshot(f.c)).toBe(before);
  const restored=readCharacter(exportCharacter(f.c)).character;
  expect(snapshot(restored)).toBe(before);
  expect([...evaluate(restored).resistances!].sort()).toEqual(expected);
  expect(snapshot(restored)).toBe(before);
  expect(restored.runtime.hp).toBe(3);expect(restored.runtime.tempHp).toBe(2);
  expect(restored.runtime.resources.manual.current).toBe(1);
  expect(restored.runtime.resources.manual.locked).toBe(true);
  for(const disabled of ['race','armor']as const){
   const paused=structuredClone(restored);
   paused.profile.disabledEntries=[disabled==='race'?f.rule.id:armor.rule.id];
   const unchanged=snapshot(paused);
   expect([...evaluate(paused).resistances!].sort()).toEqual(disabled==='race'?[spec!.resistance]:[...f.spec.resistances].sort());
   expect(snapshot(paused)).toBe(unchanged);
  }
  physical.attuned=false;
  const unattuned=snapshot(f.c);
  expect([...evaluate(f.c).resistances!].sort()).toEqual([...f.spec.resistances].sort());
  expect(snapshot(f.c)).toBe(unattuned);
 }
});
