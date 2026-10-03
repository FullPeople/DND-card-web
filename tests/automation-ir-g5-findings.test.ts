import {describe,it,expect} from 'vitest';
import {newCharacter,type Entry,type Character} from '../src/core/model';
import {createIdentity,type Identity} from '../src/data/automation/identity';
import type {Mechanics} from '../src/data/automation/protocol';
import {initializeAutomation} from '../src/core/automation/state';
import {syncAutoResources,setResource} from '../src/core/resources';
import {planFeatureResources,restResources} from '../src/core/automation/featureResources';
import {planClassMigration} from '../src/core/classMigration';
import {emptyMigrationChoices,planCardMigration} from '../src/core/cardMigration';
import {planBatchCardMigration} from '../src/core/batchCardMigration';
import {syncFeatures} from '../src/core/sheet';
import {validateCharacter} from '../src/core/validation';
import {evaluate} from '../src/core/engine';
import {exportOwlbear} from '../src/core/export';
import {spellState} from '../src/core/characterDetails';

const entry=(kind:Entry['kind'],name:string,mechanics:Mechanics,identity:Partial<Identity>={},raw:Entry['raw']={}):Entry=>({
 id:`audit:${kind}:${name}`,kind,name,english:name,packId:'kiwee',source:'XPHB',edition:'2024',revision:'1',entries:[],raw,automationVersion:'audit',
 automation:{identity:createIdentity({kind,engName:name,source:'XPHB',...identity}),edition:'2024',verdict:'automated',provenance:[{layer:'structured',ref:'synthetic-formal-audit-regression'}],mechanics,unsupported:[]}
});
const card=(entries:Entry[]):Character=>{const c=newCharacter();initializeAutomation(c);c.selections=entries.map((entry,i)=>({id:`row${i}`,entry,level:1,quantity:1,equipped:false}));return c;};
const copyIdentity={id:'audit-copy',now:'2026-10-03T00:00:00Z'};
describe('F1: synchronization copies retain overflow consumption',()=>{
 for(const mode of ['class','card','batch','disabled-batch'] as const)it(mode,()=>{
  const cls=entry('class','Audit caster',{classModel:{hitDie:8,casterProgression:'full'},resources:[{key:'uses',max:{formula:'@class.level'},recovery:[{period:'long',amount:'all'}]}]}),c=card([cls]);
  c.selections[0].level=5;syncAutoResources(c);const key=planFeatureResources(c).grants[0].key;
  setResource(c,key,0);setResource(c,'spell-slot:1',0);setResource(c,'spell-slot:3',0);
  c.selections[0].level=1;syncAutoResources(c);if(mode==='disabled-batch')c.automation!.enabled=false;
  const original=structuredClone(c),newer={...cls,revision:'2'},catalog=[newer],roots={row0:cls.id},choices=emptyMigrationChoices();choices.roots=roots;
  const copied=mode==='class'?planClassMigration(c,catalog,roots,copyIdentity).card:mode==='card'?planCardMigration(c,catalog,choices,copyIdentity).card:planBatchCardMigration(c,catalog,roots,{},copyIdentity).plan.card;
  expect(c).toEqual(original);expect(copied.runtime.resources[key]).toMatchObject({max:1,current:0,featureGrant:{spent:5}});
  expect(copied.runtime.resources['spell-slot:1']).toMatchObject({max:2,current:0,automaticSpent:4});
  expect(copied.runtime.automaticResourceArchive!['spell-slot:3']).toMatchObject({current:0,automaticSpent:2});
  const restored=validateCharacter(JSON.parse(JSON.stringify(copied)));restored.automation!.enabled=true;restored.selections[0].level=5;syncAutoResources(restored);
  expect(restored.runtime.resources[key]).toMatchObject({max:5,current:0,featureGrant:{spent:5}});
  expect(restored.runtime.resources['spell-slot:1']).toMatchObject({max:4,current:0,automaticSpent:4});expect(restored.runtime.resources['spell-slot:3'].current).toBe(0);
  restResources(restored,'long');syncAutoResources(restored);expect(restored.runtime.resources[key].current).toBe(5);expect(restored.runtime.resources['spell-slot:1'].current).toBe(4);
 });
});
it('F1 follow-up: zero maintenance preserves overflow debt while explicit positive restoration clears it',()=>{
 const cls=entry('class','Zero maintenance',{classModel:{hitDie:8,casterProgression:'full'},resources:[{key:'uses',max:{formula:'@class.level'},recovery:[{period:'long',amount:'all'}]}]}),c=card([cls]);c.selections[0].level=5;syncAutoResources(c);const key=planFeatureResources(c).grants[0].key;setResource(c,key,0);setResource(c,'spell-slot:1',0);c.selections[0].level=1;syncAutoResources(c);
 for(let i=0;i<3;i++){setResource(c,key,0);setResource(c,'spell-slot:1',0);syncAutoResources(c);}
 expect(c.runtime.resources[key].featureGrant!.spent).toBe(5);expect(c.runtime.resources['spell-slot:1'].automaticSpent).toBe(4);
 const restored=validateCharacter(JSON.parse(JSON.stringify(c)));restored.selections[0].level=5;syncAutoResources(restored);expect(restored.runtime.resources[key].current).toBe(0);expect(restored.runtime.resources['spell-slot:1'].current).toBe(0);
 setResource(c,key,1);setResource(c,'spell-slot:1',2);expect(c.runtime.resources[key].featureGrant!.spent).toBe(0);expect(c.runtime.resources['spell-slot:1'].automaticSpent).toBe(0);c.selections[0].level=5;syncAutoResources(c);expect(c.runtime.resources[key].current).toBe(5);expect(c.runtime.resources['spell-slot:1'].current).toBe(4);
});
it('F1 follow-up: exhausted pact maintenance retains the shared pool debt across slot-level changes',()=>{
 const c=card([entry('class','Zero pact',{classModel:{hitDie:8,casterProgression:'pact'}})]);c.selections[0].level=5;syncAutoResources(c);setResource(c,'pact-slot:3',0);c.selections[0].level=1;syncAutoResources(c);setResource(c,'pact-slot:1',0);
 expect(c.runtime.automaticResourceArchive!['pact-slot:pool'].automaticSpent).toBe(2);const restored=validateCharacter(JSON.parse(JSON.stringify(c)));restored.selections[0].level=5;syncAutoResources(restored);expect(restored.runtime.resources['pact-slot:3']).toMatchObject({max:2,current:0,automaticSpent:2});restResources(restored,'short');syncAutoResources(restored);expect(restored.runtime.resources['pact-slot:3'].current).toBe(2);
});
describe('F2: canonical resources outlive translated labels and regenerated owners',()=>{
 for(const legacy of [false,true])it(legacy?'adopts an archived legacy ledger after the label changed':'keeps the canonical ledger through removal and restoration',()=>{
  const cls=entry('class','Audit class',{classModel:{hitDie:8}}),feature=entry('feature','Audit uses',{resources:[{key:'uses',max:{value:2},recovery:[{period:'long',amount:'all'}]}]},{kind:'subclassFeature',classEngName:'Audit class',classSource:'XPHB',subclassEngShortName:'Audit subclass',subclassSource:'XPHB',level:3},{className:'Audit class',classSource:'XPHB',subclassShortName:'Old translated'}),sub=entry('subclass','Audit subclass',{classModel:{subclassFeatures:[feature.automation!.identity.key]}},{classEngName:'Audit class',classSource:'XPHB',subclassEngShortName:'Audit subclass',subclassSource:'XPHB'},{className:'Audit class',classSource:'XPHB',shortName:'Audit subclass'});
  const c=card([cls,sub]);c.selections[0].level=3;c.selections[1].parentId='row0';syncFeatures(c,[cls,sub,feature]);syncAutoResources(c);
  const key=planFeatureResources(c).grants[0].key;setResource(c,key,0);c.runtime.resources[key].icon='star';c.runtime.resources[key].order=7;
  if(legacy){const oldKey=`feature-resource:${JSON.stringify(['row0','XPHB','XPHB','Old translated','Audit uses'])}:uses`;c.runtime.resources[oldKey]=c.runtime.resources[key];delete c.runtime.resources[key];c.runtime.featureResourceArchive={[oldKey]:structuredClone(c.runtime.resources[oldKey])};}
  c.selections[0].level=1;syncFeatures(c,[cls,sub,feature]);syncAutoResources(c);expect(c.selections.some(row=>row.entry.id===feature.id)).toBe(false);
  const newer=structuredClone(feature);newer.name='New translated';newer.english='Changed display English';newer.raw.subclassShortName='New translated';newer.raw.className='Translated class';
  const restored=validateCharacter(JSON.parse(JSON.stringify(c)));restored.selections[0].level=3;syncFeatures(restored,[cls,sub,newer]);syncAutoResources(restored);
  expect(planFeatureResources(restored).grants[0].key).toBe(key);expect(restored.runtime.resources[key]).toMatchObject({max:2,current:0,icon:'star',order:7,featureGrant:{spent:2}});
  expect(Object.keys(restored.runtime.resources).filter(id=>id.startsWith('feature-resource:'))).toEqual([key]);
  syncAutoResources(restored);expect(restored.runtime.resources[key].current).toBe(0);restResources(restored,'long');syncAutoResources(restored);expect(restored.runtime.resources[key].current).toBe(2);
 });
});
it('F2: synchronizing an active legacy ledger preserves its available count and presentation',()=>{
 const cls=entry('class','Legacy active',{classModel:{hitDie:8},resources:[{key:'uses',max:{value:5},recovery:[{period:'long',amount:'all'}]}]}),c=card([cls]);syncAutoResources(c);
 const grant=planFeatureResources(c).grants[0];setResource(c,grant.key,2);const old=c.runtime.resources[grant.key];old.icon='star';old.order=9;
 c.runtime.resources[grant.legacyKey]=old;delete c.runtime.resources[grant.key];c.runtime.featureResourceArchive={[grant.legacyKey]:structuredClone(old)};
 const original=structuredClone(c),copy=planClassMigration(c,[{...cls,revision:'2'}],{row0:cls.id},copyIdentity).card;
 expect(c).toEqual(original);expect(copy.runtime.resources[grant.key]).toMatchObject({max:5,current:2,icon:'star',order:9,featureGrant:{spent:3}});syncAutoResources(copy);expect(copy.runtime.resources[grant.key].current).toBe(2);
});
it('F2: ambiguous old subclass receipts stay visible and cannot initialize fresh counters',()=>{
 const cls=entry('class','Ambiguous class',{classModel:{hitDie:8}}),a=entry('feature','Same uses',{resources:[{key:'uses',max:{value:2},recovery:[{period:'long',amount:'all'}]}]},{kind:'subclassFeature',classEngName:'Ambiguous class',classSource:'XPHB',subclassEngShortName:'First',subclassSource:'XPHB',level:1}),b=structuredClone(a);b.id='other-identity';b.automation!.identity=createIdentity({...a.automation!.identity,subclassEngShortName:'Second'});
 const c=card([cls,a,b]);c.selections[1].parentId=c.selections[2].parentId='row0';const key=`feature-resource:${JSON.stringify(['row0','XPHB','XPHB','Old label','Same uses'])}:uses`;
 c.runtime.featureResourceArchive={[key]:{max:2,current:0,featureGrant:{ownerId:'removed-owner',ruleMax:2,spent:2,recovery:{long:'all'},origin:'old receipt'}}};
 const before=structuredClone(c),plan=planFeatureResources(c);expect(plan.grants).toEqual([]);expect(plan.issues.filter(issue=>issue.id.startsWith('resource-ledger:'))).toHaveLength(2);expect(c).toEqual(before);syncAutoResources(c);expect(Object.values(c.runtime.resources).filter(r=>r.featureGrant)).toEqual([]);expect(c.runtime.featureResourceArchive![key].featureGrant!.spent).toBe(2);
});
it('F3: rejects grouped proficiency, orders priorities across owners, and binds @prof without mutation',()=>{
 const grouped=card([entry('feat','Grouped',{modifiers:[{target:'proficiency',op:'add',value:99,stackGroup:'exclusive'}]})]),before=structuredClone(grouped);expect(evaluate(grouped).proficiency).toBe(2);expect(evaluate(grouped).issues.some(i=>i.id==='automation-runtime:row0')).toBe(true);expect(grouped).toEqual(before);
 const c=card([entry('feat','Add',{modifiers:[{target:'proficiency',op:'add',value:2,priority:20},{target:'initiative',op:'add',formula:'@prof'}]}),entry('feat','Set',{modifiers:[{target:'proficiency',op:'set',value:3,priority:10}]})]),snapshot=structuredClone(c),d=evaluate(c);expect(d.proficiency).toBe(5);expect(d.initiative).toBe(5);expect(c).toEqual(snapshot);
});
it('F4: exports schema 0.3 using declared IR and explicit manual spell levels',()=>{
 const cls=entry('class','Export caster',{classModel:{hitDie:8,casterProgression:'full'}}),spell=entry('spell','Export spell',{spellModel:{level:3}}),item=entry('item','Export item',{equipmentModel:{category:'other',weight:7}}),c=card([cls,spell,item]);c.spellSettings={...spellState(c),mode:'known',modeOverride:true,knownCapacityAdjustment:1};syncAutoResources(c);
 const original=structuredClone(c),d=evaluate(c),result=exportOwlbear(c,d);expect(result.schema_version).toBe('0.3');expect(d.hitDice).toBe('1d8');expect(result.core_stats.hit_dice.die_size).toBe(8);expect(result.inventory.items[0].weight).toBe(7);expect(result.inventory.total_weight).toBe(7);expect(result.spellcasting.always_known).toMatchObject([{level:3,name:'Export spell'}]);expect(result.spellcasting.cantrips_known).toEqual([]);expect(c).toEqual(original);
 c.selections[1].entry.manualSpellLevel=0;expect(exportOwlbear(c,evaluate(c)).spellcasting.cantrips_known).toMatchObject([{level:0,name:'Export spell'}]);
 delete c.selections[1].entry.manualSpellLevel;delete c.selections[1].entry.automation;c.selections[1].entry.raw.level=0;expect(exportOwlbear(c,evaluate(c)).spellcasting.cantrips_known).toEqual([]);
});
