import {beforeAll,expect,it} from 'vitest';
import type {Entry,Selection} from '../src/core/model';
import {createCustomEntry} from '../src/core/customEntries';
import {syncFeatures} from '../src/core/sheet';
import ordinary from '../src/core/automation/ordinarySpellCastingEvidence.json' with {type:'json'};
import {classMovementRule,projectClassMovement,projectClassMovementModes} from '../src/core/automation/classMovement';
import {classMovementFixture} from './helpers/classMovementFlowFixture';
import {classMovementSpecs,classMovementHeldEntries,classMovementSourceEvidence,classMovementSnapshot as snapshot} from './helpers/classMovementSourceFixture';

beforeAll(()=>{classMovementSourceEvidence();},30000);
type Fixture=ReturnType<typeof classMovementFixture>;
function zero(c:Fixture['c']){const p=projectClassMovement(c);expect(p.walkingBonus).toBe(0);expect(p.grants.length).toBe(0);expect(p.relativeModes.length).toBe(0);}
function expected(f:Fixture){return f.spec.levelBonuses?f.spec.levelBonuses[f.owner.level-1]:f.spec.walkingBonus!;}
function addEquipment(f:Fixture,type:string){const entry=createCustomEntry({name:'Authored equipment condition',type:'armor',body:'Authored test equipment only',raw:{type,ac:14,armor:type!=='S'}}),row:Selection={id:'authored-equipment-owner',entry,quantity:1,level:1,equipped:true};f.c.profile.enabledSources.push('CUSTOM');f.c.selections.push(row);return row;}
function freeze(value:unknown):void{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}}

