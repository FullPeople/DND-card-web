import {createHash} from 'node:crypto';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {catalogNormalizer} from '../src/data/catalogNormalizer';
import {normalizeCatalogData} from '../src/data/catalog';

const body={feat:[{name:'Fixture feat',source:'XPHB',entries:['Preserved text'],ability:[{str:1}]}]};
const revision=createHash('sha256').update(JSON.stringify(body)).digest('hex');

describe('catalog preparation preserves source identity',()=>{
 afterEach(()=>{vi.unstubAllGlobals();});
 it('without a worker hashes and normalizes the same canonical JSON',async()=>{
  vi.stubGlobal('Worker',undefined);
  const processor=catalogNormalizer(new AbortController().signal,normalizeCatalogData);
  try{expect(await processor.prepare(body,null)).toEqual({revision,entries:normalizeCatalogData(body,revision)});}
  finally{processor.dispose();}
 });
 it('uses the upstream ETag verbatim for every entry',async()=>{
  vi.stubGlobal('Worker',undefined);
  const processor=catalogNormalizer(new AbortController().signal,normalizeCatalogData);
  try{const result=await processor.prepare(body,'"source-etag"');expect(result.revision).toBe('"source-etag"');expect(result.entries).toEqual(normalizeCatalogData(body,'"source-etag"'));}
  finally{processor.dispose();}
 });
 it('keeps the original network snapshot intact when class normalization annotates its copy',async()=>{
  vi.stubGlobal('Worker',undefined);
  const source={class:[{name:'Fixture class',source:'XPHB',edition:'one'}],classFeature:[{name:'Fixture feature',className:'Fixture class',classSource:'XPHB',source:'XPHB',level:1}]};
  const original=structuredClone(source),hash=createHash('sha256').update(JSON.stringify(original)).digest('hex');
  const processor=catalogNormalizer(new AbortController().signal,normalizeCatalogData);
  try{const result=await processor.prepare(source,null);expect(result.revision).toBe(hash);expect(source).toEqual(original);expect(result.entries.find(entry=>entry.kind==='feature')?.raw._classEdition).toBe('2024');}
  finally{processor.dispose();}
 });
 it('a broken worker falls back without losing the source revision or body',async()=>{
  class BrokenWorker{
   onerror?:()=>void;terminated=false;
   postMessage(){queueMicrotask(()=>this.onerror?.());}
   terminate(){this.terminated=true;}
  }
  vi.stubGlobal('Worker',BrokenWorker);
  const processor=catalogNormalizer(new AbortController().signal,normalizeCatalogData);
  try{expect(await processor.prepare(body,null)).toEqual({revision,entries:normalizeCatalogData(body,revision)});}
  finally{processor.dispose();}
 });
 it('cancelling queued worker preparation rejects it without invoking fallback',async()=>{
  const fallback=vi.fn(normalizeCatalogData),abort=new AbortController();
  class IdleWorker{postMessage(){}terminate(){}}
  vi.stubGlobal('Worker',IdleWorker);
  const processor=catalogNormalizer(abort.signal,fallback),pending=processor.prepare(body,null);
  const rejected=expect(pending).rejects.toThrow('资料处理已中止');
  abort.abort();await rejected;expect(fallback).not.toHaveBeenCalled();processor.dispose();
 });
 it('stopping before fallback resumes prevents processing a stale loading session',async()=>{
  vi.stubGlobal('Worker',undefined);
  const fallback=vi.fn(normalizeCatalogData),abort=new AbortController();
  const processor=catalogNormalizer(abort.signal,fallback),pending=processor.prepare(body,null);
  const rejected=expect(pending).rejects.toThrow('资料处理已中止');
  abort.abort();await rejected;expect(fallback).not.toHaveBeenCalled();processor.dispose();
 });
});
