import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mockSource,suppressAnnouncement} from './fixtures';
const base='http://127.0.0.1:5320';
const fixture=()=>JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8'));
async function signIn(context:any,role='owner'){await context.addCookies([{name:'dnd_cloud',value:fixture()[role+'Session'].token,url:base+'/api/',httpOnly:true,sameSite:'Strict'}]);}
test('signed-in library, account switching and logout clear cards and owner controls',async({page,context})=>{
  await signIn(context);await suppressAnnouncement(page);await page.goto('/library/');await expect(page.getByRole('button',{name:'我的卡库',exact:true})).toBeVisible();
  await expect(page.locator('.cloud-sidebar-warning')).toContainText('个人卡库');await expect(page.locator('.cloud-gallery-item.is-active .paper')).toBeVisible();
  await page.getByRole('button',{name:'管理这张卡'}).click();await expect(page.getByLabel('编辑者账号 ID')).toBeVisible();
  await signIn(context,'editor');await page.getByRole('button',{name:'刷新卡库',exact:true}).click();await expect(page.getByRole('dialog',{name:'管理云端角色卡'})).toHaveCount(0);await expect(page.getByRole('button',{name:'管理这张卡'})).toHaveCount(0);
  const buttons=page.getByRole('button',{name:'退出登录',exact:true});await buttons.first().click();await expect(page.locator('header').getByRole('link',{name:'QQ 登录',exact:true})).toBeVisible();await expect(page.locator('.cloud-gallery-item')).toHaveCount(0);
});
test('QQ connection remains usable when the provider has removed window.opener',async({page,request,context})=>{
  const verifier='p'.repeat(43),challenge=createHash('sha256').update(verifier).digest('base64url'),start=await request.post('/api/plugin/start',{headers:{Origin:base},data:{challenge}}),{connection}=await start.json();
  await signIn(context);await page.goto('/library/?'+new URLSearchParams({pluginAuth:'1',origin:base,challenge,nonce:'n'.repeat(43),connection}));
  expect(await page.evaluate(()=>window.opener)).toBeNull();await page.getByRole('button',{name:'连接当前账号'}).click();await expect(page.getByRole('status')).toContainText('已连接');
  const result=await request.post('/api/plugin/poll',{headers:{Origin:base},data:{connection,verifier}});expect(result.status()).toBe(200);const {token}=await result.json();
  expect((await(await request.get('/api/session',{headers:{Origin:base,Authorization:'Bearer '+token}})).json()).account.id).toBe(fixture().owner.id);
});
test('room five-page editor writes the original, preserves a conflict draft and obeys relock',async({page,request})=>{
  const f=fixture(),h={Origin:base,Cookie:'dnd_cloud='+f.ownerSession.token,'X-CSRF-Token':f.ownerSession.csrf};
  const created=await request.post('/api/cards',{headers:h,data:{character:{...f.card.character,id:crypto.randomUUID(),name:'QQ 房间自动同步验收'},confirmUpload:true}}),card=await created.json();expect(created.status()).toBe(201);
  const verifier='r'.repeat(43),challenge=createHash('sha256').update(verifier).digest('base64url'),start=await request.post('/api/plugin/start',{headers:{Origin:base},data:{challenge}}),{connection}=await start.json();
  await request.post('/api/plugin/authorize',{headers:h,data:{origin:base,challenge,connection}});const auth=await(await request.post('/api/plugin/poll',{headers:{Origin:base},data:{connection,verifier}})).json();
  const room=await(await request.post('/api/cards/'+card.id+'/rooms',{headers:h,data:{room:'browser-fixture',confirmRoomSync:true}})).json(),path='/api/room-cards/'+room.id;
  await request.put(path+'/lock',{headers:h,data:{locked:false}});
  await page.addInitScript(value=>localStorage.setItem('dnd-qq-plugin',JSON.stringify(value)),{...auth,accountId:f.owner.id,csrf:f.ownerSession.csrf});
  await page.route('https://dnd.center/api/**',async route=>{const original=route.request(),url=new URL(original.url()),response=await request.fetch(base+url.pathname,{method:original.method(),headers:{...original.headers(),Origin:base},data:original.postData()||undefined});await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':base}});});
  await mockSource(page);await suppressAnnouncement(page);await page.goto('/card/?intro=0&qqRoom='+room.id+'#cap='+room.capability);
  const edit=page.getByRole('switch',{name:'编辑模式'});if(await edit.getAttribute('aria-checked')!=='true')await edit.click();
  const name=page.getByRole('textbox',{name:'角色姓名',exact:true});await expect(name).toHaveValue('QQ 房间自动同步验收');await name.fill('房间保存已写回');
  await expect.poll(async()=>(await(await request.get('/api/cards/'+card.id,{headers:h})).json()).character.name).toBe('房间保存已写回');
  for(const tab of ['主要','特性','背景','法术','背包']){await page.getByRole('tab',{name:tab,exact:true}).click();await expect(page.locator('.paper')).toBeVisible();}
  await page.getByRole('tab',{name:'主要',exact:true}).click();
  let conflict=true;await page.route('https://dnd.center'+path,async route=>{if(conflict&&route.request().method()==='PUT')await route.fulfill({status:409,headers:{'access-control-allow-origin':base},contentType:'application/json',body:JSON.stringify({message:'云端卡已被其他人修改。本机草稿保留。'})});else await route.fallback();});
  await name.fill('应保留的冲突草稿');await expect(page.locator('.save-status')).toContainText('保存失败');await page.reload();await expect(name).toHaveValue('应保留的冲突草稿');
  conflict=false;page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'核对云端版本'}).click();await expect(name).toHaveValue('房间保存已写回');
  // Remove the owner's token: the same room participant can edit only while unlocked.
  await page.evaluate(()=>localStorage.removeItem('dnd-qq-plugin'));await request.put(path+'/lock',{headers:h,data:{locked:true}});await expect(page.locator('.read-only-banner')).toContainText('房间卡已锁定');
  await page.screenshot({path:test.info().outputPath('qq-room-five-page.png')});
  const current=await(await request.get('/api/cards/'+card.id,{headers:h})).json();await request.delete(path,{headers:h});await request.delete('/api/cards/'+card.id,{headers:h,data:{revision:current.revision}});
});
