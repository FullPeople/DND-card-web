import {beforeAll,expect,it} from 'vitest';
import type {Entry,Selection} from '../src/core/model';
import ordinary from '../src/core/automation/ordinarySpellCastingEvidence.json' with {type:'json'};
import {projectItemResistanceBonuses,itemResistanceBonusFamilyId,itemResistanceBonusRule,itemResistanceBonusSnapshot} from '../src/core/automation/itemResistanceBonuses';
import {itemResistanceBonusHeldEntries,itemResistanceBonusSpecs,itemResistanceBonusSnapshot as sourceSnapshot,itemResistanceBonusSourceEvidence} from './helpers/itemResistanceBonusSourceFixture';
import {itemResistanceBonusFixture} from './helpers/itemResistanceBonusFlowFixture';

beforeAll(()=>{itemResistanceBonusSourceEvidence();},30000);
type Fixture=ReturnType<typeof itemResistanceBonusFixture>;
type Projection=ReturnType<typeof projectItemResistanceBonuses>;
function zero(actual:Projection){expect(actual.resistances.length).toBe(0);expect(actual.grants.length).toBe(0);}
function positive(f:Fixture,actual=projectItemResistanceBonuses(f.c)){
 expect(actual.resistances.length).toBe(1);expect(actual.resistances[0]).toBe(f.spec.resistance);expect(actual.grants.length).toBe(1);
 expect(actual.grants[0].selectionId).toBe(f.owner.id);expect(actual.grants[0].entryId).toBe(f.rule.id);expect(actual.grants[0].resistance).toBe(f.spec.resistance);
 expect(actual.trace.length).toBeGreaterThan(0);expect(actual.grants[0].snapshotSha256).toMatch(/^[a-f0-9]{64}$/);
}
function addOwner(f:Fixture,second:Fixture){const row=structuredClone(second.owner);row.id='second-physical-resistance-owner';f.c.selections.push(row);f.c.profile.enabledSources=[...new Set([...f.c.profile.enabledSources,...second.c.profile.enabledSources])];return row;}
function freeze(value:unknown):void{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}}

