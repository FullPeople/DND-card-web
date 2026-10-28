import {beforeAll,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import evidence from '../src/core/automation/itemResistanceBonusEvidence.json';
import {itemResistanceBonusInputPins,itemResistanceBonusSpecs,itemResistanceBonusEntries,itemResistanceBonusFind,itemResistanceBonusHeldEntries,itemResistanceBonusSourceEvidence,itemResistanceBonusSnapshot} from './helpers/itemResistanceBonusSourceFixture';

let fresh:ReturnType<typeof itemResistanceBonusSourceEvidence>;beforeAll(()=>{fresh=itemResistanceBonusSourceEvidence();},30000);
it('binds exactly three originals and thirty partial resistance owners with sixty complete actual source forms',()=>{
 expect(itemResistanceBonusInputPins).toHaveLength(3);expect(itemResistanceBonusInputPins.reduce((n,pin)=>n+pin.bytes,0)).toBe(2798829);expect(itemResistanceBonusSnapshot(fresh)).toBe(itemResistanceBonusSnapshot(evidence));expect(fresh.counts).toEqual({owners:30,completeOwnerForms:60,dragonScaleMail:20,typedDmgRings:10,heldXdmgRings:10});expect(new Set(fresh.rules.map(rule=>rule.id)).size).toBe(30);expect(fresh.wholeEntryCompletionCredit).toBe(0);expect(fresh.newReportWitnessCredit).toBe(0);
 expect(itemResistanceBonusSpecs.map(spec=>spec.sourceIndex)).toEqual([213,253,309,323,495,888,921,1734,2036,2463,214,254,310,324,496,889,922,1735,2037,2464,1752,1759,1775,1777,1785,1789,1792,1796,1799,1821]);
});
it('rechecks all thirty canonical and actual App complete snapshots, exact headers, attunement and typed source clauses',()=>{
 for(const form of ['canonical','app']as const)for(const spec of itemResistanceBonusSpecs){
  const entry=itemResistanceBonusFind(spec.sourceIndex,form),rule=fresh.rules.find(row=>row.id===entry.id)!,proof=rule.forms.find(row=>row.form===form)!;expect(itemResistanceBonusEntries(form).filter(row=>row.id===entry.id)).toHaveLength(1);expect(itemResistanceBonusFind(entry.id,form).id).toBe(entry.id);
  expect(proof.completeSnapshotSha256).toBe(itemResistanceBonusSnapshot(entry));expect(proof.canonicalReboundSnapshotSha256).toBe(itemResistanceBonusSnapshot({...entry,id:rule.id,revision:rule.revision}));expect(rule.fullNormalizedSnapshotSha256).toBe(itemResistanceBonusSnapshot(itemResistanceBonusFind(spec.sourceIndex)));expect(rule.name).toBe(spec.name);expect(rule.english).toBe(spec.english);expect(rule.source).toBe(spec.source);expect(rule.page).toBe(spec.page);expect(rule.resistance).toBe(spec.resistance);expect(rule.category).toBe('item');expect(rule.requiresAttunement).toBe(true);expect(rule.sourceCondition).toBe('worn');expect(itemResistanceBonusSnapshot(rule.clauses)).toBe(itemResistanceBonusSnapshot(spec.clauses));
  expect(entry.raw.reqAttune).toBe(true);expect(entry.raw._copy).toBeUndefined();expect(entry.raw._unresolvedParent).toBeUndefined();expect(entry.raw._variantIdentity).toBeUndefined();expect(rule.clauses.length).toBeGreaterThan(0);expect(rule.clauses.every(ref=>/^[a-f0-9]{64}$/.test(ref.utf8Sha256))).toBe(true);
 }
 expect(fresh.rules.filter(rule=>rule.source==='DMG')).toHaveLength(20);expect(fresh.rules.filter(rule=>rule.source==='XDMG')).toHaveLength(10);expect(new Set(fresh.rules.map(rule=>rule.resistance)).size).toBe(10);
});
it('preserves all ten XDMG typed rings as held actual source records without repairing missing attunement metadata',()=>{
 expect(fresh.holds.map(hold=>hold.sourceIndex)).toEqual([1753,1760,1776,1778,1786,1790,1793,1797,1800,1822]);expect(fresh.holds).toHaveLength(10);
 for(const form of ['canonical','app']as const){const entries=itemResistanceBonusHeldEntries(form);expect(entries).toHaveLength(10);for(const entry of entries){const hold=fresh.holds.find(row=>row.id===entry.id)!;expect(hold!==undefined).toBe(true);expect(hold.source).toBe('XDMG');expect(hold.reasonCode).toBe('missing-explicit-reqAttune-metadata-not-source-proof');expect(Object.hasOwn(entry.raw,'reqAttune')).toBe(false);expect(hold.forms.find(row=>row.form===form)?.completeSnapshotSha256).toBe(itemResistanceBonusSnapshot(entry));expect(fresh.rules.some(rule=>rule.id===entry.id)).toBe(false);expect(hold.rawPaths).toEqual([`items.json/item/${hold.sourceIndex}`]);}}
});
it('keeps the source fixture pure and the public evidence body-free, without other item branches or completion credit',()=>{
 const fixture=readFileSync('tests/helpers/itemResistanceBonusSourceFixture.ts','utf8'),imports=fixture.split('\n').filter(line=>line.startsWith('import '));expect(imports).toHaveLength(4);expect(imports.filter(line=>line.includes('model')).every(line=>line.startsWith('import type '))).toBe(true);expect(imports.some(line=>/engine|automation\/state|itemResistanceBonusEvidence|FlowFixture/.test(line))).toBe(false);
 const forbidden=new Set(['raw','entries','body','text','character','cards']);let invalid=0;const walk=(value:unknown)=>{if(!value||typeof value!=='object')return;for(const[key,child]of Object.entries(value)){if(forbidden.has(key))invalid++;walk(child);}};walk(fresh);expect(invalid).toBe(0);expect(/\/workspace\/|\.local-evidence|\.private\.json/.test(JSON.stringify(fresh))).toBe(false);expect(fresh.sourceProseIncluded).toBe(false);expect(fresh.rules.every(rule=>rule.wholeEntryCompletionCredit===0)).toBe(true);
});
