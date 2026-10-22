import {afterEach,beforeEach,expect,test,vi} from 'vitest';
const disk=vi.hoisted(()=>new Map<string,unknown>());
vi.mock('../src/platform/storage',()=>({
 readCache:vi.fn(async(key:string)=>{const value=disk.get(key);return value===undefined?undefined:structuredClone(value);}),
 writeCache:vi.fn(async(key:string,value:unknown)=>{disk.set(key,structuredClone(value));}),
}));
import {loadCatalog,DEFAULT_SOURCE} from '../src/data/catalog';
import {homebrewRecovery} from '../src/data/homebrewRecovery';
import type {Entry} from '../src/core/model';

const mirror='https://homebrew.kiwee.top';
const backup='https://raw.githubusercontent.com/tjliqy/homebrew-deploy/main';
const path='class/Original Author; Missing.json';
const encoded=path.split('/').map(encodeURIComponent).join('/');
const mirrorUrl=`${mirror}/${encoded}`,backupUrl=`${backup}/${encoded}`;
const authored={_meta:{edition:'classic',sources:[{json:'AUTHORED',full:'Authored recovery source'}]},class:[{name:'恢复职业',ENG_name:'Authored Recovery',source:'AUTHORED',classFeatures:[]}]};
let primaryStatus=404,recoveryBody:unknown=authored;
beforeEach(()=>{
 disk.clear();primaryStatus=404;recoveryBody=structuredClone(authored);
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
  if(url===mirror+'/_generated/index-sources.json')return new Response(JSON.stringify({AUTHORED:path}));
  if(url===mirrorUrl)return primaryStatus===200?new Response(JSON.stringify(authored),{headers:{etag:'mirror'}}):new Response('missing',{status:primaryStatus});
  if(url===backupUrl)return new Response(JSON.stringify(recoveryBody),{headers:{etag:'recovered'}});
  return new Response(JSON.stringify(String(url).endsWith('/index.json')?{FIXTURE:'fixture.json'}:{}));
 }));
});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
async function read(refresh=false,signal=new AbortController().signal,retry:readonly string[]=[]){
 const entries:Entry[]=[];let progress:any;
 await loadCatalog(rows=>entries.push(...rows),value=>progress=value,signal,refresh,DEFAULT_SOURCE,undefined,retry);
 return {entries,progress};
}

test('a missing mirror file recovers the same indexed source and then warms without network',async()=>{
 const recovered=await read();
 expect(recovered.progress.failed).toEqual([]);
 expect(recovered.entries.filter(entry=>entry.source==='AUTHORED').map(entry=>entry.name)).toEqual(['恢复职业']);
 expect(vi.mocked(fetch).mock.calls.filter(([url])=>url===backupUrl)).toHaveLength(1);
 expect(disk.get(mirrorUrl)).toEqual(expect.objectContaining({body:authored}));
 vi.mocked(fetch).mockClear();const warm=await read();
 expect(fetch).not.toHaveBeenCalled();
 expect(warm.entries.filter(entry=>entry.source==='AUTHORED').map(entry=>entry.name)).toEqual(['恢复职业']);
});

test('an unrelated backup cannot satisfy a missing indexed source or poison its cache',async()=>{
 recoveryBody={...authored,_meta:{sources:[{json:'DIFFERENT'}]}};
 const result=await read();
 expect(result.progress.failed).toHaveLength(1);
 expect(result.entries.some(entry=>entry.source==='AUTHORED')).toBe(false);
 expect(disk.has(mirrorUrl)).toBe(false);
});

test('healthy files and non-404 failures never start backup reads',async()=>{
 primaryStatus=200;const healthy=await read();
 expect(healthy.progress.failed).toEqual([]);
 expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).startsWith(backup))).toBe(false);
 disk.clear();vi.mocked(fetch).mockClear();primaryStatus=403;
 const denied=await read();
 expect(denied.progress.failed).toHaveLength(1);
 expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).startsWith(backup))).toBe(false);
});

test('a failed refresh keeps a valid original-language cached body and its warning',async()=>{
 const prior={...authored,class:[{...authored.class[0],name:'原缓存职业'}]};
 disk.set(mirrorUrl,{body:prior,revision:'original-cache'});
 const result=await read(true);
 expect(result.entries.find(entry=>entry.source==='AUTHORED')?.name).toBe('原缓存职业');
 expect(result.progress.failed).toHaveLength(1);
 expect(result.progress.failed[0]).toContain('正在使用旧缓存');
 expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).startsWith(backup))).toBe(false);
 expect(disk.get(mirrorUrl)).toEqual({body:prior,revision:'original-cache'});
});

