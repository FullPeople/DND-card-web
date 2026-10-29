import {beforeAll,expect,it} from 'vitest';
import type {Entry} from '../src/core/model';
import ordinary from '../src/core/automation/ordinarySpellCastingEvidence.json' with {type:'json'};
import {projectRelativeRacialMovement,relativeRacialMovementFamilyId,relativeRacialMovementRule} from '../src/core/automation/relativeRacialMovement';
import {relativeRacialMovementFixture} from './helpers/relativeRacialMovementFlowFixture';
import {relativeRacialMovementSpecs,relativeRacialMovementHeldEntries,relativeRacialMovementSourceEvidence,relativeRacialMovementSnapshot as snapshot} from './helpers/relativeRacialMovementSourceFixture';
import {racialMovementFixture,racialMovementSpecs} from './helpers/racialMovementFixture';

beforeAll(()=>{relativeRacialMovementSourceEvidence();},30000);
type Fixture=ReturnType<typeof relativeRacialMovementFixture>;
type Projection=ReturnType<typeof projectRelativeRacialMovement>;
function zero(p:Projection){expect(Object.keys(p.modes).length).toBe(0);expect(p.grants.length).toBe(0);}
function positive(f:Fixture,walkingSpeed=50,p=projectRelativeRacialMovement(f.c,walkingSpeed)){
 expect(Object.keys(p.modes).length).toBe(1);expect(p.modes[f.spec.mode]).toBe(walkingSpeed);expect(p.grants.length).toBe(1);
 const grant=p.grants[0];expect(grant.selectionId).toBe(f.owner.id);expect(grant.entryId).toBe(f.rule.id);expect(grant.mode).toBe(f.spec.mode);expect(grant.feet).toBe(walkingSpeed);expect(grant.walkingSpeed).toBe(walkingSpeed);expect(grant.relation).toBe('equal-current-walking');expect(p.trace.length).toBeGreaterThan(0);
}
function freeze(value:unknown):void{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}}

