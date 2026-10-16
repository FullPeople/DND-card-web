import {expect,test} from '@playwright/test';
import {newCharacter} from '../../src/core/model';
import {mockSource,suppressAnnouncement} from './fixtures';
test('paused cloud entrypoints preserve the existing workspace and session without API requests',async({page,context})=>{
 const apiRequests:string[]=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apiRequests.push(r.url());});
 await context.addCookies([{name:'dnd_cloud',value:'synthetic-preserved-session',url:'http://127.0.0.1:5320/api/',httpOnly:true,sameSite:'Strict'}]);await page.goto('/');
 const c=newCharacter();c.name='暂停入口原有本机角色';const workspace={schemaVersion:1,characters:[c],activeId:c.id,packs:[]};
 await page.evaluate(async workspace=>{const request=indexedDB.open('dnd-card-standalone',1);request.onupgradeneeded=()=>{request.result.createObjectStore('documents');request.result.createObjectStore('cache');};const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put(workspace,'workspace');await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();},workspace);
 for(const path of ['/card/?cloud=synthetic','/library/','/library/?pluginAuth=1']){await page.goto(path);await expect(page.getByRole('heading',{name:'云端功能已暂停',exact:true})).toBeVisible();}
 const saved=await page.evaluate(async()=>{const request=indexedDB.open('dnd-card-standalone',1);const db=await new Promise<IDBDatabase>(resolve=>request.onsuccess=()=>resolve(request.result));try{return await new Promise(resolve=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result);});}finally{db.close();}});
 expect(saved).toEqual(workspace);expect((await context.cookies()).find(c=>c.name==='dnd_cloud')?.value).toBe('synthetic-preserved-session');expect(apiRequests).toEqual([]);
});
test('the production card remains usable while login and real HTTP cloud endpoints are paused',async({page,request})=>{
 const health=await request.get('/api/health');expect(health.status()).toBe(200);expect(await health.json()).toMatchObject({cloudFeaturesEnabled:false,qqLogin:'disabled',accountPrivate:true,accountLibrariesPrivate:true,temporaryUpload:false});
 for(const endpoint of ['/api/session','/api/cards','/api/auth/qq/login']){const response=await request.get(endpoint);expect(response.status()).toBe(503);expect(await response.json()).toMatchObject({error:'cloud_disabled'});}
 const apiRequests:string[]=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apiRequests.push(r.url());});await mockSource(page);await suppressAnnouncement(page);await page.goto('/card/?intro=0');await expect(page.getByRole('button',{name:'导入 / 导出',exact:true})).toBeEnabled();await expect(page.locator('header').getByRole('link',{name:'QQ 登录',exact:true})).toHaveCount(0);expect(apiRequests).toEqual([]);
});
