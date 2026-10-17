import {expect,it} from 'vitest';
import {runInNewContext} from 'node:vm';
import {offlineShell} from '../tools/offlineShell';

function harness(fetch:(url:string)=>Promise<Response>){
 let source='';const events:Record<string,Function>={},saved=new Map<string,Response>();
 const generated=offlineShell().generateBundle!,hook=(typeof generated==='function'?generated:generated.handler) as Function;
 const chunk=(imports:string[])=>({type:'chunk',imports});
 hook.call({emitFile:(asset:any)=>source=asset.source},{},{
  'assets/tool.js':chunk(['assets/shared.js']),
  'assets/shared.js':chunk(['assets/cycle.js']),
  'assets/cycle.js':chunk(['assets/shared.js']),
  'assets/unused-editor.js':chunk([]),
 });
 runInNewContext(source,{URL,Promise,setTimeout,clearTimeout,Error,fetch,caches:{open:async()=>({match:async(url:string)=>saved.get(url),put:async(url:string,response:Response)=>{saved.set(url,response);}})},self:{location:new URL('https://example.test/card/sw.js'),addEventListener:(name:string,listener:Function)=>events[name]=listener}});
 const backfill=()=>{let done!:Promise<void>;events.message({data:{type:'cache-used-assets',urls:['https://example.test/card/assets/tool.js','https://other.test/private.json']},waitUntil:(task:Promise<void>)=>done=task});return done;};
 return {saved,backfill,events};
}
it('commits a deferred entry only after its shared static graph, without fetching unrelated editors',async()=>{
 let release!:()=>void,blocked=false;const gate=new Promise<void>(resolve=>release=resolve),reads:string[]=[];
 const {saved,backfill}=harness(async url=>{reads.push(url);if(url.endsWith('/cycle.js')){blocked=true;await gate;}return new Response('asset');});
 const done=backfill();await expect.poll(()=>blocked).toBe(true);
 expect(saved.has('https://example.test/card/assets/tool.js')).toBe(false);
 release();await done;
 expect([...saved.keys()]).toEqual(['https://example.test/card/assets/cycle.js','https://example.test/card/assets/shared.js','https://example.test/card/assets/tool.js']);
 expect(reads).toHaveLength(3);expect(reads.some(url=>url.includes('unused-editor')||url.includes('other.test'))).toBe(false);
});
it('a failed static dependency cannot leave a misleading cached entry',async()=>{
 const {saved,backfill}=harness(async url=>new Response('asset',{status:url.endsWith('/cycle.js')?503:200}));
 await backfill();expect(saved.has('https://example.test/card/assets/tool.js')).toBe(false);
});
it('a controlled tool request also makes its graph durable before exposing the cached entry',async()=>{
 const {saved,events}=harness(async()=>new Response('online'));let result!:Promise<Response>;
 events.fetch({request:{url:'https://example.test/card/assets/tool.js',method:'GET'},respondWith:(value:Promise<Response>)=>result=value,waitUntil:()=>{}});
 expect(await (await result).text()).toBe('online');expect(saved.size).toBe(3);
});
