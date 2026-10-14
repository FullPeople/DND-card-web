import {expect,test,vi} from 'vitest';
import type {Entry} from '../src/core/model';
import type {LoadProgress} from '../src/data/catalog';
import {CATALOG_SNAPSHOT_SCHEMA,loadCatalogSnapshot,type CatalogSnapshot} from '../src/data/catalogSnapshot';
const entry=(id='retained'):Entry=>({id,kind:'feat',name:id,english:id,source:'TEST',edition:'2024',packId:'test',revision:'r1',entries:[],raw:{name:id}});
const progress:LoadProgress={done:2,total:2,label:'complete',failed:[],cached:0,retry:[]};
const snapshot=(scope='source'):CatalogSnapshot=>({schema:CATALOG_SNAPSHOT_SCHEMA,scope,createdAt:1,entries:[entry()],sources:{TEST:{name:'Test source'}},progress});
function fixture(cached:unknown=undefined){
 const controller=new AbortController(),onBatch=vi.fn(),onProgress=vi.fn(),onSources=vi.fn(),write=vi.fn(async(_value:CatalogSnapshot)=>{});
 const load=vi.fn(async(batch:(rows:Entry[])=>void,publish:(value:LoadProgress)=>void,sources:(value:CatalogSnapshot['sources'])=>void)=>{
  sources({TEST:{name:'Test source'}});batch([entry('fresh')]);publish({...progress});
 });
 return{scope:'source',signal:controller.signal,controller,read:vi.fn(async()=>cached),write,load,onBatch,onProgress,onSources};
}
test('a complete warm catalog bypasses downloads and normalization and restores source labels',async()=>{
 const f=fixture(snapshot());await loadCatalogSnapshot(f);
 expect(f.load).not.toHaveBeenCalled();expect(f.write).not.toHaveBeenCalled();
 expect(f.onBatch.mock.calls[0][0][0].id).toBe('retained');
 expect(f.onSources).toHaveBeenCalledWith({TEST:{name:'Test source'}});
 expect(f.onProgress).toHaveBeenCalledWith(expect.objectContaining({done:2,total:2,cached:2,failed:[]}));
});
test('a cold load persists the completed parsed view for the next opening',async()=>{
 const f=fixture();await loadCatalogSnapshot(f);
 expect(f.load).toHaveBeenCalledOnce();expect(f.write).toHaveBeenCalledOnce();
 const saved=f.write.mock.calls[0][0];expect(saved.entries.map(e=>e.id)).toEqual(['fresh']);expect(saved.sources.TEST.name).toBe('Test source');
 const warm=fixture(saved);await loadCatalogSnapshot(warm);expect(warm.load).not.toHaveBeenCalled();
});
test.each(['different-source','old-parser','malformed-entries','incomplete','failed'] as const)('an incompatible %s snapshot falls back to the source loader',async problem=>{
 const old=snapshot();if(problem==='different-source')old.scope='other';
 if(problem==='old-parser')old.schema='old-parser';
 if(problem==='malformed-entries')old.entries=[{id:'bad'} as Entry];
 if(problem==='incomplete')old.progress={...progress,done:1};
 if(problem==='failed')old.progress={...progress,failed:['missing']};
 const f=fixture(old);await loadCatalogSnapshot(f);expect(f.load).toHaveBeenCalledOnce();expect(f.onBatch.mock.calls[0][0][0].id).toBe('fresh');
});
test('explicit update/retry bypasses a complete view and replaces it only after success',async()=>{
 const f=fixture(snapshot());await loadCatalogSnapshot({...f,refresh:true});
 expect(f.read).not.toHaveBeenCalled();expect(f.load).toHaveBeenCalledOnce();
 expect(f.write.mock.calls[0][0].entries[0].id).toBe('fresh');
});
test('a failed or paused refresh leaves the prior complete catalog recoverable',async()=>{
 for(const status of [{failed:['one source failed']},{paused:'offline'}]){
  const old=snapshot(),f=fixture(old);
  f.load.mockImplementation(async(batch,publish)=>{batch([entry('partial')]);publish({...progress,...status});});
  await loadCatalogSnapshot({...f,refresh:true});expect(f.write).not.toHaveBeenCalled();
  const warm=fixture(old);await loadCatalogSnapshot(warm);expect(warm.onBatch.mock.calls[0][0][0].id).toBe('retained');
 }
});
test('aborting while a cache read is pending publishes nothing',async()=>{
 const f=fixture(snapshot());f.read.mockImplementation(async()=>{f.controller.abort();return snapshot();});
 await loadCatalogSnapshot(f);expect(f.onBatch).not.toHaveBeenCalled();expect(f.onSources).not.toHaveBeenCalled();expect(f.load).not.toHaveBeenCalled();
});
test('an aborted partial load cannot publish a supposedly complete snapshot',async()=>{
 const f=fixture();f.load.mockImplementation(async(batch,publish)=>{batch([entry()]);f.controller.abort();publish(progress);});
 await loadCatalogSnapshot(f);expect(f.write).not.toHaveBeenCalled();
});
test('cache read and write failures retain a usable catalog',async()=>{
 const f=fixture();f.read.mockRejectedValue(new Error('storage unavailable'));f.write.mockRejectedValue(new Error('quota'));
 await expect(loadCatalogSnapshot(f)).resolves.toBeUndefined();expect(f.onBatch).toHaveBeenCalled();expect(f.onProgress).toHaveBeenCalledWith(progress);
});
test('later expanded entries replace preliminary rows in the persisted view',async()=>{
 const f=fixture();f.load.mockImplementation(async(batch,publish)=>{batch([entry()]);batch([{...entry(),revision:'expanded',raw:{name:'expanded'}}]);publish(progress);});
 await loadCatalogSnapshot(f);expect(f.write.mock.calls[0][0].entries).toHaveLength(1);expect(f.write.mock.calls[0][0].entries[0].revision).toBe('expanded');
});
