import {beforeAll,expect,it} from 'vitest';
import {evaluate} from '../src/core/engine';
import {createCustomEntry} from '../src/core/customEntries';
import type {Selection} from '../src/core/model';
import {syncFeatures} from '../src/core/sheet';
import {sourceLevelHpFamilyId,sourceLevelHpOffer} from '../src/core/automation/sourceLevelHp';
import {sourceLevelHpFixture} from './helpers/sourceLevelHpFlowFixture';
import {sourceLevelHpCatalogEntries,sourceLevelHpComponent,sourceLevelHpSourceEvidence,sourceLevelHpSpecs,sourceLevelHpSnapshot as snapshot} from './helpers/sourceLevelHpSourceFixture';

beforeAll(()=>{sourceLevelHpSourceEvidence();});
const authority={canEdit:true,gm:false};
const admitted=()=>new Set(sourceLevelHpSourceEvidence().rules.map(rule=>rule.key));

it('known source HP roots and native supporting nodes cannot regain rejected HP through the legacy flat-effect executor',()=>{
 const keys=admitted();expect(keys.size).toBeGreaterThan(0);
 for(const spec of sourceLevelHpSpecs.filter(row=>keys.has(row.key))){
  const nodes=spec.ownerPath?['root','class','top','dragged-hp-target']as const:['root','owned-inline-hp']as const;
  for(const node of nodes)for(const transport of node==='root'?['canonical','coherent-alias']as const:['canonical']as const){
   const f=sourceLevelHpFixture(spec.key);let row:Selection;
   if(node==='owned-inline-hp'){
    const path=spec.clauses.find(clause=>clause.role==='maximum-hp')!.expectedCompleteEntryPath,matched=path.match(/^raw\/entries\/(\d+)\/entries\/0$/);expect(matched).not.toBeNull();const children=f.c.selections.filter(item=>item.parentId===f.owner.id&&item.grantKey===`inline:${matched![1]}`);expect(children).toHaveLength(1);row=children[0];expect(row.entry.kind).toBe('feature');expect(row.entry.raw).toEqual({});
   }else if(node==='class')row=f.classOwner;
   else if(node==='top'){expect(f.top).toBeDefined();row=f.top!;}
   else if(node==='dragged-hp-target'){
    const target=sourceLevelHpComponent(spec.hpFeaturePath!);expect(f.c.selections.some(item=>item.entry.id===target.id)).toBe(false);
    row={id:'authored-manually-dragged-hp-target',entry:structuredClone(target),quantity:1,level:1,equipped:false};f.c.selections.push(row);
   }else row=f.owner;
   if(transport==='coherent-alias'){row.entry.id='authored-source-level-hp-alias-'+row.id;row.entry.revision='authored-source-level-hp-transport-revision';}
   if(node!=='owned-inline-hp')expect(sourceLevelHpFamilyId(row.entry)).toBeDefined();
   // No consent is manufactured: this is the existing generic-effect bypass,
   // not the new owned-source HP projection or a dragged-child grant.
   row.entry.effects=[{target:'hp',op:'add',value:99}];
   const before=snapshot(f.c),d=evaluate(f.c);
   expect.soft(d.maxHp).toBe(42);
   expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(7);expect(f.c.runtime.tempHp).toBe(2);expect(f.c.runtime.resources.manual.current).toBe(1);
   if(node!=='dragged-hp-target')expect(sourceLevelHpOffer(f.c,f.owner.id,authority)?.active).not.toBe(true);
  }
 }
});

it('genuine unrelated CUSTOM same-name HP effects retain their established manual executor and stored values',()=>{
 for(const spec of sourceLevelHpSpecs.filter(row=>admitted().has(row.key))){
  const f=sourceLevelHpFixture(spec.key);f.owner.entry=createCustomEntry({type:spec.ownerPath?'feature':'race',name:f.entry.name,english:f.entry.english,body:''});delete f.owner.parentId;delete f.owner.grantKey;f.owner.entry.effects=[{target:'hp',op:'add',value:5}];
  f.c.profile.enabledSources=[...new Set([...f.c.profile.enabledSources,f.owner.entry.source])];
  expect(sourceLevelHpFamilyId(f.owner.entry)).toBeUndefined();const before=snapshot(f.c);expect(evaluate(f.c).maxHp).toBe(47);expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(7);expect(f.c.runtime.tempHp).toBe(2);expect(f.c.runtime.resources.manual.current).toBe(1);
 }
 const f=sourceLevelHpFixture('race/34'),nativeChild=f.c.selections.find(row=>row.parentId===f.owner.id&&row.grantKey==='inline:2')!;expect(nativeChild).toBeDefined();const custom=createCustomEntry({type:'feature',name:nativeChild.entry.name,english:nativeChild.entry.english,body:''});custom.effects=[{target:'hp',op:'add',value:5}];f.c.profile.enabledSources=[...new Set([...f.c.profile.enabledSources,custom.source])];f.c.selections.push({id:'authored-custom-hp-slot-collision',parentId:f.owner.id,grantKey:nativeChild.grantKey,entry:custom,level:1,quantity:1,equipped:false});const before=snapshot(f.c);expect(evaluate(f.c).maxHp).toBe(47);expect(snapshot(f.c)).toBe(before);
});

it('the separately excluded same-name PHB Draconic subclass for an XPHB class retains its unrelated legacy HP route',()=>{
 const f=sourceLevelHpFixture('subclass/20'),matches=sourceLevelHpCatalogEntries().filter(entry=>entry.packId==='kiwee'&&entry.kind==='subclass'&&entry.raw._category==='subclass'&&entry.source==='PHB'&&entry.english==='Draconic Bloodline'&&entry.raw.className==='术士'&&entry.raw.classSource==='XPHB');
 expect(matches).toHaveLength(1);f.owner.entry=structuredClone(matches[0]);f.owner.parentId=f.classOwner.id;f.c.profile.optional.legacy=true;f.c.profile.enabledSources=[...new Set([...f.c.profile.enabledSources,'PHB'])];syncFeatures(f.c,f.catalog);
 expect.soft(sourceLevelHpFamilyId(f.owner.entry)).toBeUndefined();
 f.owner.entry.effects=[{target:'hp',op:'add',value:5}];const before=snapshot(f.c);expect(evaluate(f.c).maxHp).toBe(47);expect(snapshot(f.c)).toBe(before);expect(f.c.runtime.hp).toBe(7);expect(f.c.runtime.tempHp).toBe(2);expect(f.c.runtime.resources.manual.current).toBe(1);
});
