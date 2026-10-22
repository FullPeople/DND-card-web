import {afterEach,describe,expect,it,vi} from 'vitest';
import {catalogBatchBuffers,decodeCatalogBatch} from '../src/data/catalogReaderProtocol';
import {readCatalogInWorker} from '../src/data/catalogReader';
import type {Entry} from '../src/core/model';

const entry=(i:number):Entry=>({id:'entry-'+i,kind:'feat',name:'Entry '+i,english:'Entry '+i,source:'FIXTURE',edition:'2014',packId:'fixture',revision:'one',entries:['Synthetic text'],raw:{name:'Entry '+i,source:'FIXTURE',entries:['Synthetic text'],optional:undefined}});
function worker(){return {onmessage:null as null|((e:any)=>void),onerror:null as null|((e:any)=>void),onmessageerror:null as null|(()=>void),postMessage:vi.fn(),terminate:vi.fn()};}
const request={type:'load' as const,refresh:false,base:'https://fixture.example',retryKeys:[]};
afterEach(()=>vi.useRealTimers());
describe('background catalog delivery',()=>{
 it('keeps all JSON content and order while limiting ordinary batches and preserving a large individual entry',()=>{
  const rows=Array.from({length:132},(_,i)=>entry(i));rows[52].raw.long='synthetic '.repeat(20000);
  const buffers=[...catalogBatchBuffers(rows,2048)],decoded=buffers.flatMap(decodeCatalogBatch);
  expect(JSON.stringify(decoded)).toBe(JSON.stringify(rows));expect(buffers.length).toBeGreaterThan(3);expect(decoded.map(row=>row.id)).toEqual(rows.map(row=>row.id));
 });
 it('acknowledges only after yielding to input and terminates after complete delivery',async()=>{
  vi.useFakeTimers();const w=worker(),batch=vi.fn(),controller=new AbortController();const job=readCatalogInWorker(w as unknown as Worker,request,{batch,progress:()=>{}},controller.signal);
  expect(w.postMessage).toHaveBeenCalledExactlyOnceWith(request);w.onmessage!({data:{type:'batch',sequence:1,buffer:[...catalogBatchBuffers([entry(1)])][0]}});expect(batch).toHaveBeenCalledTimes(1);expect(w.postMessage).toHaveBeenCalledTimes(1);
  await vi.runAllTimersAsync();expect(w.postMessage).toHaveBeenLastCalledWith({type:'ack',sequence:1});w.onmessage!({data:{type:'done'}});await job;expect(w.terminate).toHaveBeenCalledOnce();expect(w.onmessage).toBeNull();
 });
 it('aborts pending delivery without acknowledging another batch or applying late data',async()=>{
  vi.useFakeTimers();const w=worker(),batch=vi.fn(),controller=new AbortController(),job=readCatalogInWorker(w as unknown as Worker,request,{batch,progress:()=>{}},controller.signal),rejected=expect(job).rejects.toMatchObject({name:'AbortError'});
  w.onmessage!({data:{type:'batch',sequence:1,buffer:[...catalogBatchBuffers([entry(1)])][0]}});const late=w.onmessage;controller.abort();await rejected;late!({data:{type:'batch',sequence:2,buffer:[...catalogBatchBuffers([entry(2)])][0]}});await vi.runAllTimersAsync();expect(batch).toHaveBeenCalledTimes(1);expect(w.postMessage).toHaveBeenCalledTimes(1);expect(w.terminate).toHaveBeenCalledOnce();
 });
 it.each(['order','malformed'])('rejects %s corruption before mutating the catalog',async kind=>{
  const w=worker(),batch=vi.fn(),job=readCatalogInWorker(w as unknown as Worker,request,{batch,progress:()=>{}},new AbortController().signal),rejected=expect(job).rejects.toThrow();
  w.onmessage!({data:{type:'batch',sequence:kind==='order'?2:1,buffer:kind==='malformed'?new TextEncoder().encode('[{}]').buffer:[...catalogBatchBuffers([entry(1)])][0]}});await rejected;expect(batch).not.toHaveBeenCalled();expect(w.terminate).toHaveBeenCalledOnce();
 });
 it('forwards progress, source metadata and actual worker failures',async()=>{
  const w=worker(),progress=vi.fn(),sources=vi.fn(),job=readCatalogInWorker(w as unknown as Worker,request,{batch:()=>{},progress,sources},new AbortController().signal),rejected=expect(job).rejects.toThrow('synthetic failure');
  const value={done:1,total:2,label:'Fixture',failed:[],cached:1};w.onmessage!({data:{type:'progress',value}});w.onmessage!({data:{type:'sources',value:{FIXTURE:{name:'Fixture'}}}});w.onmessage!({data:{type:'error',message:'synthetic failure'}});await rejected;expect(progress).toHaveBeenCalledExactlyOnceWith(value);expect(sources).toHaveBeenCalledExactlyOnceWith({FIXTURE:{name:'Fixture'}});
 });
 it.each(['overlap','early-completion'])('rejects %s while a delivered batch is still awaiting acknowledgement',async kind=>{
  vi.useFakeTimers();const w=worker(),batch=vi.fn(),job=readCatalogInWorker(w as unknown as Worker,request,{batch,progress:()=>{}},new AbortController().signal),rejected=expect(job).rejects.toThrow();
  w.onmessage!({data:{type:'batch',sequence:1,buffer:[...catalogBatchBuffers([entry(1)])][0]}});w.onmessage!({data:kind==='overlap'?{type:'batch',sequence:2,buffer:[...catalogBatchBuffers([entry(2)])][0]}:{type:'done'}});await rejected;await vi.runAllTimersAsync();expect(batch).toHaveBeenCalledTimes(1);expect(w.postMessage).toHaveBeenCalledTimes(1);expect(w.terminate).toHaveBeenCalledOnce();
 });
});
