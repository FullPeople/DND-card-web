import {expect,it} from 'vitest';
import {ABILITIES,type Entry} from '../src/core/model';
import ordinary from '../src/core/automation/ordinarySpellCastingEvidence.json';
import {projectItemPassiveBonuses,itemPassiveBonusFamilyId,itemPassiveBonusRule,itemPassiveBonusSnapshot} from '../src/core/automation/itemPassiveBonuses';
import {itemPassiveBonusSpecs,itemPassiveBonusSnapshot as sourceSnapshot,type ItemPassiveBonusSpec} from './helpers/itemPassiveBonusSourceFixture';
import {itemPassiveBonusFixture} from './helpers/itemPassiveBonusFlowFixture';

type Projection=ReturnType<typeof projectItemPassiveBonuses>;
function numbers(actual:Pick<Projection,'acBonus'|'saveBonuses'>,spec:Pick<ItemPassiveBonusSpec,'acBonus'|'saveBonuses'>){
 expect(actual.acBonus).toBe(spec.acBonus);for(const ability of ABILITIES)expect(actual.saveBonuses[ability]??0).toBe(spec.saveBonuses[ability]??0);
}
function zero(actual:Projection){numbers(actual,{acBonus:0,saveBonuses:{}});expect(actual.grants).toHaveLength(0);}
function fullFreeze(value:unknown):void{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(fullFreeze);Object.freeze(value);}}
function joinOwners(first:ReturnType<typeof itemPassiveBonusFixture>,second:ReturnType<typeof itemPassiveBonusFixture>){
 const owner=structuredClone(second.owner);owner.id='second-physical-passive-owner';first.c.selections.push(owner);first.c.profile.enabledSources=[...new Set([...first.c.profile.enabledSources,...second.c.profile.enabledSources])];return owner;
}

