import {beforeAll,expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {evaluate} from '../src/core/engine';
import {racialMovementDigest,racialMovementEntries,racialMovementFixture,racialMovementOriginal,racialMovementPin,racialMovementSnapshot,racialMovementSpecs} from './helpers/racialMovementFixture';

beforeAll(()=>{racialMovementEntries();});
it('independently proves exact12 source clauses and complete installed normalized source forms',()=>{
 racialMovementOriginal();const entries=racialMovementEntries();expect(entries).toHaveLength(12);
 const rules=entries.map(entry=>{const spec=racialMovementSpecs.find(row=>row.id===entry.id)!;return {id:entry.id,kind:entry.kind,name:entry.name,english:entry.english,source:entry.source,edition:entry.edition,packId:entry.packId,revision:entry.revision,page:entry.page??null,category:entry.raw._category,sourcePath:spec.sourcePath,mode:spec.mode,baseFeet:spec.baseFeet,sourceClause:{path:spec.clausePath,utf8Sha256:spec.clauseSha256},requiredSources:spec.requiredSources,fullNormalizedSnapshotSha256:racialMovementSnapshot(entry),firstPassMechanism:'source-base-fixed-movement-only',wholeEntryCompletion:false,remainingWholeEntryGaps:['other-source-clauses-not-certified-by-this-mechanism','conditional-and-global-movement-policy-not-implemented','world-movement-execution-not-implemented']};});
 expect(rules.filter(row=>row.mode==='swim')).toHaveLength(11);expect(rules.filter(row=>row.mode==='climb')).toHaveLength(1);expect(rules.every(row=>row.edition==='both')).toBe(true);
 if(process.env.RACIAL_MOVEMENT_PROOF_OUTPUT)writeFileSync(process.env.RACIAL_MOVEMENT_PROOF_OUTPUT,JSON.stringify({schemaVersion:1,scope:'exact12-source-base-fixed-racial-movement',inputs:[racialMovementPin],wholeEntryCompletionCredit:0,newWitnessCredit:0,rules},null,2)+'\n');
});
for(const spec of racialMovementSpecs)it(`actual selected racial source BASE ${spec.mode}${spec.baseFeet} ${spec.id}`,()=>{
 const {c}=racialMovementFixture(spec.id),before=racialMovementDigest(c),derived=evaluate(c),movement=(derived as typeof derived&{sourceMovement?:Partial<Record<'swim'|'climb',number>>}).sourceMovement;
 expect(movement).toEqual({[spec.mode]:spec.baseFeet});expect(derived.speed).toBe(50);expect(derived.trace.sourceMovement.length).toBeGreaterThan(0);expect(racialMovementDigest(c)).toBe(before);
});
