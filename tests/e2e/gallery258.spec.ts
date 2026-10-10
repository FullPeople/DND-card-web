import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test('wheel and continuous drag wrap; side taps select; fullscreen keeps A4 proportions and cached reads',async({page,request,context})=>{
 const fixture=JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8')),ids:string[]=[],reads:string[]=[],errors:string[]=[];
 const headers={Origin:'http://127.0.0.1:5320','X-CSRF-Token':fixture.ownerSession.csrf,Cookie:'dnd_cloud='+fixture.ownerSession.token};
 for(let i=0;i<3;i++){const response=await request.post('/api/cards',{headers,data:{character:{...fixture.card.character,id:crypto.randomUUID(),name:'循环交互验收 '+i},confirmUpload:true}});expect(response.status()).toBe(201);ids.push((await response.json()).id);}
 await context.addCookies([{name:'dnd_cloud',value:fixture.ownerSession.token,url:'http://127.0.0.1:5320/api/',httpOnly:true,sameSite:'Strict'}]);
 try{
  page.on('request',r=>{if(/\/api\/cards\/[A-Z]{6}$/.test(r.url())&&r.method()==='GET')reads.push(r.url());});page.on('pageerror',error=>errors.push(error.message));await page.goto('/library/?q=循环交互验收');const active=page.locator('.cloud-gallery-item.is-active'),stage=page.locator('.cloud-gallery-stage'),full=page.getByRole('dialog',{name:'全屏角色卡'});await expect(active.locator('.paper')).toBeVisible();await expect.poll(()=>reads.length).toBe(3);const first=(await active.getAttribute('data-card-id'))!;
  await stage.hover();for(let i=0;i<9;i++){const previous=await active.getAttribute('data-card-id');await page.mouse.wheel(0,70);await expect(active).not.toHaveAttribute('data-card-id',previous!);}await expect(active).toHaveAttribute('data-card-id',first);await expect(full).toHaveCount(0);
  const side=page.locator('.cloud-gallery-item[data-offset="1"] .cloud-gallery-open');
  await expect.poll(()=>stage.evaluate(el=>[...el.querySelectorAll('.cloud-gallery-item')].reduce((count,item)=>count+item.getAnimations().length,0))).toBe(0);
  // The gallery also animates with requestAnimationFrame; getAnimations() alone
  // does not establish that the side card has reached its visible position.
  const sidePoint=()=>side.evaluate(el=>{const r=el.getBoundingClientRect(),y=(r.top+r.bottom)/2;for(let x=Math.min(r.right-8,innerWidth-8);x>r.left;x-=6)if(document.elementFromPoint(x,y)===el)return {x,y};});
  await expect.poll(sidePoint,{message:'side card must expose a clickable area'}).toBeDefined();
  const sideId=await side.locator('..').getAttribute('data-card-id'),point=(await sidePoint())!;await page.mouse.click(point.x,point.y);await expect(active).toHaveAttribute('data-card-id',sideId!);await expect(full).toHaveCount(0);
  await page.evaluate(()=>{(window as any).dragCards=[];new MutationObserver(()=>{const id=document.querySelector('.cloud-gallery-item.is-active')?.getAttribute('data-card-id');if(id&&(window as any).dragCards.at(-1)!==id)(window as any).dragCards.push(id);}).observe(document.querySelector('.cloud-gallery-stage')!,{subtree:true,attributes:true,attributeFilter:['class']});});
  const box=(await stage.boundingBox())!;await page.mouse.move(box.x+box.width*.86,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+20,box.y+box.height*.5,{steps:40});await page.mouse.up();await expect(full).toHaveCount(0);expect(new Set(await page.evaluate(()=>(window as any).dragCards)).size).toBeGreaterThanOrEqual(3);
  const card=(await active.locator('.cloud-gallery-open').boundingBox())!;await page.mouse.move(card.x+card.width*.5,card.y+card.height*.5);await page.mouse.down();await page.mouse.move(card.x+card.width*.5+7,card.y+card.height*.5);await page.mouse.up();await expect(full).toHaveCount(0);
  await active.locator('.cloud-gallery-open').click();await expect(full).toBeVisible();const ratios=await full.locator('.paper').evaluate(async el=>{const samples:number[]=[];for(let i=0;i<20;i++){await new Promise(requestAnimationFrame);const r=el.getBoundingClientRect();samples.push(r.width/r.height);}return samples;});for(const ratio of ratios)expect(ratio).toBeCloseTo(210/297,2);
  for(const name of ['主要','特性','背景','法术','背包']){await full.getByRole('tab',{name,exact:true}).click();await expect(full.getByRole('tabpanel',{name,exact:true})).toBeVisible();}await full.getByRole('button',{name:'返回画廊',exact:true}).click();await expect(full).toHaveCount(0);expect(reads).toHaveLength(3);
  await page.setViewportSize({width:390,height:844});await stage.hover();const before=await active.getAttribute('data-card-id');await page.mouse.wheel(0,-70);await expect(active).not.toHaveAttribute('data-card-id',before!);await expect(active.locator('.paper')).toBeVisible();expect(reads).toHaveLength(3);expect(errors).toEqual([]);await page.screenshot({path:test.info().outputPath('gallery-mobile-a4.png')});
 }finally{if(!page.isClosed())for(const id of ids)expect((await request.delete('/api/cards/'+id,{headers,data:{revision:1}})).ok()).toBe(true);}
});
