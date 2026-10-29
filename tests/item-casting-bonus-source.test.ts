import {beforeAll,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import evidence from '../src/core/automation/itemCastingBonusEvidence.json';
import {ordinaryCastingRule,ordinaryCastingSnapshot} from '../src/core/automation/ordinarySpellCasting';
import {itemCastingBonusEntries,itemCastingBonusFind,itemCastingBonusClasses,itemCastingBonusClass,itemCastingBonusInputPins,itemCastingBonusSpecs,itemCastingBonusSnapshot,itemCastingBonusSourceEvidence} from './helpers/itemCastingBonusSourceFixture';

let fresh:ReturnType<typeof itemCastingBonusSourceEvidence>;beforeAll(()=>{fresh=itemCastingBonusSourceEvidence();},30000);
it('rechecks only ten exact originals and closes nine owners, eighteen numeric branches/forms and fourteen real classes',()=>{
 expect(itemCastingBonusInputPins).toHaveLength(10);expect(itemCastingBonusInputPins.slice(0,3).reduce((n,p)=>n+p.bytes,0)).toBe(2798829);expect(itemCastingBonusInputPins.reduce((n,p)=>n+p.bytes,0)).toBe(3812253);expect(fresh).toEqual(evidence);
 expect(fresh.counts).toEqual({owners:9,numericBranches:18,completeOwnerForms:18,classes:14,heldOwners:5});expect(fresh.rules).toHaveLength(9);expect(new Set(fresh.rules.map(rule=>rule.id)).size).toBe(9);expect(fresh.classes).toHaveLength(14);expect(fresh.wholeEntryCompletionCredit).toBe(0);expect(fresh.newReportWitnessCredit).toBe(0);
});
it('independently proves every complete canonical and actual App owner form, numeric scope and exact role IDs',()=>{
 for(const spec of itemCastingBonusSpecs)for(const form of ['canonical','app']as const){
  const entry=itemCastingBonusFind(spec.sourceIndex,form),rule=fresh.rules.find(row=>row.id===entry.id)!;expect(rule.sourceIndex).toBe(spec.sourceIndex);expect(itemCastingBonusEntries(form).filter(row=>row.id===entry.id)).toHaveLength(1);
  expect(rule.forms.find(row=>row.form===form)?.completeSnapshotSha256).toBe(itemCastingBonusSnapshot(entry));expect(rule.forms.find(row=>row.form===form)?.canonicalReboundSnapshotSha256).toBe(itemCastingBonusSnapshot({...entry,id:rule.id,revision:rule.revision}));expect(rule.name).toBe(spec.name);expect(rule.english).toBe(spec.english);expect(rule.source).toBe(spec.source.toUpperCase());expect(rule.page).toBe(spec.page);
  expect(rule.attackBonus).toBe(spec.attackBonus);expect(rule.dcBonus).toBe(spec.dcBonus);expect(rule.scope).toBe(spec.scope);expect(rule.requiredCastingAbility).toBe(spec.requiredCastingAbility);expect(rule.rankOverlapGroup).toBe(spec.rankOverlapGroup);expect(rule.sourceCondition).toBe('worn');expect(rule.attunementFieldUtf8Sha256).toBe(spec.attunementFieldUtf8Sha256);
  expect(rule.attunementRoleIds.slice().sort()).toEqual(fresh.classes.filter(row=>spec.attunementClassRoles.includes(row.role as any)).map(row=>row.id).sort());expect(rule.recipientRoleIds.slice().sort()).toEqual(spec.scope==='sorcerer-spells'?fresh.classes.filter(row=>row.role==='Sorcerer').map(row=>row.id).sort():[]);
  expect(rule.clauses).toEqual(spec.clauses);expect(typeof entry.raw.reqAttune).toBe('string');expect(entry.raw._copy).toBeUndefined();expect(entry.raw._unresolvedParent).toBeUndefined();expect(entry.raw._variantIdentity).toBeUndefined();
 }
});
it('re-normalizes seven original class files into fourteen exact ordinary proofs, with Druid recipient controls not attunement roles',()=>{
 const classes=itemCastingBonusClasses();expect(classes).toHaveLength(14);expect(new Set(classes.map(row=>row.id)).size).toBe(14);expect(fresh.classes.filter(row=>row.role==='Druid')).toHaveLength(2);const druids=fresh.classes.filter(row=>row.role==='Druid').map(row=>row.id);expect(fresh.rules.every(rule=>!rule.attunementRoleIds.some(id=>druids.includes(id)))).toBe(true);
 for(const record of fresh.classes){const entry=classes.find(row=>row.id===record.id)!;expect(entry!==undefined).toBe(true);expect(itemCastingBonusClass(record.role as any,record.edition as '2014'|'2024').id).toBe(record.id);expect(ordinaryCastingRule(entry)?.id).toBe(record.id);expect(ordinaryCastingSnapshot(entry)).toBe(record.snapshotSha256);expect(itemCastingBonusSnapshot(entry)).toBe(record.fullNormalizedSnapshotSha256);expect(entry.revision).toBe(record.input.sha256);expect(entry.raw.spellcastingAbility).toBe(record.spellcastingAbility);expect(entry.raw._copy).toBeUndefined();expect(entry.raw._unresolvedParent).toBeUndefined();}
});
it('keeps five held source headers, rank policies and class attunement separate from spell recipient scope and publishes no bodies',()=>{
 expect(fresh.held.map(row=>row.sourceIndex)).toEqual([1844,2259,2263,2260,2264]);expect(fresh.rules.some(rule=>fresh.held.some(held=>held.sourceIndex===rule.sourceIndex))).toBe(false);
 expect(fresh.rules.filter(rule=>rule.rankOverlapGroup==='amulet-of-the-devout-ranks')).toHaveLength(3);expect(fresh.rules.filter(rule=>rule.rankOverlapGroup==='bloodwell-vial-ranks')).toHaveLength(3);
 const devout=fresh.rules.find(rule=>rule.sourceIndex===1)!,blood=fresh.rules.find(rule=>rule.sourceIndex===3)!,jester=fresh.rules.find(rule=>rule.sourceIndex===1153)!;expect(devout.scope).toBe('all-your-spells');expect(devout.attunementClassRoles).toEqual(['Cleric','Paladin']);expect(blood.scope).toBe('sorcerer-spells');expect(jester.requiredCastingAbility).toBe('cha');
 const fixture=readFileSync('tests/helpers/itemCastingBonusSourceFixture.ts','utf8'),imports=fixture.split('\n').filter(line=>line.startsWith('import '));expect(imports).toHaveLength(5);expect(imports.filter(line=>line.includes('model')).every(line=>line.startsWith('import type '))).toBe(true);expect(imports.some(line=>/engine|automation\/state|itemCastingBonusEvidence|FlowFixture/.test(line))).toBe(false);
 const forbidden=new Set(['raw','entries','body','text','character','cards']);let invalid=0;const walk=(value:unknown)=>{if(!value||typeof value!=='object')return;for(const[key,child]of Object.entries(value)){if(forbidden.has(key))invalid++;walk(child);}};walk(fresh);expect(invalid).toBe(0);expect(/\/workspace\/|\.local-evidence|\.private\.json/.test(JSON.stringify(fresh))).toBe(false);
});
