import {expect,it} from 'vitest';
import {runInNewContext} from 'node:vm';
import {offlineShell} from '../tools/offlineShell';

it('installs at most two shell assets at once, reuses HTTP cache and excludes unused cloud reader/API',async()=>{
 let source='',active=0,peak=0;const reads:{url:string;options:any}[]=[],saved=new Map<string,Response>(),events:Record<string,Function>={};
 const generated=offlineShell().generateBundle!,hook=(typeof generated==='function'?generated:generated.handler) as Function;
 hook.call({emitFile:(asset:any)=>source=asset.source},{},{
  'index.html':{type:'asset',source:'shell'},
  'assets/main.js':{fileName:'assets/main.js',type:'chunk',isEntry:true,imports:['assets/shared.js']},
  'assets/shared.js':{fileName:'assets/shared.js',type:'chunk',imports:[]},
  'assets/App.js':{fileName:'assets/App.js',type:'chunk',imports:['assets/shared.js'],facadeModuleId:'/src/ui/App.tsx'},
  'assets/PlayerViewer.js':{fileName:'assets/PlayerViewer.js',type:'chunk',imports:[],facadeModuleId:'/src/ui/PlayerViewer.tsx'},
 });
 runInNewContext(source,{URL,Promise,setTimeout,clearTimeout,Error,caches:{open:async()=>({put:async(url:string,response:Response)=>saved.set(url,response),match:async(url:string)=>saved.get(url)})},fetch:async(url:string,options:any)=>{reads.push({url,options});peak=Math.max(peak,++active);await new Promise(done=>setTimeout(done,2));active--;return new Response('asset');},self:{location:new URL('https://example.test/card/sw.js'),addEventListener:(name:string,listener:Function)=>events[name]=listener}});
 let installed!:Promise<void>;events.install({waitUntil:(task:Promise<void>)=>installed=task});await installed;
 expect(peak).toBe(2);expect(reads.some(row=>row.url.endsWith('PlayerViewer.js'))).toBe(false);expect(reads.some(row=>row.url.includes('/api/'))).toBe(false);
 for(const row of reads)expect(row.options).toEqual({cache:row.url.endsWith('index.html')?'no-cache':'force-cache',priority:'low'});
 expect([...saved.keys()]).toContain('https://example.test/card/assets/App.js');
 let handled=false;events.fetch({request:{method:'GET',url:'https://example.test/api/cards/AAAAAA'},respondWith:()=>handled=true});expect(handled).toBe(false);
});
