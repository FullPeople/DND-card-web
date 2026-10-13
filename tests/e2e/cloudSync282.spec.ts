import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {mockSource,suppressAnnouncement} from './fixtures';
const base='http://127.0.0.1:5320';
test.setTimeout(120000);
test('QQ account imports in place, receives inactive cards and mirrors to a second tab',async({page,context,request})=>{
 const f=JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8')),headers={Origin:base,Cookie:'dnd_cloud='+f.ownerSession.token,'X-CSRF-Token':f.ownerSession.csrf};
 await context.addCookies([{name:'dnd_cloud',value:f.ownerSession.token,url:base+'/api/',httpOnly:true,sameSite:'Strict'}]);
 const response=await request.post('/api/cards',{headers,data:{character:{...f.card.character,id:crypto.randomUUID(),name:'二级弹窗导入验收'},confirmUpload:true}});expect(response.status()).toBe(201);const card=await response.json();
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/card/?intro=0');
 await page.getByRole('button',{name:'账号',exact:true}).click();const account=page.getByRole('dialog',{name:'账号',exact:true}),row=account.locator('.qq-card-picker-list>div').filter({hasText:card.id});
 await row.getByRole('button',{name:'导入当前场景',exact:true}).click();await expect(account).toContainText('已导入当前场景');await account.getByRole('button',{name:'关闭账号弹窗'}).click();
 const name=page.getByRole('textbox',{name:'角色姓名',exact:true});await expect(name).toHaveValue(card.character.name);expect(page.url()).toBe(base+'/card/?intro=0');expect(page.frames()).toHaveLength(1);await expect(page.getByRole('button',{name:'云端卡设置',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'账号',exact:true}).click();await account.locator('.qq-card-picker-list>div').filter({hasText:card.id}).getByRole('button',{name:'导入当前场景',exact:true}).click();await account.getByRole('button',{name:'关闭账号弹窗'}).click();
 const count=()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('dnd-card-standalone',1);r.onsuccess=()=>resolve(r.result);});const tx=db.transaction('documents','readonly'),value=await new Promise<any>(resolve=>{const r=tx.objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result);});db.close();return value.characters.length;});expect(await count()).toBe(2);
 const second=await context.newPage();await mockSource(second);await suppressAnnouncement(second);await second.goto('/card/?intro=0');await expect(second.getByRole('textbox',{name:'角色姓名',exact:true})).toHaveValue(card.character.name);
 const updated=await request.put('/api/cards/'+card.id,{headers,data:{revision:card.revision,character:{...card.character,name:'另一端自动传来的名字',notes:'其他端笔记',runtime:{...card.character.runtime,hp:8}},confirmUpload:true}});expect(updated.status()).toBe(200);
 await expect(name).toHaveValue('另一端自动传来的名字',{timeout:20000});await expect(second.getByRole('textbox',{name:'角色姓名',exact:true})).toHaveValue('另一端自动传来的名字');
 if(await page.getByRole('switch',{name:'编辑模式'}).getAttribute('aria-checked')!=='true')await page.getByRole('switch',{name:'编辑模式'}).click();await name.fill('接收后继续自动写回');
 await expect.poll(async()=>(await(await request.get('/api/cards/'+card.id,{headers})).json()).character.name).toBe('接收后继续自动写回');
 const remote=await(await request.get('/api/cards/'+card.id,{headers})).json();expect(remote.character.id).toBe(card.character.id);expect(remote.character.notes).toBe('其他端笔记');expect(remote.character.runtime.hp).toBe(8);
 await page.getByRole('tab',{name:/未命名的冒险者/}).first().click();
 expect((await request.put('/api/cards/'+card.id,{headers,data:{revision:remote.revision,character:{...remote.character,name:'未选中卡也接收更新'},confirmUpload:true}})).status()).toBe(200);
 await expect(page.getByRole('tab',{name:/未选中卡也接收更新/})).toBeVisible({timeout:20000});await page.getByRole('tab',{name:/未选中卡也接收更新/}).click();await expect(name).toHaveValue('未选中卡也接收更新');
 await page.getByRole('button',{name:'账号',exact:true}).click();await page.screenshot({path:test.info().outputPath('qq-card-picker.png')});await account.getByRole('button',{name:'关闭账号弹窗'}).click();
 await second.close();const latest=await(await request.get('/api/cards/'+card.id,{headers})).json();await request.delete('/api/cards/'+card.id,{headers,data:{revision:latest.revision}});
});
test('independent room and standalone pages exchange edits through the original cloud card',async({page,context,request,browser})=>{
 const f=JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8')),headers={Origin:base,Cookie:'dnd_cloud='+f.ownerSession.token,'X-CSRF-Token':f.ownerSession.csrf};
 await context.addCookies([{name:'dnd_cloud',value:f.ownerSession.token,url:base+'/api/',httpOnly:true,sameSite:'Strict'}]);
 const created=await request.post('/api/cards',{headers,data:{character:{...f.card.character,id:crypto.randomUUID(),name:'网站与房间互相同步'},confirmUpload:true}}),card=await created.json();expect(created.status()).toBe(201);
 const room=await(await request.post('/api/cards/'+card.id+'/rooms',{headers,data:{room:'two-independent-contexts',confirmRoomSync:true}})).json();expect((await request.put('/api/room-cards/'+room.id+'/lock',{headers,data:{locked:false}})).status()).toBe(200);
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/card/?intro=0');await page.getByRole('button',{name:'账号',exact:true}).click();const account=page.getByRole('dialog',{name:'账号',exact:true});await account.locator('.qq-card-picker-list>div').filter({hasText:card.id}).getByRole('button',{name:'导入当前场景',exact:true}).click();await expect(account).toContainText('已导入当前场景');await account.getByRole('button',{name:'关闭账号弹窗'}).click();
 const roomContext=await browser.newContext();try{
  const roomPage=await roomContext.newPage();await mockSource(roomPage);await suppressAnnouncement(roomPage);
  await roomPage.route('https://dnd.center/api/**',async route=>{const original=route.request(),url=new URL(original.url()),response=await roomContext.request.fetch(base+url.pathname+url.search,{method:original.method(),headers:{...original.headers(),Origin:base},data:original.postData()||undefined});await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':base}});});
  await roomPage.goto(base+'/card/?intro=0&qqRoom='+room.id+'#cap='+room.capability);const roomName=roomPage.getByRole('textbox',{name:'角色姓名',exact:true}),websiteName=page.getByRole('textbox',{name:'角色姓名',exact:true});await expect(roomName).toHaveValue(card.character.name);
  for(const target of [roomPage,page])if(await target.getByRole('switch',{name:'编辑模式'}).getAttribute('aria-checked')!=='true')await target.getByRole('switch',{name:'编辑模式'}).click();
  await roomName.fill('房间编辑自动传到网站');await page.bringToFront();await expect(websiteName).toHaveValue('房间编辑自动传到网站',{timeout:20000});
  await websiteName.fill('网站编辑自动传到房间');await roomPage.bringToFront();await expect(roomName).toHaveValue('网站编辑自动传到房间',{timeout:20000});
  const remote=await(await request.get('/api/cards/'+card.id,{headers})).json();expect(remote.character.id).toBe(card.character.id);expect(remote.character.runtime.resources.custom.current).toBe(2);
  expect((await request.put('/api/room-cards/'+room.id+'/lock',{headers,data:{locked:true}})).status()).toBe(200);
  const restricted=await(await roomContext.request.get(base+'/api/room-cards/'+room.id,{headers:{Origin:base,'X-Room-Capability':room.capability}})).json();expect(restricted.owner).toBe(false);expect(restricted.locked).toBe(true);expect(restricted.write).toBe(false);
  await roomPage.bringToFront();await expect(roomPage.getByRole('switch',{name:'编辑模式'})).toBeDisabled({timeout:10000});await expect(roomPage.locator('.card-permission-banner').first()).toContainText('房间卡已锁定');await expect(page.getByRole('switch',{name:'编辑模式'})).toBeEnabled();
 }finally{for(const roomPage of roomContext.pages())await roomPage.unrouteAll({behavior:'ignoreErrors'});await roomContext.close();const latest=await(await request.get('/api/cards/'+card.id,{headers})).json();await request.delete('/api/cards/'+card.id,{headers,data:{revision:latest.revision}});}
});
test('foreground invalidation keeps editing disabled after an old GET until a new authorization GET completes',async({page})=>{
 const f=JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8')),id=crypto.randomUUID(),state={id,cardId:'synthetic-original',revision:1,locked:false,owner:false,write:true,character:{...f.card.character,id:crypto.randomUUID(),name:'前台核验回归'}};
 let stage='normal',releaseOld:(()=>void)|undefined,releaseNew:(()=>void)|undefined;const events:{stage:string;at:number}[]=[];
 await mockSource(page);await suppressAnnouncement(page);
 await page.route('https://dnd.center/api/**',async route=>{
  const url=new URL(route.request().url());if(url.pathname==='/api/changes'){await new Promise(resolve=>setTimeout(resolve,400));await route.fulfill({json:{accountId:null,cursor:'a'.repeat(64),changed:false}});return;}
  if(url.pathname.startsWith('/api/room-cards/')){
   const captured={...state,...url.searchParams.has('since')?{unchanged:true,character:undefined}:{}};
   if(stage==='hold-old'){events.push({stage:'old GET started',at:Date.now()});await new Promise<void>(resolve=>releaseOld=resolve);}
   else if(stage==='hold-new'){events.push({stage:'new GET started',at:Date.now()});await new Promise<void>(resolve=>releaseNew=resolve);}
   await route.fulfill({json:captured});return;
  }
  await route.fulfill({json:{authenticated:false}});
 });
 try{
  await page.goto(base+'/card/?intro=0&qqRoom='+id+'#cap=synthetic-proof');const edit=page.getByRole('switch',{name:'编辑模式'});await expect(edit).toBeEnabled();
  stage='hold-old';await expect.poll(()=>!!releaseOld,{timeout:5000}).toBe(true);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(edit).toBeDisabled();events.push({stage:'foreground checking disables editor',at:Date.now()});
  stage='hold-new';releaseOld!();await expect.poll(()=>!!releaseNew).toBe(true);await expect(edit).toBeDisabled();events.push({stage:'old GET cannot reopen editor',at:Date.now()});
  stage='normal';releaseNew!();await expect(edit).toBeEnabled();events.push({stage:'new GET verifies editor',at:Date.now()});const result=JSON.stringify({events,syntheticHTTP:true,realQQ:false,realRoom:false},null,2);writeFileSync('evidence/foreground-authorization-events.json',result+'\n');await test.info().attach('foreground-authorization-events',{body:result,contentType:'application/json'});
 }finally{releaseOld?.();releaseNew?.();await page.unrouteAll({behavior:'ignoreErrors'});}
});
