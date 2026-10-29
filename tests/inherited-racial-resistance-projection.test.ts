import {beforeAll,expect,it} from 'vitest';
import type {Entry} from '../src/core/model';
import oldEvidence from '../src/core/automation/racialResistanceEvidence.json';
import ordinary from '../src/core/automation/ordinarySpellCastingEvidence.json';
import {projectRacialResistances,racialResistanceRule} from '../src/core/automation/racialResistances';
import {racialResistanceFixture} from './helpers/racialResistanceFlowFixture';
import {inheritedRacialResistanceFixture} from './helpers/inheritedRacialResistanceFlowFixture';
import {inheritedRacialResistanceSpecs,inheritedRacialResistanceHeldEntries,inheritedRacialResistanceSourceEvidence,inheritedRacialResistanceSnapshot as snapshot} from './helpers/inheritedRacialResistanceSourceFixture';

beforeAll(()=>{inheritedRacialResistanceSourceEvidence();},30000);
type Fixture=ReturnType<typeof inheritedRacialResistanceFixture>;
type Projection=ReturnType<typeof projectRacialResistances>;
function zero(p:Projection){expect(p.resistances.length).toBe(0);expect(p.grants.length).toBe(0);}
function positive(f:Fixture,p=projectRacialResistances(f.c)){expect(p.resistances.join(',')).toBe([...f.spec.resistances].sort().join(','));expect(p.grants.length).toBe(1);expect(p.grants[0].selectionId).toBe(f.owner.id);expect(p.grants[0].entryId).toBe(f.rule.id);expect(p.grants[0].resistances.join(',')).toBe([...f.spec.resistances].sort().join(','));expect(p.trace.length).toBeGreaterThan(0);}
function freeze(value:unknown):void{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}}

