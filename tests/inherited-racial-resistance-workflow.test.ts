import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {exportCharacter} from '../src/core/export';
import {readCharacter} from '../src/core/validation';
import {removeSelection} from '../src/core/sheet';
import {inheritedRacialResistanceFixture} from './helpers/inheritedRacialResistanceFlowFixture';
import {inheritedRacialResistanceSpecs,inheritedRacialResistanceHeldEntries,inheritedRacialResistanceSourceEvidence,inheritedRacialResistanceSnapshot as snapshot} from './helpers/inheritedRacialResistanceSourceFixture';
import {racialResistanceFixture} from './helpers/racialResistanceFlowFixture';
import {racialResistanceSpecs,racialResistanceSourceEvidence} from './helpers/racialResistanceSourceFixture';

beforeAll(()=>{inheritedRacialResistanceSourceEvidence();racialResistanceSourceEvidence();});
const sorted=(types:readonly string[]|undefined)=>[...(types||[])].sort();
const admitted=()=>{const keys=new Set(inheritedRacialResistanceSourceEvidence().rules.map(rule=>rule.key));return inheritedRacialResistanceSpecs.filter(spec=>keys.has(spec.key));};

it('all actually admitted inherited complete owners project their source types through both routes and native reopening without modifying the character or the earlier thirty-eight grants',()=>{
 expect(admitted().length).toBeGreaterThan(0);
 for(const form of ['canonical','app']as const)for(const spec of admitted()){const f=inheritedRacialResistanceFixture(spec.key,form),before=snapshot(f.c),d=evaluate(f.c);expect(f.rule.sourceProof.childResistOwnProperty).toBe(false);expect(f.c.selections.length).toBe(1);expect(sorted(d.resistances)).toEqual(sorted(spec.resistances));expect(d.trace.resistances.some(row=>row.includes(f.entry.name))).toBe(true);expect(d.issues.some(issue=>issue.id.startsWith('racial-resistance:'))).toBe(false);expect(snapshot(f.c)).toBe(before);const reopened=readCharacter(exportCharacter(f.c)).character;expect(snapshot(reopened)).toBe(before);expect(sorted(evaluate(reopened).resistances)).toEqual(sorted(spec.resistances));expect(snapshot(reopened)).toBe(before);expect(Object.hasOwn(reopened,'resistances')).toBe(false);expect(reopened.runtime.hp).toBe(3);expect(reopened.runtime.tempHp).toBe(2);expect(reopened.runtime.resources.manual.current).toBe(1);}
 // Retained R1 proof is its original complete-source fixture, not new evidence
 // attribution or a second source-credit count for those existing owners.
 expect(racialResistanceSpecs.length).toBe(38);for(const form of ['canonical','app']as const)for(const spec of racialResistanceSpecs){const f=racialResistanceFixture(spec.key,form),before=snapshot(f.c);expect(sorted(evaluate(f.c).resistances)).toEqual(sorted(spec.resistances));expect(snapshot(f.c)).toBe(before);}
});

it('a complete child needs no separately owned parent or transitive parent-ID permission, while current sources, concrete identities, root removal and explicit null or choice routes stay fail-closed',()=>{
 for(const spec of admitted()){const f=inheritedRacialResistanceFixture(spec.key),parentId=f.rule.sourceProof.parent.normalizedId;expect(typeof parentId).toBe('string');expect(parentId===f.entry.id).toBe(false);expect(f.c.selections.some(row=>row.entry.id===parentId)).toBe(false);f.c.profile.disabledEntries=[parentId];const before=snapshot(f.c);expect(sorted(evaluate(f.c).resistances)).toEqual(sorted(spec.resistances));expect(snapshot(f.c)).toBe(before);const reopened=readCharacter(exportCharacter(f.c)).character;expect(snapshot(reopened)).toBe(before);expect(sorted(evaluate(reopened).resistances)).toEqual(sorted(spec.resistances));expect(snapshot(reopened)).toBe(before);}
 for(const mode of ['source','canonical','automation','parent','duplicate','removed','forged']as const){const f=inheritedRacialResistanceFixture();if(mode==='source')f.c.profile.enabledSources=[];if(mode==='canonical')f.c.profile.disabledEntries=[f.entry.id];if(mode==='automation')f.c.automation!.enabled=false;if(mode==='parent')f.owner.parentId='authored-absent-parent';if(mode==='duplicate')f.c.selections.push({...structuredClone(f.owner),id:'authored-second-race-root'});if(mode==='removed')removeSelection(f.c,f.owner.id);if(mode==='forged')f.entry.raw.resist=['force'];const before=snapshot(f.c);expect(evaluate(f.c).resistances).toEqual([]);expect(snapshot(f.c)).toBe(before);const reopened=readCharacter(exportCharacter(f.c)).character;expect(snapshot(reopened)).toBe(before);expect(evaluate(reopened).resistances).toEqual([]);expect(snapshot(reopened)).toBe(before);expect(reopened.runtime.hp).toBe(3);expect(reopened.runtime.tempHp).toBe(2);expect(reopened.runtime.resources.manual.current).toBe(1);}
 for(const disabled of ['canonical','alias']as const){const f=inheritedRacialResistanceFixture(),canonicalId=f.entry.id;f.entry.id='authored-inherited-racial-resistance-alias';f.entry.revision='authored-transport-only';const before=snapshot(f.c);expect(sorted(evaluate(f.c).resistances)).toEqual(sorted(f.spec.resistances));expect(snapshot(f.c)).toBe(before);f.c.profile.disabledEntries=[disabled==='canonical'?canonicalId:f.entry.id];const paused=snapshot(f.c);expect(evaluate(f.c).resistances).toEqual([]);expect(snapshot(f.c)).toBe(paused);}
 const held=inheritedRacialResistanceHeldEntries();expect(held.length).toBeGreaterThan(0);for(const entry of held){const f=inheritedRacialResistanceFixture();f.owner.entry=structuredClone(entry);f.c.profile.enabledSources=[entry.source,...(entry.dependencies||[])];const before=snapshot(f.c);expect(evaluate(f.c).resistances).toEqual([]);expect(snapshot(f.c)).toBe(before);}
});
