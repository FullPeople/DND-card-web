import {beforeAll,expect,it} from 'vitest';
import type {Entry} from '../src/core/model';
import ordinary from '../src/core/automation/ordinarySpellCastingEvidence.json' with {type:'json'};
import {projectRacialResistances,racialResistanceRule,racialResistanceFamilyId} from '../src/core/automation/racialResistances';
import {racialResistanceFixture} from './helpers/racialResistanceFlowFixture';
import {racialResistanceSpecs,racialResistanceHeldEntries,racialResistanceSourceEvidence,racialResistanceSnapshot as snapshot} from './helpers/racialResistanceSourceFixture';

beforeAll(()=>{racialResistanceSourceEvidence();},30000);
type Fixture=ReturnType<typeof racialResistanceFixture>;
type Projection=ReturnType<typeof projectRacialResistances>;
function zero(p:Projection){expect(p.resistances.length).toBe(0);expect(p.grants.length).toBe(0);}
function positive(f:Fixture,p=projectRacialResistances(f.c)){
 expect(p.resistances.join(',')).toBe([...f.spec.resistances].sort().join(','));expect(p.grants.length).toBe(1);expect(p.grants[0].selectionId).toBe(f.owner.id);expect(p.grants[0].entryId).toBe(f.rule.id);expect(p.grants[0].resistances.join(',')).toBe([...f.spec.resistances].sort().join(','));expect(p.trace.length).toBeGreaterThan(0);
}
function freeze(value:unknown):void{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}}

