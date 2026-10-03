import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter} from '../../src/core/model';
for(const requested of [false,true])test(`a stalled editor cannot hold a validated saved card behind the logo (saved editing=${requested})`,async({page},info)=>{
 test.skip(!['standalone','integrated-entry'].includes(info.project.name),'Requires dedicated production builds; the Vite dev import URL is not an assets chunk.');
 await mockSource(page);await suppressAnnouncement(page);
 const card=newCharacter();card.name='开屏分层验收';card.runtime.hp=8;card.runtime.resources.fixture={name:'保留次数',current:2,max:5};
 await page.addInitScript(({card,requested,dbName})=>{localStorage.setItem('dnd-card:editing',String(requested));const open=indexedDB.open(dbName,1);open.onupgradeneeded=()=>{open.result.createObjectStore('documents');open.result.createObjectStore('cache');};open.onsuccess=()=>{const db=open.result,tx=db.transaction('documents','readwrite');tx.objectStore('documents').put({schemaVersion:1,characters:[card],activeId:card.id,packs:[]},'workspace');tx.oncomplete=()=>db.close();};}, {card,requested,dbName:info.project.name==='standalone'?'dnd-card-standalone':'dnd-card-workspace'});
 let release!:()=>void;const blocked=new Promise<void>(r=>release=r);let editorRequested=false;
 await page.route('**/assets/cardRuntime-*.js',async route=>{editorRequested=true;await blocked;await route.continue();});
 await page.goto('/',{waitUntil:'commit'});
 if(process.env.STARTUP_BASELINE_CHECK==='1'&&requested){await page.waitForFunction(()=>document.documentElement?.dataset.cardStartup==='waiting');await expect(page.locator('.app-shell')).toBeAttached();await expect(page.locator('#root')).toHaveCSS('visibility','hidden');await page.screenshot({path:info.outputPath('baseline-validated-card-still-blocked-by-editor.png')});release();}
 await page.waitForFunction(()=>document.documentElement?.dataset.cardStartup==='complete',null,{timeout:12000});
 await expect(page.locator('.paper')).toBeVisible();await expect(page.getByRole('tab',{name:'开屏分层验收',exact:true})).toBeVisible();
 const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});if(!(process.env.STARTUP_BASELINE_CHECK==='1'&&requested)){await expect(toggle).toBeDisabled();await expect(toggle).toHaveAttribute('aria-checked','false');if(requested)await expect(toggle).toHaveAttribute('aria-busy','true');}
 await expect.poll(()=>editorRequested).toBe(true);expect(await page.evaluate(()=>localStorage.getItem('dnd-card:editing'))).toBe(String(requested));
 const saved=await page.evaluate(async dbName=>{const req=indexedDB.open(dbName);await new Promise(r=>req.onsuccess=r);const tx=req.result.transaction('documents'),get=tx.objectStore('documents').get('workspace');await new Promise(r=>get.onsuccess=r);req.result.close();return get.result.characters[0];},info.project.name==='standalone'?'dnd-card-standalone':'dnd-card-workspace');
 expect(saved.runtime.hp).toBe(8);expect(saved.runtime.resources.fixture.current).toBe(2);
 await page.screenshot({path:info.outputPath(`card-readable-with-editor-stalled-${requested}.png`)});release();await expect(toggle).toBeEnabled();await expect(toggle).toHaveAttribute('aria-checked',String(requested));
});

test('a failed workspace can restore its backup and load editing and Wiki afterward',async({page},info)=>{
 test.skip(process.env.STARTUP_BASELINE_CHECK==='1'||!['standalone','integrated-entry'].includes(info.project.name),'Recovery pass is verified against the candidate production entry.');
 await mockSource(page);await suppressAnnouncement(page);const card=newCharacter();card.name='保留备份恢复';card.runtime.hp=8;card.runtime.resources.fixture={name:'保留次数',current:2,max:5};
 await page.addInitScript(({card,dbName})=>{const open=indexedDB.open(dbName,1);open.onupgradeneeded=()=>{open.result.createObjectStore('documents');open.result.createObjectStore('cache');};open.onsuccess=()=>{const db=open.result,tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents');store.put({schemaVersion:99,characters:[],packs:[]},'workspace');store.put({schemaVersion:1,characters:[card],activeId:card.id,packs:[]},'backup');tx.oncomplete=()=>db.close();};},{card,dbName:info.project.name==='standalone'?'dnd-card-standalone':'dnd-card-workspace'});
 await page.goto('/');await expect(page.getByRole('alert')).toContainText('读取失败');await page.getByRole('button',{name:'读取备份',exact:true}).click();await expect(page.locator('.paper')).toBeVisible();await expect(page.getByRole('tab',{name:'保留备份恢复',exact:true})).toBeVisible();await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();await expect(page.locator('.catalog-row').filter({hasText:'测试法师'}).first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.dataset.cardStartup)).toBe('failed');await page.screenshot({path:info.outputPath('backup-recovered-with-deferred-tools.png')});
});
