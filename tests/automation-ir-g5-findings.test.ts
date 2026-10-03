import {describe,it,expect} from 'vitest';
import {newCharacter,type Entry,type Character} from '../src/core/model';
import {createIdentity,type Identity} from '../src/data/automation/identity';
import type {Mechanics} from '../src/data/automation/protocol';
import {initializeAutomation} from '../src/core/automation/state';
import {syncAutoResources,setResource} from '../src/core/resources';
import {planFeatureResources,restResources} from '../src/core/automation/featureResources';
import {planClassMigration} from '../src/core/classMigration';
import {emptyMigrationChoices,planCardMigration,migrationDraft} from '../src/core/cardMigration';
import {planBatchCardMigration} from '../src/core/batchCardMigration';
import {syncFeatures,removeSelection} from '../src/core/sheet';
import {validateCharacter,importOwlbear} from '../src/core/validation';
import {evaluate} from '../src/core/engine';
import {exportOwlbear} from '../src/core/export';
import {spellState} from '../src/core/characterDetails';
import {resourceCanvasRows} from '../src/core/resourceWidgets';

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
describe('G5 delta: paused copies seed reviewed resources',()=>{
 for(const mode of ['class','card','batch'] as const)it(mode,()=>{
  const cls=entry('class','Paused caster',{classModel:{hitDie:8},resources:[{key:'uses',max:{value:5},recovery:[{period:'long',amount:'all'}]}]}),c=card([cls]);c.selections[0].level=5;syncAutoResources(c);for(const id of Object.keys(c.runtime.resources))setResource(c,id,0);c.automation!.enabled=false;
  const feature=entry('feature','Paused new feature',{resources:[{key:'feature',max:{value:10},recovery:[{period:'long',amount:'all'}]}]},{kind:'classFeature',classEngName:'Paused caster',classSource:'XPHB',level:1},{className:'Paused caster',classSource:'XPHB',level:1}),newer=structuredClone(cls);newer.revision='2';newer.automation!.mechanics!.classModel!.classFeatures=[feature.automation!.identity.key];newer.automation!.mechanics!.resources![0].max={value:10};newer.automation!.mechanics!.resources!.push({key:'new',max:{value:10},recovery:[{period:'long',amount:'all'}]});
  const catalog=[newer,feature],original=structuredClone(c),choices=emptyMigrationChoices();choices.roots={row0:cls.id};if(mode==='card')for(const grant of migrationDraft(c,catalog,choices,1).grants)choices.grants[grant.key]={include:true};const copy=mode==='class'?planClassMigration(c,catalog,choices.roots,copyIdentity).card:mode==='card'?planCardMigration(c,catalog,choices,copyIdentity).card:planBatchCardMigration(c,catalog,choices.roots,{},copyIdentity).plan.card;
  expect(c).toEqual(original);expect(copy.automation!.enabled).toBe(false);expect(Object.values(copy.runtime.resources).every(r=>r.current===0)).toBe(true);const restored=validateCharacter(JSON.parse(JSON.stringify(copy)));restored.automation!.enabled=true;syncFeatures(restored,catalog);syncAutoResources(restored);expect(planFeatureResources(restored).grants).toHaveLength(3);expect(Object.values(restored.runtime.resources).every(r=>r.current===0)).toBe(true);
 });
});
it('G5 delta: two owned item instances have independent consumption and attunement lifecycles',()=>{
 const cls=entry('class','Item owner',{classModel:{hitDie:8}}),item=entry('item','Charge item',{equipmentModel:{category:'other',requiresAttunement:true},resources:[{key:'charges',max:{value:5},recovery:[{period:'long',amount:'all'}]}]}),c=card([cls,item,structuredClone(item)]);for(const row of c.selections.slice(1)){row.parentId='row0';row.grantKey='equipment:0:a:0';row.equipped=true;row.attuned=true;}syncAutoResources(c);const grants=planFeatureResources(c).grants;expect(grants).toHaveLength(2);expect(new Set(grants.map(g=>g.key)).size).toBe(2);const first=grants.find(g=>g.ownerId==='row1')!.key,second=grants.find(g=>g.ownerId==='row2')!.key;setResource(c,first,0);expect(c.runtime.resources[second].current).toBe(5);c.selections[1].attuned=false;syncAutoResources(c);expect(c.runtime.resources[first]).toBeUndefined();expect(c.runtime.resources[second].current).toBe(5);const restored=validateCharacter(JSON.parse(JSON.stringify(c)));restored.selections[1].attuned=true;syncAutoResources(restored);expect(restored.runtime.resources[first].current).toBe(0);expect(restored.runtime.resources[second].current).toBe(5);
});
it('G5 delta: independent old item ledgers retain both consumption histories',()=>{
 const cls=entry('class','Old item owner',{classModel:{hitDie:8}}),item=entry('item','Old charge item',{equipmentModel:{category:'other'},resources:[{key:'charges',max:{value:5},recovery:[{period:'long',amount:'all'}]}]}),c=card([cls,item,structuredClone(item)]);for(const row of c.selections.slice(1)){row.parentId='row0';row.equipped=true;}
 for(const grant of planFeatureResources(c).grants)c.runtime.resources[grant.legacyKey]={max:5,current:grant.ownerId==='row1'?0:3,featureGrant:{ownerId:grant.ownerId,ruleMax:5,spent:grant.ownerId==='row1'?5:2,recovery:{long:'all'},origin:'previous owned item'}};
 syncAutoResources(c);const grants=planFeatureResources(c).grants;expect(grants).toHaveLength(2);expect(c.runtime.resources[grants.find(g=>g.ownerId==='row1')!.key]).toMatchObject({max:5,current:0,featureGrant:{spent:5}});expect(c.runtime.resources[grants.find(g=>g.ownerId==='row2')!.key]).toMatchObject({max:5,current:3,featureGrant:{spent:2}});expect(Object.keys(c.runtime.resources).filter(id=>id.startsWith('feature-resource:'))).toHaveLength(2);
});
it('G5 delta: legacy rekey preserves hidden state, order, positions and grouped members through reload',()=>{
 const c=card([entry('feat','Layout resource',{resources:[{key:'uses',max:{value:5},recovery:[{period:'long',amount:'all'}]}]})]);syncAutoResources(c);const grant=planFeatureResources(c).grants[0];setResource(c,grant.key,2);const old=c.runtime.resources[grant.key];c.runtime.resources[grant.legacyKey]=old;delete c.runtime.resources[grant.key];c.runtime.featureResourceArchive={[grant.legacyKey]:structuredClone(old)};c.runtime.resources.manual={max:2,current:1};c.quickbarLayout={order:[`resource:${grant.legacyKey}`,'resource:manual'],hidden:[`resource:${grant.legacyKey}`],widgets:{[grant.legacyKey]:{x:2,y:1,w:4,h:2,page:3,style:'poolpips',members:[grant.legacyKey,'manual'],label:'Owned group',color:'#123456'}}};const saved=structuredClone(c.quickbarLayout.widgets![grant.legacyKey]);syncAutoResources(c);expect(c.quickbarLayout.order).toEqual([`resource:${grant.key}`,'resource:manual']);expect(c.quickbarLayout.hidden).toEqual([`resource:${grant.key}`]);expect(c.quickbarLayout.widgets![grant.key]).toEqual({...saved,members:[grant.key,'manual']});expect(c.quickbarLayout.widgets![grant.legacyKey]).toBeUndefined();expect(resourceCanvasRows(c).some(([id])=>id===grant.key)).toBe(false);const restored=validateCharacter(JSON.parse(JSON.stringify(c)));syncAutoResources(restored);expect(restored.quickbarLayout).toEqual(c.quickbarLayout);expect(restored.runtime.resources[grant.key].current).toBe(2);
});
it('G5 delta: 0.3 import preserves explicit unit weight without raw inference or changing quantities',()=>{
 const c=card([entry('item','Weight item',{equipmentModel:{category:'other',weight:7}})]);c.selections[0].quantity=3;const first=exportOwlbear(c,evaluate(c)),imported=importOwlbear(first),again=exportOwlbear(imported,evaluate(imported));expect(first.inventory.items[0]).toMatchObject({weight:7,quantity:3});expect(imported.selections.find(s=>s.entry.kind==='item')!.entry.manualItemWeight).toBe(7);expect(again.inventory.items[0]).toMatchObject({weight:7,quantity:3});expect(again.inventory.total_weight).toBe(21);const before=structuredClone(imported);imported.selections.find(s=>s.entry.kind==='item')!.entry.raw.weight=999;expect(exportOwlbear(imported,evaluate(imported)).inventory.items[0].weight).toBe(7);expect(importOwlbear(again).selections.find(s=>s.entry.kind==='item')!.entry.manualItemWeight).toBe(7);expect(before.selections[0].quantity).toBe(3);
 const invalid=structuredClone(first);invalid.inventory.items[0].weight=-1;expect(()=>importOwlbear(invalid)).toThrow(/重量/);
});
it('G5 delta: 0.3 exchange also retains its explicitly provided single-class hit die',()=>{
 const c=card([entry('class','Exchange die',{classModel:{hitDie:8}})]),first=exportOwlbear(c,evaluate(c)),imported=importOwlbear(first),original=structuredClone(imported);expect(imported.selections[0].entry.manualHitDie).toBe(8);imported.selections[0].entry.raw.hd={faces:99};expect(exportOwlbear(imported,evaluate(imported)).core_stats.hit_dice.die_size).toBe(8);expect(importOwlbear(exportOwlbear(imported,evaluate(imported))).selections[0].entry.manualHitDie).toBe(8);expect(original.selections[0].entry.raw.hd.faces).toBe(8);
 const invalid=structuredClone(first);invalid.core_stats.hit_dice.die_size=1.5;expect(()=>importOwlbear(invalid)).toThrow(/生命骰/);
});
describe('D2-R1: unresolved historical ownership survives activity changes',()=>{
 for(const pause of ['equipped','attuned','quantity','source'] as const)for(const index of [1,2])for(const initiallyPaused of [false,true])it(`${pause}, row${index}, ${initiallyPaused?'paused at load':'paused after detection'}`,()=>{
  const cls=entry('class','Historical owner',{classModel:{hitDie:8}}),item=entry('item','Historical charges',{equipmentModel:{category:'other',requiresAttunement:true},resources:[{key:'uses',max:{value:5},recovery:[{period:'long',amount:'all'}]}]}),c=card([cls,item,structuredClone(item)]);c.selections[2].entry.id+=':second';for(const row of c.selections.slice(1)){row.parentId='row0';row.equipped=true;row.attuned=true;}
  const oldKey=planFeatureResources(c).grants[0].previousKey!;c.runtime.resources[oldKey]={max:5,current:0,featureGrant:{ownerId:'row2',ruleMax:5,spent:5,recovery:{long:'all'},origin:'old merged'}};
  const toggle=(card:Character,paused:boolean)=>{const row=card.selections.find(row=>row.id===`row${index}`)!;if(pause==='equipped')row.equipped=!paused;else if(pause==='attuned')row.attuned=!paused;else if(pause==='quantity')row.quantity=paused?0:1;else card.profile.disabledEntries=paused?[row.entry.id]:[];};
  if(initiallyPaused)toggle(c,true);const before=structuredClone(c);expect(planFeatureResources(c).grants).toEqual([]);expect(c).toEqual(before);syncAutoResources(c);expect(c.runtime.featureResourceArchive![oldKey].featureGrant).toMatchObject({spent:5,requiresReview:true});
  toggle(c,true);syncAutoResources(c);expect(planFeatureResources(c).grants).toEqual([]);expect(Object.values(c.runtime.resources).filter(r=>r.featureGrant)).toEqual([]);expect(planFeatureResources(c).issues.some(issue=>issue.id.startsWith('resource-ledger:'))).toBe(true);
  if(pause==='quantity')toggle(c,false);const restored=validateCharacter(JSON.parse(JSON.stringify(c)));toggle(restored,false);syncAutoResources(restored);expect(planFeatureResources(restored).grants).toEqual([]);expect(restored.runtime.featureResourceArchive![oldKey].featureGrant).toMatchObject({spent:5,requiresReview:true});expect(Object.values(restored.runtime.resources).filter(r=>r.featureGrant)).toEqual([]);
 });
});
it('D2-R1: a class-scoped item receipt cannot prove unique historical ownership from a single current instance',()=>{
 const cls=entry('class','Single historical owner',{classModel:{hitDie:8}}),item=entry('item','Single historical charge',{equipmentModel:{category:'other'},resources:[{key:'uses',max:{value:5},recovery:[{period:'long',amount:'all'}]}]}),c=card([cls,item]);c.selections[1].parentId='row0';c.selections[1].equipped=true;const oldKey=planFeatureResources(c).grants[0].previousKey!;c.runtime.resources[oldKey]={max:5,current:0,featureGrant:{ownerId:'row1',ruleMax:5,spent:5,recovery:{long:'all'},origin:'old class receipt'}};syncAutoResources(c);expect(planFeatureResources(c).grants).toEqual([]);expect(c.runtime.featureResourceArchive![oldKey].featureGrant!.spent).toBe(5);delete c.selections[1].parentId;c.selections.shift();syncAutoResources(c);expect(planFeatureResources(c).grants).toEqual([]);expect(c.runtime.featureResourceArchive![oldKey].featureGrant!.requiresReview).toBe(true);
});
it('D2-R1: once detected, a legacy feature conflict stays pending after one former holder is removed',()=>{
 const cls=entry('class','Persistent class',{classModel:{hitDie:8}}),a=entry('feature','Persistent uses',{resources:[{key:'uses',max:{value:2},recovery:[{period:'long',amount:'all'}]}]},{kind:'subclassFeature',classEngName:'Persistent class',classSource:'XPHB',subclassEngShortName:'First',subclassSource:'XPHB',level:1}),b=structuredClone(a);b.id='second-persistent-feature';b.automation!.identity=createIdentity({...a.automation!.identity,subclassEngShortName:'Second'});const c=card([cls,a,b]);c.selections[1].parentId=c.selections[2].parentId='row0';const key=`feature-resource:${JSON.stringify(['row0','XPHB','XPHB','Old label','Persistent uses'])}:uses`;c.runtime.featureResourceArchive={[key]:{max:2,current:0,featureGrant:{ownerId:'removed-owner',ruleMax:2,spent:2,recovery:{long:'all'},origin:'old ambiguous'}}};syncAutoResources(c);expect(c.runtime.featureResourceArchive[key].featureGrant!.requiresReview).toBe(true);c.selections.pop();const restored=validateCharacter(JSON.parse(JSON.stringify(c)));syncAutoResources(restored);expect(planFeatureResources(restored).grants).toEqual([]);expect(restored.runtime.featureResourceArchive![key].featureGrant!.spent).toBe(2);
});
describe('D2-R2: historical instance bindings survive actual source removal',()=>{
 for(const codec of ['canonical','legacy-path'] as const)for(const deleteOwner of [false,true])for(const enabled of [false,true])for(const detectFirst of [false,true])it(`${codec}, owner removed=${deleteOwner}, enabled=${enabled}, detected=${detectFirst}`,()=>{
  const cls=entry('class','Removal owner',{classModel:{hitDie:8}}),item=entry('item','Removal charges',{equipmentModel:{category:'other'},resources:[{key:'uses',max:{value:5},recovery:[{period:'long',amount:'all'}]}]}),c=card([cls,item,structuredClone(item)]);for(const row of c.selections.slice(1)){row.parentId='row0';row.grantKey='equipment:0:a:0';row.equipped=true;}
  const grants=planFeatureResources(c).grants,oldKey=codec==='canonical'?grants[0].previousKey!:grants[0].legacyKey;c.runtime.resources[oldKey]={max:5,current:0,featureGrant:{ownerId:'row2',ruleMax:5,spent:5,recovery:{long:'all'},origin:'legacy path'}};c.automation!.enabled=enabled;
  if(detectFirst)syncAutoResources(c);if(deleteOwner)removeSelection(c,'row2');removeSelection(c,'row0');expect(c.selections.map(row=>row.id)).toEqual(deleteOwner?['row1']:['row1','row2']);expect(c.selections.every(row=>!row.parentId)).toBe(true);
  const restored=validateCharacter(JSON.parse(JSON.stringify(c)));restored.automation!.enabled=true;const before=structuredClone(restored);expect(planFeatureResources(restored).grants).toEqual([]);expect(restored).toEqual(before);syncAutoResources(restored);expect(Object.values(restored.runtime.resources).filter(r=>r.featureGrant)).toEqual([]);expect(planFeatureResources(restored).issues.filter(i=>i.id.startsWith('resource-ledger:'))).toHaveLength(deleteOwner?1:2);expect(restored.runtime.featureResourceArchive![oldKey].featureGrant).toMatchObject({spent:5,requiresReview:true,reviewKeys:grants.map(g=>g.key)});
 });
 for(const codec of ['canonical','legacy-path'] as const)it(`a single current holder does not prove unique history: ${codec}`,()=>{
  const cls=entry('class','Single path owner',{classModel:{hitDie:8}}),item=entry('item','Single path charges',{equipmentModel:{category:'other'},resources:[{key:'uses',max:{value:5},recovery:[{period:'long',amount:'all'}]}]}),c=card([cls,item]);c.selections[1].parentId='row0';c.selections[1].grantKey='equipment:0:a:0';c.selections[1].equipped=true;const g=planFeatureResources(c).grants[0],key=codec==='canonical'?g.previousKey!:g.legacyKey;c.runtime.featureResourceArchive={[key]:{max:5,current:0,featureGrant:{ownerId:'removed-owner',ruleMax:5,spent:5,recovery:{long:'all'},origin:'historical shared'}}};syncAutoResources(c);expect(planFeatureResources(c).grants).toEqual([]);expect(c.runtime.featureResourceArchive[key].featureGrant).toMatchObject({spent:5,requiresReview:true,reviewKeys:[g.key]});expect(Object.values(c.runtime.resources).filter(r=>r.featureGrant)).toEqual([]);
 });
 it('pre-binding historical path archives remain pending for delivered orphan equipment',()=>{
  const item=entry('item','Orphan charges',{equipmentModel:{category:'other'},resources:[{key:'uses',max:{value:5},recovery:[{period:'long',amount:'all'}]}]}),c=card([item]);c.selections[0].grantKey='equipment:0:a:0';c.selections[0].equipped=true;const key=`feature-resource:${JSON.stringify(['removed-parent','equipment:0:a:0'])}:uses`;c.runtime.featureResourceArchive={[key]:{max:5,current:0,featureGrant:{ownerId:'removed-owner',ruleMax:5,spent:5,requiresReview:true,recovery:{long:'all'},origin:'previous unresolved path'}}};const restored=validateCharacter(JSON.parse(JSON.stringify(c)));syncAutoResources(restored);expect(planFeatureResources(restored).grants).toEqual([]);expect(Object.values(restored.runtime.resources).filter(r=>r.featureGrant)).toEqual([]);expect(restored.runtime.featureResourceArchive![key].featureGrant!.spent).toBe(5);expect(restored.runtime.featureResourceArchive![key].featureGrant!.reviewKeys).toHaveLength(1);
 });
 it('invalid review bindings cannot enter a saved card',()=>{
  const c=card([entry('feat','Validation binding',{resources:[{key:'uses',max:{value:2},recovery:[{period:'long',amount:'all'}]}]})]);syncAutoResources(c);const key=planFeatureResources(c).grants[0].key,r=c.runtime.resources[key];r.featureGrant!.reviewKeys=['arbitrary'];r.featureGrant!.requiresReview=true;expect(()=>validateCharacter(JSON.parse(JSON.stringify(c)))).toThrow('职业资源归属记录无效');r.featureGrant!.reviewKeys=[key];delete r.featureGrant!.requiresReview;expect(()=>validateCharacter(JSON.parse(JSON.stringify(c)))).toThrow('职业资源归属记录无效');
 });
});
