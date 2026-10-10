import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {mockSource,suppressAnnouncement} from './fixtures';
const base='http://127.0.0.1:5320',fixture=()=>JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8'));
test('cloud settings describe granted editors and refuse stale account or revision mutations',async({page,context})=>{
 const f=fixture(),headers={Origin:base,Cookie:'dnd_cloud='+f.ownerSession.token,'X-CSRF-Token':f.ownerSession.csrf};
 const response=await context.request.post('/api/cards',{headers,data:{character:{...f.card.character,id:crypto.randomUUID(),name:'独立云端权限验收'},confirmUpload:true}});expect(response.status()).toBe(201);const card=await response.json();
 await context.request.post('/api/cards/'+card.id+'/editors',{headers,data:{accountId:f.editor.id}});
 await context.addCookies([{name:'dnd_cloud',value:f.editorSession.token,url:base+'/api/',httpOnly:true,sameSite:'Strict'}]);await mockSource(page);await suppressAnnouncement(page);await page.goto('/');
 await page.evaluate(async({card,accountId})=>{const db=await new Promise<IDBDatabase>(resolve=>{const request=indexedDB.open('dnd-card-standalone',1);request.onupgradeneeded=()=>{request.result.createObjectStore('documents');request.result.createObjectStore('cache');};request.onsuccess=()=>resolve(request.result);});const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put({schemaVersion:1,characters:[card.character],activeId:card.character.id,packs:[]},'workspace');tx.objectStore('documents').put({accountId,cloudId:card.id,revision:card.revision},'cloud-binding:'+card.character.id);await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve();});db.close();},{card,accountId:f.editor.id});
 await page.goto('/card/?intro=0');await page.getByRole('button',{name:'云端卡设置',exact:true}).click();const dialog=page.getByRole('dialog',{name:'云端卡设置',exact:true});await expect(dialog).toContainText('卡主已授权你的 QQ 账号编辑这张卡');await expect(dialog.getByRole('textbox')).toHaveCount(0);await expect(dialog.getByRole('button',{name:'移除云端卡（本机保留）'})).toHaveCount(0);await dialog.getByRole('button',{name:'关闭',exact:true}).click();
 await context.addCookies([{name:'dnd_cloud',value:f.ownerSession.token,url:base+'/api/',httpOnly:true,sameSite:'Strict'}]);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('button',{name:'账号',exact:true})).toContainText('卡主测试昵称');await page.getByRole('button',{name:'云端卡设置',exact:true}).click();await expect(dialog.getByRole('textbox',{name:'编辑者账号 ID'})).toBeVisible();
 // An intervening cloud edit must make deletion fail instead of removing a
 // version the owner has not reviewed in this dialog.
 const updated=await context.request.put('/api/cards/'+card.id,{headers,data:{revision:card.revision,character:{...card.character,name:'另一页的新版本'},confirmUpload:true}});expect(updated.status()).toBe(200);
 page.once('dialog',confirmation=>confirmation.accept());await dialog.getByRole('button',{name:'移除云端卡（本机保留）'}).click();await expect(dialog.getByRole('alert')).toContainText('版本已改变');expect((await context.request.get('/api/cards/'+card.id,{headers})).status()).toBe(200);
 // The visible old owner's controls cannot authorize a newly signed-in editor.
 await context.addCookies([{name:'dnd_cloud',value:f.editorSession.token,url:base+'/api/',httpOnly:true,sameSite:'Strict'}]);await dialog.getByRole('textbox',{name:'编辑者账号 ID'}).fill(f.owner.id);await dialog.getByRole('button',{name:'授予编辑权限'}).click();await expect(dialog.getByRole('alert')).toContainText('登录账号或上传浏览器已改变');
 const current=await(await context.request.get('/api/cards/'+card.id,{headers})).json();await context.request.delete('/api/cards/'+card.id,{headers,data:{revision:current.revision}});
});