it('projects every source-qualified canonical and actual App fixed resistance without changing the complete card',()=>{
 for(const form of ['canonical','app']as const)for(const spec of racialResistanceSpecs){const f=racialResistanceFixture(spec.key,form),before=snapshot(f.c);expect(racialResistanceRule(f.entry)?.id).toBe(f.rule.id);expect(racialResistanceFamilyId(f.entry)).toBe(f.rule.id);positive(f);expect(projectRacialResistances(f.c).issues.length).toBe(0);expect(snapshot(f.c)).toBe(before);}
});
it('accepts only coherent unreserved aliases and honors canonical and alias opt-outs independently',()=>{
 for(const key of ['race/3','subrace/34'])for(const form of ['canonical','app']as const){const f=racialResistanceFixture(key,form),canonicalId=f.rule.id;f.entry.id='authored-racial-resistance-alias';f.entry.revision='authored-transport-only';expect(racialResistanceRule(f.entry)?.id).toBe(canonicalId);positive(f);
  for(const id of [canonicalId,f.entry.id]){f.c.profile.disabledEntries=[id];zero(projectRacialResistances(f.c));}delete f.c.profile.disabledEntries;
  f.entry.id=ordinary.canonicalIds.find(id=>id.startsWith('kiwee:spell:'))!;expect(typeof f.entry.id).toBe('string');expect(racialResistanceRule(f.entry)===undefined).toBe(true);zero(projectRacialResistances(f.c));
 }
});
it('rejects changed complete payloads header edition pack parent composition and arbitrary copied numeric tags',()=>{
 const changes:((entry:Entry)=>void)[]=[e=>{e.raw.resist=['fire'];},e=>{e.entries=[...e.entries,'Authored source change'];},e=>{e.raw.authoredParent='Authored parent';},e=>{e.kind='item';},e=>{e.packId='authored-foreign';},e=>{e.source='AUTHORED';},e=>{e.edition=e.edition==='2024'?'2014':'2024';},e=>{e.name+=' Authored';},e=>{e.english+=' Authored';},e=>{e.page=(e.page??0)+1;},e=>{(e as any).effects=[{target:'resistance',value:'all'}];},e=>{(e as any).authoredExtra=true;}];
 for(const change of changes){const f=racialResistanceFixture();change(f.entry);const before=snapshot(f.c);expect(racialResistanceRule(f.entry)===undefined).toBe(true);zero(projectRacialResistances(f.c));expect(snapshot(f.c)).toBe(before);}
 const f=racialResistanceFixture();f.entry.id='authored-foreign-same-name';f.entry.packId='authored-foreign';f.entry.source='AUTHORED';f.entry.raw.source='AUTHORED';f.c.profile.enabledSources=['AUTHORED'];expect(racialResistanceFamilyId(f.entry)===undefined).toBe(true);zero(projectRacialResistances(f.c));
});
it('requires an authentic unique race root but never invents an item-quantity prerequisite for classifying a race',()=>{
 const changes:((f:Fixture)=>void)[]=[f=>{f.owner.parentId='authored-missing';},f=>{f.owner.parentId=f.owner.id;},f=>{f.owner.grantKey='authored-generated';},f=>{f.owner.requirementId='authored-choice';},f=>{(f.owner as any).id='';},f=>{delete (f.owner as any).id;Object.setPrototypeOf(f.owner,{id:'authored-inherited-id'});}];
 for(const change of changes){const f=racialResistanceFixture();change(f);const before=snapshot(f.c);zero(projectRacialResistances(f.c));expect(snapshot(f.c)).toBe(before);}
 for(const quantity of [0,2,1.5]){const f=racialResistanceFixture();f.owner.quantity=quantity;positive(f);}
 for(const mode of ['same-root','alias-root','another-race','cross-kind-id-collision']as const){const f=racialResistanceFixture(),copy=structuredClone(f.owner);if(mode!=='cross-kind-id-collision')copy.id='authored-second-race';if(mode==='alias-root')copy.entry.id='authored-coherent-second-alias';if(mode==='another-race')copy.entry=structuredClone(racialResistanceFixture('race/4').entry);if(mode==='cross-kind-id-collision')copy.entry.kind='item';f.c.selections.push(copy);zero(projectRacialResistances(f.c));}
});
it('holds unavailable exact sources declared dependencies canonical authority and unknown automation without manual repair',()=>{
 const changes:((f:Fixture)=>void)[]=[f=>{f.c.automation!.enabled=false;},f=>{f.c.automation!.protocol=99;},f=>{f.c.automation!.rulesVersion='authored-future';},f=>{f.c.profile.enabledSources=[];},f=>{f.c.profile.disabledEntries=[f.rule.id];}];
 for(const change of changes){const f=racialResistanceFixture();change(f);const before=snapshot(f.c);zero(projectRacialResistances(f.c));expect(snapshot(f.c)).toBe(before);}
 for(const spec of racialResistanceSpecs){const f=racialResistanceFixture(spec.key);for(const source of f.rule.requiredSources){f.c.profile.enabledSources=f.rule.requiredSources.filter(value=>value!==source);zero(projectRacialResistances(f.c));}f.c.profile.enabledSources=[...f.rule.requiredSources];positive(f);}
 const f=racialResistanceFixture();f.c.profile.enabledSources=[];f.c.profile.exceptions[f.entry.id]='Authored exception is not source permission';zero(projectRacialResistances(f.c));
});
it('uses supplied active rows only as a current intersection and retains complete subrace ownership without parent-row demands',()=>{
 const f=racialResistanceFixture('subrace/34');expect(f.c.selections.length).toBe(1);positive(f,projectRacialResistances(f.c,[f.owner]));zero(projectRacialResistances(f.c,[]));positive(f,projectRacialResistances(f.c,[f.owner,f.owner]));zero(projectRacialResistances(f.c,[structuredClone(f.owner)]));
 // Disabling an independently catalogued parent identity is not an invented
 // transitive switch for this concrete fully-composed selected subrace.
 const parentId=f.rule.sourceProof.parent!.normalizedId;expect(typeof parentId).toBe('string');expect(parentId===f.rule.id).toBe(false);f.c.profile.disabledEntries=[parentId];positive(f);f.c.profile.enabledSources=[];zero(projectRacialResistances(f.c,[f.owner]));
});
it('keeps choice null-override copy inherited-only and version-only rows outside this closed direct-clause domain',()=>{
 const held=racialResistanceHeldEntries();expect(held.length).toBeGreaterThan(0);
 for(const entry of held){const f=racialResistanceFixture();f.owner.entry=structuredClone(entry);f.c.profile.enabledSources=[entry.source,...(entry.dependencies||[])];const before=snapshot(f.c);expect(racialResistanceRule(entry)===undefined).toBe(true);zero(projectRacialResistances(f.c));expect(snapshot(f.c)).toBe(before);}
 const f=racialResistanceFixture();f.owner.entry={...structuredClone(f.entry),id:'authored-unknown-race',name:'Authored unknown race',english:'Authored unknown race',raw:{name:'Authored unknown race',source:f.entry.source,resist:['fire']}};zero(projectRacialResistances(f.c));
});
it('stays read-only on locked frozen cards and does not infer immunity advantage conditional resistance or HP damage automation',()=>{
 for(const key of ['race/3','subrace/34']){const f=racialResistanceFixture(key);f.c.locked=true;f.c.notes+=' immunity all damage 777';f.owner.level=20;const before=snapshot(f.c);freeze(f.c);const p=projectRacialResistances(f.c);positive(f,p);expect(Object.keys(p).sort().join(',')).toBe('grants,issues,resistances,trace');expect(p.resistances.includes('all' as (typeof p.resistances)[number])).toBe(false);expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.resources.manual.current).toBe(1);}
});
