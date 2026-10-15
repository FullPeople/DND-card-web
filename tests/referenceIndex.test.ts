import {describe,it,expect} from 'vitest';
import type {Entry} from '../src/core/model';
import {ReferenceIndex,indexedReference} from '../src/ui/referenceIndex';
const entry=(id:string,patch:Partial<Entry>={}):Entry=>({id,name:id,english:id,kind:'spell',source:'PHB',edition:'2014',packId:'test',revision:'1',entries:[],raw:{},...patch});
describe('indexed Wiki references',()=>{
 it('keeps order, Chinese and English aliases, and one row for identical aliases',()=>{
  const first=entry('first',{name:'火球术',english:'Fireball'}),second=entry('second',{english:'Fireball'}),same=entry('same');
  const index=new ReferenceIndex([first,second,same]);
  expect(index.named('FIREBALL','spell')).toEqual([first,second]);expect(index.named('火球术')).toEqual([first]);expect(index.named('same')).toEqual([same]);
 });
 it('retains selected snapshots for explicit IDs and catalog priority for ordinary links',()=>{
  const catalog=entry('same'),saved=entry('same',{revision:'saved'}),index=new ReferenceIndex([catalog]);
  expect(indexedReference(index,[saved],'entry:same')).toBe(saved);expect(indexedReference(index,[saved],'same','spell')).toBe(catalog);
 });
 it('selects an explicit source without merging equal display names or editions',()=>{
  const old=entry('old',{english:'Fireball'}),next=entry('next',{english:'Fireball',source:'XPHB',edition:'2024'}),index=new ReferenceIndex([old,next]);
  expect(indexedReference(index,[],'fireball|xphb','spell')).toBe(next);expect(indexedReference(index,[],'fireball|PHB','spell')).toBe(old);
  expect(indexedReference(index,[],'fireball','spell',next)).toBe(next);expect(indexedReference(index,[],'fireball','spell')).toBe(old);
 });
 it('resolves subclass short names only under the matching class and sources',()=>{
  const wrong=entry('wrong',{kind:'subclass',source:'TCE',raw:{shortName:'Scribe',classEnglish:'Cleric',classSource:'PHB'}}),right=entry('right',{kind:'subclass',source:'TCE',raw:{ENG_shortName:'Scribe',classEnglish:'Wizard',classSource:'PHB'}}),index=new ReferenceIndex([wrong,right]);
  expect(indexedReference(index,[],'Wizard|PHB||Scribe|TCE','class')).toBe(right);expect(indexedReference(index,[],'Wizard|XPHB||Scribe|TCE','class')).toBeUndefined();
 });
 it('preserves tag aliases and does not fall across unrelated entry kinds',()=>{
  const monster=entry('wolf',{kind:'monster'}),rule=entry('rule',{kind:'rule'}),condition=entry('poison',{kind:'condition'}),index=new ReferenceIndex([monster,rule,condition]);
  expect(indexedReference(index,[],'wolf','creature')).toBe(monster);expect(indexedReference(index,[],'rule','action')).toBe(rule);expect(indexedReference(index,[],'poison','status')).toBe(condition);expect(indexedReference(index,[],'wolf','spell')).toBeUndefined();
 });
 it('rebuilds from current readable sources without retaining a removed source',()=>{
  const removed=entry('private'),remaining=entry('public');const before=new ReferenceIndex([removed,remaining]),after=new ReferenceIndex([remaining]);
  expect(indexedReference(before,[],'entry:private')).toBe(removed);expect(indexedReference(after,[],'entry:private')).toBeUndefined();expect(indexedReference(after,[],'entry:public')).toBe(remaining);
 });
 it('matches feature UIDs by class source, level and feature source rather than display name',()=>{
  const feature=(id:string,patch:Partial<Entry>={})=>entry(id,{name:'同名特性',english:'Shared feature',kind:'feature',raw:{className:'法师',classEnglish:'Wizard',classSource:'PHB',level:2},...patch});
  const wrongClass=feature('cleric',{raw:{classEnglish:'Cleric',classSource:'PHB',level:2}}),wrongLevel=feature('level3',{raw:{classEnglish:'Wizard',classSource:'PHB',level:3}}),right=feature('wizard'),revised=feature('revised',{source:'XPHB',edition:'2024',raw:{classEnglish:'Wizard',classSource:'XPHB',level:2}});
  const index=new ReferenceIndex([wrongClass,wrongLevel,revised,right]);
  expect(indexedReference(index,[],'Shared feature|Wizard|PHB|2','feature')).toBe(right);
  expect(indexedReference(index,[],'同名特性|Wizard|XPHB|2','feature')).toBe(revised);
  expect(indexedReference(index,[],'Shared feature|Wizard|PHB|2|TCE','feature')).toBeUndefined();
 });
 it('keeps subclass UID defaults independent of the parent class edition',()=>{
  const feature=entry('sub-feature',{kind:'feature',english:'Shared feature',raw:{classEnglish:'Wizard',classSource:'XPHB',subclassShortName:'Abjuration',subclassSource:'PHB',level:3}});
  const other=entry('other-sub',{...feature,id:'other-sub',raw:{...feature.raw,subclassShortName:'Evocation'}}),index=new ReferenceIndex([other,feature]);
  expect(indexedReference(index,[],'Shared feature|Wizard|XPHB|Abjuration||3','feature')).toBe(feature);
  expect(indexedReference(index,[],'Shared feature|Wizard|XPHB|Abjuration|XPHB|3','feature')).toBeUndefined();
 });
 it('uses a selected snapshot when its source is missing from the live catalog without replacing it',()=>{
  const saved=entry('saved-feature',{name:'旧特性',english:'Saved feature',kind:'feature',source:'TCE',revision:'saved',raw:{classEnglish:'Wizard',classSource:'PHB',level:2}}),before=structuredClone(saved),index=new ReferenceIndex([]);
  expect(indexedReference(index,[saved],'Saved feature|Wizard|PHB|2|TCE','feature')).toBe(saved);
  expect(saved).toEqual(before);
 });
 it('does not revisit unrelated catalog names for repeated rendered references',()=>{
  let reads=0;const rows=Array.from({length:1000},(_,i)=>{const row=entry('entry-'+i);Object.defineProperty(row,'name',{get(){reads++;return '名称'+i;}});return row;});
  const index=new ReferenceIndex(rows),afterBuild=reads;
  for(let i=0;i<50;i++)expect(indexedReference(index,[],'名称'+i,'spell')).toBe(rows[i]);
  expect(reads).toBe(afterBuild);
 });
});
