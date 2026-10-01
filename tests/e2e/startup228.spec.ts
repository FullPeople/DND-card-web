import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {writeFileSync} from 'node:fs';

test('Wiki code can remain stalled while a saved card opens, edits and persists',async({page})=>{
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 const card=newCharacter();card.name='首屏独立验收';card.automation={...newAutomationState(),enabled:false};card.runtime.resources={fixture:{name:'保留次数',current:2,max:5}};
 writeFileSync('.local-evidence/startup-character.json',JSON.stringify(card));
 await page.addInitScript(card=>{
  (window as any).seed=new Promise<void>((done,fail)=>{const open=indexedDB.open('dnd-card-standalone',1);open.onupgradeneeded=()=>{open.result.createObjectStore('documents');open.result.createObjectStore('cache');};open.onerror=()=>fail(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('documents','readwrite');tx.objectStore('documents').put({schemaVersion:1,characters:[card],activeId:card.id,packs:[]},'workspace');tx.oncomplete=()=>{db.close();done();};};});
 },card);
 let release!:()=>void;const gate=new Promise<void>(done=>release=done),errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/assets/WikiUi-*.js',async route=>{await gate;await route.continue();});
 await page.goto('/');await expect(page.locator('.paper')).toBeVisible();
 await expect(page.getByRole('tab',{name:'首屏独立验收',exact:true})).toBeVisible();
 await expect(page.locator('.wiki-loading')).toBeVisible();
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 const name=page.getByRole('textbox',{name:'角色姓名',exact:true});await name.fill('Wiki 未到也能保存');
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const saved=await page.evaluate(async()=>{const request=indexedDB.open('dnd-card-standalone');await new Promise<void>(r=>request.onsuccess=()=>r());const db=request.result;const result=await new Promise<any>(r=>{const get=db.transaction('documents').objectStore('documents').get('workspace');get.onsuccess=()=>r(get.result);});db.close();return result.characters[0];});
 expect(saved.name).toBe('Wiki 未到也能保存');expect(saved.runtime.resources.fixture.current).toBe(2);expect(saved.automation.enabled).toBe(false);
 await page.screenshot({path:'.local-evidence/card-with-wiki-stalled.png',fullPage:true});
 release();await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();expect(errors).toEqual([]);
});

test('a delayed page tool keeps the card frame and tab navigation usable',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);
 let requested=false,release!:()=>void;const gate=new Promise<void>(done=>release=done);
 await page.route('**/assets/SpellsPage-*.js',async route=>{requested=true;await gate;await route.continue();});
 await page.goto('/');await expect(page.locator('.paper')).toBeVisible();expect(requested).toBe(false);
 await page.locator('[data-sheet-tab=法术]').click();await expect.poll(()=>requested).toBe(true);
 await expect(page.locator('.paper')).toBeVisible();
 await page.locator('[data-sheet-tab=主要]').click();await expect(page.locator('.identity-class')).toBeVisible();
 release();await page.locator('[data-sheet-tab=法术]').click();await expect(page.locator('.header-法术')).toBeVisible();
});

test('a failed deferred page leaves the saved card and navigation available',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);
 await page.route('**/assets/SpellsPage-*.js',route=>route.abort('failed'));
 await page.goto('/');await expect(page.locator('.paper')).toBeVisible();
 await page.locator('[data-sheet-tab=法术]').click();await expect(page.locator('.tool-load-error')).toBeVisible();
 await page.getByRole('button',{name:'返回角色卡',exact:true}).click();await expect(page.locator('.identity-class')).toBeVisible();
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await page.getByRole('textbox',{name:'角色姓名',exact:true}).fill('工具失败仍可保存');
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
});

test.describe('offline cache',()=>{
 test.use({serviceWorkers:'allow'});
 test('offline installation excludes unused dictionary and editing tools',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/');await expect(page.locator('.paper')).toBeVisible();
 await page.evaluate(async()=>{const registration=await navigator.serviceWorker.ready;if(registration.active?.state!=='activated')await new Promise<void>(done=>registration.active?.addEventListener('statechange',()=>done(),{once:true}));});
 const cached=await page.evaluate(async()=>{const names=await caches.keys(),name=names.find(name=>name.startsWith('dnd-card-shell:'));return (await (await caches.open(name!)).keys()).map(request=>request.url);});
 expect(cached.some(url=>/\/assets\/App-.*\.js/.test(url))).toBe(true);
 for(const tool of ['search','sheetImage','AutomationPanel','ResourceDashboard','SpellsPage','CardMigration'])expect(cached.some(url=>new RegExp('/assets/'+tool+'-.*\\.js').test(url)),tool).toBe(false);
});

test('first-visit libraries and used pages are retained for offline reopening',async({page,context})=>{
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/');
 await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.locator('[data-sheet-tab=法术]').click();await expect(page.locator('.header-法术')).toBeVisible();
 await expect.poll(()=>page.evaluate(async()=>{const names=await caches.keys(),cache=await caches.open(names.find(name=>name.startsWith('dnd-card-shell:'))!);const urls=(await cache.keys()).map(request=>request.url);return ['WikiUi','catalog','cardRuntime','SpellsPage'].every(tool=>urls.some(url=>new RegExp('/assets/'+tool+'-.*\\.js').test(url)));})).toBe(true);
 await context.setOffline(true);await page.reload();await expect(page.locator('.paper')).toBeVisible();
 await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();
 await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();
 await page.locator('[data-sheet-tab=法术]').click();await expect(page.locator('.header-法术')).toBeVisible();
 await page.locator('[data-sheet-tab=主要]').click();await expect(page.locator('.identity-class')).toBeVisible();
});

});
