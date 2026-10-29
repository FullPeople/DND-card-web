import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {type Entry,type Selection} from '../src/core/model';
import {planSourceSpells,syncSourceSpells} from '../src/core/automation/sourceSpells';
import {spellPayments} from '../src/core/automation/actions';
import {planFeatureResources,syncFeatureResources} from '../src/core/automation/featureResources';
import {classPoolKey,planClassResourcePools,sourceResourcePool} from '../src/core/automation/sourceResourcePools';
import {reviewedAlertIdentity,reviewedModernAlertRule} from '../src/core/automation/reviewedFeatIdentity';
import {alertDirectory,alertFrozenInput,alertSnapshot,setupAlert} from './helpers/reviewedAlertCore';

function sourceSpell():Entry{
 const path='spells/spells-phb.json',index=JSON.parse(readFileSync(`${alertDirectory}/index.json`,'utf8')),rows=index.rows.filter((row:any)=>row.url.endsWith('/data/'+path));
 if(rows.length!==1)throw Error('Unique actual PHB spell input required');
 const spell=normalizeData(structuredClone(alertFrozenInput(path,rows[0].sha256)),'alert-spell-deny-real').find(row=>row.kind==='spell'&&row.source==='PHB'&&row.english==='Light');
 if(!spell)throw Error('Actual PHB Light required');return spell;
}
function manual(source:'PHB'|'XPHB'='PHB',alias=false){const s=setupAlert(),entry=structuredClone(s.entries.find(row=>row.english==='Alert'&&row.source===source)!);if(alias)entry.id='imported-alert-spells';s.c.edition=source==='PHB'?'2014':'2024';s.c.profile.enabledSources=['PHB','XPHB','TCE'];const owner:Selection={id:'manual-alert-magic',entry,level:1,quantity:1,equipped:false};s.c.selections.push(owner);return {...s,owner,spell:sourceSpell()};}
const ref=(entry:Entry)=>`${entry.english}|${entry.source}`;
describe.skipIf(!alertDirectory)('actual-source Alert deny-family cannot grant source magic or use resources',()=>{
 for(const source of ['PHB','XPHB'] as const)for(const alias of [false,true])it.each(['known','prepared','daily','rest','will','choices'] as const)(`${source}${alias?' alias':''} forged %s has no source spell, resource or choice authority`,mode=>{
  const s=manual(source,alias),uid=ref(s.spell);
  s.owner.entry.raw.additionalSpells=mode==='known'||mode==='prepared'?[{ability:'int',[mode]:{_:[uid]}}]:mode==='choices'?[{ability:{choose:['int','wis']},innate:{_:[{choose:{from:[uid,'Dancing Lights|PHB'],count:1}}]}}]:[{ability:'int',innate:{_:{[mode]:mode==='daily'?{1:[uid]}:mode==='rest'?{pb:[uid]}:[uid]}}}];
  const before=alertSnapshot(s.c);expect(reviewedAlertIdentity(s.owner.entry)).toBe(true);const plan=planSourceSpells(s.c,[s.spell]);expect(plan.grants.filter(row=>row.owner.id===s.owner.id).length).toBe(0);expect(plan.choices.filter(row=>row.ownerId===s.owner.id).length).toBe(0);expect(alertSnapshot(s.c)).toBe(before);
  const selections=s.c.selections.map(row=>row.id),resources=structuredClone(s.c.runtime.resources);syncSourceSpells(s.c,[s.spell]);expect(s.c.selections.map(row=>row.id)).toEqual(selections);expect(s.c.runtime.resources).toEqual(resources);expect(s.c.runtime.resources.manual.current).toBe(2);
 });
 it('implicit class metadata cannot use a forged Alert class level; real parentClass metadata remains supported',()=>{
  const s=manual(),uid=ref(s.spell),forged=structuredClone(s.feat);forged.kind='class';s.c.selections.push({id:'forged-alert-metadata-class',entry:forged,level:20,quantity:1,equipped:false});s.owner.entry.id='authored-metadata-gate';s.owner.entry.kind='feature';s.owner.entry.english=s.owner.entry.raw.ENG_name='Authored metadata gate';s.owner.entry.raw.className=forged.raw.name;s.owner.entry.raw.classSource='PHB';s.owner.entry.raw.additionalSpells=[{ability:'int',known:{5:[uid]}}];const before=alertSnapshot(s.c);expect(planSourceSpells(s.c,[s.spell]).grants.filter(row=>row.owner.id===s.owner.id&&row.config.sourceGrant?.active).length).toBe(0);expect(alertSnapshot(s.c)).toBe(before);const ids=s.c.selections.map(row=>row.id),resources=structuredClone(s.c.runtime.resources);syncSourceSpells(s.c,[s.spell]);expect(s.c.selections.map(row=>row.id)).toEqual(ids);expect(s.c.runtime.resources).toEqual(resources);s.owner.entry.raw.className=s.c.selections[0].entry.raw.name;s.c.selections[0].level=5;expect(planSourceSpells(s.c,[s.spell]).grants.filter(row=>row.owner.id===s.owner.id&&row.config.sourceGrant?.active).length).toBe(1);
 });
 it('a forged Alert class cannot raise another real source spell gate, while a genuine class level still can',()=>{
  const s=manual(),uid=ref(s.spell);s.owner.entry.id='authored-total-gate';s.owner.entry.english=s.owner.entry.raw.ENG_name='Authored total gate';s.owner.entry.kind='feature';s.owner.entry.raw.additionalSpells=[{ability:'int',known:{5:[uid]}}];const forged=structuredClone(s.feat);forged.kind='class';s.c.selections.push({id:'forged-alert-total-class',entry:forged,level:1,quantity:1,equipped:false});const before=alertSnapshot(s.c);expect(planSourceSpells(s.c,[s.spell]).grants.filter(row=>row.owner.id===s.owner.id&&row.config.sourceGrant?.active).length).toBe(0);expect(alertSnapshot(s.c)).toBe(before);const ids=s.c.selections.map(row=>row.id),resources=structuredClone(s.c.runtime.resources);syncSourceSpells(s.c,[s.spell]);expect(s.c.selections.map(row=>row.id)).toEqual(ids);expect(s.c.runtime.resources).toEqual(resources);s.c.selections=s.c.selections.filter(row=>row.id!=='forged-alert-total-class');s.c.selections[0].level=5;expect(planSourceSpells(s.c,[s.spell]).grants.filter(row=>row.owner.id===s.owner.id&&row.config.sourceGrant?.active).length).toBe(1);
 });
 it('forged Alert cannot request a class table pool or resolve an existing class pool for payment',()=>{
  const s=manual(),cls=s.c.selections[0],name='Authored Alert Pool';cls.entry.raw.classTableGroups=[...(cls.entry.raw.classTableGroups||[]),{colLabels:[name],rows:Array.from({length:20},()=>[3])}];s.owner.parentId=cls.id;s.owner.entry.raw.additionalSpells=[{ability:'int',resourceName:name,innate:{_:{resource:{1:[ref(s.spell)]}}}}];
  const before=alertSnapshot(s.c),grant={key:'existing-class-pool',ownerId:cls.id,name,max:3,recovery:{},origin:'Project-authored retained pool'};
  expect({poolCount:planClassResourcePools(s.c,[]).length,resolved:!!sourceResourcePool(s.c,s.owner,0,name,[grant]).grant,featureCount:planFeatureResources(s.c).grants.filter(row=>row.name===name.replace(/ /g,'')).length,spellCount:planSourceSpells(s.c,[s.spell]).grants.filter(row=>row.owner.id===s.owner.id).length}).toEqual({poolCount:0,resolved:false,featureCount:0,spellCount:0});expect(alertSnapshot(s.c)).toBe(before);
  const resources=structuredClone(s.c.runtime.resources);syncFeatureResources(s.c);syncSourceSpells(s.c,[s.spell]);expect(s.c.runtime.resources).toEqual(resources);
 });
 it('retiring a forged Alert spell leaves delivered records and spent counters but exposes no cast action or new/refilled uses',()=>{
  const s=manual(),uid=ref(s.spell);s.owner.entry.id='old-authored-spell-source';s.owner.entry.english=s.owner.entry.raw.ENG_name='Authored prior source';s.owner.entry.raw.additionalSpells=[{ability:'int',innate:{_:{daily:{1:[uid]}}}}];syncSourceSpells(s.c,[s.spell]);
  const delivered=s.c.selections.find(row=>row.parentId===s.owner.id&&row.entry.kind==='spell')!,key=Object.keys(s.c.runtime.resources).find(key=>key.startsWith('innate-spell:'))!;expect(delivered).toBeDefined();expect(key).toBeDefined();s.c.runtime.resources[key].current=0;
  s.owner.entry.english=s.owner.entry.raw.ENG_name='Alert';expect(reviewedAlertIdentity(s.owner.entry)).toBe(true);const resources=structuredClone(s.c.runtime.resources),ids=s.c.selections.map(row=>row.id);expect(spellPayments(s.c,delivered.id).options).toEqual([]);syncSourceSpells(s.c,[s.spell]);expect(s.c.selections.map(row=>row.id)).toEqual(ids);expect(s.c.runtime.resources).toEqual(resources);expect(s.c.spellSettings!.special![delivered.id].sourceGrant!.active).toBe(false);
 });
 it('an already established genuine class pool is retained, not deleted or refilled by retirement of a forged Alert requester',()=>{
  const s=manual(),cls=s.c.selections[0],name='AuthoredRetainedPool';cls.entry.raw.classTableGroups=[{colLabels:[name],rows:Array.from({length:20},()=>[3])}];s.owner.parentId=cls.id;s.owner.entry.raw.additionalSpells=[{resourceName:name,innate:{_:{resource:{1:[ref(s.spell)]}}}}];const key=classPoolKey(s.c,cls,name);s.c.runtime.resources[key]={name,max:3,current:1,featureGrant:{ownerId:cls.id,ruleMax:3,origin:'Project-authored existing class pool',recovery:{},spent:2,classPool:{entryId:cls.entry.id,label:name}}};
  expect(planClassResourcePools(s.c,[]).map(row=>row.key)).toEqual([key]);syncFeatureResources(s.c);expect(s.c.runtime.resources[key].current).toBe(1);expect(s.c.runtime.resources.manual.current).toBe(2);
 });
 it('genuine XPHB Alert still has its original no-magic/no-use-resource path, not PHB authority',()=>{
  const s=manual('XPHB');expect(reviewedModernAlertRule(s.owner.entry)).toBe(true);expect(reviewedAlertIdentity(s.owner.entry)).toBe(false);const before=alertSnapshot(s.c);expect(planSourceSpells(s.c,[s.spell]).grants.filter(row=>row.owner.id===s.owner.id).length).toBe(0);expect(planClassResourcePools(s.c,[])).toEqual([]);syncSourceSpells(s.c,[s.spell]);expect(alertSnapshot(s.c)).toBe(before);
 });
});
