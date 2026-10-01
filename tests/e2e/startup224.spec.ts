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
 await expect(page.locator('#startup-title')).toBeVisible();
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
