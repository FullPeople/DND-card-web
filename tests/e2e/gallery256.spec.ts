import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const fixture=()=>JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8'));

test('incognito circular gallery shares its renderer, bounds reads and fits the whole A4',async({page,request})=>{
 const data=fixture(),ids:string[]=[],reads:string[]=[],errors:string[]=[];
 const headers={Origin:'http://127.0.0.1:5320','X-CSRF-Token':data.ownerSession.csrf,Cookie:'dnd_cloud='+data.ownerSession.token};
 for(let i=0;i<3;i++){const response=await request.post('/api/cards',{headers,data:{character:{...data.card.character,id:crypto.randomUUID(),name:'画廊验收 '+i},confirmUpload:true}});expect(response.status()).toBe(201);ids.push((await response.json()).id);}
 try{
  await page.addInitScript(()=>{(window as any).databaseOpens=0;const open=indexedDB.open.bind(indexedDB);indexedDB.open=((...args:any[])=>{(window as any).databaseOpens++;return (open as any)(...args);}) as typeof indexedDB.open;});
  page.on('request',r=>{if(/\/api\/cards\/[A-Z]{6}$/.test(r.url())&&r.method()==='GET')reads.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/library/?q=画廊验收');const active=page.locator('.cloud-gallery-item.is-active');await expect(active.locator('.paper')).toBeVisible();
  const warning=page.locator('.cloud-sidebar-warning');await expect(warning.locator('h2')).toHaveText('所有人都可以在云端看到所有卡。');await expect(warning.locator('p')).toHaveText('请勿上传私人信息，同一个 IP 最多上传 10 张；共用网络的人共享额度。临时上传无需登录，只有原上传浏览器可以修改或删除；清除 Cookie 或更换设备可能失去管理权限。');
  expect(await warning.evaluate(el=>el.getBoundingClientRect().top>el.previousElementSibling!.getBoundingClientRect().bottom)).toBe(true);
  expect(page.frames()).toHaveLength(1);expect(await page.evaluate(()=>(window as any).databaseOpens)).toBe(0);
  const first=await active.getAttribute('data-card-id');
  for(let i=0;i<3;i++){await page.getByRole('button',{name:'下一张角色卡'}).click();await expect(active.locator('.paper')).toBeVisible();await page.waitForTimeout(80);}
  await expect(active).toHaveAttribute('data-card-id',first!);expect(new Set(reads).size).toBe(3);expect(reads).toHaveLength(3);
  await active.getByRole('tab',{name:'背景',exact:true}).click();await expect(active.locator('.paper')).toContainText('云端五页故事');
  for(const name of ['主要','特性','背景','法术','背包']){await active.getByRole('tab',{name,exact:true}).click();await expect(active.getByRole('tabpanel',{name,exact:true})).toBeVisible();}
  await active.getByRole('tab',{name:'主要',exact:true}).click();await page.screenshot({path:test.info().outputPath('circular-gallery-desktop.png')});
  for(const size of [{width:1440,height:960},{width:390,height:844}]){
   await page.setViewportSize(size);await page.waitForTimeout(600);
   const fit=await active.locator('.paper').evaluate(el=>{const p=el.getBoundingClientRect(),s=el.closest('.cloud-gallery-stage')!.getBoundingClientRect();return p.top>=s.top-1&&p.bottom<=s.bottom+1&&p.left>=s.left-1&&p.right<=s.right+1;});expect(fit).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.screenshot({path:test.info().outputPath('circular-gallery-mobile.png')});await page.setViewportSize({width:1440,height:960});await page.waitForTimeout(600);
  const bounds=await active.locator('.paper').boundingBox();await page.mouse.move(bounds!.x+bounds!.width*.65,bounds!.y+bounds!.height*.6);await page.mouse.down();await page.mouse.move(bounds!.x+bounds!.width*.65-130,bounds!.y+bounds!.height*.6,{steps:10});await page.mouse.up();await expect(active).not.toHaveAttribute('data-card-id',first!);
  await page.emulateMedia({reducedMotion:'reduce'});expect(await active.evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');expect(errors).toEqual([]);
 }finally{for(const id of ids)expect((await request.delete('/api/cards/'+id,{headers,data:{revision:1}})).ok()).toBe(true);}
});

test('a removed directory entry refreshes rather than stranding an anonymous reader at HTTP 404',async({page})=>{
 let first=true;await page.route('**/api/cards?offset=0',async route=>{const response=await route.fetch(),data=await response.json();if(first){first=false;data.cards.unshift({id:'AAAAAA',revision:1,name:'已删除的临时验收卡',edition:'2024',updatedAt:new Date().toISOString()});}await route.fulfill({response,json:data});});
 await page.goto('/library/');await expect(page.locator('.cloud-message')).toContainText('已删除或不存在');await expect(page.locator('.cloud-gallery-item.is-active .paper')).toBeVisible();await expect(page.locator('.cloud-gallery-item[data-card-id=AAAAAA]')).toHaveCount(0);await expect(page.getByText('角色读取失败（HTTP 404）',{exact:false})).toHaveCount(0);
 await page.goto('/card/?legacyViewer=1&cloud=AAAAAA');await expect(page.getByRole('alert')).toHaveText('这张云端卡已删除或不存在。请返回角色卡库刷新列表。');await expect(page.getByRole('link',{name:'返回角色卡库'})).toHaveAttribute('href','/library/');
});
