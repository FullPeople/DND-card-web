import {test,expect} from '@playwright/test';
import {mockSource} from '../e2e/fixtures';
test.beforeEach(async({page})=>mockSource(page));

test('the first view never exposes an empty result while data is pending',async({page})=>{
 let release!:()=>void;const waiting=new Promise<void>(resolve=>release=resolve);
 await page.route('https://5e.kiwee.top/data/class/class-test.json',async route=>{await waiting;await route.fallback();});
 await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('#wiki-boot')).toBeVisible();await expect(page.locator('#root')).toHaveCSS('visibility','hidden');
 await expect(page.getByText('没有符合条件的条目',{exact:true})).toHaveCount(0);
 release();await expect(page.locator('.catalog-row')).toHaveCount(2);await expect(page.locator('#wiki-boot')).toHaveCount(0);
});

test('a delayed stylesheet cannot expose the unstyled Wiki',async({page})=>{
 let release!:()=>void;const waiting=new Promise<void>(resolve=>release=resolve);
 await page.route('**/assets/index-*.css',async route=>{await waiting;await route.continue();});
 await page.goto('/',{waitUntil:'commit'});await expect(page.locator('#wiki-boot')).toBeVisible();await expect(page.locator('.catalog-row')).toHaveCount(2);await expect(page.locator('#root')).toHaveCSS('visibility','hidden');
 release();await expect(page.locator('#wiki-boot')).toHaveCount(0);await expect(page.locator('.wiki-reader-header')).toBeVisible();
});

test('a failed entry presents recovery without showing false empty results',async({page})=>{
 await page.route('**/assets/index-*.js',route=>route.abort('failed'));
 await page.goto('/',{waitUntil:'commit'});await expect(page.locator('#wiki-boot-retry')).toBeVisible();await expect(page.locator('#wiki-boot-message')).toContainText('未能加载');
});

test('switching books keeps the previous document and its own heading until the new book is ready',async({page})=>{
 const files:Record<string,unknown>={
  'books.json':{book:[{id:'FIRST',name:'第一份自制资料',contents:[{name:'开篇'}]},{id:'SECOND',name:'第二份自制资料',contents:[{name:'后篇'}]}]},
  'book/book-first.json':{bookData:[{id:'FIRST',data:[{type:'section',name:'开篇',entries:['第一份原创正文。']}]}]},
  'book/book-second.json':{bookData:[{id:'SECOND',data:[{type:'section',name:'后篇',entries:['第二份原创正文。']}]}]}
 };
 let release!:()=>void;const waiting=new Promise<void>(resolve=>release=resolve);
 await page.route('https://5e.kiwee.top/data/**',async route=>{const key=new URL(route.request().url()).pathname.replace('/data/','');if(!Object.hasOwn(files,key)){await route.fallback();return;}if(key==='book/book-second.json')await waiting;await route.fulfill({json:files[key],headers:{'access-control-allow-origin':'*'}});});
 await page.goto('/?reading=book&book=FIRST');await expect(page.getByRole('region',{name:'章节正文'})).toContainText('第一份原创正文');
 await page.getByRole('button',{name:'第二份自制资料'}).click();await expect(page.locator('.reading-volume-content')).toHaveAttribute('aria-busy','true');await expect(page.locator('.reading-volume-heading h2')).toHaveText('第一份自制资料');await expect(page.getByRole('region',{name:'章节正文'})).toContainText('第一份原创正文');
 release();await expect(page.locator('.reading-volume-heading h2')).toHaveText('第二份自制资料');await expect(page.getByRole('region',{name:'章节正文'})).toContainText('第二份原创正文');
});