test('a successful mirror refresh preserves recovered catalog and import identities',async()=>{
 const recovered=await read(),before=recovered.entries.find(entry=>entry.source==='AUTHORED')!;
 expect(recovered.progress.recovered).toEqual([path]);
 vi.mocked(fetch).mockClear();primaryStatus=200;
 const refreshed=await read(true),after=refreshed.entries.find(entry=>entry.source==='AUTHORED')!;
 expect(after.id).toBe(before.id);expect(after.packId).toBe(before.packId);
 expect(after.edition).toBe(before.edition);expect(after.source).toBe(before.source);
 expect(after.revision).not.toBe(before.revision);
 expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).startsWith(backup))).toBe(false);
});

test('a rejected backup remains retryable through the original mirror key',async()=>{
 recoveryBody={...authored,_meta:{sources:[{json:'WRONG'}]}};
 const rejected=await read();expect(rejected.progress.retry).toEqual([mirrorUrl]);
 recoveryBody=authored;vi.mocked(fetch).mockClear();
 const retried=await read(false,new AbortController().signal,rejected.progress.retry);
 expect(retried.progress.failed).toEqual([]);
 expect(retried.entries.some(entry=>entry.source==='AUTHORED')).toBe(true);
 expect(vi.mocked(fetch).mock.calls.filter(([url])=>url===mirrorUrl)).toHaveLength(1);
 expect(vi.mocked(fetch).mock.calls.filter(([url])=>url===backupUrl)).toHaveLength(1);
});

test('every indexed source alias must be declared and unreadable bodies cannot enter the cache',async()=>{
 const recover=homebrewRecovery({AUTHORED:path,OTHER:path},new AbortController().signal);
 await expect(recover(path)).rejects.toThrow('来源身份');
 recoveryBody={_meta:{sources:[{json:'AUTHORED'},{json:'OTHER'}]}};
 await expect(recover(path)).rejects.toThrow('正文');
 vi.mocked(fetch).mockClear();
 await expect(recover('../outside.json')).rejects.toThrow('明确来源');
 expect(fetch).not.toHaveBeenCalled();
});

test('repeated backup failures do not pause or discard the later healthy mirror queue',async()=>{
 const files=Array.from({length:5},(_,index)=>`class/Author; Missing ${index}.json`);
 const index=Object.fromEntries(files.map((file,index)=>[`SOURCE${index}`,file]));
 index.AUTHORED=path;
 vi.mocked(fetch).mockImplementation(async(url:any)=>{
  if(url===mirror+'/_generated/index-sources.json')return new Response(JSON.stringify(index));
  if(url===mirrorUrl)return new Response(JSON.stringify(authored));
  if(String(url).startsWith(backup+'/'))throw new TypeError('backup unavailable');
  if(String(url).startsWith(mirror+'/class/'))return new Response('missing',{status:404});
  return new Response(JSON.stringify(String(url).endsWith('/index.json')?{FIXTURE:'fixture.json'}:{}));
 });
 const result=await read();
 expect(result.progress.failed).toHaveLength(files.length);
 expect(result.progress.retry).toHaveLength(files.length);expect(result.progress.paused).toBeUndefined();
 expect(result.progress.done).toBe(result.progress.total);
 expect(result.entries.some(entry=>entry.source==='AUTHORED')).toBe(true);
});

test('a backup deadline aborts its request and cancellation cannot write recovered content',async()=>{
 vi.useFakeTimers();
 let requestSignal:AbortSignal|undefined;
 vi.mocked(fetch).mockImplementation(async(url:any,options?:RequestInit)=>{
  if(url!==backupUrl)return new Response('{}');
  requestSignal=options?.signal||undefined;
  return new Promise((_,reject)=>requestSignal!.addEventListener('abort',()=>reject(requestSignal!.reason),{once:true}));
 });
 const recover=homebrewRecovery({AUTHORED:path},new AbortController().signal);
 const failed=expect(recover(path)).rejects.toMatchObject({name:'TimeoutError'});
 await vi.advanceTimersByTimeAsync(8000);await failed;expect(requestSignal?.aborted).toBe(true);
 const controller=new AbortController(),cancelled=homebrewRecovery({AUTHORED:path},controller.signal);
 const aborted=expect(cancelled(path)).rejects.toMatchObject({name:'AbortError'});
 controller.abort();await aborted;expect(disk.has(mirrorUrl)).toBe(false);
});
