import {describe,it,expect} from 'vitest';
import {selectionAllowed,selectionEffectsAllowed,type Entry,type Selection} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {syncAutoResources} from '../src/core/resources';
import {casterProfiles} from '../src/core/spellcastingRules';
import {activeEffectSelections} from '../src/core/automation/active';
import {reviewedAlertIdentity,reviewedModernAlertRule} from '../src/core/automation/reviewedFeatIdentity';
import {reviewedAlertStatus} from '../src/core/automation/reviewedAlert';
import {planFeatureResources} from '../src/core/automation/featureResources';
import {sheetChoices} from '../src/core/automation/choices';
import {alertDirectory,alertSnapshot,setupAlert} from './helpers/reviewedAlertCore';
const selection=(entry:Entry):Selection=>({id:'forged-alert-kind',entry,level:1,quantity:1,equipped:false});
describe.skipIf(!alertDirectory)('actual-source Alert known identity cannot impersonate another generic rule kind',()=>{
 for(const source of ['PHB','XPHB'] as const)for(const alias of [false,true])it.each(['class','subclass','race','feature','background','item','rule'] as const)(`${source}${alias?' alias':''} non-feat %s fails availability even with an explicit exception`,kind=>{
  const s=setupAlert(),entry=structuredClone(s.entries.find(row=>row.english==='Alert'&&row.source===source)!);entry.kind=kind;if(alias)entry.id='imported-alert-kind';s.c.profile.enabledSources=['PHB','XPHB','TCE'];s.c.profile.exceptions[entry.id]='Retained player exception must not authorize another kind';
  expect(reviewedAlertIdentity(entry)).toBe(true);expect(selectionEffectsAllowed(s.c,entry)).toBe(false);expect(selectionAllowed(s.c,entry)).toBe(false);
 });
 it('forged class cannot raise level/PB, create a caster profile, spell slots, hit dice or new resources',()=>{
  const s=setupAlert();syncAutoResources(s.c);const before=evaluate(s.c),resources=structuredClone(s.c.runtime.resources),entry=structuredClone(s.feat);entry.kind='class';entry.raw.casterProgression='full';entry.raw.spellcastingAbility='int';entry.raw.hd={faces:20};s.c.selections.push(selection(entry));const snapshot=alertSnapshot(s.c);
  const actual=evaluate(s.c);expect({level:actual.level,pb:actual.proficiency,hitDice:actual.hitDice,abilities:actual.abilities,maxHp:actual.maxHp}).toEqual({level:before.level,pb:before.proficiency,hitDice:before.hitDice,abilities:before.abilities,maxHp:before.maxHp});expect(casterProfiles(s.c).some(profile=>profile.owner.id==='forged-alert-kind')).toBe(false);expect(activeEffectSelections(s.c).some(row=>row.id==='forged-alert-kind')).toBe(false);expect(alertSnapshot(s.c)).toBe(snapshot);syncAutoResources(s.c);expect(s.c.runtime.resources).toEqual(resources);
 });
 it.each(['manual','opaque','locked'] as const)('excluding a forged class preserves %s spell/pact pools and mirrors without refill, removal or adoption',mode=>{
  const s=setupAlert();syncAutoResources(s.c);const flags=mode==='manual'?{automatic:false}:mode==='locked'?{automatic:true,locked:true}:{},spellKey='spell-slot:1',pactKey='pact-slot:3';s.c.runtime.resources[spellKey]={name:'Player spell pool',max:9,current:2,...flags};s.c.runtime.resources[pactKey]={name:'Player pact pool',max:4,current:1,...flags};s.c.spellSettings!.slots['1']={max:9,used:7};const before=structuredClone(s.c);s.c.spellSettings!.slots['1']={max:11,used:5};const mirrors=structuredClone(s.c.spellSettings!.slots),resources=structuredClone(s.c.runtime.resources),entry=structuredClone(s.feat);entry.kind='class';entry.raw.casterProgression='full';entry.raw.hd={faces:20};s.c.selections.push(selection(entry));syncAutoResources(s.c,before);expect(s.c.runtime.resources).toEqual(resources);expect(s.c.spellSettings!.slots).toEqual(mirrors);expect(s.c.runtime.resources[spellKey]).not.toHaveProperty('featureGrant');expect(s.c.runtime.resources[pactKey]).not.toHaveProperty('featureGrant');
 });
 it('forged subclass cannot replace a real Wizard casting progression or slot table',()=>{
  const s=setupAlert();syncAutoResources(s.c);const resources=structuredClone(s.c.runtime.resources),profiles=casterProfiles(s.c).map(row=>({owner:row.owner.id,casting:row.casting.id,maxLevel:row.maxLevel})),entry=structuredClone(s.feat);entry.kind='subclass';entry.raw.className=s.c.selections[0].entry.raw.name;entry.raw.classSource='PHB';entry.raw.casterProgression='pact';entry.raw.subclassTableGroups=[{rowsSpellProgression:Array.from({length:20},()=>[9,9,9,9,9])}];s.c.selections.push({...selection(entry),parentId:s.c.selections[0].id});
  expect(casterProfiles(s.c).map(row=>({owner:row.owner.id,casting:row.casting.id,maxLevel:row.maxLevel}))).toEqual(profiles);syncAutoResources(s.c);expect(s.c.runtime.resources).toEqual(resources);
 });
 it('forged race cannot provide speed/size or ability bonuses through pre-loop race paths',()=>{
  const s=setupAlert(),before=evaluate(s.c),entry=structuredClone(s.feat);entry.kind='race';entry.raw.speed=120;entry.raw.size=['H'];entry.raw.ability=[{dex:10}];s.c.selections.push(selection(entry));expect(evaluate(s.c).speed).toBe(before.speed);expect(evaluate(s.c).abilities).toEqual(before.abilities);expect(activeEffectSelections(s.c).some(row=>row.entry.kind==='race')).toBe(false);
 });
 it('an unreviewed child cannot inherit grants or resource ownership through a forged Alert ancestor',()=>{
  const s=setupAlert(),before=evaluate(s.c),entry=structuredClone(s.feat);entry.kind='feature';s.c.selections.push(selection(entry),{id:'forged-alert-child',parentId:'forged-alert-kind',entry:{...structuredClone(s.feat),id:'authored-descendant',kind:'feature',english:'Authored child',effects:[{op:'add',target:'dex',value:10},{op:'add',target:'hp',value:90}],entries:[],raw:{resources:[{name:'Authored child resource',max:9,recovery:'lr'}],skillProficiencies:[{perception:true}]}},level:1,quantity:1,equipped:false});
  const actual=evaluate(s.c);expect({abilities:actual.abilities,maxHp:actual.maxHp,perception:actual.skills.perception.value}).toEqual({abilities:before.abilities,maxHp:before.maxHp,perception:before.skills.perception.value});expect(planFeatureResources(s.c).grants.filter(row=>row.ownerId==='forged-alert-child').length).toBe(0);expect(sheetChoices(s.c,s.entries).filter(row=>row.ownerId==='forged-alert-child').every(row=>row.restricted)).toBe(true);
 });
 it('a genuine confirmed PHB grant below a forged Alert ancestor pauses rather than laundering +5',()=>{
  const s=setupAlert();s.confirm();const entry=structuredClone(s.feat);entry.kind='feature';s.c.selections[0].parentId='forged-alert-kind';s.c.selections.push(selection(entry));const before=alertSnapshot(s.c);expect(reviewedAlertStatus(s.c,s.choice.id,s.feat.id).active).toBe(false);expect(evaluate(s.c).initiative).toBe(2);expect(alertSnapshot(s.c)).toBe(before);
 });
 it.each(['PHB','XPHB'] as const)('genuine %s feat and coherent source aliases retain their original availability boundary',source=>{
  const s=setupAlert(),entry=structuredClone(s.entries.find(row=>row.english==='Alert'&&row.source===source)!);s.c.profile.enabledSources=['PHB','XPHB','TCE'];entry.id=`coherent-${source}-alias`;expect(selectionEffectsAllowed(s.c,entry)).toBe(true);if(source==='XPHB'){expect(reviewedModernAlertRule(entry)).toBe(true);expect(reviewedAlertIdentity(entry)).toBe(false);}else{s.confirm();expect(reviewedAlertStatus(s.c,s.choice.id,s.feat.id).active).toBe(true);expect(evaluate(s.c).initiative).toBe(7);}
 });
});
