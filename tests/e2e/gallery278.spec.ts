import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

for(const count of [2,4,5,7])test(`previous and both edge transitions remain continuous with ${count} cards`,async({page,request,context})=>{
 const fixture=JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8')),headers={Origin:'http://127.0.0.1:5320','X-CSRF-Token':fixture.ownerSession.csrf,Cookie:'dnd_cloud='+fixture.ownerSession.token},ids:string[]=[];
 for(let i=0;i<count;i++){const response=await request.post('/api/cards',{headers,data:{confirmUpload:true,character:{...fixture.card.character,id:crypto.randomUUID(),name:'动画连续性验收 '+i}}});expect(response.status()).toBe(201);ids.push((await response.json()).id);}
 await context.addCookies([{name:'dnd_cloud',value:fixture.ownerSession.token,url:'http://127.0.0.1:5320/api/',httpOnly:true,sameSite:'Strict'}]);
 try{
  await page.goto('/library/?q=动画连续性验收');await expect(page.locator('.cloud-gallery-item .paper')).toHaveCount(Math.min(count,5));
  const first=await page.locator('.cloud-gallery-item.is-active').getAttribute('data-card-id');
  for(const direction of [-1,1,1,-1]){
   await expect.poll(()=>page.locator('.cloud-gallery-stage').evaluate(el=>[...el.querySelectorAll('.cloud-gallery-item')].reduce((sum,node)=>sum+node.getAnimations().length,0))).toBe(0);
   const frames=await page.evaluate(async direction=>{
    const before=document.querySelector<HTMLElement>('.cloud-gallery-item.is-active')!.dataset.cardId;
    document.querySelector<HTMLButtonElement>(`button[aria-label="${direction<0?'上一张角色卡':'下一张角色卡'}"]`)!.click();
    const samples:{x:number;id:string;departures:number;paper:boolean}[]=[];
    for(let i=0;i<25;i++){await new Promise(requestAnimationFrame);const node=document.querySelector<HTMLElement>('.cloud-gallery-item.is-active')!,matrix=new DOMMatrix(getComputedStyle(node).transform);samples.push({x:matrix.m41,id:node.dataset.cardId!,departures:document.querySelectorAll('.cloud-gallery-departure').length,paper:!!node.querySelector('.paper')});}
    return {before,samples};
   },direction);
   expect(frames.samples[0].id).not.toBe(frames.before);expect(Math.sign(frames.samples[0].x)).toBe(direction);expect(Math.abs(frames.samples[0].x)).toBeGreaterThan(25);expect(Math.abs(frames.samples.at(-1)!.x)).toBeLessThan(1);
   expect(frames.samples.slice(0,8).filter(frame=>Math.abs(frame.x)>1).length).toBeGreaterThan(3);expect(frames.samples.some(frame=>frame.departures>0)).toBe(true);expect(frames.samples.every(frame=>frame.paper)).toBe(true);expect(frames.samples.at(-1)!.departures).toBe(0);
  }
  await expect(page.locator('.cloud-gallery-item.is-active')).toHaveAttribute('data-card-id',first!);
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'上一张角色卡'}).click();await expect(page.locator('.cloud-gallery-departure')).toHaveCount(0);
 }finally{for(const id of ids)expect((await request.delete('/api/cards/'+id,{headers,data:{revision:1}})).ok()).toBe(true);}
});

for(const width of [1440,390])test(`account dialog and library-only controls at ${width}px`,async({page,context})=>{
 const fixture=JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8'));
 await context.addCookies([{name:'dnd_cloud',value:(width===390?fixture.editorProfileSession:fixture.ownerSession).token,url:'http://127.0.0.1:5320/api/',httpOnly:true,sameSite:'Strict'}]);
 await page.route('**/api/session',async route=>{const response=await route.fetch(),value=await response.json();if(value.account)value.account.nickname='一位名字很长的角色卡玩家';await route.fulfill({response,json:value});});
 await page.setViewportSize({width,height:900});await page.goto('/library/');
 const trigger=page.getByRole('button',{name:'账号',exact:true});await expect(trigger).toBeVisible();await expect(page.locator('.cloud-sidebar .qq-account')).toHaveCount(0);await expect(page.getByRole('button',{name:'公告',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:/调色盘/})).toHaveCount(0);await expect(page.getByRole('button',{name:'退出登录',exact:true})).toHaveCount(0);
 const rect=(await trigger.boundingBox())!;expect(rect.x+rect.width).toBeLessThanOrEqual(width);expect(rect.width).toBeLessThanOrEqual(190);
 await trigger.click();let dialog=page.getByRole('dialog',{name:'账号',exact:true});await expect(dialog).toBeVisible();await expect(dialog.getByText('一位名字很长的角色卡玩家',{exact:true})).toBeVisible();await expect(dialog.getByText(width===390?fixture.editor.id:fixture.owner.id,{exact:true})).toBeVisible();await expect(dialog.getByRole('button',{name:'复制账号 ID'})).toBeVisible();await expect(dialog.getByRole('button',{name:'退出登录',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();if(width!==390)return;await trigger.click();dialog=page.getByRole('dialog',{name:'账号',exact:true});await dialog.getByRole('button',{name:'退出登录',exact:true}).click();await expect(page.locator('header').getByRole('link',{name:'QQ 登录',exact:true})).toBeVisible();await expect(dialog).toHaveCount(0);
});
