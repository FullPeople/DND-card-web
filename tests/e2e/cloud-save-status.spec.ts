import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {mockSource,suppressAnnouncement} from './fixtures';
const fixture=()=>JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8'));
async function seed(page:any){
 await page.goto('/');await page.evaluate(async(card:any)=>{
  const request=indexedDB.open('dnd-card-standalone',1);request.onupgradeneeded=()=>{request.result.createObjectStore('documents');request.result.createObjectStore('cache');};
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const character={...card.character,id:crypto.randomUUID(),name:'保存状态测试'},second={...character,id:crypto.randomUUID(),name:'仅本机的另一张'};
  const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put({schemaVersion:1,characters:[character,second],activeId:character.id,packs:[]},'workspace');await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
 },fixture().card);
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/card/');
}
test('card consent, short ID, copy, real autosync and per-character book states',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await seed(page);
 const header=page.locator('.header-tools');await expect(page.getByRole('button',{name:'上锁角色卡'})).toHaveCount(0);
 await header.getByRole('button',{name:'保存到云端',exact:true}).click();const dialog=page.getByRole('dialog',{name:'保存到云端确认'});
 await expect(dialog).toContainText('目前保存还在内测阶段，这意味着你的卡将会无条件公之于众。');await expect(dialog).toContainText('等未来接入登陆和便捷的账号系统后，该问题会得到解决。');await expect(dialog).toContainText('请确保你真的同意，并且不要在卡内填写隐私信息。');
 const emphasis=dialog.locator('.cloud-upload-warning strong');expect(await emphasis.evaluate(el=>getComputedStyle(el).color)).toBe('rgb(197, 34, 50)');expect(Number(await emphasis.evaluate(el=>getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(700);
 await expect(dialog.getByRole('button',{name:'确认保存到云端'})).toBeDisabled();await page.screenshot({path:test.info().outputPath('cloud-consent-desktop.png')});
 const posted=page.waitForResponse(response=>response.url().endsWith('/api/cards')&&response.request().method()==='POST');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'确认保存到云端'}).click();const saved=await(await posted).json();expect(saved.id).toMatch(/^[A-Z]{6}$/);await expect(header.locator('.cloud-id-box code')).toHaveText(saved.id);expect(await header.locator('.cloud-id-box button').evaluate(el=>getComputedStyle(el).color)).not.toBe('rgb(255, 255, 255)');
 await header.getByRole('button',{name:'复制云端卡 ID '+saved.id}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(saved.id);
 let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);await page.route('**/api/cards/'+saved.id,async route=>{if(route.request().method()==='PUT')await held;await route.continue();});
 if(await page.getByRole('switch',{name:'编辑模式'}).getAttribute('aria-checked')!=='true')await page.getByRole('switch',{name:'编辑模式'}).click();await page.getByRole('textbox',{name:'角色姓名',exact:true}).fill('同步后的完整角色');await expect(header.getByRole('status')).toContainText('正在同步...');
 await page.getByRole('button',{name:/角色簿/}).click();const book=page.locator('.character-manager');await expect(book.getByRole('row').filter({hasText:'同步后的完整角色'})).toContainText('正在同步...');await expect(book.getByRole('row').filter({hasText:'仅本机的另一张'})).toContainText('保存到云端');await expect(book.getByRole('row').filter({hasText:'仅本机的另一张'})).toContainText('仅本机保存');release();await expect(book.getByRole('row').filter({hasText:'同步后的完整角色'})).toContainText(saved.id);await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 const remote=await(await context.request.get('/api/cards/'+saved.id)).json();expect(remote.character.name).toBe('同步后的完整角色');expect(remote.character.runtime.resources.custom.current).toBe(2);await page.reload();await expect(header.locator('.cloud-id-box code')).toHaveText(saved.id);await page.screenshot({path:test.info().outputPath('cloud-card-status.png')});
});
test('announcement poster appears on notice tab with the requested wording',async({page})=>{
 await mockSource(page);await page.goto('/card/');const dialog=page.getByRole('dialog').filter({has:page.locator('.announcement-cloud-poster')});await expect(dialog.locator('.announcement-cloud-poster strong')).toHaveText('现在支持云端存储/分享角色卡了！！！');await expect(dialog.locator('.announcement-cloud-poster small')).toHaveText('详情请打开右上角的云端存储。');await page.screenshot({path:test.info().outputPath('cloud-announcement-desktop.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:test.info().outputPath('cloud-announcement-mobile.png')});
});
test('search, sidebar warning, complete circular A4 gallery, drag switching and source footer',async({page,context})=>{
 const session=await(await context.request.get('/api/session')).json();const ids=[];
 for(const name of ['叠卡验收 A','叠卡验收 B']){const response=await context.request.post('/api/cards',{headers:{Origin:'http://127.0.0.1:5320','X-CSRF-Token':session.csrf},data:{character:{...fixture().card.character,id:crypto.randomUUID(),name},confirmUpload:true,confirmPublicTemporary:true}});expect(response.status()).toBe(201);ids.push((await response.json()).id);}
 await page.goto('/library/');const search=page.getByRole('searchbox',{name:'搜索角色卡'});await search.fill('叠卡验收');await expect(page.getByRole('button',{name:'按 ID 查看'})).toHaveCount(0);await expect(page.locator('.cloud-stack-id code')).toHaveText(ids[1]);
 await expect(page.locator('.cloud-sidebar-warning')).toBeVisible();
 const active=()=>page.locator('.cloud-gallery-item.is-active');expect(page.frames()).toHaveLength(1);await expect(active().locator('.paper')).toBeVisible();expect(await active().locator('.sheet-viewport').getAttribute('data-sheet-display')).toBe('a4');
 const bounds=await active().locator('.paper').boundingBox();expect(bounds!.height/bounds!.width).toBeCloseTo(297/210,2);
 await expect(active().getByRole('tab')).toHaveCount(0);await active().getByRole('button',{name:/全屏查看角色卡/}).click();const fullscreen=page.getByRole('dialog',{name:'全屏角色卡',exact:true});await expect(fullscreen).toBeVisible();for(const name of ['主要','特性','背景','法术','背包']){await fullscreen.getByRole('tab',{name,exact:true}).click();await expect(fullscreen.locator('.paper')).toBeVisible();}await fullscreen.getByRole('button',{name:'返回画廊',exact:true}).click();await expect(fullscreen).not.toBeVisible();
 await page.getByRole('button',{name:'下一张角色卡'}).click();await expect(page.locator('.cloud-stack-id code')).toHaveText(ids[0]);await expect(active().locator('.paper')).toBeVisible();
 const area=await active().locator('.paper').boundingBox();await page.mouse.move(area!.x+area!.width*.2,area!.y+area!.height*.7);await page.mouse.down();await page.mouse.move(area!.x+area!.width*.2+95,area!.y+area!.height*.7,{steps:12});await page.mouse.up();await expect(page.locator('.cloud-stack-id code')).toHaveText(ids[1]);
 await search.fill(ids[0].toLowerCase());await expect(page.locator('.cloud-stack-id code')).toContainText(ids[0]);await search.fill('叠卡验收');await expect(active().locator('.paper')).toBeVisible();await page.screenshot({path:test.info().outputPath('cloud-library-stack-desktop.png')});
 const footer=page.locator('.cloud-source-footer');expect(await footer.evaluate(el=>Math.abs(innerWidth-el.getBoundingClientRect().right)<2&&Math.abs(innerHeight-el.getBoundingClientRect().bottom)<2)).toBe(true);await expect(footer.getByRole('link',{name:/源码仓库/})).toHaveAttribute('href','https://github.com/FullPeople/DND-card-web');
 await page.setViewportSize({width:390,height:844});await expect(active().locator('.paper')).toBeVisible();await page.screenshot({path:test.info().outputPath('cloud-library-stack-mobile.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
