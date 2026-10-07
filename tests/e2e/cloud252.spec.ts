import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {mockSource,suppressAnnouncement} from './fixtures';
const fixture=()=>JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8'));
async function seed(page:any,cloud=false){
 const data=fixture();await page.goto('/');await page.evaluate(async({card,accountId,cloud}:any)=>{
  const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('dnd-card-standalone',1);request.onupgradeneeded=()=>{request.result.createObjectStore('documents');request.result.createObjectStore('cache');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const character={...card.character,name:'本机完整测试草稿'},tx=database.transaction('documents','readwrite');tx.objectStore('documents').put({schemaVersion:1,characters:[character],activeId:character.id,packs:[]},'workspace');
  if(cloud)tx.objectStore('documents').put({accountId,cloudId:card.id,revision:card.revision},'cloud-binding:'+character.id);
  await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});database.close();
 },{card:data.card,accountId:data.owner.id,cloud});
}
async function signIn(context:any,role='owner'){const data=fixture();await context.addCookies([{name:'dnd_cloud',value:data[role+'Session'].token,url:'http://127.0.0.1:5320/api/',httpOnly:true,sameSite:'Strict'}]);}

test('library has compact chrome, public warning, sidebar and hidden purchase policy',async({page})=>{
 const posts:string[]=[],errors:string[]=[];page.on('request',request=>{if(request.method()!=='GET')posts.push(request.url());});page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await expect(page.getByRole('link',{name:'打开在线车卡'})).toHaveAttribute('href','/card/');await page.getByRole('link',{name:'打开角色卡库'}).click();await expect(page).toHaveURL(/\/library\/$/);
 await expect(page.getByRole('button',{name:'QQ 登录（申请中）'})).toBeDisabled();await expect(page.getByText('所有的卡并不会安全保存',{exact:false}).first()).toBeVisible();await expect(page.getByText('购买槽位',{exact:false})).toHaveCount(0);expect(await page.locator('.cloud-header').evaluate(el=>el.getBoundingClientRect().height)).toBe(36);await page.getByRole('button',{name:'迁移与备份',exact:true}).click();await expect(page.getByRole('link',{name:'旧站入口'})).toHaveAttribute('href','https://obr.dnd.center/card/');
 await expect.poll(()=>page.getByRole('img',{name:'DND 角色卡网站标志'}).evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);expect(posts).toEqual([]);expect(errors).toEqual([]);await page.screenshot({path:test.info().outputPath('library-desktop.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:test.info().outputPath('library-mobile.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('guest ID renders all five full pages, full JSON and does not write local workspace',async({page})=>{
 const card=fixture().card;await page.goto('/card/?legacyViewer=1&cloud='+card.id);await expect(page.locator('.player-viewer-toolbar')).toContainText(card.character.name);
 for(const name of ['主要','特性','背景','法术','背包']){await page.getByRole('tab',{name,exact:true}).click();await expect(page.locator('.paper')).toBeVisible();if(name==='背景')await expect(page.locator('.paper')).toContainText('云端五页故事');}
 const saved=page.waitForEvent('download');await page.getByRole('button',{name:'导出 JSON',exact:true}).click();const file=await (await saved).path();const value=JSON.parse(readFileSync(file!,'utf8'));expect(value.character.runtime.resources.custom.current).toBe(2);expect(value.character.externalSnapshot.unmapped).toBe('原文保留');expect(await page.evaluate(()=>indexedDB.databases().then(rows=>rows.some(row=>row.name==='dnd-card-standalone')))).toBe(false);
 await page.screenshot({path:test.info().outputPath('guest-five-page.png')});
});
test('normal card saves locally, reloads, exports and imports complete JSON, with new-tab storage entry',async({page})=>{
 await seed(page);await mockSource(page);await suppressAnnouncement(page);await page.goto('/card/');const cloud=page.getByRole('link',{name:'云端存储',exact:true});await expect(cloud).toHaveAttribute('target','_blank');await expect(cloud).toHaveAttribute('href','https://dnd.center/library/');
 if(await page.getByRole('switch',{name:'编辑模式'}).getAttribute('aria-checked')!=='true')await page.getByRole('switch',{name:'编辑模式'}).click();await page.getByRole('textbox',{name:'角色姓名',exact:true}).fill('迁移完整角色');await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.reload();await expect(page.getByRole('textbox',{name:'角色姓名',exact:true})).toHaveValue('迁移完整角色');
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();const fileEvent=page.waitForEvent('download');await page.getByRole('button',{name:'下载 JSON',exact:true}).click();const file=await (await fileEvent).path(),text=readFileSync(file!,'utf8'),value=JSON.parse(text);expect(value.character.name).toBe('迁移完整角色');expect(value.character.runtime.resources.custom.current).toBe(2);expect(value.character.externalSnapshot.unmapped).toBe('原文保留');
 await page.getByRole('textbox',{name:'角色 JSON 文本'}).fill(text);await page.getByRole('button',{name:'校验并导入 JSON 文本'}).click();await page.getByRole('button',{name:'确认导入这批角色',exact:true}).click();await expect(page.locator('.character-manager')).toContainText('迁移完整角色');await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();await page.screenshot({path:test.info().outputPath('card-logo.png')});
});
test('upload only occurs after explicit confirmation and keeps complete document',async({page,context})=>{
 await signIn(context);await seed(page);await page.goto('/library/');await page.getByRole('button',{name:'本机角色',exact:true}).click();const requests:string[]=[];page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/api/cards'))requests.push(request.url());});
 await page.getByRole('button',{name:'上传到云端',exact:true}).click();expect(requests).toHaveLength(0);await page.getByRole('button',{name:'取消',exact:true}).click();expect(requests).toHaveLength(0);await page.getByRole('button',{name:'上传到云端',exact:true}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'确认上传完整角色卡',exact:true}).click();await expect(page.getByRole('alert')).toContainText('已上传完整角色卡');expect(requests).toHaveLength(1);
});
test('CAS conflict leaves recoverable local draft and does not advance its baseline',async({page,context})=>{
 await signIn(context);await seed(page,true);await page.goto('/library/');await page.getByRole('button',{name:'本机角色',exact:true}).click();const data=fixture();const response=await context.request.put('/api/cards/'+data.card.id,{headers:{Origin:'http://127.0.0.1:5320','X-CSRF-Token':data.ownerSession.csrf},data:{revision:1,character:{...data.card.character,name:'另一标签页领先修改'},confirmUpload:true}});expect(response.status()).toBe(200);
 await page.getByRole('button',{name:'保存草稿到云端',exact:true}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'确认上传完整角色卡',exact:true}).click();await expect(page.getByRole('alert')).toContainText('本机草稿保留');await page.getByRole('button',{name:'取消',exact:true}).click();await page.reload();await page.getByRole('button',{name:'本机角色',exact:true}).click();await expect(page.locator('.cloud-frame').filter({has:page.getByRole('heading',{name:'本机角色与待保存草稿',exact:true})}).getByText('本机完整测试草稿',{exact:true})).toBeVisible();await page.getByRole('button',{name:'导出完整 JSON',exact:true}).click();
});
test('account switch before confirmation refuses mutation and retains local draft',async({page,context})=>{
 await signIn(context);await seed(page);await page.goto('/library/');await page.getByRole('button',{name:'本机角色',exact:true}).click();await page.getByRole('button',{name:'上传到云端',exact:true}).click();await signIn(context,'editor');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'确认上传完整角色卡',exact:true}).click();await expect(page.getByRole('alert')).toContainText('登录账号或上传浏览器已改变');await expect(page.locator('.cloud-frame').filter({has:page.getByRole('heading',{name:'本机角色与待保存草稿',exact:true})}).getByText('本机完整测试草稿',{exact:true})).toBeVisible();
});
test('authorized editors get a local editing draft without owner controls or slot usage',async({page,context})=>{
 await signIn(context,'editor');await mockSource(page);await suppressAnnouncement(page);await page.goto('/library/');await expect(page.locator('.cloud-sidebar-status strong')).toHaveText('0 / 10');await page.getByRole('button',{name:'我的上传',exact:true}).click();await expect(page.getByRole('button',{name:'授权与删除',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'编辑本机草稿',exact:true}).first().click();await expect(page).toHaveURL(/\/card\/\?cloudDraft=/);await expect(page.getByRole('textbox',{name:'角色姓名',exact:true})).toHaveValue('另一标签页领先修改');
});

test('anonymous upload needs public consent, appears to another browser and only its browser can delete',async({page,browser})=>{
 await seed(page);await page.goto('/library/');await page.getByRole('button',{name:'本机角色',exact:true}).click();
 const writes:string[]=[];page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/cards')writes.push(request.url());});
 await page.getByRole('button',{name:'上传到云端',exact:true}).click();await expect(page.getByRole('button',{name:'确认上传完整角色卡',exact:true})).toBeDisabled();expect(writes).toHaveLength(0);
 await page.getByRole('checkbox').check();const savedEvent=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/cards'&&response.request().method()==='POST');await page.getByRole('button',{name:'确认上传完整角色卡',exact:true}).click();const saved=await(await savedEvent).json();expect(saved.id).toMatch(/^[A-Z]{6}$/);await expect(page.getByRole('alert')).toContainText(saved.id);expect(writes).toHaveLength(1);expect(saved.character.runtime.resources.custom.current).toBe(2);
 const guest=await browser.newContext(),other=await guest.newPage();try{
  await other.goto('/library/');const row=other.locator('li').filter({has:other.getByText(saved.id,{exact:true})});await expect(row).toContainText('本机完整测试草稿');await expect(row.getByRole('button')).toHaveCount(0);
  await other.getByRole('button',{name:'按 ID 查看',exact:true}).click();await other.getByRole('textbox',{name:'云端卡 ID'}).fill(saved.id.toLowerCase());await other.getByRole('button',{name:'查看完整角色卡'}).click();await expect(other.locator('.player-viewer-toolbar')).toContainText(saved.character.name);
  for(const name of ['主要','特性','背景','法术','背包']){await other.getByRole('tab',{name,exact:true}).click();await expect(other.locator('.paper')).toBeVisible();}
 }finally{await guest.close();}
 const own=page.locator('li').filter({has:page.getByText(saved.id,{exact:true})});await own.getByRole('button',{name:'导出与删除'}).click();const download=page.waitForEvent('download');await page.getByRole('dialog').getByRole('button',{name:'导出完整 JSON'}).click();expect(JSON.parse(readFileSync((await(await download).path())!,'utf8')).character.runtime.resources.custom.current).toBe(2);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'删除云端卡',exact:true}).click();await expect(page.getByRole('alert')).toContainText('云端卡已删除');await page.getByRole('button',{name:'本机角色',exact:true}).click();await expect(page.getByRole('button',{name:'上传到云端',exact:true})).toBeEnabled();await expect(page.getByText('本机完整测试草稿',{exact:true})).toBeVisible();
});
