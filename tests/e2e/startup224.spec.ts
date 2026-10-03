import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';

test('preloaded styles are reused by the application without duplicate downloads',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);
 const requests=new Map<string,number>(),warnings:string[]=[];
 page.on('request',request=>{if(/\/assets\/.*\.css(?:\?|$)/.test(request.url()))requests.set(request.url(),(requests.get(request.url())??0)+1);});
 page.on('console',message=>{if(message.text().includes('credentials mode does not match'))warnings.push(message.text());});
 await page.goto('/');await expect(page.locator('.paper')).toBeVisible();
 const styles=await page.locator('link[rel="preload"][as="style"]').evaluateAll(nodes=>nodes.map(node=>(node as HTMLLinkElement).href));
 expect(styles.length).toBeGreaterThan(0);
 for(const href of styles)expect(requests.get(href),href).toBe(1);
 expect(warnings).toEqual([]);
});

test('application preload starts before a delayed entry and slow loading remains recoverable',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);await page.clock.install();
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 let appRequested=false,largeIconRequested=false;
 page.on('request',request=>{if(request.url().endsWith('/exe_icon.png'))largeIconRequested=true;if(/\/assets\/App-.*\.js/.test(request.url()))appRequested=true;});
 await page.route('**/assets/index-*.js',async route=>{await gate;await route.continue();});
 await page.goto('/',{waitUntil:'commit'});
 await expect(page.locator('#startup-intro')).toBeVisible();
 await expect(page.locator('#startup')).toBeHidden();
 await expect(page.locator('#startup-intro')).toHaveCSS('background-color','rgb(255, 255, 86)');
 await expect(page.locator('#startup-intro')).toHaveText('');
 await expect(page.locator('#startup-intro img')).toHaveCount(4);
 await expect.poll(()=>appRequested).toBe(true);expect(largeIconRequested).toBe(false);
 await expect(page.locator('#startup-message')).toContainText('秒');
 await page.clock.fastForward(21000);
 await expect(page.locator('#startup-title')).toHaveText('程序仍在加载');
 await expect(page.locator('#startup-detail')).toContainText('暂未收到文件加载错误');
 await expect(page.locator('#startup-message')).toContainText('正在下载程序文件');
 release();await expect(page.locator('.paper')).toBeVisible();
 await expect(page.locator('#startup')).toBeHidden();
});

test('pinyin dictionary is loaded on demand and results refresh after it arrives',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);
 let requested=false,release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/assets/search-*.js',async route=>{requested=true;await gate;await route.continue();});
 await page.goto('/');await expect(page.locator('.paper')).toBeVisible();expect(requested).toBe(false);
 const search=page.getByRole('textbox',{name:'搜索规则资料',exact:true});
 await search.fill('测试法师');await expect(page.locator('.global-result').filter({hasText:'测试法师'}).first()).toBeVisible();expect(requested).toBe(false);
 await search.fill('ceshifashi');await expect.poll(()=>requested).toBe(true);
 await expect(page.getByText('正在加载拼音搜索…',{exact:true})).toBeVisible();
 release();await expect(page.locator('.global-result').filter({hasText:'测试法师'}).first()).toBeVisible();
 await expect(page.getByText('正在加载拼音搜索…',{exact:true})).toHaveCount(0);
});


test('category pinyin updates in the existing status row without displacing the Wiki columns',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/assets/search-*.js',async route=>{await gate;await route.continue();});
 await page.goto('/');await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();
 const before=await page.locator('.catalog-shell').boundingBox();
 await page.getByRole('searchbox',{name:'职业分类搜索',exact:true}).fill('ceshifashi');
 await expect(page.locator('.catalog-status')).toContainText('正在加载拼音搜索');
 const during=await page.locator('.catalog-shell').boundingBox();expect(Math.abs(during!.width-before!.width)).toBeLessThan(2);expect(Math.abs(during!.x-before!.x)).toBeLessThan(2);
 release();await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();
 await expect(page.locator('.catalog-status')).not.toContainText('正在加载拼音搜索');
});


test('approved four-layer yellow opening fades into the real card without lobby content',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const intro=page.locator('#startup-intro');
 await expect(intro).toHaveCSS('background-color','rgb(255, 255, 86)');
 await expect(intro).toHaveText('');
 await expect(intro.locator('img')).toHaveCount(4);
 await expect.poll(()=>intro.locator('img').evaluateAll(nodes=>nodes.every(node=>(node as HTMLImageElement).complete&&(node as HTMLImageElement).naturalWidth===500))).toBe(true);
 const layers=await intro.locator('img').evaluateAll(nodes=>nodes.map(node=>({src:node.getAttribute('src'),delay:getComputedStyle(node).animationDelay})));
 expect(layers.map(row=>row.src)).toEqual(['./startup-logo/4.PNG','./startup-logo/1.PNG','./startup-logo/2.PNG','./startup-logo/3.PNG']);
 expect(layers.map(row=>row.delay)).toEqual(['0s','0.14s','0.28s','0.42s']);
 await page.screenshot({path:test.info().outputPath('yellow-logo-entrance.png')});
 await expect(intro).toBeHidden();
 await expect(page.locator('.paper')).toBeVisible();
 await expect(page.locator('#startup')).toBeHidden();
 await expect(page.getByText('CHARACTER LOBBY',{exact:true})).toHaveCount(0);
 await page.screenshot({path:test.info().outputPath('card-after-logo.png')});
});
