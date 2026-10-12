import {test,expect,type Page} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {mockSource,suppressAnnouncement} from './fixtures';
const base='http://127.0.0.1:5320';
const output=resolve(process.env.NOTIFICATION_TIMING_FILE||'../evidence/notification-browser-timing.json');
async function importOwn(page:Page,id:string){
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/card/?intro=0');await page.getByRole('button',{name:'账号',exact:true}).click();
 const account=page.getByRole('dialog',{name:'账号',exact:true});await account.locator('.qq-card-picker-list>div').filter({hasText:id}).getByRole('button',{name:'导入当前场景',exact:true}).click();await expect(account).toContainText('已导入当前场景');await account.getByRole('button',{name:'关闭账号弹窗'}).click();
}
test('two independent standalone contexts receive committed changes through a bounded wait',async({page,context,browser,request})=>{
 const f=JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8')),headers={Origin:base,Cookie:'dnd_cloud='+f.ownerSession.token,'X-CSRF-Token':f.ownerSession.csrf};
 await context.addCookies([{name:'dnd_cloud',value:f.ownerSession.token,url:base+'/api/',httpOnly:true,sameSite:'Strict'}]);
 const created=await request.post('/api/cards',{headers,data:{character:{...f.card.character,id:crypto.randomUUID(),name:'Notification fixture'},confirmUpload:true}});expect(created.status()).toBe(201);let card=await created.json();
 const second=await browser.newContext({viewport:{width:1440,height:960}}),samples:{iteration:number;serverMs:number;bothVisibleMs:number}[]=[];
 try{
  await second.addCookies([{name:'dnd_cloud',value:f.ownerSession.token,url:base+'/api/',httpOnly:true,sameSite:'Strict'}]);const peer=await second.newPage();
  await importOwn(page,card.id);await importOwn(peer,card.id);await expect(page.getByRole('textbox',{name:'角色姓名',exact:true})).toHaveValue(card.character.name);
  for(let iteration=0;iteration<6;iteration++){
   const arrived=[page,peer].map(target=>target.waitForResponse(async response=>response.url().endsWith('/api/changes')&&!!response.request().postDataJSON()?.cursor&&response.status()===200&&(await response.json()).changed===true));
   const name='Notification round '+iteration,start=performance.now(),saved=await request.put('/api/cards/'+card.id,{headers,data:{revision:card.revision,character:{...card.character,name},confirmUpload:true}});expect(saved.status()).toBe(200);card=await saved.json();const serverMs=performance.now()-start;
   await Promise.all(arrived);await expect(page.getByRole('textbox',{name:'角色姓名',exact:true})).toHaveValue(name,{timeout:1500});await expect(peer.getByRole('textbox',{name:'角色姓名',exact:true})).toHaveValue(name,{timeout:1500});samples.push({iteration,serverMs,bothVisibleMs:performance.now()-start});
  }
 }finally{
  writeFileSync(output,JSON.stringify({at:new Date().toISOString(),samples,boundary:'Functional notification timing in two disposable independent Chrome contexts, synthetic QQ identity and local SQLite API; six rounds, not P95 or real player acceptance'},null,2)+'\n');await second.close();
  const latest=await(await request.get('/api/cards/'+card.id,{headers})).json();await request.delete('/api/cards/'+card.id,{headers,data:{revision:latest.revision}});
 }
});

test('QQ picker and private gallery update a name without reopening or manual refresh',async({page,context,browser,request})=>{
 const f=JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8')),headers={Origin:base,Cookie:'dnd_cloud='+f.ownerSession.token,'X-CSRF-Token':f.ownerSession.csrf};
 await context.addCookies([{name:'dnd_cloud',value:f.ownerSession.token,url:base+'/api/',httpOnly:true,sameSite:'Strict'}]);
 const created=await request.post('/api/cards',{headers,data:{character:{...f.card.character,id:crypto.randomUUID(),name:'Picker before notification'},confirmUpload:true}});expect(created.status()).toBe(201);const card=await created.json();
 const galleryContext=await browser.newContext();
 try{
  await mockSource(page);await suppressAnnouncement(page);await page.goto('/card/?intro=0');await page.getByRole('button',{name:'账号',exact:true}).click();
  const row=page.locator('.qq-card-picker-list>div').filter({hasText:card.id});await expect(row).toContainText(card.character.name);
  await galleryContext.addCookies([{name:'dnd_cloud',value:f.ownerSession.token,url:base+'/api/',httpOnly:true,sameSite:'Strict'}]);const gallery=await galleryContext.newPage();await gallery.goto('/library/');await expect(gallery.locator('.cloud-card-stack')).toContainText(card.character.name);
  const name='Picker after notification',start=performance.now();const saved=await request.put('/api/cards/'+card.id,{headers,data:{revision:card.revision,character:{...card.character,name},confirmUpload:true}});expect(saved.status()).toBe(200);
  await expect(row).toContainText(name,{timeout:1500});await expect(gallery.locator('.cloud-card-stack')).toContainText(name,{timeout:1500});
  writeFileSync(output+'.picker.json',JSON.stringify({at:new Date().toISOString(),bothVisibleMs:performance.now()-start,boundary:'One local functional round, synthetic identity; not production timing or real QQ acceptance'},null,2)+'\n');
 }finally{await galleryContext.close();const latest=await(await request.get('/api/cards/'+card.id,{headers})).json();await request.delete('/api/cards/'+card.id,{headers,data:{revision:latest.revision}});}
});