it('projects all five exact native owner-feature pairs through both canonical and real App routes',()=>{
 expect(classMovementSpecs.length).toBe(5);
 for(const form of ['canonical','app']as const)for(const spec of classMovementSpecs){const f=classMovementFixture(spec.key,form),before=snapshot(f.c),p=projectClassMovement(f.c);expect(classMovementRule(f.entry)?.id).toBe(f.rule.id);expect(p.walkingBonus).toBe(expected(f));expect(p.grants.length).toBe(1);expect(p.grants[0].selectionId).toBe(f.feature.id);expect(p.grants[0].ownerId).toBe(f.owner.id);expect(p.grants[0].entryId).toBe(f.rule.id);expect(p.grants[0].ownerEntryId).toBe(f.rule.owner.id);expect(p.grants[0].ownerLevel).toBe(f.owner.level);expect(p.relativeModes.join(',')).toBe(spec.relativeModes.join(','));expect(p.trace.length).toBeGreaterThan(0);expect(p.issues.length).toBe(0);expect(snapshot(f.c)).toBe(before);}
});
it('uses every own Monk table row and native thresholds rather than total class level or child level',()=>{
 const levels=[0,10,10,10,10,15,15,15,15,20,20,20,20,25,25,25,25,30,30,30];
 for(const key of ['monk-phb','monk-xphb']){const f=classMovementFixture(key);for(let level=1;level<=20;level++){f.owner.level=level;syncFeatures(f.c,f.entries);const before=snapshot(f.c);expect(projectClassMovement(f.c).walkingBonus).toBe(levels[level-1]);expect(snapshot(f.c)).toBe(before);}
  f.owner.level=2;syncFeatures(f.c,f.entries);const other=classMovementFixture(key==='monk-phb'?'barbarian-phb':'barbarian-xphb'),owner=structuredClone(other.owner);owner.id='other-class-owner';owner.level=10;f.c.selections.push(owner);syncFeatures(f.c,f.entries);const p=projectClassMovement(f.c);expect(p.grants.find(row=>row.ownerId===f.owner.id)?.walkingBonus).toBe(10);expect(p.walkingBonus).toBe(20);
 }
 for(const key of ['barbarian-phb','barbarian-xphb','ranger-xphb']){const f=classMovementFixture(key);f.owner.level=f.spec.minLevel-1;syncFeatures(f.c,f.entries);zero(f.c);f.owner.level=f.spec.minLevel;syncFeatures(f.c,f.entries);expect(projectClassMovement(f.c).walkingBonus).toBe(10);}
});
it('uses current equipment conditions without borrowing a heavy restriction for Ranger swim and climb',()=>{
 for(const spec of classMovementSpecs)for(const type of ['LA','MA','HA','S']){const f=classMovementFixture(spec.key),gear=addEquipment(f,type),blocked=spec.walkingPolicy==='no-armor-and-no-shield'||type==='HA',before=snapshot(f.c),p=projectClassMovement(f.c);expect(p.walkingBonus).toBe(blocked?0:expected(f));expect(p.relativeModes.length).toBe(spec.relativeModes.length);if(spec.relativeModes.length){const modes=projectClassMovementModes(f.c,50);expect(modes.modes.swim).toBe(50);expect(modes.modes.climb).toBe(50);}expect(snapshot(f.c)).toBe(before);
  if(type==='HA'||type==='S'&&!!spec.levelBonuses)for(const unavailable of ['source','entry']as const){if(unavailable==='source')f.c.profile.enabledSources=f.c.profile.enabledSources.filter(source=>source!=='CUSTOM');else f.c.profile.disabledEntries=[gear.entry.id];const retained=snapshot(f.c);expect(gear.equipped).toBe(true);expect(projectClassMovement(f.c).walkingBonus).toBe(0);if(spec.relativeModes.length){const modes=projectClassMovementModes(f.c,50);expect(modes.modes.swim).toBe(50);expect(modes.modes.climb).toBe(50);}expect(snapshot(f.c)).toBe(retained);f.c.profile.enabledSources=[...new Set([...f.c.profile.enabledSources,'CUSTOM'])];delete f.c.profile.disabledEntries;}
  gear.equipped=false;expect(projectClassMovement(f.c).walkingBonus).toBe(expected(f));}
});
it('authenticates exact declared ref ownership and source opt-outs rather than standalone manual copies or stale grants',()=>{
 const changes:((f:Fixture)=>void)[]=[f=>{delete f.feature.parentId;},f=>{f.feature.parentId='authored-missing';},f=>{f.feature.parentId=f.feature.id;},f=>{f.feature.grantKey='ref:authored-other-reference';},f=>{delete f.feature.grantKey;},f=>{f.c.dismissedFeatures=[`${f.owner.id}|${f.rule.grantKey}`];},f=>{f.owner.level=f.spec.minLevel-1;},f=>{f.owner.level=21;},f=>{f.owner.level=NaN;},f=>{f.owner.parentId='authored-parent';},f=>{f.c.automation!.enabled=false;},f=>{f.c.automation!.protocol=99;},f=>{f.c.automation!.rulesVersion='authored-future';},f=>{f.c.profile.enabledSources=[];},f=>{f.c.profile.disabledEntries=[f.rule.id];},f=>{f.c.profile.disabledEntries=[f.rule.owner.id];}];
 for(const change of changes){const f=classMovementFixture();change(f);const before=snapshot(f.c);zero(f.c);expect(snapshot(f.c)).toBe(before);}
 const f=classMovementFixture();f.c.profile.enabledSources=[];f.c.profile.exceptions[f.entry.id]='Authored exception is not exact declared ownership';f.c.profile.exceptions[f.classEntry.id]='Authored exception is not source permission';zero(f.c);
});
it('holds duplicate canonical or alias grants and classes and rejects substituted active lists',()=>{
 for(const mode of ['feature','alias-feature','class','alias-class','selection-id']as const){const f=classMovementFixture();if(mode==='feature'||mode==='alias-feature'){const copy=structuredClone(f.feature);copy.id='authored-second-feature';if(mode==='alias-feature')copy.entry.id='authored-coherent-feature-alias';f.c.selections.push(copy);}else{const copy=structuredClone(f.owner);if(mode!=='selection-id')copy.id='authored-second-class';if(mode==='alias-class')copy.entry.id='authored-coherent-class-alias';f.c.selections.push(copy);}zero(f.c);}
 const f=classMovementFixture();expect(projectClassMovement(f.c,[f.owner,f.feature]).walkingBonus).toBe(10);expect(projectClassMovement(f.c,[]).walkingBonus).toBe(0);expect(projectClassMovement(f.c,[structuredClone(f.owner),structuredClone(f.feature)]).walkingBonus).toBe(0);expect(projectClassMovement(f.c,[f.owner]).walkingBonus).toBe(0);expect(projectClassMovement(f.c,[f.feature]).walkingBonus).toBe(0);
});
it('accepts coherent complete transport aliases while rejecting changed feature or class payloads and reserved identities',()=>{
 const f=classMovementFixture();f.entry.id='authored-feature-alias';f.entry.revision='authored-feature-transport';f.classEntry.id='authored-class-alias';f.classEntry.revision='authored-class-transport';expect(classMovementRule(f.entry)?.id).toBe(f.rule.id);expect(projectClassMovement(f.c).walkingBonus).toBe(10);for(const id of [f.rule.id,f.entry.id,f.rule.owner.id,f.classEntry.id]){f.c.profile.disabledEntries=[id];zero(f.c);}delete f.c.profile.disabledEntries;
 f.entry.id=ordinary.canonicalIds.find(id=>id.startsWith('kiwee:spell:'))!;expect(classMovementRule(f.entry)===undefined).toBe(true);zero(f.c);
 const changes:((entry:Entry)=>void)[]=[entry=>{entry.raw.authoredExtra=true;},entry=>{entry.entries=[...entry.entries,'Authored source change'];},entry=>{entry.packId='authored-foreign';},entry=>{entry.source='AUTHORED';},entry=>{entry.edition=entry.edition==='2024'?'2014':'2024';},entry=>{entry.name+=' Authored';},entry=>{entry.english+=' Authored';},entry=>{entry.raw.classSource='AUTHORED';},entry=>{(entry as any).effects=[{op:'add',target:'speed',value:7}];}];
 for(const kind of ['feature','class']as const)for(const change of changes){const x=classMovementFixture();change(kind==='feature'?x.entry:x.classEntry);const before=snapshot(x.c);zero(x.c);expect(snapshot(x.c)).toBe(before);}
});
it('resolves only authentic Ranger modes from finite nonnegative final walking including zero and never repairs it',()=>{
 const f=classMovementFixture('ranger-xphb');addEquipment(f,'HA');expect(projectClassMovement(f.c).walkingBonus).toBe(0);
 for(const value of [50,0,12.5]){const before=snapshot(f.c),p=projectClassMovementModes(f.c,value);expect(p.modes.swim).toBe(value);expect(p.modes.climb).toBe(value);expect(snapshot(f.c)).toBe(before);}
 for(const value of [undefined,null,'30',NaN,Infinity,-Infinity,-1]){const p=projectClassMovementModes(f.c,value as number);expect(Object.keys(p.modes).length).toBe(0);expect(p.issues.some(issue=>issue.id.startsWith('class-movement:'))).toBe(true);}
 f.c.profile.disabledEntries=[f.rule.id];expect(Object.keys(projectClassMovementModes(f.c,50).modes).length).toBe(0);delete f.c.profile.disabledEntries;expect(Object.keys(projectClassMovementModes(f.c,50,[]).modes).length).toBe(0);
});
it('keeps actual optional TCE replacements held and pure frozen cards preserve manual state and unrelated custom effects',()=>{
 const held=classMovementHeldEntries();expect(held.length).toBe(2);for(const entry of held){const f=classMovementFixture('ranger-xphb');f.feature.entry=structuredClone(entry);f.feature.grantKey='ref:authored-optional-replacement';f.c.profile.enabledSources.push('TCE');const before=snapshot(f.c);expect(classMovementRule(entry)===undefined).toBe(true);zero(f.c);expect(snapshot(f.c)).toBe(before);}
 for(const spec of classMovementSpecs){const f=classMovementFixture(spec.key);f.c.locked=true;f.owner.quantity=2;const before=snapshot(f.c);freeze(f.c);expect(projectClassMovement(f.c).walkingBonus).toBe(expected(f));expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(3);expect(f.c.runtime.resources.manual.current).toBe(1);}
});
