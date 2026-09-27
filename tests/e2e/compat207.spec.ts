import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';

test('Wiki loads and reloads without AbortSignal.any or timeout',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);await page.addInitScript(()=>{Object.defineProperty(AbortSignal,'any',{value:undefined,configurable:true});Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true});});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.reload();await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();expect(errors).toEqual([]);
});
test('full Wiki cache does not discard downloaded entries or prevent character saves',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);await page.addInitScript(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:any[]){if(this.name==='cache')throw new DOMException('cache quota exceeded','QuotaExceededError');return put.apply(this,args as any);};});
 await page.goto('/');await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await expect(page.locator('.save-status')).toContainText('已保存');await page.reload();await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();
});
test('a failed lazy application chunk shows diagnostics and retry recovers without deleting saved data',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/');await expect(page.locator('.paper')).toBeVisible();
 const before=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('dnd-card-workspace');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});try{return await new Promise<any>((resolve,reject)=>{const req=db.transaction('documents').objectStore('documents').get('workspace');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}finally{db.close();}});
 const pattern='**/assets/App-*.js';await page.route(pattern,r=>r.abort('failed'));await page.reload();await expect(page.getByRole('heading',{name:'角色卡程序加载失败'})).toBeVisible();await page.getByText('错误详情（可复制给开发者）',{exact:true}).last().click();await expect(page.locator('#root pre')).toContainText(/fetch|import|module|load/i);await page.unroute(pattern);await page.getByRole('button',{name:'重新加载',exact:true}).click();await expect(page.locator('.paper')).toBeVisible();
 const id=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const req=indexedDB.open('dnd-card-workspace');req.onsuccess=()=>resolve(req.result);});try{return await new Promise<string>(resolve=>{const req=db.transaction('documents').objectStore('documents').get('workspace');req.onsuccess=()=>resolve(req.result.activeId);});}finally{db.close();}});expect(id).toBe(before.activeId);
});
test('a failed entry script has an HTML error and retry button before React starts',async({page})=>{
 await page.route('**/assets/index-*.js',r=>r.abort('failed'));await page.goto('/');await expect(page.locator('#startup-title')).toHaveText('程序文件加载失败');await expect(page.getByRole('button',{name:'重新加载',exact:true})).toBeVisible();await page.screenshot({path:(process.env.COMPAT_OUTPUT||'test-results')+'/startup-failure.png'});
});
