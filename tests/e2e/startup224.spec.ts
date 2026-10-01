import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';

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
