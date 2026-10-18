import {afterEach,expect,it,vi} from 'vitest';
import {createEntryMatcher,matchesEntrySearch} from '../src/core/search';
import {createTextMatcher} from '../src/core/searchText';
import {searchEntryRows,type SearchRow} from '../src/data/entrySearchTask';
import {entrySearchClient} from '../src/data/entrySearchClient';
const rows:SearchRow[]=[{name:'火球术',english:'Fireball',source:'XPHB',sourceName:'玩家手册'},{name:'治疗真言',english:'Healing Word',source:'PHB',sourceName:'玩家手册 2014'},{name:'同名',english:'Same',source:'OTHER',sourceName:'扩展来源'}];
afterEach(()=>vi.unstubAllGlobals());
it.each(['huoqiushu','hqs','huo qiu','huǒ qiú','火球','fire','XPHB','玩家 火球','hqs 玩家'])('background search retains matching semantics for %s',async query=>{
 const expected=rows.flatMap((row,i)=>matchesEntrySearch(row,query,row.sourceName)?[i]:[]);expect(await searchEntryRows(rows,query)).toEqual(expected);
});
it('invalidates both text and pronunciation caches after renaming or changing source display names',()=>{
 const row={...rows[0]},matcher=createEntryMatcher('hqs');expect(matcher(row,row.sourceName)).toBe(true);row.name='寒冰箭';row.english='Ice';expect(matcher(row,row.sourceName)).toBe(false);
 const text=createTextMatcher('新手册');expect(text(row,'旧手册')).toBe(false);expect(text(row,'新手册')).toBe(true);
});
it('yields and cancels a superseded fallback query without publishing partial results',async()=>{
 let cancelled=false;const clock=vi.spyOn(performance,'now');let time=0;clock.mockImplementation(()=>time+=2);
 const yieldControl=vi.fn(async()=>{cancelled=true;});try{expect(await searchEntryRows(Array.from({length:10000},()=>({...rows[0]})),'hqs',()=>cancelled,yieldControl)).toBeUndefined();expect(yieldControl).toHaveBeenCalledOnce();}finally{clock.mockRestore();}
});
it('still searches without Worker support and respects an already aborted request',async()=>{
 vi.stubGlobal('Worker',undefined);const client=entrySearchClient(rows),controller=new AbortController();expect(await client.search('hqs',controller.signal)).toEqual([0]);controller.abort();expect(await client.search('fire',controller.signal)).toBeUndefined();client.dispose();
});
it('discards a stale worker response and falls back after a worker/CSP failure',async()=>{
 const instances:any[]=[];class WorkerMock{onmessage:any;onerror:any;messages:any[]=[];constructor(){instances.push(this);}postMessage(data:any){this.messages.push(data);}terminate(){}}
 vi.stubGlobal('Worker',WorkerMock);const client=entrySearchClient(rows),a=new AbortController(),b=new AbortController();
 const first=client.search('hqs',a.signal),worker=instances[0],oldId=worker.messages.at(-1).id;a.abort();const second=client.search('fire',b.signal),newId=worker.messages.at(-1).id;
 worker.onmessage({data:{id:oldId,indices:[2]}});worker.onmessage({data:{id:newId,indices:[0]}});expect(await first).toBeUndefined();expect(await second).toEqual([0]);
 const fallback=client.search('治疗',b.signal);worker.onerror();expect(await fallback).toEqual([1]);client.dispose();
});
