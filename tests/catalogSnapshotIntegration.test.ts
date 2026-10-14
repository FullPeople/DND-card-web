import {afterEach,beforeEach,expect,test,vi} from 'vitest';
const disk=vi.hoisted(()=>new Map<string,unknown>());
vi.mock('../src/platform/storage',()=>({
 readCache:vi.fn(async(key:string)=>{const value=disk.get(key);return value===undefined?undefined:structuredClone(value);}),
 writeCache:vi.fn(async(key:string,value:unknown)=>{disk.set(key,structuredClone(value));}),
}));
import {loadCatalog} from '../src/data/catalog';
import {CATALOG_SNAPSHOT_SCHEMA} from '../src/data/catalogSnapshot';
import type {Entry} from '../src/core/model';
const base='https://rules.test';
let name='Original fixture',missing=false;
beforeEach(()=>{
 disk.clear();name='Original fixture';missing=false;
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
  const path=new URL(url).pathname;
  if(path==='/data/class/fixture.json'&&missing)return new Response('missing',{status:404});
  const body=path.endsWith('/index.json')?{fixture:'fixture.json'}:
   path==='/data/class/fixture.json'?{class:[{name,ENG_name:'Fixture Class',source:'XPHB',hd:{faces:6},classFeatures:[]}]}:
   path==='/data/books.json'?{book:[{id:'FIXTURE',name:'Fixture source',published:'2026-01-01'}]}:{};
  return new Response(JSON.stringify(body),{headers:{etag:'fixture-revision'}});
 }));
});
afterEach(()=>{vi.unstubAllGlobals();});
async function read(refresh=false,retry:readonly string[]=[]){
 const entries=new Map<string,Entry>(),sources:Record<string,unknown>={};let progress:any;
 await loadCatalog(rows=>rows.forEach(row=>entries.set(row.id,row)),value=>progress=value,new AbortController().signal,refresh,base,rows=>Object.assign(sources,rows),retry);
 return{entries:[...entries.values()],sources,progress};
}
test('the real loader warms from its parsed snapshot without another upstream read',async()=>{
 const cold=await read();expect(cold.progress.failed).toEqual([]);expect(cold.progress.done).toBe(cold.progress.total);
 expect(cold.entries.some(entry=>entry.name==='Original fixture')).toBe(true);expect(cold.sources.FIXTURE).toEqual(expect.objectContaining({name:'Fixture source'}));
 expect([...disk.keys()].some(key=>key.startsWith(CATALOG_SNAPSHOT_SCHEMA))).toBe(true);
 vi.mocked(fetch).mockClear();const warm=await read();
 expect(fetch).not.toHaveBeenCalled();expect(warm.entries).toEqual(cold.entries);expect(warm.sources).toEqual(cold.sources);expect(warm.progress.cached).toBe(warm.progress.total);
});
test('explicit update replaces the parsed view and failed-file retry still reads only that file',async()=>{
 await read();name='Updated fixture';await read(true);
 vi.mocked(fetch).mockClear();const warm=await read();expect(fetch).not.toHaveBeenCalled();expect(warm.entries.some(entry=>entry.name==='Updated fixture')).toBe(true);
 missing=true;const partial=await read(true);expect(partial.progress.failed.length).toBeGreaterThan(0);
 missing=false;vi.mocked(fetch).mockClear();const recovered=await read(false,[base+'/data/class/fixture.json']);
 expect(vi.mocked(fetch).mock.calls.map(([url])=>url)).toEqual([base+'/data/class/fixture.json']);
 expect(recovered.progress.failed).toEqual([]);
});
test('a partial refresh cannot overwrite the last complete parsed view',async()=>{
 await read();missing=true;await read(true);
 vi.mocked(fetch).mockClear();const warm=await read();
 expect(fetch).not.toHaveBeenCalled();expect(warm.progress.failed).toEqual([]);expect(warm.entries.some(entry=>entry.name==='Original fixture')).toBe(true);
});