it('projects all thirty genuine canonical and actual App forms with exact complete-source proofs',()=>{
 expect(itemResistanceBonusSpecs.length).toBe(30);
 for(const form of ['canonical','app']as const)for(const spec of itemResistanceBonusSpecs){const f=itemResistanceBonusFixture(spec.sourceIndex,form),before=sourceSnapshot(f.c);expect(itemResistanceBonusRule(f.entry)?.id).toBe(f.rule.id);expect(itemResistanceBonusFamilyId(f.entry)).toBe(f.rule.id);positive(f);expect(projectItemResistanceBonuses(f.c).issues.length).toBe(0);expect(sourceSnapshot(f.c)).toBe(before);}
});
it('accepts coherent unreserved full-source aliases but honors canonical and alias opt-outs and reserved identities',()=>{
 for(const index of [213,1752])for(const form of ['canonical','app']as const){
  const f=itemResistanceBonusFixture(index,form),canonicalId=f.rule.id;f.entry.id='authored-coherent-resistance-alias';f.entry.revision='authored-transport-only-revision';
  expect(itemResistanceBonusFamilyId(f.entry)).toBe(canonicalId);expect(itemResistanceBonusRule(f.entry)?.id).toBe(canonicalId);positive(f);
  for(const id of [canonicalId,f.entry.id]){f.c.profile.disabledEntries=[id];zero(projectItemResistanceBonuses(f.c));}delete f.c.profile.disabledEntries;
  f.entry.id=ordinary.canonicalIds.find(id=>id.startsWith('kiwee:spell:'))!;expect(typeof f.entry.id).toBe('string');expect(itemResistanceBonusRule(f.entry)===undefined).toBe(true);zero(projectItemResistanceBonuses(f.c));
 }
});
it('rejects changed complete payloads and never uses display names or raw damage tags as source authority',()=>{
 const changes:((entry:Entry)=>void)[]=[entry=>{entry.raw.resist=['火焰'];},entry=>{entry.raw.authoredExtra=true;},entry=>{entry.entries=[...entry.entries,'Authored source change'];},entry=>{entry.kind='feat';},entry=>{entry.packId='authored-foreign';},entry=>{entry.source='AUTHORED';},entry=>{entry.edition=entry.edition==='2024'?'2014':'2024';},entry=>{entry.page=(entry.page??0)+1;},entry=>{entry.name+=' Authored';},entry=>{entry.english+=' Authored';},entry=>{(entry as any).effects=[{type:'authored-extra'}];},entry=>{(entry as any).choices=[{id:'authored-extra'}];},entry=>{(entry as any).authoredExtra=true;}];
 for(const change of changes){const f=itemResistanceBonusFixture();change(f.entry);const before=sourceSnapshot(f.c);expect(itemResistanceBonusRule(f.entry)===undefined).toBe(true);zero(projectItemResistanceBonuses(f.c));expect(sourceSnapshot(f.c)).toBe(before);}
 const f=itemResistanceBonusFixture();f.entry.id='authored-foreign-same-name';f.entry.packId='authored-foreign';f.entry.source='AUTHORED';f.entry.raw.source='AUTHORED';f.c.profile.enabledSources=['AUTHORED'];expect(itemResistanceBonusFamilyId(f.entry)===undefined).toBe(true);zero(projectItemResistanceBonuses(f.c));
});
it('holds unavailable sources automation and physical ownership and requires own true current wearing and attunement',()=>{
 const changes:((f:Fixture)=>void)[]=[f=>{f.c.automation!.enabled=false;},f=>{f.c.automation!.protocol=99;},f=>{f.c.automation!.rulesVersion='authored-future';},f=>{f.c.profile.enabledSources=[];},f=>{f.c.profile.disabledEntries=[f.rule.id];},f=>{f.owner.quantity=0;},f=>{f.owner.quantity=2;},f=>{f.owner.quantity=1.5;},f=>{f.owner.quantity=NaN;},f=>{f.owner.parentId='authored-missing';},f=>{f.owner.parentId=f.owner.id;},f=>{f.owner.grantKey='authored-generated';},f=>{f.owner.requirementId='authored-choice';},f=>{f.owner.equipped=false;},f=>{f.owner.attuned=false;},f=>{(f.owner as any).equipped=1;},f=>{(f.owner as any).attuned=1;},f=>{delete (f.owner as any).equipped;Object.setPrototypeOf(f.owner,{equipped:true});},f=>{delete f.owner.attuned;Object.setPrototypeOf(f.owner,{attuned:true});}];
 for(const index of [213,1752])for(const change of changes){const f=itemResistanceBonusFixture(index);change(f);const before=sourceSnapshot(f.c);zero(projectItemResistanceBonuses(f.c));expect(sourceSnapshot(f.c)).toBe(before);}
});
it('rejects duplicate source roots aliases and selection ids and treats provided active rows only as a current intersection',()=>{
 for(const mode of ['same-source-root','alias-root','duplicate-selection-id']as const){const f=itemResistanceBonusFixture(1752),copy=structuredClone(f.owner);if(mode!=='duplicate-selection-id')copy.id='authored-second-root';if(mode==='alias-root')copy.entry.id='authored-coherent-second-alias';f.c.selections.push(copy);zero(projectItemResistanceBonuses(f.c));}
 const f=itemResistanceBonusFixture(1752);positive(f,projectItemResistanceBonuses(f.c,[f.owner]));zero(projectItemResistanceBonuses(f.c,[]));positive(f,projectItemResistanceBonuses(f.c,[f.owner,f.owner]));
 const copied=structuredClone(f.owner);zero(projectItemResistanceBonuses(f.c,[copied]));f.owner.equipped=false;zero(projectItemResistanceBonuses(f.c,[copied]));f.owner.equipped=true;
 const second=addOwner(f,itemResistanceBonusFixture(1759));second.id=f.owner.id;zero(projectItemResistanceBonuses(f.c));
});
it('matches the existing active equipped armor-slot conflict rule without treating shields or rings as armor conflicts',()=>{
 const f=itemResistanceBonusFixture(213),second=addOwner(f,itemResistanceBonusFixture(253));zero(projectItemResistanceBonuses(f.c));
 second.equipped=false;positive(f);second.equipped=true;f.c.profile.disabledEntries=[second.entry.id];positive(f);delete f.c.profile.disabledEntries;
 second.quantity=0;positive(f);second.quantity=1;second.entry.raw.type='S';positive(f);
 const ring=itemResistanceBonusFixture(1752);addOwner(ring,itemResistanceBonusFixture(213));addOwner(ring,itemResistanceBonusFixture(253)).id='third-physical-owner';const actual=projectItemResistanceBonuses(ring.c);expect(actual.grants.length).toBe(1);expect(actual.grants[0].entryId).toBe(ring.rule.id);expect(actual.resistances[0]).toBe('acid');
});
it('keeps all ten XDMG ring conditions unresolved even when manually attuned and does not infer other resistance rows',()=>{
 const held=itemResistanceBonusHeldEntries();expect(held.length).toBe(10);
 for(const entry of held){const f=itemResistanceBonusFixture(1752);f.owner.entry=structuredClone(entry);f.c.profile.enabledSources=[entry.source,...(entry.dependencies||[])];const before=sourceSnapshot(f.c),actual=projectItemResistanceBonuses(f.c);expect(itemResistanceBonusRule(f.owner.entry)===undefined).toBe(true);zero(actual);expect(actual.issues.some(issue=>issue.id.startsWith('item-resistance-bonus:'))).toBe(true);expect(sourceSnapshot(f.c)).toBe(before);}
 const f=itemResistanceBonusFixture(1752);f.owner.entry={...structuredClone(f.entry),id:'authored-unknown-ring',name:'Authored unknown ring',english:'Authored unknown ring',raw:{name:'Authored unknown ring',source:'DMG',resist:['强酸']}};zero(projectItemResistanceBonuses(f.c));
});
it('unions resistance types without adding damage reductions and stays pure for locked frozen cards and native manual state',()=>{
 for(const secondIndex of [1752,1759]){const f=itemResistanceBonusFixture(213),other=itemResistanceBonusFixture(secondIndex);addOwner(f,other);f.c.locked=true;f.c.skillBonuses={perception:7};f.c.saveBonuses={con:9};const before=sourceSnapshot(f.c);freeze(f.c);const actual=projectItemResistanceBonuses(f.c);expect(actual.grants.length).toBe(2);expect(actual.resistances.length).toBe(secondIndex===1752?1:2);expect(actual.resistances.includes('acid')).toBe(true);expect(actual.trace.length).toBe(2);expect(sourceSnapshot(f.c)).toBe(before);}
});