it('projects every newly authenticated inherited canonical and actual App owner while preserving all thirty-eight prior proof records',()=>{
 const fresh=inheritedRacialResistanceSourceEvidence();expect(fresh.rules.every(rule=>oldEvidence.rules.every(old=>old.id!==rule.id))).toBe(true);
 for(const form of ['canonical','app']as const)for(const spec of inheritedRacialResistanceSpecs){const f=inheritedRacialResistanceFixture(spec.key,form),before=snapshot(f.c);expect(racialResistanceRule(f.entry)?.id).toBe(f.rule.id);positive(f);expect(snapshot(f.c)).toBe(before);}
 expect(snapshot(oldEvidence.rules)).toBe('ce68b9fbd6a1932eeec348ce02b43d6d6dba155639c712986455c79a01aa5ca8');
});
it('preserves canonical and coherent unreserved aliases including unnamed child versus same-name parent and honors both opt-outs',()=>{
 for(const key of ['subrace/1','subrace/9','subrace/82'])for(const form of ['canonical','app']as const){const f=inheritedRacialResistanceFixture(key,form),canonicalId=f.rule.id;f.entry.id='authored-inherited-resistance-alias';f.entry.revision='authored-transport-only';expect(racialResistanceRule(f.entry)?.id).toBe(canonicalId);positive(f);for(const id of [canonicalId,f.entry.id]){f.c.profile.disabledEntries=[id];zero(projectRacialResistances(f.c));}delete f.c.profile.disabledEntries;f.entry.id=ordinary.canonicalIds.find(id=>id.startsWith('kiwee:spell:'))!;expect(racialResistanceRule(f.entry)===undefined).toBe(true);zero(projectRacialResistances(f.c));}
 const parent=racialResistanceFixture('race/143');parent.entry.id='authored-parent-tiefling-alias';parent.entry.revision='authored-parent-transport';expect(racialResistanceRule(parent.entry)?.id).toBe(parent.rule.id);expect(projectRacialResistances(parent.c).resistances.join(',')).toBe('fire');
});
it('rejects changed complete child or parent composition and does not repair unnamed child fields or localized payloads',()=>{
 const changes:((entry:Entry)=>void)[]=[e=>{e.raw.resist=['fire'];},e=>{e.raw._parentName='Authored parent';},e=>{e.raw._parentSource='AUTHORED';},e=>{e.raw._subraceName='Authored child';},e=>{e.raw.authoredExtra=true;},e=>{e.entries=[...e.entries,'Authored change'];},e=>{e.kind='item';},e=>{e.packId='authored-foreign';},e=>{e.source='AUTHORED';},e=>{e.edition=e.edition==='2014'?'2024':'2014';},e=>{e.name+=' Authored';},e=>{e.english+=' Authored';},e=>{e.page=(e.page??0)+1;}];
 for(const change of changes){const f=inheritedRacialResistanceFixture('subrace/82');change(f.entry);const before=snapshot(f.c);expect(racialResistanceRule(f.entry)===undefined).toBe(true);zero(projectRacialResistances(f.c));expect(snapshot(f.c)).toBe(before);}
 const f=inheritedRacialResistanceFixture('subrace/9');f.entry.raw.entries=[];expect(racialResistanceRule(f.entry)===undefined).toBe(true);zero(projectRacialResistances(f.c));
});
it('retains the exact unique root source active and protocol authority without adding item quantities or borrowing manual exceptions',()=>{
 const changes:((f:Fixture)=>void)[]=[f=>{f.owner.parentId='authored-missing';},f=>{f.owner.grantKey='authored-generated';},f=>{f.c.automation!.enabled=false;},f=>{f.c.automation!.protocol=99;},f=>{f.c.automation!.rulesVersion='authored-future';},f=>{f.c.profile.enabledSources=[];},f=>{f.c.profile.disabledEntries=[f.rule.id];}];
 for(const change of changes){const f=inheritedRacialResistanceFixture();change(f);const before=snapshot(f.c);zero(projectRacialResistances(f.c));expect(snapshot(f.c)).toBe(before);}
 for(const mode of ['same-root','alias-root','same-selection-id']as const){const f=inheritedRacialResistanceFixture(),other=structuredClone(f.owner);if(mode!=='same-selection-id')other.id='authored-second-owner';if(mode==='alias-root')other.entry.id='authored-second-coherent-alias';f.c.selections.push(other);zero(projectRacialResistances(f.c));}
 const f=inheritedRacialResistanceFixture();f.owner.quantity=2;positive(f);positive(f,projectRacialResistances(f.c,[f.owner]));zero(projectRacialResistances(f.c,[]));zero(projectRacialResistances(f.c,[structuredClone(f.owner)]));f.c.profile.enabledSources=[];f.c.profile.exceptions[f.entry.id]='Authored source exception';zero(projectRacialResistances(f.c,[f.owner]));
});
it('authenticates actual surviving replacement clauses and concrete child availability without inventing parent ownership or disable chains',()=>{
 for(const key of ['subrace/9','subrace/82']){const f=inheritedRacialResistanceFixture(key);expect(f.c.selections.length).toBe(1);positive(f);const parent=f.rule.sourceProof.parent;f.c.profile.disabledEntries=[parent.normalizedId];positive(f);
  if(!f.rule.requiredSources.includes(parent.header.source)){f.c.profile.enabledSources=f.rule.requiredSources.filter(source=>source!==parent.header.source);positive(f);}for(const source of f.rule.requiredSources){f.c.profile.enabledSources=f.rule.requiredSources.filter(value=>value!==source);zero(projectRacialResistances(f.c));}
 }
});
it('keeps all choice null-copy and version holds inactive and preserves frozen manual HP resource and ancestry state',()=>{
 for(const entry of inheritedRacialResistanceHeldEntries()){const f=inheritedRacialResistanceFixture();f.owner.entry=structuredClone(entry);f.c.profile.enabledSources=[entry.source,...(entry.dependencies||[])];const before=snapshot(f.c);expect(racialResistanceRule(entry)===undefined).toBe(true);zero(projectRacialResistances(f.c));expect(snapshot(f.c)).toBe(before);}
 for(const key of ['subrace/1','subrace/82']){const f=inheritedRacialResistanceFixture(key);f.c.locked=true;const before=snapshot(f.c);freeze(f.c);positive(f);expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.tempHp).toBe(2);expect(f.c.runtime.resources.manual.current).toBe(1);}
});