it('projects all six canonical and actual App source routes from supplied current walking including zero without raw-base substitution',()=>{
 expect(relativeRacialMovementSpecs.length).toBe(6);
 for(const form of ['canonical','app']as const)for(const spec of relativeRacialMovementSpecs){const f=relativeRacialMovementFixture(spec.id,form),before=snapshot(f.c);expect(relativeRacialMovementRule(f.entry)?.id).toBe(spec.id);expect(relativeRacialMovementFamilyId(f.entry)).toBe(spec.id);for(const value of [50,17,0,12.5])positive(f,value);expect(projectRelativeRacialMovement(f.c,50).issues.length).toBe(0);expect(snapshot(f.c)).toBe(before);}
});
it('holds missing nonnumeric nonfinite and negative walking context instead of repairing it or falling back to source speed',()=>{
 for(const spec of relativeRacialMovementSpecs)for(const value of [undefined,null,'30',{},NaN,Infinity,-Infinity,-1]){const f=relativeRacialMovementFixture(spec.id),before=snapshot(f.c),p=projectRelativeRacialMovement(f.c,value as number);zero(p);expect(p.issues.some(issue=>issue.id.startsWith('relative-racial-movement:'))).toBe(true);expect(snapshot(f.c)).toBe(before);}
});
it('accepts only coherent unreserved full-source aliases and honors canonical and alias disable authority',()=>{
 for(const spec of relativeRacialMovementSpecs){const f=relativeRacialMovementFixture(spec.id);f.entry.id='authored-relative-movement-alias';f.entry.revision='authored-current-transport';expect(relativeRacialMovementFamilyId(f.entry)).toBe(spec.id);expect(relativeRacialMovementRule(f.entry)?.id).toBe(spec.id);positive(f);
  for(const id of [spec.id,f.entry.id]){f.c.profile.disabledEntries=[id];zero(projectRelativeRacialMovement(f.c,50));}delete f.c.profile.disabledEntries;
  f.entry.id=ordinary.canonicalIds.find(id=>id.startsWith('kiwee:spell:'))!;expect(typeof f.entry.id).toBe('string');expect(relativeRacialMovementRule(f.entry)===undefined).toBe(true);zero(projectRelativeRacialMovement(f.c,50));
 }
});
it('rejects changed complete headers parent composition entries effects and arbitrary added payload without source-name inference',()=>{
 const changes:((entry:Entry)=>void)[]=[entry=>{entry.raw.speed={walk:999,swim:true};},entry=>{entry.entries=[...entry.entries,'Authored source change'];},entry=>{entry.raw.authoredParent='Authored parent';},entry=>{entry.kind='item';},entry=>{entry.packId='authored-foreign';},entry=>{entry.source='AUTHORED';},entry=>{entry.edition='2024';},entry=>{entry.name+=' Authored';},entry=>{entry.english+=' Authored';},entry=>{entry.page=(entry.page??0)+1;},entry=>{(entry as any).effects=[{target:'speed',op:'add',value:999}];},entry=>{(entry as any).authoredExtra=true;}];
 for(const change of changes){const f=relativeRacialMovementFixture();change(f.entry);const before=snapshot(f.c);expect(relativeRacialMovementRule(f.entry)===undefined).toBe(true);zero(projectRelativeRacialMovement(f.c,50));expect(snapshot(f.c)).toBe(before);}
 const f=relativeRacialMovementFixture();f.entry.id='authored-foreign-same-name';f.entry.packId='authored-foreign';f.entry.source='AUTHORED';f.entry.raw.source='AUTHORED';f.c.profile.enabledSources=['AUTHORED'];expect(relativeRacialMovementFamilyId(f.entry)===undefined).toBe(true);zero(projectRelativeRacialMovement(f.c,50));
});
it('requires one genuine current race root and pauses unavailable sources and unknown automation without card writes',()=>{
 const changes:((f:Fixture)=>void)[]=[f=>{f.c.automation!.enabled=false;},f=>{f.c.automation!.protocol=99;},f=>{f.c.automation!.rulesVersion='authored-future';},f=>{f.c.profile.enabledSources=[];},f=>{f.owner.quantity=0;},f=>{f.owner.quantity=2;},f=>{f.owner.quantity=1.5;},f=>{f.owner.quantity=NaN;},f=>{f.owner.parentId='authored-missing';},f=>{f.owner.parentId=f.owner.id;},f=>{f.owner.grantKey='authored-generated';},f=>{f.owner.requirementId='authored-choice';}];
 for(const change of changes){const f=relativeRacialMovementFixture();change(f);const before=snapshot(f.c);zero(projectRelativeRacialMovement(f.c,50));expect(snapshot(f.c)).toBe(before);}
 for(const mode of ['same-root','alias-root','another-race','cross-kind-same-selection-id']as const){const f=relativeRacialMovementFixture(),copy=structuredClone(f.owner);if(mode!=='cross-kind-same-selection-id')copy.id='authored-second-race';if(mode==='alias-root')copy.entry.id='authored-second-coherent-alias';if(mode==='another-race')copy.entry=structuredClone(relativeRacialMovementFixture('race/105').entry);if(mode==='cross-kind-same-selection-id')copy.entry.kind='item';f.c.selections.push(copy);zero(projectRelativeRacialMovement(f.c,50));}
 const f=relativeRacialMovementFixture();f.c.profile.enabledSources=[];f.c.profile.exceptions[f.entry.id]='Authored exception is not source authority';zero(projectRelativeRacialMovement(f.c,50));
});
it('treats supplied active rows as an intersection only and authenticates composed Water Genasi without separately selected ancestry',()=>{
 const f=relativeRacialMovementFixture('subrace/34');expect(f.c.selections.length).toBe(1);positive(f,50,projectRelativeRacialMovement(f.c,50,[f.owner]));zero(projectRelativeRacialMovement(f.c,50,[]));positive(f,50,projectRelativeRacialMovement(f.c,50,[f.owner,f.owner]));
 const copy=structuredClone(f.owner);zero(projectRelativeRacialMovement(f.c,50,[copy]));f.c.profile.enabledSources=[];zero(projectRelativeRacialMovement(f.c,50,[copy]));
});
it('keeps linked-Speed ambiguity absent-clause races and all twelve fixed-base owners outside the new relation domain',()=>{
 const held=relativeRacialMovementHeldEntries();expect(held.length).toBe(3);
 for(const entry of held){const f=relativeRacialMovementFixture();f.owner.entry=structuredClone(entry);f.c.profile.enabledSources=[entry.source,...(entry.dependencies||[])];const before=snapshot(f.c),p=projectRelativeRacialMovement(f.c,50);expect(relativeRacialMovementRule(entry)===undefined).toBe(true);zero(p);expect(p.issues.length).toBeGreaterThan(0);expect(snapshot(f.c)).toBe(before);}
 for(const spec of racialMovementSpecs){const f=racialMovementFixture(spec.id),before=snapshot(f.c);zero(projectRelativeRacialMovement(f.c,50));expect(snapshot(f.c)).toBe(before);}
});
it('is read-only on locked frozen cards and grants no ancestor transfer level-three wall capability armor policy or resource state',()=>{
 for(const spec of relativeRacialMovementSpecs){const f=relativeRacialMovementFixture(spec.id);f.c.locked=true;f.owner.level=1;const before=snapshot(f.c);freeze(f.c);positive(f);expect(snapshot(f.c)).toBe(before);expect(Object.keys(projectRelativeRacialMovement(f.c,50)).sort().join(',')).toBe('grants,issues,modes,trace');}
});
