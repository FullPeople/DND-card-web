import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import evidence from '../src/core/automation/racialNaturalArmorEvidence.json';
import {racialNaturalArmorFixture} from './helpers/racialNaturalArmorFlowFixture';
import {racialNaturalArmorSourceEvidence,racialNaturalArmorSnapshot} from './helpers/racialNaturalArmorSourceFixture';

beforeAll(()=>{racialNaturalArmorSourceEvidence();},30000);
// Existing evaluate(c) ONLY, with no future projection imported or mocked.
// Each actual admitted owner gets canonical and actual App-route assertions.
// A passing owner is already implemented, not new-credit or a forced failure.
for(const rule of evidence.rules)it(`actual innate racial AC ${rule.key}`,()=>{
 for(const form of ['canonical','app']as const){
  const f=racialNaturalArmorFixture(rule.key,form),native=JSON.stringify(f.c),before=racialNaturalArmorSnapshot(f.c),d=evaluate(f.c),policy=f.spec.policy;
  expect(d.modifiers.dex).toBe(2);expect(d.modifiers.con).toBe(3);
  const modifier=policy.modifier==='dex'?d.modifiers.dex:policy.modifier==='con'?d.modifiers.con:0;
  const sourceAc=policy.operation==='additive-bonus'?10+d.modifiers.dex+policy.constant:policy.constant+modifier;
  expect.soft(d.ac).toBe(sourceAc+(f.c.sheetBonuses?.ac||0));
  expect(JSON.stringify(f.c)).toBe(native);expect(racialNaturalArmorSnapshot(f.c)).toBe(before);
  expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.tempHp).toBe(2);expect(f.c.runtime.resources.manual.current).toBe(1);expect(f.c.size).toBe('M');expect(f.c.inventory?.coins.gp).toBe(7);
 }
});
it('retains current manual FINAL AC priority and the independent card offset on every admitted owner and route',()=>{
 for(const rule of evidence.rules)for(const form of ['canonical','app']as const){const f=racialNaturalArmorFixture(rule.key,form);f.c.adjustments=[{id:'authored-final-ac',target:'ac',value:29,reason:'Authored manual final AC'}];const native=JSON.stringify(f.c);expect(evaluate(f.c).ac).toBe(31);expect(JSON.stringify(f.c)).toBe(native);}
});
