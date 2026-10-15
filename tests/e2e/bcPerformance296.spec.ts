import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
test.beforeEach(async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);
 await page.addInitScript(()=>{
  (window as any).__toolWarm=[];(window as any).__toolsWarm=false;
  window.addEventListener('dnd-card-tool-warm',event=>(window as any).__toolWarm.push((event as CustomEvent).detail));
  window.addEventListener('dnd-card-tools-warm',()=>{(window as any).__toolsWarm=true;});
 });
});
test('all character pages warm before navigation and repeated switches download no page code',async({page},info)=>{
 await page.goto('/');await expect(page.locator('.paper')).toBeVisible();
 await page.waitForFunction(()=>(window as any).__toolsWarm);
 const warmed=await page.evaluate(()=>(window as any).__toolWarm);
 expect(warmed.filter((row:any)=>!row.ok)).toEqual([]);expect(warmed.length).toBe(18);
 const requests:string[]=[];page.on('request',request=>{if(/\/assets\/.*\.js(?:\?|$)/.test(request.url()))requests.push(request.url());});
 const timings:number[]=[];
 for(let pass=0;pass<2;pass++)for(const name of ['特性','背景','法术','背包','主要']){
  const start=Date.now();await page.locator('[data-sheet-tab="'+name+'"]').click();
  await expect(page.locator('.paper')).toBeVisible();await expect(page.locator('.sheet-details-loading')).toHaveCount(0);timings.push(Date.now()-start);
 }
 expect(requests).toEqual([]);
 await info.attach('page-switch-timings.json',{body:JSON.stringify({scope:'controlled production browser; not a multiplayer room',milliseconds:timings}),contentType:'application/json'});
});
test('reopening Wiki uses its complete parsed cache without upstream requests or a parser worker',async({page},info)=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();
 const requests:string[]=[],workers:string[]=[];
 page.on('request',request=>{if(/https:\/\/(?:5e|homebrew)\.kiwee\.top\//.test(request.url()))requests.push(request.url());});
 page.on('worker',worker=>{if(/catalog\.worker/.test(worker.url()))workers.push(worker.url());});
 const start=Date.now();await page.reload();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();
 expect(requests).toEqual([]);expect(workers).toEqual([]);
 await info.attach('wiki-warm-timing.json',{body:JSON.stringify({scope:'authored fixture; retained IndexedDB',milliseconds:Date.now()-start}),contentType:'application/json'});
 // An explicit update still uses the live-source/recovery path.
 await page.getByRole('button',{name:'更新资料',exact:true}).click();
 await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 expect(requests.length).toBeGreaterThan(0);
});
