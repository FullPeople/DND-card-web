import {describe,it,expect,vi,afterEach} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {startupPreload} from '../tools/startupPreload';
import {afterStartupPaint} from '../src/platform/afterPaint';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
afterEach(()=>vi.unstubAllGlobals());
describe('nonblocking startup delivery',()=>{
 it('preloads card CSS once but applies it asynchronously with success and failure state',()=>{
  const plugin=startupPreload(),transform=plugin.transformIndexHtml as {handler:Function};
  const result=transform.handler('<head><link rel="stylesheet" crossorigin href="./assets/card.css"></head>',{bundle:{'assets/App.js':{type:'chunk',fileName:'assets/App.js',facadeModuleId:'/src/ui/App.tsx',imports:[],viteMetadata:{importedCss:new Set(['assets/card.css'])}}}});
  expect(result.html).toContain('media="print" data-card-style="pending"');expect(result.html).toContain("this.media='all'");expect(result.html).toContain("cardStyle='ready'");expect(result.html).toContain("cardStyle='failed'");expect(result.tags[1].children).toContain('link.crossOrigin');
 });
 it('keeps the approved source PNGs and budgets lossless delivery below 120 KiB',()=>{
  const total=[1,2,3,4].reduce((n,i)=>n+statSync(new URL(`../public/startup-logo/${i}.webp`,import.meta.url)).size,0);
  const manifest=JSON.parse(readFileSync(new URL('../docs/STARTUP-LOSSLESS-ASSETS.json',import.meta.url),'utf8'));for(const row of manifest.assets){expect(createHash('sha256').update(readFileSync(new URL('../'+row.delivery,import.meta.url))).digest('hex')).toBe(row.webpSha256);}
  expect(total).toBeLessThan(120*1024);expect(source.match(/as="image"/g)).toHaveLength(4);expect(source.match(/decoding="async" fetchpriority="high"/g)).toHaveLength(4);
  expect(source).toContain('.startup-intro.leaving{opacity:0}');
  expect(readFileSync(new URL('../src/ui/App.tsx',import.meta.url),'utf8')).toContain("src={startupSettled?'./exe_icon.png':undefined}");expect(readFileSync(new URL('../src/platform/startup.ts',import.meta.url),'utf8')).toContain("['complete','failed'].includes(startupPhase())");expect(source).toContain('<div id="root" inert>');
 });
 it('waits for complete and one paint before optional work; cancelled mounts never start',()=>{
  const eventTarget=new EventTarget(),dataset={cardStartup:'playing'},frames=new Map<number,FrameRequestCallback>();let id=0;
  vi.stubGlobal('window',eventTarget);vi.stubGlobal('document',{documentElement:{dataset},getElementById:()=>({})});vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{frames.set(++id,cb);return id;});vi.stubGlobal('cancelAnimationFrame',(n:number)=>frames.delete(n));vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
  try{
   const work=vi.fn(),cancel=afterStartupPaint(work);expect(frames.size).toBe(0);dataset.cardStartup='fading';eventTarget.dispatchEvent(new Event('dnd-card-startup'));expect(frames.size).toBe(0);dataset.cardStartup='complete';eventTarget.dispatchEvent(new Event('dnd-card-startup'));expect(frames.size).toBe(1);frames.get(1)!(0);vi.runAllTimers();expect(work).toHaveBeenCalledOnce();cancel();
   dataset.cardStartup='playing';const cancelled=vi.fn(),stop=afterStartupPaint(cancelled);stop();dataset.cardStartup='complete';eventTarget.dispatchEvent(new Event('dnd-card-startup'));vi.runAllTimers();expect(cancelled).not.toHaveBeenCalled();
   dataset.cardStartup='failed';const recovery=vi.fn();afterStartupPaint(recovery);frames.get(2)!(0);vi.runAllTimers();expect(recovery).toHaveBeenCalledOnce();
  }finally{vi.useRealTimers();}
 });
});
