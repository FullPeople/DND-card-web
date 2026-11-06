import {afterEach,expect,it,vi} from 'vitest';
const disk=vi.hoisted(()=>new Map<string,unknown>());
vi.mock('../src/platform/storage',()=>({readCache:async(key:string)=>structuredClone(disk.get(key)),writeCache:async(key:string,value:unknown)=>{disk.set(key,structuredClone(value));}}));
import {loadCatalog,DEFAULT_SOURCE} from '../src/data/catalog';
import {DEFAULT_HOMEBREW} from '../src/data/homebrew';
import {CATALOG_SNAPSHOT_SCHEMA,type CatalogSnapshot} from '../src/data/catalogSnapshot';
import {sourceSpellFilter} from '../src/core/automation/sourceSpellFilter';
import type {Entry} from '../src/core/model';
afterEach(()=>vi.unstubAllGlobals());
it('rebuilds an old normalized view from its raw cache so new spell groups become available without network or deleting the old view',async()=>{
 disk.clear();const body={class:[{name:'Authored caster',source:'LLMC',classSpells:[{groupName:'Authored group',groupSource:'LLMC'}]}],spellList:[{name:'Authored group',source:'LLMC',spells:['Authored grouped spell|PHB']}]};
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
  const url=new URL(input),path=url.pathname;
  const value=input===DEFAULT_HOMEBREW+'/_generated/index-sources.json'?{}:path.endsWith('/index.json')?{fixture:'fixture.json'}:path==='/data/class/fixture.json'?body:path==='/data/spells/fixture.json'?{spell:[{name:'Authored grouped spell',source:'PHB',level:0}]}:{};
  return new Response(JSON.stringify(value),{headers:{etag:'authored-cache-fixture'}});
 }));
 const read=async()=>{const entries=new Map<string,Entry>();await loadCatalog(batch=>batch.forEach(entry=>entries.set(entry.id,entry)),()=>{},new AbortController().signal);return [...entries.values()];};
 expect((await read()).some(entry=>entry.raw._category==='spellList')).toBe(true);
 const scope=JSON.stringify([DEFAULT_SOURCE,DEFAULT_HOMEBREW]),currentKey=CATALOG_SNAPSHOT_SCHEMA+':'+scope,snapshot=(disk.get(currentKey) as {body:CatalogSnapshot}).body;
 const legacySchema='wiki-normalized-296-v2-spell-lookup',legacyKey=legacySchema+':'+scope,legacy={body:{...snapshot,schema:legacySchema,entries:snapshot.entries.filter(entry=>entry.raw._category!=='spellList')},revision:legacySchema};
 disk.set(legacyKey,structuredClone(legacy));if(currentKey!==legacyKey)disk.delete(currentKey);
 vi.stubGlobal('fetch',vi.fn(async()=>{throw Error('Authored cache rebuild must stay offline');}));
 const restored=await read();expect(restored.find(entry=>entry.raw._category==='spellList')).toBeDefined();expect(fetch).not.toHaveBeenCalled();expect(disk.get(legacyKey)).toEqual(legacy);
 const result=sourceSpellFilter('class=Authored caster (LLMag)',restored,'2014');expect(result.supported).toBe(true);if(result.supported)expect(result.references).toEqual(['Authored grouped spell|PHB']);
});
