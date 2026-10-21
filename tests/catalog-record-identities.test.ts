import {expect,it} from 'vitest';
import type {Entry,Raw} from '../src/core/model';
import {normalizeData} from '../src/data/catalog';
import {loadCatalogSnapshot,type CatalogSnapshot} from '../src/data/catalogSnapshot';
import {resolveEntryReference} from '../src/core/entryReferences';

// Original examples only; no upstream rule bodies or saved player characters.
const feature=(name:string,extra:Raw={}):Raw=>({name,ENG_name:'Shared Authored Ability',source:'AUTH',edition:'one',
 className:'Authored Class',classSource:'XPHB',subclassShortName:'Alpha',subclassSource:'AUTH',level:3,
 entries:[`Original description for ${name}.`],...extra});
const normalize=(body:Raw)=>normalizeData(body,'authored-revision','authored');
const twoDefinitions=()=>normalize({subclassFeature:[feature('Authored First Ability'),feature('Authored Second Ability')]});

it('different authored names with the same English name retain distinct complete source identities',()=>{
 const entries=twoDefinitions();
 expect(entries).toHaveLength(2);
 expect(new Set(entries.map(entry=>entry.id)).size).toBe(2);
 const reversed=normalize({subclassFeature:[feature('Authored Second Ability'),feature('Authored First Ability')]});
 expect(Object.fromEntries(entries.map(entry=>[entry.name,entry.id]))).toEqual(Object.fromEntries(reversed.map(entry=>[entry.name,entry.id])));
});

it('the real cold and warm snapshot path retains both distinct definitions',async()=>{
 const entries=twoDefinitions();let saved:CatalogSnapshot|undefined,cold:Entry[]=[],warm:Entry[]=[];
 const options={scope:'authored-collisions',signal:new AbortController().signal,onProgress(){},
  read:async()=>saved,write:async(value:CatalogSnapshot)=>{saved=structuredClone(value);},
  load:async(batch:(rows:Entry[])=>void,progress:(value:any)=>void)=>{batch(entries);progress({done:1,total:1,label:'Authored input',failed:[],cached:0});}};
 await loadCatalogSnapshot({...options,refresh:true,onBatch:rows=>{cold.push(...rows);}});
 await loadCatalogSnapshot({...options,load:async()=>{throw Error('A complete warm snapshot must stay reusable');},onBatch:rows=>{warm.push(...rows);}});
 expect(cold.map(entry=>entry.name)).toEqual(['Authored First Ability','Authored Second Ability']);
 expect(warm.map(entry=>entry.name)).toEqual(cold.map(entry=>entry.name));
 expect(saved?.entries).toHaveLength(2);
});

it('a named expanded version does not overwrite its original or a sibling version',()=>{
 const entries=normalize({monster:[{name:'Original Authored Companion',ENG_name:'Authored Companion',source:'AUTH',edition:'classic',
  hp:{average:10},_versions:[{name:'Authored Gold Companion'},{name:'Authored Silver Companion'}]}]});
 expect(entries.map(entry=>entry.name)).toEqual(['Original Authored Companion','Authored Gold Companion','Authored Silver Companion']);
 expect(new Set(entries.map(entry=>entry.id)).size).toBe(3);
});

it('explicit editions remain different identities even inside a single source',()=>{
 const entries=normalize({classFeature:[feature('Shared Authored Ability',{edition:'classic'}),feature('Shared Authored Ability',{edition:'one'})]});
 expect(entries.map(entry=>entry.edition)).toEqual(['2014','2024']);
 expect(new Set(entries.map(entry=>entry.id)).size).toBe(2);
});

it('a subclass root short name participates in its identity',()=>{
 const root={name:'Shared Authored Subclass',ENG_name:'Shared Authored Subclass',source:'AUTH',edition:'one',className:'Authored Class',classSource:'XPHB',subclassFeatures:[]};
 const entries=normalize({subclass:[{...root,shortName:'Alpha'},{...root,shortName:'Beta'}]});
 expect(new Set(entries.map(entry=>entry.id)).size).toBe(2);
});

it('an ambiguous English UID cannot silently choose one authored definition',()=>{
 const entries=twoDefinitions(),suffix='|Authored Class|XPHB|Alpha|AUTH|3';
 expect(resolveEntryReference('Authored First Ability'+suffix,entries,'feature')?.name).toBe('Authored First Ability');
 expect(resolveEntryReference('Authored Second Ability'+suffix,entries,'feature')?.name).toBe('Authored Second Ability');
 expect(resolveEntryReference('Shared Authored Ability'+suffix,entries,'feature')).toBeUndefined();
});

it('existing source, parent and level discriminators remain effective',()=>{
 const entries=normalize({subclassFeature:[feature('Shared'),feature('Shared',{level:6}),feature('Shared',{subclassShortName:'Beta'}),feature('Shared',{classSource:'PHB'})]});
 expect(new Set(entries.map(entry=>entry.id)).size).toBe(4);
});

it('a non-colliding record keeps its existing public identifier',()=>{
 const [entry]=normalize({feat:[{name:'One Authored Feat',ENG_name:'One Authored Feat',source:'AUTH',edition:'one',entries:['Original standalone definition.']}]});
 expect(entry.id).toBe('authored:feat:auth:one%20authored%20feat::::::');
});