it('projects all sixteen actual canonical and App-final positives from independent reviewed source numbers',()=>{
 expect(itemPassiveBonusSpecs).toHaveLength(16);
 for(const form of ['canonical','app']as const)for(const spec of itemPassiveBonusSpecs){
  const f=itemPassiveBonusFixture(spec.sourceIndex,form),before=sourceSnapshot(f.c),actual=projectItemPassiveBonuses(f.c);
  expect(itemPassiveBonusRule(f.entry)?.id).toBe(f.rule.id);expect(itemPassiveBonusFamilyId(f.entry)).toBe(f.rule.id);numbers(actual,spec);
  expect(actual.grants).toHaveLength(1);const grant=actual.grants[0];expect(grant.selectionId).toBe(f.owner.id);expect(grant.entryId).toBe(f.entry.id);expect(grant.source).toBe(f.entry.source);expect(grant.sourceCondition).toBe(spec.sourceCondition);expect(grant.snapshotSha256).toMatch(/^[a-f0-9]{64}$/);numbers(grant,spec);
  expect(Array.isArray(actual.acTrace)).toBe(true);if(spec.acBonus>0)expect(actual.acTrace.length).toBeGreaterThan(0);for(const ability of ABILITIES)if((spec.saveBonuses[ability]??0)>0){expect(Array.isArray(actual.saveTrace[ability])).toBe(true);expect(actual.saveTrace[ability]!.length).toBeGreaterThan(0);}expect(actual.issues).toHaveLength(0);expect(sourceSnapshot(f.c)).toBe(before);
 }
});
it('uses literal current worn/on-person and attunement conditions while all seven attuned-only sources work unequipped',()=>{
 const attunedOnly=itemPassiveBonusSpecs.filter(spec=>spec.sourceCondition==='attuned-only');expect(attunedOnly).toHaveLength(7);
 for(const spec of itemPassiveBonusSpecs){
  const f=itemPassiveBonusFixture(spec.sourceIndex);f.owner.equipped=false;
  if(spec.sourceCondition==='attuned-only')numbers(projectItemPassiveBonuses(f.c),spec);else zero(projectItemPassiveBonuses(f.c));
  f.owner.equipped=true;f.owner.attuned=false;zero(projectItemPassiveBonuses(f.c));
  (f.owner as any).attuned=1;zero(projectItemPassiveBonuses(f.c));f.owner.attuned=true;
  if(spec.sourceCondition!=='attuned-only'){(f.owner as any).equipped=1;zero(projectItemPassiveBonuses(f.c));}
 }
});
it('accepts only full-source coherent unknown aliases and applies canonical opt-outs before granting alias mechanics',()=>{
 const f=itemPassiveBonusFixture(),canonicalId=f.rule.id;f.entry.id='authored-coherent-unreserved-passive-alias';f.entry.revision='authored-compatible-transport-revision';
 expect(itemPassiveBonusFamilyId(f.entry)).toBe(canonicalId);expect(itemPassiveBonusRule(f.entry)?.id).toBe(canonicalId);numbers(projectItemPassiveBonuses(f.c),f.spec);
 for(const id of [canonicalId,f.entry.id]){f.c.profile.disabledEntries=[id];zero(projectItemPassiveBonuses(f.c));}delete f.c.profile.disabledEntries;
 const foreignCanonical=ordinary.canonicalIds.find(id=>id.startsWith('kiwee:spell:'))!;expect(foreignCanonical!==undefined).toBe(true);f.entry.id=foreignCanonical;expect(itemPassiveBonusRule(f.entry)).toBeUndefined();zero(projectItemPassiveBonuses(f.c));
});
it('rejects complete-source changes to raw, entries, identity, edition, effects, choices and arbitrary added payload',()=>{
 const changes:((entry:Entry)=>void)[]=[entry=>{entry.raw.authoredExtra=true;},entry=>{entry.entries=[...entry.entries,'Authored source change'];},entry=>{entry.kind='feat';},entry=>{entry.packId='authored-foreign';},entry=>{entry.source='AUTHORED';},entry=>{entry.edition=entry.edition==='2024'?'2014':'2024';},entry=>{entry.page=(entry.page??0)+1;},entry=>{entry.english+=' Authored';},entry=>{entry.name+=' Authored';},entry=>{(entry as any).effects=[...(entry.effects||[]),{type:'authored-extra'}];},entry=>{(entry as any).choices=[...(entry.choices||[]),{id:'authored-extra'}];},entry=>{(entry as any).authoredUnexpectedField=true;}];
 for(const change of changes){const f=itemPassiveBonusFixture(),before=itemPassiveBonusSnapshot(f.entry);change(f.entry);expect(itemPassiveBonusSnapshot(f.entry)).not.toBe(before);expect(itemPassiveBonusRule(f.entry)).toBeUndefined();zero(projectItemPassiveBonuses(f.c));}
});
it('holds disabled or unknown automation, unavailable sources, invalid quantities and missing/cyclic ancestry',()=>{
 const changes:((f:ReturnType<typeof itemPassiveBonusFixture>)=>void)[]=[f=>{f.c.automation!.enabled=false;},f=>{f.c.automation!.protocol=99;},f=>{f.c.automation!.rulesVersion='authored-future';},f=>{f.c.profile.enabledSources=[];},f=>{f.c.profile.disabledEntries=[f.rule.id];},f=>{f.owner.quantity=0;},f=>{f.owner.quantity=2;},f=>{f.owner.quantity=1.5;},f=>{f.owner.quantity=NaN;},f=>{f.owner.parentId='authored-missing-parent';},f=>{f.owner.parentId=f.owner.id;},f=>{f.owner.grantKey='authored-granted-item';},f=>{f.owner.requirementId='authored-choice-owned-item';}];
 for(const change of changes){const f=itemPassiveBonusFixture();change(f);const before=sourceSnapshot(f.c);zero(projectItemPassiveBonuses(f.c));expect(sourceSnapshot(f.c)).toBe(before);}
 const f=itemPassiveBonusFixture();f.c.profile.enabledSources=[];f.c.profile.exceptions[f.entry.id]='Authored exception is not source proof';zero(projectItemPassiveBonuses(f.c));
});
it('never double-counts duplicate roots, coherent alias roots or duplicate selection IDs',()=>{
 for(const mode of ['same-source-root','alias-root','duplicate-selection-id']as const){
  const f=itemPassiveBonusFixture(),copy=structuredClone(f.owner);if(mode!=='duplicate-selection-id')copy.id='authored-second-root';if(mode==='alias-root')copy.entry.id='authored-second-coherent-alias';f.c.selections.push(copy);
  const before=sourceSnapshot(f.c);zero(projectItemPassiveBonuses(f.c));expect(sourceSnapshot(f.c)).toBe(before);
 }
});
it('treats providedActive only as an intersection with current owned selections, never an alternate source of eligibility',()=>{
 const f=itemPassiveBonusFixture();numbers(projectItemPassiveBonuses(f.c,[f.owner]),f.spec);zero(projectItemPassiveBonuses(f.c,[]));numbers(projectItemPassiveBonuses(f.c,[f.owner,f.owner]),f.spec);
 const supplied=structuredClone(f.owner);f.owner.equipped=false;zero(projectItemPassiveBonuses(f.c,[supplied]));f.owner.equipped=true;f.owner.attuned=false;zero(projectItemPassiveBonuses(f.c,[supplied]));f.owner.attuned=true;
 const stranger=structuredClone(f.owner);stranger.id='authored-not-owned';zero(projectItemPassiveBonuses(f.c,[stranger]));numbers(projectItemPassiveBonuses(f.c,[f.owner,stranger]),f.spec);
 const duplicate=structuredClone(f.owner);duplicate.id='second-current-physical-root';f.c.selections.push(duplicate);zero(projectItemPassiveBonuses(f.c,[f.owner]));
});
it('holds only otherwise-eligible members of the three literal reviewed cross-edition overlap groups',()=>{
 const pairs=[{group:'cloak-protection-editions',indices:[453,454]},{group:'ring-protection-editions',indices:[1794,1795]},{group:'robe-stars-editions',indices:[1840,1841]}]as const;
 for(const pair of pairs){
  const f=itemPassiveBonusFixture(pair.indices[0]),other=itemPassiveBonusFixture(pair.indices[1]);expect((f.rule as any).projectionPolicy.overlapGroup).toBe(pair.group);expect((other.rule as any).projectionPolicy.overlapGroup).toBe(pair.group);expect(f.rule.id).not.toBe(other.rule.id);expect(f.rule.edition).not.toBe(other.rule.edition);numbers(projectItemPassiveBonuses(f.c),f.spec);
  const owner=joinOwners(f,other),overlap=projectItemPassiveBonuses(f.c);zero(overlap);expect(overlap.issues.length).toBeGreaterThan(0);
  for(const condition of ['source-off','unattuned','unequipped']as const){
   f.c.profile.enabledSources=[...new Set([f.entry.source,owner.entry.source,...(f.entry.dependencies||[]),...(owner.entry.dependencies||[])])];owner.attuned=true;owner.equipped=true;
   if(condition==='source-off')f.c.profile.enabledSources=f.c.profile.enabledSources.filter(source=>source!==owner.entry.source);if(condition==='unattuned')owner.attuned=false;if(condition==='unequipped')owner.equipped=false;
   numbers(projectItemPassiveBonuses(f.c),f.spec);
  }
 }
 const cloak=itemPassiveBonusFixture(453),ring=itemPassiveBonusFixture(1794);joinOwners(cloak,ring);const sum={acBonus:cloak.spec.acBonus+ring.spec.acBonus,saveBonuses:Object.fromEntries(ABILITIES.map(ability=>[ability,(cloak.spec.saveBonuses[ability]??0)+(ring.spec.saveBonuses[ability]??0)]))};numbers(projectItemPassiveBonuses(cloak.c),sum);
});
it('is read-only even for frozen locked cards and preserves authored native resources, manual values and selections',()=>{
 for(const sourceIndex of [453,422,2492]){const f=itemPassiveBonusFixture(sourceIndex);f.c.locked=true;f.c.saveBonuses={str:9};f.c.sheetBonuses={ac:7};const before=sourceSnapshot(f.c),manual=sourceSnapshot([f.c.runtime,f.c.notes,f.c.saveBonuses,f.c.sheetBonuses,f.c.selections]);fullFreeze(f.c);let actual:Projection|undefined;expect(()=>{actual=projectItemPassiveBonuses(f.c);}).not.toThrow();numbers(actual!,f.spec);expect(sourceSnapshot(f.c)).toBe(before);expect(sourceSnapshot([f.c.runtime,f.c.notes,f.c.saveBonuses,f.c.sheetBonuses,f.c.selections])).toBe(manual);}
});
it('does not classify or project same-name foreign items or donate source authority to arbitrary numeric fields',()=>{
 const f=itemPassiveBonusFixture();f.entry.id='authored-foreign-same-name';f.entry.packId='authored-foreign';f.entry.source='AUTHORED';f.entry.raw.source='AUTHORED';f.c.profile.enabledSources=['AUTHORED'];f.entry.raw.bonusAc=99;f.entry.raw.bonusSavingThrow=99;
 expect(itemPassiveBonusFamilyId(f.entry)).toBeUndefined();expect(itemPassiveBonusRule(f.entry)).toBeUndefined();zero(projectItemPassiveBonuses(f.c));
});
