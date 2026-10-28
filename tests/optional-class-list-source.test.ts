import {beforeAll,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import evidence from '../src/core/automation/optionalClassSpellListEvidence.json' with {type:'json'};
import {optionalClassListAssociations,optionalClassListDigest,optionalClassListEntries,optionalClassListFind,optionalClassListInputPins,optionalClassListOfflineBoundary,optionalClassListOriginals,optionalClassListOwners,optionalClassListSideProof,optionalClassListSideSource,optionalClassListSnapshot,optionalClassListTargets} from './helpers/optionalClassListSourceFixture';

beforeAll(()=>{optionalClassListSideProof();});
it('rechecks only eleven exact original byte/canonical pins and one immutable semantic side-source without extending runtime inputs',()=>{
 expect(Object.keys(optionalClassListOriginals())).toHaveLength(11);
 expect(evidence.inputs).toEqual(Object.entries(optionalClassListInputPins).map(([path,pin])=>({url:'https://5e.kiwee.top/data/'+path,...pin})));
 expect(evidence.inputs.reduce((n,row)=>n+row.bytes,0)).toBe(2351778);
 expect(evidence.sideSource).toEqual(optionalClassListSideSource);expect(evidence.sideSource.runtimeInputExtension).toBe(false);
 expect(optionalClassListOfflineBoundary().unexpected.length).toBe(0);
});
it('independently parses exact selected class blocks and proves seven owners101 associations68 targets8 existing-base overlaps',()=>{
 const proof=optionalClassListSideProof();expect(proof.owners.length).toBe(7);expect(proof.associations.length).toBe(101);expect(optionalClassListTargets().length).toBe(68);expect(proof.associations.filter(a=>a.baseOverlap).length).toBe(8);
 expect(evidence.counts).toEqual({owners:7,associations:101,distinctTargets:68,baseOverlaps:8,heldSorcererAssociations:21});
 expect(evidence.owners.length).toBe(7);expect(evidence.targets.length).toBe(68);expect(evidence.associations.length).toBe(101);
 expect(new Set(evidence.owners.map(o=>o.id)).size).toBe(7);expect(new Set(evidence.targets.map(t=>t.id)).size).toBe(68);expect(new Set(evidence.associations.map(a=>a.ownerId+'|'+a.targetId)).size).toBe(101);
 expect(evidence.owners.map(o=>o.id).sort()).toEqual(proof.owners.map(o=>o.entry.id).sort());expect(evidence.targets.map(t=>t.id).sort()).toEqual(optionalClassListTargets().map(t=>t.id).sort());expect(evidence.associations.map(a=>a.ownerId+'|'+a.targetId).sort()).toEqual(proof.associations.map(a=>a.owner.id+'|'+a.target.id).sort());
 expect(new Set(proof.associations.map(a=>a.owner.id+'|'+a.target.id)).size).toBe(101);
});
for(const record of evidence.owners)it(`actual original complete PHB2014 owner proof ${record.english}`,()=>{
 const entry=optionalClassListOwners().find(e=>e.id===record.id)!;expect(entry!==undefined).toBe(true);expect(optionalClassListSnapshot(entry)).toBe(record.fullNormalizedSnapshotSha256);
 const proof=optionalClassListSideProof().owners.find(o=>o.entry.id===record.id)!;expect(record.sideSource).toEqual(proof.sideSource);expect(record.minLevel).toBe(proof.minLevel);
 expect(record.inputSha256).toBe(optionalClassListInputPins[`class/class-${record.english.toLowerCase()}.json` as keyof typeof optionalClassListInputPins].sha256);expect(entry.revision).toBe(record.inputSha256);
 expect({id:entry.id,kind:entry.kind,name:entry.name,english:entry.english,packId:entry.packId,source:entry.source,edition:entry.edition,page:entry.page??null,revision:entry.revision,category:entry.raw._category}).toEqual({id:record.id,kind:record.kind,name:record.name,english:record.english,packId:record.packId,source:record.source,edition:record.edition,page:record.page,revision:record.revision,category:record.category});
 expect(entry.raw.edition).toBe('classic');expect(entry.raw._copy!==undefined||entry.raw._unresolvedParent!==undefined).toBe(false);
});
for(const record of evidence.targets)it(`actual hydrated whole spell source proof ${record.source} ${record.english}`,()=>{
 const entry=optionalClassListTargets().find(e=>e.id===record.id)!;expect(entry!==undefined).toBe(true);expect(optionalClassListSnapshot(entry)).toBe(record.fullNormalizedSnapshotSha256);
 expect({id:entry.id,kind:entry.kind,name:entry.name,english:entry.english,packId:entry.packId,source:entry.source,edition:entry.edition,page:entry.page??null,revision:entry.revision,category:entry.raw._category,spellLevel:entry.raw.level}).toEqual({id:record.id,kind:record.kind,name:record.name,english:record.english,packId:record.packId,source:record.source,edition:record.edition,page:record.page,revision:record.revision,category:record.category,spellLevel:record.spellLevel});
 expect(record.normalizedForm).toBe('actual-hydrated-original');expect(entry.raw._spellClassLookupLoaded).toBe(true);expect(entry.raw.classes===undefined).toBe(true);
 expect(record.inputSha256).toBe(optionalClassListInputPins[`spells/spells-${record.source.toLowerCase()}.json` as keyof typeof optionalClassListInputPins].sha256);expect(record.lookupSha256).toBe(optionalClassListInputPins['generated/gendata-spell-source-lookup.json'].sha256);expect(entry.revision).toBe(record.inputSha256+'|lists:'+record.lookupSha256);
});
for(const record of evidence.associations)it(`actual chapter table source association ${record.ownerId} -> ${record.targetId}`,()=>{
 const rows=optionalClassListAssociations().filter(a=>a.owner.id===record.ownerId&&a.target.id===record.targetId);expect(rows.length).toBe(1);const a=rows[0];
 expect({ownerId:a.owner.id,targetId:a.target.id,spellLevel:a.spellLevel,baseOverlap:a.baseOverlap,sourceUid:a.sourceUid,sideBlockId:a.sideBlockId,sideBlockPath:a.sideBlockPath}).toEqual(record);
 expect(a.target.raw.level).toBe(record.spellLevel);
});
it('preserves Sorcerer21 explicit source-conflict holds without inventing feature entries or revoking existing base cantrips',()=>{
 const held=optionalClassListSideProof().held;expect(evidence.holds).toEqual(held);expect(held).toHaveLength(1);expect(held[0].targetIds).toHaveLength(21);expect(evidence.owners.some(o=>o.id===held[0].ownerId)).toBe(false);expect(evidence.associations.some(a=>a.ownerId===held[0].ownerId)).toBe(false);
 const sorcerer=optionalClassListFind('class','Sorcerer');expect(sorcerer.id).toBe(held[0].ownerId);
 const original=optionalClassListOriginals()['generated/gendata-spell-source-lookup.json'];const overlap=evidence.associations.filter(a=>a.baseOverlap);expect(new Set(overlap.map(a=>a.targetId)).size).toBe(4);
 for(const a of overlap){const owner=evidence.owners.find(o=>o.id===a.ownerId)!,target=evidence.targets.find(t=>t.id===a.targetId)!;expect(optionalClassListDigest(original[target.source.toLowerCase()][target.name.toLowerCase()].class.PHB[owner.name])).toBe(optionalClassListDigest({definedInSources:['SCAG']}));}
});
it('keeps actual target editions and source spell levels, not a fabricated blanket2014 character ban',()=>{
 const counts=evidence.targets.reduce((out,row)=>({...out,[row.edition]:(out[row.edition]||0)+1}),{} as Record<string,number>);expect(Object.keys(counts).sort()).toEqual(['2014','both']);expect(counts.both).toBeGreaterThan(0);
 expect(evidence.owners.filter(o=>o.minLevel===2).map(o=>o.english).sort()).toEqual(['Paladin','Ranger']);expect(evidence.associations.every(a=>Number.isSafeInteger(a.spellLevel)&&a.spellLevel>=0&&a.spellLevel<=9)).toBe(true);
});
it('retains every original lookup base definition and never injects raw class arrays into382 original spells',()=>{
 const proof=optionalClassListSideProof();expect(proof.rawSpellClassesAbsent).toBe(true);expect(evidence.preservedLookupBaseDefinitionsSha256).toBe(proof.lookupBaseDefinitionsSha256);
 const bodies=optionalClassListOriginals(),spells=['spells/spells-phb.json','spells/spells-tce.json'].flatMap(path=>bodies[path].spell);expect(spells.length).toBe(382);expect(spells.filter(s=>s.classes!==undefined).length).toBe(0);
});
it('whole normalized fingerprints bind raw, entries, identity, edition, revision and arbitrary added source fields',()=>{
 const entry=optionalClassListTargets()[0],expected=optionalClassListSnapshot(entry);
 for(const field of ['raw','entries','id','edition','revision'] as const){const copy=structuredClone(entry);if(field==='raw')copy.raw={...copy.raw,authoredUnexpectedSourceField:true};else if(field==='entries')copy.entries=[...copy.entries,'authored changed'];else (copy as any)[field]='authored changed';expect(optionalClassListSnapshot(copy)===expected).toBe(false);}
});
it('fixture is source-only and public evidence carries no raw entries, policy prose, character cards or private paths',()=>{
 const fixture=readFileSync('tests/helpers/optionalClassListSourceFixture.ts','utf8'),imports=fixture.split('\n').filter(line=>line.startsWith('import '));expect(imports).toHaveLength(5);expect(imports.filter(line=>/model/.test(line)).every(line=>line.startsWith('import type '))).toBe(true);expect(imports.some(line=>/engine|automation\/state|optionalClassSpellListEvidence|FlowFixture/.test(line))).toBe(false);
 const forbidden=new Set(['raw','entries','text','body','policyText','fullBook','character','cards']);let invalid=0;const walk=(v:unknown)=>{if(!v||typeof v!=='object')return;for(const[k,x]of Object.entries(v)){if(forbidden.has(k))invalid++;walk(x);}};walk(evidence);expect(invalid).toBe(0);expect(/\/workspace\/|\.private\.json|\.local-evidence/.test(JSON.stringify(evidence))).toBe(false);
 expect(evidence.policy).toEqual({automatic:false,dmDiscussedInclusionAttestation:true,individualCasterChoice:true,twoPersonAuthenticationRequired:false,listEligibilityOnly:true,automaticKnownPreparedOrGrant:false});expect(evidence.wholeEntryCompletionCredit).toBe(0);expect(evidence.newReportWitnessCredit).toBe(0);
});
