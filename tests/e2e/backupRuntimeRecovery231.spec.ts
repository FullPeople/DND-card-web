import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Character} from '../../src/core/model';
import type {Workspace} from '../../src/platform/storage';

async function records(page:Page){
 return page.evaluate(async()=>{
  const request=indexedDB.open('dnd-card-standalone');await new Promise<void>((done,fail)=>{request.onsuccess=()=>done();request.onerror=()=>fail(request.error);});const db=request.result;
  try{return await new Promise<{workspace:Workspace;backup:Workspace;draft:Character}>((done,fail)=>{const tx=db.transaction('documents'),store=tx.objectStore('documents'),values:any={};for(const key of ['workspace','backup','recovery:unrelated']){const get=store.get(key);get.onsuccess=()=>values[key==='recovery:unrelated'?'draft':key]=get.result;}tx.oncomplete=()=>done(values);tx.onerror=()=>fail(tx.error);});}finally{db.close();}
 });
}
async function fixture(page:Page){
 const active=newCharacter(),other=newCharacter();active.name='当前已保存角色';active.notes='新版本笔记';active.revision=9;active.runtime.resources.manual={name:'新版本次数',current:2,max:5};
 other.name='不相关角色';other.notes='保持另一角色原值';other.runtime.resources.other={name:'另一个资源',current:7,max:11};
 await mockSource(page,{displayMode:'default'});await suppressAnnouncement(page);
 await page.addInitScript(cards=>{const request=indexedDB.open('dnd-card-standalone',1);request.onupgradeneeded=()=>{request.result.createObjectStore('documents');request.result.createObjectStore('cache');};request.onsuccess=()=>{const db=request.result,tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents'),get=store.get('workspace');get.onsuccess=()=>{if(!get.result)store.put({schemaVersion:1,characters:cards,activeId:cards[0].id,packs:[]},'workspace');};tx.oncomplete=()=>db.close();};},[active,other]);
 await page.route('**/assets/cardRuntime-*.js',route=>route.abort('connectionreset'));
 await page.goto('/');await expect(page.locator('.editing-load-error')).toBeVisible();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const current=(await records(page)).workspace,backup=structuredClone(current),restored=backup.characters.find(card=>card.id===backup.activeId)!;
 restored.name='已读取的旧备份';restored.notes='旧版本不同笔记';restored.revision=4;restored.abilities.dex=14;restored.runtime.tempHp=6;restored.runtime.resources.manual={name:'旧版本次数',current:4,max:9};
 const draft=structuredClone(current.characters.find(card=>card.id===other.id)!);draft.notes='独立恢复草稿，不能被覆盖';draft.revision=13;
 await page.evaluate(async({backup,draft})=>{const request=indexedDB.open('dnd-card-standalone');await new Promise<void>(done=>request.onsuccess=()=>done());const db=request.result;await new Promise<void>((done,fail)=>{const tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents');store.put(backup,'backup');store.put(draft,'recovery:unrelated');tx.oncomplete=()=>done();tx.onerror=()=>fail(tx.error);});db.close();},{backup,draft});
 return {current,backup,draft,otherId:other.id};
}
async function restore(page:Page){
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByRole('button',{name:'读取上一次保存',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'导入与导出',exact:true})).toHaveCount(0);await expect(page.locator('.character-tabs [aria-selected=true]')).toContainText('已读取的旧备份');
}
function accepted(state:{workspace:Workspace;backup:Workspace;draft:Character},data:Awaited<ReturnType<typeof fixture>>){
 const actual=state.workspace.characters.find(card=>card.id===state.workspace.activeId)!,expected=data.backup.characters.find(card=>card.id===data.backup.activeId)!;
 expect(actual).toMatchObject({id:expected.id,name:expected.name,notes:expected.notes,revision:expected.revision,abilities:{dex:14},runtime:{tempHp:6,resources:{manual:{name:'旧版本次数',current:4,max:9}}}});
 expect(state.workspace.activeId).toBe(data.backup.activeId);expect(state.workspace.packs).toEqual(data.backup.packs);expect(state.workspace.siteSources).toEqual(data.backup.siteSources);
 expect(state.workspace.characters.find(card=>card.id===data.otherId)).toEqual(data.backup.characters.find(card=>card.id===data.otherId));expect(state.draft).toEqual(data.draft);
 expect(state.backup).toEqual(data.current);
}

test('restored backup survives editing retry with all characters and separate drafts intact',async({page})=>{
 const data=await fixture(page);await restore(page);expect((await records(page)).workspace).toEqual(data.current);
 await page.screenshot({path:test.info().outputPath('backup-accepted-unsaved.png'),fullPage:true});
 await page.unroute('**/assets/cardRuntime-*.js');await page.getByRole('button',{name:'保存后重新加载编辑功能',exact:true}).click();
 await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();await expect(page.locator('.character-tabs [aria-selected=true]')).toContainText('已读取的旧备份');accepted(await records(page),data);
 await page.reload();await expect(page.locator('.character-tabs [aria-selected=true]')).toContainText('已读取的旧备份');accepted(await records(page),data);
});

test('cancelling navigation preserves the unsaved accepted backup and disk records',async({page})=>{
 const data=await fixture(page);await restore(page);await expect(page.locator('.save-status')).toContainText('尚未保存');
 const navigation=page.waitForEvent('dialog');await page.evaluate(()=>{setTimeout(()=>location.reload(),0);});const dialog=await navigation;expect(dialog.type()).toBe('beforeunload');await dialog.dismiss();
 await expect(page.locator('.character-tabs [aria-selected=true]')).toContainText('已读取的旧备份');expect(await records(page)).toEqual({workspace:data.current,backup:data.backup,draft:data.draft});
});

test('an aborted recovery save blocks reload and keeps the accepted backup for another retry',async({page})=>{
 const data=await fixture(page);await restore(page);let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;(window as any).rejectRecoverySave=true;IDBObjectStore.prototype.put=function(value,key){if((window as any).rejectRecoverySave&&this.name==='documents'&&key==='workspace'){this.transaction.abort();throw new DOMException('authored recovery quota failure','QuotaExceededError');}return original.call(this,value,key);};});
 await page.getByRole('button',{name:'保存后重新加载编辑功能',exact:true}).click();await expect(page.locator('.save-status')).toContainText('保存失败');await expect(page.locator('.character-tabs [aria-selected=true]')).toContainText('已读取的旧备份');
 expect(navigations).toBe(0);expect(await records(page)).toEqual({workspace:data.current,backup:data.backup,draft:data.draft});await expect(page.getByRole('button',{name:'导出角色备份',exact:true})).toBeEnabled();
 await page.screenshot({path:test.info().outputPath('backup-save-aborted.png'),fullPage:true});
 await page.evaluate(()=>(window as any).rejectRecoverySave=false);await page.unroute('**/assets/cardRuntime-*.js');await page.getByRole('button',{name:'保存后重新加载编辑功能',exact:true}).click();await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();accepted(await records(page),data);
});

test('an ordinary editing retry does not rotate an unrelated backup',async({page})=>{
 const data=await fixture(page);await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await page.unroute('**/assets/cardRuntime-*.js');await page.getByRole('button',{name:'保存后重新加载编辑功能',exact:true}).click();await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();expect(await records(page)).toEqual({workspace:data.current,backup:data.backup,draft:data.draft});
});

test('rapid recovery retry clicks save the accepted backup only once',async({page})=>{
 const data=await fixture(page);await restore(page);await page.unroute('**/assets/cardRuntime-*.js');
 await page.getByRole('button',{name:'保存后重新加载编辑功能',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
 await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();accepted(await records(page),data);
});

test('a read-only tab keeps its restored preview without overwriting the writable tab',async({page,context})=>{
 const data=await fixture(page),viewer=await context.newPage();
 try{
  await mockSource(viewer,{displayMode:'default'});await suppressAnnouncement(viewer);await viewer.route('**/assets/cardRuntime-*.js',route=>route.abort('connectionreset'));await viewer.goto('/');
  await expect(viewer.locator('.editing-load-error')).toBeVisible();await expect(viewer.locator('.read-only-banner').filter({hasText:'另一标签页'})).toBeVisible();
  await restore(viewer);let navigations=0;viewer.on('framenavigated',frame=>{if(frame===viewer.mainFrame())navigations++;});
  await viewer.getByRole('button',{name:'保存后重新加载编辑功能',exact:true}).click();await expect(viewer.getByText('此标签页为只读，恢复的备份尚未保存。请先导出角色备份。',{exact:true})).toBeVisible();
  expect(navigations).toBe(0);await expect(viewer.locator('.character-tabs [aria-selected=true]')).toContainText('已读取的旧备份');expect(await records(page)).toEqual({workspace:data.current,backup:data.backup,draft:data.draft});
 }finally{await viewer.close();}
});
