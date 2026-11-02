import assert from 'node:assert/strict';
import {arcaneGrimoireFixture} from './arcaneGrimoireFixture';
import {ordinarySnapshot} from './ordinarySpellCastingFixture';
import {arcaneGrimoireFamily,arcaneGrimoireRule,grimoireHoldingOffers,grimoireHoldingRequest,performGrimoireHolding} from '../../src/core/automation/arcaneGrimoireHolding';
import {arcaneGrimoireSpellValues} from '../../src/core/automation/arcaneGrimoireSpellValues';
import {ordinarySpellOffer} from '../../src/core/automation/ordinarySpellCasting';
import {readCharacter} from '../../src/core/validation';
import {exportCharacter} from '../../src/core/export';
import {applyCharacterHistoryPatch} from '../../src/ui/characterHistoryPatch';
import {grimoireHoldingEdit,applyGrimoireHoldingEdit} from '../../src/ui/arcaneGrimoireHoldingSubmission';
import {setResource,syncAutoResources} from '../../src/core/resources';
import {syncFeatures} from '../../src/core/sheet';
import {learnActiveSpell} from '../../src/core/spellWorkspace';
import type {Character} from '../../src/core/model';
const auth={canEdit:true,gm:false},json=(v:unknown)=>JSON.parse(JSON.stringify(v));
type Fixture=ReturnType<typeof arcaneGrimoireFixture>;
const stats=(f:Fixture,a=auth)=>arcaneGrimoireSpellValues(f.c,f.row.id,f.owner.id,a);
const set=(f:Fixture,held=true)=>performGrimoireHolding(f.c,grimoireHoldingRequest(f.c,f.book.id,held),auth);
const outside=(c:Character)=>{const copy=structuredClone(c);if(copy.automation)delete copy.automation.arcaneGrimoireHolding;return ordinarySnapshot(copy);};
export const arcaneGrimoireChecks:{name:string;run:()=>void}[]=[];
for(const rank of [1,2,3])for(const form of ['canonical','app']as const)arcaneGrimoireChecks.push({name:`actual rank ${rank} ${form}: hold/project/native/revoke preserves all other player data`,run(){
 const f=arcaneGrimoireFixture(rank,form),base=stats(f).values!,manual=outside(f.c);assert.equal(f.book.equipped,false);assert.equal(f.book.attuned,true);assert.equal(ordinarySpellOffer(f.c,f.row.id,f.owner.id,auth).casterId,f.owner.id);assert.equal(stats(f).bonus,0);assert.equal(set(f),true);assert.equal(outside(f.c),manual);assert.deepEqual(stats(f).values,{attack:base.attack+rank,dc:base.dc+rank});
 const expected=json(exportCharacter(f.c)),reopened=readCharacter(expected).character;assert.deepEqual(reopened,expected.character);assert.deepEqual(arcaneGrimoireSpellValues(reopened,f.row.id,f.owner.id,auth).values,stats(f).values);assert.equal(set(f,false),true);assert.deepEqual(stats(f).values,base);assert.equal(outside(f.c),manual);
}});
arcaneGrimoireChecks.push({name:'readonly/locked viewing retains values but cannot change intent or pay',run(){
 const f=arcaneGrimoireFixture();assert.ok(set(f));const value=stats(f).values;f.c.locked=true;const before=ordinarySnapshot(f.c),request=grimoireHoldingRequest(f.c,f.book.id,false);assert.deepEqual(stats(f,{canEdit:false,gm:false}).values,value);assert.deepEqual(stats(f).values,value);assert.equal(performGrimoireHolding(f.c,request,{canEdit:false}),false);assert.equal(performGrimoireHolding(f.c,request,auth),false);assert.ok(ordinarySpellOffer(f.c,f.row.id,f.owner.id,{canEdit:false}).options.every(p=>!p.available));assert.equal(ordinarySnapshot(f.c),before);
}});
arcaneGrimoireChecks.push({name:'setter-exhausted ordinary slots retain values without payment availability',run(){
 const f=arcaneGrimoireFixture();assert.ok(set(f));const value=stats(f).values;const payments=ordinarySpellOffer(f.c,f.row.id,f.owner.id,auth).options;assert.ok(payments.length);for(const p of payments){assert.ok(p.resourceId);setResource(f.c,p.resourceId!,0);}const before=ordinarySnapshot(f.c);assert.ok(ordinarySpellOffer(f.c,f.row.id,f.owner.id,auth).options.every(p=>!p.available));assert.deepEqual(stats(f).values,value);assert.equal(ordinarySnapshot(f.c),before);
}});
arcaneGrimoireChecks.push({name:'actual Sorcerer recipient cannot borrow Wizard bonus and missing/ambiguous caster is not guessed',run(){
 const f=arcaneGrimoireFixture();assert.ok(set(f));const sorcerer={id:'actual-sorcerer',entry:f.find('class','Sorcerer'),level:3,quantity:1,equipped:false};f.c.selections.push(sorcerer);syncFeatures(f.c,f.entries);syncAutoResources(f.c);const learned=learnActiveSpell(f.c,f.row.entry,sorcerer.id);assert.ok(learned.id);assert.equal(ordinarySpellOffer(f.c,learned.id!,sorcerer.id,auth).casterId,sorcerer.id);assert.equal(arcaneGrimoireSpellValues(f.c,learned.id!,sorcerer.id,auth).bonus,0);assert.equal(arcaneGrimoireSpellValues(f.c,f.row.id,undefined,auth).values,undefined);assert.equal(arcaneGrimoireSpellValues(f.c,f.row.id,'missing',auth).values,undefined);
}});
arcaneGrimoireChecks.push({name:'source disable, unready, unattune and removal withdraw only derived effect',run(){
 for(const mode of ['source','ready','attune','remove']){const f=arcaneGrimoireFixture();assert.ok(set(f));if(mode==='source')f.c.profile.enabledSources=f.c.profile.enabledSources.filter(s=>s!=='TCE');if(mode==='ready')f.c.spellSettings!.classSpells![f.owner.id]=[];if(mode==='attune')f.book.attuned=false;if(mode==='remove')f.c.selections=f.c.selections.filter(s=>s.id!==f.book.id);const before=ordinarySnapshot(f.c);assert.ok(!stats(f).bonus);assert.equal(ordinarySnapshot(f.c),before);assert.ok(f.c.automation!.arcaneGrimoireHolding);}
}});
arcaneGrimoireChecks.push({name:'unknown/future/foreign saved namespace roundtrips opaque and rejects mutation/history erase',run(){
 for(const mode of ['future','unknown','foreign']){const f=arcaneGrimoireFixture(),empty=structuredClone(f.c);assert.ok(set(f));const state=f.c.automation!.arcaneGrimoireHolding as any;if(mode==='future')state.version=2;if(mode==='unknown')state.extra='keep';if(mode==='foreign')state.characterId='other';const reopened=readCharacter(json(exportCharacter(f.c))).character;assert.deepEqual(reopened.automation!.arcaneGrimoireHolding,state);const before=ordinarySnapshot(f.c),offer=grimoireHoldingOffers(f.c,auth)[0];assert.equal(offer.canSet,false);assert.equal(offer.canWithdraw,false);assert.equal(performGrimoireHolding(f.c,{characterId:f.c.id,selectionId:f.book.id,basis:offer.basis,held:false},auth),false);assert.throws(()=>applyCharacterHistoryPatch(f.c,f.c,empty,()=>auth));assert.equal(ordinarySnapshot(f.c),before);}
}});
arcaneGrimoireChecks.push({name:'descriptor history prevents hidden/accessor/null namespace deletion before merge',run(){
 for(const mode of ['hidden','getter','null']){const f=arcaneGrimoireFixture(),empty=structuredClone(f.c);assert.ok(set(f));const state=f.c.automation!.arcaneGrimoireHolding;let reads=0;if(mode==='hidden')Object.defineProperty(f.c.automation!,'arcaneGrimoireHolding',{value:state,enumerable:false,configurable:true});if(mode==='getter')Object.defineProperty(f.c.automation!,'arcaneGrimoireHolding',{get(){reads++;return state;},enumerable:true,configurable:true});if(mode==='null')f.c.automation!.arcaneGrimoireHolding=null;const descriptor=Object.getOwnPropertyDescriptor(f.c.automation!,'arcaneGrimoireHolding');assert.throws(()=>applyCharacterHistoryPatch(f.c,f.c,empty,()=>auth));assert.deepEqual(Object.getOwnPropertyDescriptor(f.c.automation!,'arcaneGrimoireHolding'),descriptor);assert.equal(reads,0);}
}});
arcaneGrimoireChecks.push({name:'authorized own history restores intent but readonly history cannot',run(){
 const f=arcaneGrimoireFixture(),before=structuredClone(f.c);assert.ok(set(f));const after=structuredClone(f.c);const undo=applyCharacterHistoryPatch(after,after,before,()=>auth);assert.equal(undo.automation!.arcaneGrimoireHolding,undefined);assert.deepEqual(applyCharacterHistoryPatch(undo,before,after,()=>auth).automation!.arcaneGrimoireHolding,after.automation!.arcaneGrimoireHolding);assert.throws(()=>applyCharacterHistoryPatch(after,after,before,()=>({canEdit:false})));
}});
arcaneGrimoireChecks.push({name:'stale request and denied adapter preserve manual inventory/resources byte semantics',run(){
 const f=arcaneGrimoireFixture(),request=grimoireHoldingRequest(f.c,f.book.id,true);f.c.notes+=' change';const before=ordinarySnapshot(f.c);assert.equal(performGrimoireHolding(f.c,request,auth),false);assert.equal(applyGrimoireHoldingEdit(f.c,grimoireHoldingEdit(d=>{performGrimoireHolding(d,request,auth);})),f.c);assert.equal(ordinarySnapshot(f.c),before);
 const resources=ordinarySnapshot(f.c.runtime),inv=ordinarySnapshot(f.c.selections),next=applyGrimoireHoldingEdit(f.c,grimoireHoldingEdit(d=>{performGrimoireHolding(d,grimoireHoldingRequest(d,f.book.id,true),auth);}))!;assert.notEqual(next,f.c);assert.equal(ordinarySnapshot(next.runtime),resources);assert.equal(ordinarySnapshot(next.selections),inv);assert.equal(ordinarySnapshot(f.c),before);
}});
arcaneGrimoireChecks.push({name:'full certificate immutable while player entries remain editable; source drift pauses',run(){
 const f=arcaneGrimoireFixture(),r=arcaneGrimoireRule(f.book.entry)!;assert.equal(r,arcaneGrimoireFamily(f.book.entry));assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.forms[0]));assert.ok(Object.isFrozen(r.clauses[0]));assert.throws(()=>{(r as any).rank=99;});assert.throws(()=>{(r.forms[0]as any).snapshotSha256='fake';});assert.ok(!Object.isFrozen(f.book.entry));assert.ok(set(f));f.book.entry.raw.playerNote='editable';const before=ordinarySnapshot(f.c);assert.equal(arcaneGrimoireRule(f.book.entry),undefined);assert.equal(stats(f).bonus,0);assert.equal(ordinarySnapshot(f.c),before);
}});
arcaneGrimoireChecks.push({name:'same-family multiple ranks hold without auto-max or stacking',run(){
 const f=arcaneGrimoireFixture(),other=arcaneGrimoireFixture(3);assert.ok(set(f));f.c.selections.push({...structuredClone(other.book),id:'second-book'});const before=ordinarySnapshot(f.c);assert.equal(stats(f).bonus,0);assert.match(stats(f).reason!,/多个/);assert.equal(ordinarySnapshot(f.c),before);
}});
arcaneGrimoireChecks.push({name:'manual offsets and nonnative ability override remain owned and visibly held',run(){
 const f=arcaneGrimoireFixture();assert.ok(set(f));assert.equal(f.c.spellSettings!.attackBonus,7);assert.equal(f.c.spellSettings!.dcBonus,11);f.c.spellSettings!.abilityOverride=true;f.c.spellSettings!.ability='wis';const before=ordinarySnapshot(f.c);assert.equal(stats(f).bonus,0);assert.match(stats(f).reason!,/技术限制/);assert.equal(ordinarySnapshot(f.c),before);
}});
arcaneGrimoireChecks.push({name:'unknown parent protocol/rules block holding delta both ways while preserving unrelated notes',run(){
 for(const mode of ['protocol','rules']){
  const f=arcaneGrimoireFixture(),before=structuredClone(f.c);assert.ok(set(f));const after=structuredClone(f.c),live=structuredClone(after);
  if(mode==='protocol')live.automation!.protocol=3;else live.automation!.rulesVersion='future-rules';
  const original=ordinarySnapshot(live);assert.equal(grimoireHoldingOffers(live,auth)[0].canWithdraw,false);assert.throws(()=>applyCharacterHistoryPatch(live,after,before,()=>auth));assert.throws(()=>applyCharacterHistoryPatch(before,before,live,()=>auth));
  const notes=structuredClone(live);notes.notes+=' unrelated';const updated=applyCharacterHistoryPatch(live,live,notes,()=>auth);assert.equal(updated.notes,notes.notes);assert.deepEqual(updated.automation,live.automation);assert.deepEqual(updated.runtime,live.runtime);assert.equal(ordinarySnapshot(live),original);
 }
}});
