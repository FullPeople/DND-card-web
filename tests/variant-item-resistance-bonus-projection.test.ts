import {beforeAll,expect,it} from 'vitest';
import type {Entry} from '../src/core/model';
import ordinary from '../src/core/automation/ordinarySpellCastingEvidence.json' with {type:'json'};
import {projectVariantItemResistanceBonuses,variantItemResistanceBonusFamilyId,variantItemResistanceBonusRule} from '../src/core/automation/variantItemResistanceBonuses';
import {variantItemResistanceBonusFixture} from './helpers/variantItemResistanceBonusFlowFixture';
import {variantItemResistanceBonusEntries,variantItemResistanceBonusSpecs,variantItemResistanceBonusSourceEvidence,variantItemResistanceBonusSnapshot as snapshot} from './helpers/variantItemResistanceBonusSourceFixture';

beforeAll(()=>{variantItemResistanceBonusSourceEvidence();},30000);
type Fixture=ReturnType<typeof variantItemResistanceBonusFixture>;
type Projection=ReturnType<typeof projectVariantItemResistanceBonuses>;
function zero(p:Projection){expect(p.resistances.length).toBe(0);expect(p.grants.length).toBe(0);}
function positive(f:Fixture,p=projectVariantItemResistanceBonuses(f.c)){
 expect(p.resistances.length).toBe(1);expect(p.resistances[0]).toBe(f.spec.resistance);expect(p.grants.length).toBe(1);expect(p.grants[0].selectionId).toBe(f.owner.id);expect(p.grants[0].entryId).toBe(f.rule.id);expect(p.grants[0].resistance).toBe(f.spec.resistance);expect(p.grants[0].snapshotSha256).toMatch(/^[a-f0-9]{64}$/);expect(p.trace.length).toBeGreaterThan(0);
}
function freeze(value:unknown):void{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}}

