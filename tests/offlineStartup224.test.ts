import {afterEach,describe,it,expect,vi} from 'vitest';
import {runInNewContext} from 'node:vm';
import {offlineShell} from '../tools/offlineShell';

function worker(fetch:()=>Promise<Response>,saved?:Response){
 let source='';const listeners:Record<string,(event:any)=>void>={};
 const hook=offlineShell().generateBundle as Function;
 hook.call({emitFile:(file:{source:string})=>source=file.source},{},{'assets/main.js':{}});
 runInNewContext(source,{URL,Promise,setTimeout,clearTimeout,fetch,caches:{open:async()=>({match:async()=>saved})},self:{location:new URL('https://example.test/card/sw.js'),addEventListener:(name:string,listener:(event:any)=>void)=>listeners[name]=listener}});
 let response!:Promise<Response>;
 listeners.fetch({request:{url:'https://example.test/card/',method:'GET',mode:'navigate'},waitUntil:()=>{},respondWith:(value:Promise<Response>)=>response=value});
 return response;
}
afterEach(()=>vi.useRealTimers());
describe('cached startup navigation',()=>{
 it('opens cached HTML after 1.5 seconds when the network never responds',async()=>{
  vi.useFakeTimers();const cached=new Response('saved');const result=worker(()=>new Promise(()=>{}),cached);
  await vi.advanceTimersByTimeAsync(1500);expect(await result).toBe(cached);expect(vi.getTimerCount()).toBe(0);
 });
 it('prefers fresh HTML when the network responds promptly',async()=>{
  const fresh=new Response('new');expect(await worker(async()=>fresh,new Response('saved'))).toBe(fresh);
 });
 it('preserves cached startup on offline and server errors',async()=>{
  const cached=new Response('saved');expect(await worker(async()=>{throw Error('offline');},cached)).toBe(cached);
  expect(await worker(async()=>new Response('bad gateway',{status:502}),cached)).toBe(cached);
 });
 it('a first visit without a cache retains network success or a real failure',async()=>{
  const fresh=new Response('new');expect(await worker(async()=>fresh)).toBe(fresh);
  await expect(worker(async()=>{throw Error('offline');})).rejects.toThrow('offline');
 });
});
