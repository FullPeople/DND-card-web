import {describe,it,expect} from 'vitest';
import {normalizeData,resolveReference} from '../src/data/catalog';
import {candidateReason,requirementMismatch} from '../src/core/engine';
import {newCharacter} from '../src/core/model';
import {syncFeatures} from '../src/core/sheet';
import {spellState} from '../src/core/characterDetails';
import {ownsSubclassFeature} from '../src/core/entryReferences';

import {source195} from './fixtures/source195';
describe('195 source identities and casting',()=>{
 const catalog=normalizeData(source195,'test');
 it('distinguishes original, compatibility and revised subclasses including their copy parents',()=>{
  const subs=catalog.filter(e=>e.kind==='subclass');expect(new Set(subs.map(e=>e.id)).size).toBe(3);
  expect(subs[0].entries).toContain('原版介绍');
  for(const [i,ref] of ['旧影|测试祭司||镜||2','旧影|测试祭司|XPHB|镜||3','新影|测试祭司|XPHB|镜|XPHB|3'].entries()){
   const feature=resolveReference(ref,catalog,'feature')!;expect(feature).toBeDefined();expect(feature.entries.length).toBeGreaterThan(0);expect(requirementMismatch(feature,{refs:[ref]})).toBeUndefined();
   expect(ownsSubclassFeature(subs[[1,0,2][i]],feature)).toBe(true);expect(subs.filter(s=>ownsSubclassFeature(s,feature))).toHaveLength(1);
  }
  expect(resolveReference('旧影|测试祭司|XPHB|镜|XPHB|3',catalog,'feature')).toBeUndefined();
 });
 it('grants compatibility features from exact UIDs without borrowing revised ones',()=>{
  const c=newCharacter(),cls=catalog.find(e=>e.kind==='class')!,sub=catalog.find(e=>e.kind==='subclass'&&e.raw.classSource==='XPHB'&&e.source==='PHB')!;c.profile.enabledSources=['PHB','XPHB'];c.profile.exceptions[sub.id]="验收适配版";
  c.selections=[{id:'class',entry:cls,level:3,quantity:1,equipped:false},{id:'sub',entry:sub,level:3,quantity:1,equipped:false}];syncFeatures(c,catalog);
  const feature=c.selections.find(s=>s.entry.name==='旧影');expect(feature?.entry.source).toBe('PHB');expect(feature?.entry.raw.classSource).toBe('XPHB');expect(feature?.entry.entries).toContain('独立的旧版正文。');expect(c.selections.some(s=>s.entry.name==='新影')).toBe(false);
 });
 it('accepts same class advancement but keeps multiclass and total-level guards',()=>{
  const c=newCharacter(),entry=catalog.find(e=>e.kind==='class')!;c.selections=[{id:'class',entry,level:3,quantity:1,equipped:false}];expect(candidateReason(c,entry)).toBeUndefined();expect(candidateReason(c,{...entry,id:'different-source'})).toContain('兼职');c.selections[0].level=20;expect(candidateReason(c,entry)).toContain('20');
 });
 it('derives ability on every read, supports explicit override and subclass casting',()=>{
  const c=newCharacter(),entry=catalog.find(e=>e.kind==='class')!;c.selections=[{id:'class',entry,level:3,quantity:1,equipped:false}];c.spellSettings={mode:'prepared',ability:'int',capacity:0,attackBonus:0,dcBonus:0,prepared:[],slots:{}};expect(spellState(c).ability).toBe('wis');c.spellSettings.abilityOverride=true;expect(spellState(c).ability).toBe('int');c.spellSettings.abilityOverride=false;
  const sub=catalog.find(e=>e.kind==='subclass'&&e.source==='XPHB')!;c.selections.push({id:'sub',entry:{...sub,raw:{...sub.raw,casterProgression:'third',spellcastingAbility:'cha'}},level:3,quantity:1,equipped:false});expect(spellState(c).ability).toBe('cha');
 });
});

