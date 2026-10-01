import {test,expect,type Route} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';

test.beforeEach(async({page})=>{await mockSource(page,{displayMode:'default'});await suppressAnnouncement(page);});

test('a fresh browser opens A4 on every page, while an explicit screen choice survives reload',async({page})=>{
 await page.goto('/');await expect(page.locator('.paper')).toBeVisible();
 await expect(page.getByRole('button',{name:'切换为非 A4 显示'})).toBeVisible();
 for(const tab of ['主要','特性','背景','法术','背包']){
  await page.locator(`[data-sheet-tab=${tab}]`).click();
  const box=await page.locator('.paper').boundingBox();expect(box!.width/box!.height).toBeCloseTo(210/297,3);
 }
 await page.locator('[data-sheet-tab=主要]').click();await page.screenshot({path:'.local-evidence/default-a4-229.png',fullPage:true});
 await page.getByRole('button',{name:'切换为非 A4 显示'}).click();await page.reload();
 await expect(page.getByRole('button',{name:'切换为 A4 显示'})).toBeVisible();
});

test('a transient document failure recovers automatically and leaves no error count',async({page})=>{
 let attempts=0;await page.route('https://5e.kiwee.top/data/class/class-test.json',route=>++attempts===1?route.abort('connectionreset'):route.fallback());
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();
 expect(attempts).toBe(2);await expect(page.locator('.load-errors')).toHaveCount(0);
});

test('a sustained source outage pauses the queue, keeps the card editable and resumes the missing files',async({page})=>{
 let attempts=0;await page.route('https://5e.kiwee.top/data/**',route=>{attempts++;return route.abort('connectionreset');});
 await page.goto('/');await expect(page.locator('.load-paused')).toContainText('尚有资料未读');
 await expect(page.locator('.catalog-status')).toContainText('已暂停');
 const count=attempts;expect(count).toBe(6);await page.waitForTimeout(700);expect(attempts).toBe(count);
 await expect(page.locator('.load-errors summary')).toContainText('2 份资料读取异常');
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await page.getByRole('textbox',{name:'角色姓名',exact:true}).fill('断线期间仍能保存');
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.screenshot({path:'.local-evidence/wiki-paused-229.png',fullPage:true});
 await page.unroute('https://5e.kiwee.top/data/**');await mockSource(page,{displayMode:'default'});
 await page.locator('.load-errors summary').click();await page.getByRole('button',{name:'重试加载',exact:true}).click();
 await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await expect(page.locator('.load-paused')).toHaveCount(0);
 await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();
 await expect(page.getByRole('textbox',{name:'角色姓名',exact:true})).toHaveValue('断线期间仍能保存');
});

test('retrying a missing file uses good caches and retries a stale-cache warning without hiding it',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 let missing=true,requests:string[]=[];
 await page.route('https://5e.kiwee.top/data/class/class-test.json',route=>missing?route.fulfill({status:404,body:'missing'}):route.fallback());
 await page.getByRole('button',{name:'更新资料',exact:true}).click();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await expect(page.locator('.load-errors')).toContainText('旧缓存');
 page.on('request',r=>{if(/kiwee\.top/.test(r.url()))requests.push(r.url());});
 await page.locator('.load-errors summary').click();await page.getByRole('button',{name:'重试加载',exact:true}).click();
 await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await expect(page.locator('.load-errors')).toContainText('旧缓存');
 expect(requests).toEqual(['https://5e.kiwee.top/data/class/class-test.json']);
  missing=false;requests=[];await page.locator('.load-errors summary').click();await page.getByRole('button',{name:'重试加载',exact:true}).click();
 await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await expect(page.locator('.load-errors')).toHaveCount(0);
 expect(requests).toEqual(['https://5e.kiwee.top/data/class/class-test.json']);
});

test('an uncached missing document stays visible without pausing or repeatedly requesting it',async({page})=>{
 let requests=0;await page.route('https://5e.kiwee.top/data/feats.json',route=>{requests++;return route.fulfill({status:404,body:'missing'});});
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await expect(page.locator('.load-errors')).toContainText('HTTP 404');await expect(page.locator('.load-paused')).toHaveCount(0);expect(requests).toBe(1);
});

test('a mid-download outage stops the parallel file readers and preserves the existing library',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 const failedRequests:string[]=[];
 const broken=(route:Route)=>{
  const url=route.request().url();
  if(url.endsWith('/index.json')||url.includes('gendata-spell-source-lookup'))return route.fallback();
  failedRequests.push(url);return route.abort('connectionreset');
 };
 await page.route('https://5e.kiwee.top/data/**',broken);
 await page.getByRole('button',{name:'更新资料',exact:true}).click();await expect(page.locator('.load-paused')).toBeVisible();
 const count=failedRequests.length;expect(count).toBeLessThanOrEqual(12);
 await page.waitForTimeout(700);expect(failedRequests.length).toBe(count);
 await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();
 await expect(page.locator('.load-errors')).toContainText('旧缓存');
 await page.unroute('https://5e.kiwee.top/data/**',broken);
 await page.locator('.load-errors summary').click();await page.getByRole('button',{name:'重试加载',exact:true}).click();
 await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await expect(page.locator('.load-paused')).toHaveCount(0);await expect(page.locator('.load-errors')).toHaveCount(0);
});

test.describe('activation timing',()=>{
 test.use({serviceWorkers:'allow'});
 test('a tool requested before activation and completed afterwards is cached for offline use',async({page,context})=>{
  let releaseInstall!:()=>void,releaseTool!:()=>void,installBlocked=false,toolRequested=false;
  const installGate=new Promise<void>(done=>releaseInstall=done),toolGate=new Promise<void>(done=>releaseTool=done);
  await context.route('**/favicon.svg',async route=>{if(route.request().serviceWorker()){installBlocked=true;await installGate;}await route.continue();});
  await page.route('**/assets/cardRuntime-*.js',async route=>{toolRequested=true;await toolGate;await route.continue();});
  try{
   await page.goto('/');await expect(page.locator('.paper')).toBeVisible();
   await expect.poll(()=>installBlocked&&toolRequested).toBe(true);
   releaseInstall();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);releaseTool();
   await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();
   await expect.poll(()=>page.evaluate(async()=>{const names=await caches.keys(),name=names.find(name=>name.startsWith('dnd-card-shell:')),urls=(await(await caches.open(name!)).keys()).map(request=>request.url);return urls.some(url=>/\/assets\/cardRuntime-.*\.js/.test(url));})).toBe(true);
   await context.setOffline(true);await page.reload();await expect(page.locator('.paper')).toBeVisible();await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();
  }finally{releaseInstall();releaseTool();}
 });
});