it('projects the complete fresh qualified canonical and actual App cohort with exact variant and base proof',()=>{
 expect(variantItemResistanceBonusSpecs.length).toBe(250);
 for(const form of ['canonical','app']as const)for(const spec of variantItemResistanceBonusSpecs){const f=variantItemResistanceBonusFixture(spec.key,form),before=snapshot(f.c);expect(variantItemResistanceBonusRule(f.entry)?.id).toBe(f.entry.id);expect(variantItemResistanceBonusFamilyId(f.entry)).toBe(f.entry.id);positive(f);expect(projectVariantItemResistanceBonuses(f.c).issues.length).toBe(0);expect(snapshot(f.c)).toBe(before);}
});
it('uses only concrete final sources and declared dependencies while unrelated base and template provenance toggles do not suspend',()=>{
 for(const key of ['23:38','24:39','195:38']){
  const f=variantItemResistanceBonusFixture(key),before=snapshot(f.c);expect(f.c.selections.length).toBe(1);positive(f);expect(snapshot(f.c)).toBe(before);
  const unrelatedIds=[f.rule.baseProof.normalized.id,f.rule.templateProof.normalized.id];expect(unrelatedIds.every(id=>id!==f.rule.id)).toBe(true);f.c.profile.disabledEntries=unrelatedIds;positive(f);
  for(const source of [f.rule.baseProof.normalized.source,f.rule.templateProof.normalized.source])if(source!==f.entry.source&&!(f.entry.dependencies||[]).includes(source)){f.c.profile.enabledSources=f.c.profile.enabledSources.filter(value=>value!==source);positive(f);f.c.profile.enabledSources.push(source);positive(f);}
  f.c.profile.enabledSources=f.c.profile.enabledSources.filter(source=>source!==f.entry.source);zero(projectVariantItemResistanceBonuses(f.c));f.c.profile.exceptions[f.entry.id]='Authored generic exception is not final source authority';zero(projectVariantItemResistanceBonuses(f.c));
 }
});
it('accepts coherent unreserved aliases but rejects canonical opt-outs reserved identities and changed full payloads',()=>{
 for(const key of ['23:38','24:39','195:38']){const f=variantItemResistanceBonusFixture(key),canonical=f.rule.id;f.entry.id='authored-coherent-variant-alias';f.entry.revision='authored-transport';expect(variantItemResistanceBonusRule(f.entry)?.id).toBe(canonical);positive(f);for(const id of [canonical,f.entry.id]){f.c.profile.disabledEntries=[id];zero(projectVariantItemResistanceBonuses(f.c));}delete f.c.profile.disabledEntries;f.entry.id=ordinary.canonicalIds.find(id=>id.startsWith('kiwee:spell:'))!;expect(typeof f.entry.id).toBe('string');expect(variantItemResistanceBonusRule(f.entry)===undefined).toBe(true);zero(projectVariantItemResistanceBonuses(f.c));}
 const changes:((entry:Entry)=>void)[]=[entry=>{entry.raw._variantIdentity+=' Authored';},entry=>{entry.raw.baseItem+=' Authored';},entry=>{entry.raw.type='S';},entry=>{entry.raw.resist=['火焰'];},entry=>{entry.raw._unresolvedVariant=true;},entry=>{entry.raw._copy={};},entry=>{entry.raw.authoredExtra=true;},entry=>{entry.entries=[...entry.entries,'Authored source change'];},entry=>{entry.packId='authored-foreign';},entry=>{entry.source='AUTHORED';},entry=>{entry.edition='2024';},entry=>{entry.kind='feat';},entry=>{entry.name+=' Authored';},entry=>{entry.english+=' Authored';},entry=>{(entry as any).authoredExtra=true;}];
 for(const change of changes){const f=variantItemResistanceBonusFixture();change(f.entry);const before=snapshot(f.c);expect(variantItemResistanceBonusRule(f.entry)===undefined).toBe(true);zero(projectVariantItemResistanceBonuses(f.c));expect(snapshot(f.c)).toBe(before);}
});
it('requires one currently worn attuned quantity-one physical root and supports no unknown automation protocol',()=>{
 const changes:((f:Fixture)=>void)[]=[f=>{f.c.automation!.enabled=false;},f=>{f.c.automation!.protocol=99;},f=>{f.c.automation!.rulesVersion='authored-future';},f=>{f.owner.quantity=0;},f=>{f.owner.quantity=2;},f=>{f.owner.quantity=1.5;},f=>{f.owner.quantity=NaN;},f=>{f.owner.parentId='authored-missing';},f=>{f.owner.parentId=f.owner.id;},f=>{f.owner.grantKey='authored-generated';},f=>{f.owner.requirementId='authored-choice';},f=>{f.owner.equipped=false;},f=>{f.owner.attuned=false;},f=>{(f.owner as any).equipped=1;},f=>{(f.owner as any).attuned=1;},f=>{delete (f.owner as any).equipped;Object.setPrototypeOf(f.owner,{equipped:true});},f=>{delete f.owner.attuned;Object.setPrototypeOf(f.owner,{attuned:true});}];
 for(const change of changes){const f=variantItemResistanceBonusFixture();change(f);const before=snapshot(f.c);zero(projectVariantItemResistanceBonuses(f.c));expect(snapshot(f.c)).toBe(before);}
});
it('does not double-count duplicate roots or selection ids and treats supplied active rows only as a current intersection',()=>{
 for(const mode of ['same-root','coherent-alias','duplicate-selection-id']as const){const f=variantItemResistanceBonusFixture(),copy=structuredClone(f.owner);if(mode!=='duplicate-selection-id')copy.id='authored-second-owner';if(mode==='coherent-alias')copy.entry.id='authored-second-coherent-alias';f.c.selections.push(copy);zero(projectVariantItemResistanceBonuses(f.c));}
 const f=variantItemResistanceBonusFixture();positive(f,projectVariantItemResistanceBonuses(f.c,[f.owner]));positive(f,projectVariantItemResistanceBonuses(f.c,[f.owner,f.owner]));zero(projectVariantItemResistanceBonuses(f.c,[]));zero(projectVariantItemResistanceBonuses(f.c,[structuredClone(f.owner)]));f.owner.equipped=false;zero(projectVariantItemResistanceBonuses(f.c,[structuredClone(f.owner)]));
});
it('reuses the current armor-slot conflict predicate without making shields or inactive armor conflict with a valid root',()=>{
 const f=variantItemResistanceBonusFixture(),other=variantItemResistanceBonusFixture('33:38'),copy=structuredClone(other.owner);copy.id='authored-second-armor';f.c.selections.push(copy);zero(projectVariantItemResistanceBonuses(f.c));zero(projectVariantItemResistanceBonuses(f.c,[f.owner]));
 copy.equipped=false;positive(f);copy.equipped=true;copy.quantity=0;positive(f);copy.quantity=1;f.c.profile.disabledEntries=[copy.entry.id];positive(f);delete f.c.profile.disabledEntries;copy.entry.raw.type='S';positive(f);
});
it('holds generic templates shields missing or forged variant identities and unrelated raw resistance instead of broadening the old denial',()=>{
 const evidence=variantItemResistanceBonusSourceEvidence();expect(evidence.holds.length).toBe(22);
 for(const held of evidence.holds){const h=held.normalized,f=variantItemResistanceBonusFixture();f.entry.id=h.id;f.entry.name=h.name;f.entry.english=h.english;f.entry.source=h.source;f.entry.raw._category=h.category;delete f.entry.raw._variantIdentity;f.c.profile.enabledSources=[h.source];const before=snapshot(f.c);expect(variantItemResistanceBonusRule(f.entry)===undefined).toBe(true);zero(projectVariantItemResistanceBonuses(f.c));expect(snapshot(f.c)).toBe(before);}
 const f=variantItemResistanceBonusFixture();delete f.entry.raw._variantIdentity;expect(variantItemResistanceBonusRule(f.entry)===undefined).toBe(true);zero(projectVariantItemResistanceBonuses(f.c));
 const foreign=variantItemResistanceBonusFixture();foreign.entry.id='authored-foreign-same-name';foreign.entry.packId='authored-foreign';foreign.entry.source='AUTHORED';foreign.entry.raw.source='AUTHORED';foreign.c.profile.enabledSources=['AUTHORED'];expect(variantItemResistanceBonusFamilyId(foreign.entry)===undefined).toBe(true);zero(projectVariantItemResistanceBonuses(foreign.c));
});
it('remains pure on frozen locked cards and keeps all source snapshots HP spent resources and manual values unchanged',()=>{
 expect(variantItemResistanceBonusEntries().length).toBe(250);
 for(const key of ['23:38','24:39','195:38']){const f=variantItemResistanceBonusFixture(key);f.c.locked=true;f.c.sheetBonuses={ac:7};f.c.saveBonuses={con:9};f.c.notes+='; authored manual resistance';const before=snapshot(f.c);freeze(f.c);positive(f);expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.resources.manual.current).toBe(1);}
});
