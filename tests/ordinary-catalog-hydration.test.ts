import {afterEach,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const disk=vi.hoisted(()=>new Map<string,any>());
vi.mock('../src/platform/storage',()=>({readCache:async(key:string)=>structuredClone(disk.get(key)),writeCache:async(key:string,v:any)=>{disk.set(key,structuredClone(v));}}));
import {loadCatalog,normalizeCatalogData} from '../src/data/catalog';
import {homebrewBody,DEFAULT_HOMEBREW} from '../src/data/homebrew';
import {DEFAULT_SOURCE} from '../src/data/catalogSource';
import {ordinarySourceDirectory,ordinaryFrozenInput,ordinarySnapshot} from './helpers/ordinarySpellCastingFixture';
import {ordinaryCastingRule} from '../src/core/automation/ordinarySpellCasting';
import {CATALOG_SNAPSHOT_SCHEMA} from '../src/data/catalogSnapshot';
import type {Entry} from '../src/core/model';
afterEach(()=>vi.unstubAllGlobals());
it('real cold homebrew and primary spells share exact per-row lookup hydration, and warm/raw cache rebuild stays offline',async()=>{
 disk.clear();const index=JSON.parse(readFileSync(`${ordinarySourceDirectory}/index.json`,'utf8')),pin=index.rows.find((r:any)=>r.sha256==='618085edd03dd88636f3feba3f36ebe8462dc552a542c9e3add7fb20a045ba1f'),body=JSON.parse(readFileSync(`${ordinarySourceDirectory}/${pin.path}`,'utf8'));expect(createHash('sha256').update(JSON.stringify(body)).digest('hex')).toBe(pin.sha256);
 const path=decodeURIComponent(new URL(pin.url).pathname).slice(1),lookup=ordinaryFrozenInput('generated/gendata-spell-source-lookup.json'),spells=ordinaryFrozenInput('spells/spells-phb.json');
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{const parsed=new URL(url),p=decodeURIComponent(parsed.pathname);const b=url===`${DEFAULT_HOMEBREW}/_generated/index-sources.json`?{TEST:path}:parsed.origin===DEFAULT_HOMEBREW&&p==='/'+path?body:p==='/data/generated/gendata-spell-source-lookup.json'?lookup:p==='/data/spells/spells-phb.json'?spells:p.endsWith('/index.json')?{fixture:'fixture.json'}:{};return new Response(JSON.stringify(b),{headers:{etag:'fresh-fixture'}});}));
 const read=async()=>{const entries=new Map<string,Entry>();await loadCatalog(batch=>batch.forEach(e=>entries.set(e.id,e)),()=>{},new AbortController().signal);return [...entries.values()];};
 const cold=await read(),brew=normalizeCatalogData(homebrewBody(body),'fresh','kiwee-homebrew').filter(e=>e.kind==='spell');expect(brew.length).toBeGreaterThan(0);
 for(const expected of brew){const row=cold.find(e=>e.id===expected.id)!;expect(row).toBeDefined();const sourceRow=lookup[row.source.toLowerCase()]?.[row.name.toLowerCase()]||lookup[row.source.toLowerCase()]?.[row.english.toLowerCase()];expect(row.raw._spellClassLookupLoaded).toBe(!!sourceRow);expect(row.raw._spellClasses).toEqual(sourceRow?.class);expect(row.raw._spellSources).toEqual(sourceRow);expect(ordinaryCastingRule(row)).toBeDefined();const old=structuredClone(row);delete old.raw._spellClassLookupLoaded;const before=ordinarySnapshot(old);expect(ordinaryCastingRule(old)).toBeUndefined();expect(ordinarySnapshot(old)).toBe(before);}
 const primary=cold.find(e=>e.kind==='spell'&&e.source==='PHB'&&e.english==='Magic Missile')!;expect(primary.raw._spellClassLookupLoaded).toBe(true);expect(primary.raw._spellClasses).toBeDefined();expect(ordinaryCastingRule(primary)).toBeDefined();
 vi.mocked(fetch).mockClear();expect(ordinarySnapshot(await read())).toBe(ordinarySnapshot(cold));expect(fetch).not.toHaveBeenCalled();for(const key of disk.keys())if(key.startsWith('wiki-normalized-'))disk.delete(key);expect(CATALOG_SNAPSHOT_SCHEMA).not.toBe('wiki-normalized-296-v1');const oldKey='wiki-normalized-296-v1:'+JSON.stringify([DEFAULT_SOURCE,DEFAULT_HOMEBREW]),oldView={body:{schema:'wiki-normalized-296-v1',entries:brew}};disk.set(oldKey,structuredClone(oldView));expect(ordinarySnapshot(await read())).toBe(ordinarySnapshot(cold));expect(fetch).not.toHaveBeenCalled();expect(disk.get(oldKey)).toEqual(oldView);
});
