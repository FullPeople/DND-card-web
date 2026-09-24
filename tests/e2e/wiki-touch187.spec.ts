import {test,expect,type Page,type Locator} from '@playwright/test';
import {mockSource} from './fixtures';

async function setup(page:Page,phone:boolean){
  await mockSource(page);
  await page.route('**/data/spells/spells-test.json',route=>route.fulfill({json:{spell:Array.from({length:80},(_,i)=>({name:i===0?'微光术':`练习法术${String(i).padStart(2,'0')}`,source:'XPHB',level:0,entries:['原创触摸测试正文。']}))}}));
  await page.goto('./');
  if(phone)await page.getByRole('switch',{name:'编辑模式'}).tap();
  if(phone)await page.getByRole('navigation',{name:'工作区'}).getByRole('button',{name:'Wiki',exact:true}).tap();
  await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
  await page.evaluate(()=>{(window as any).dragStarts=0;window.addEventListener('card-drag-start',()=>{(window as any).dragStarts++;});});
}
async function center(locator:Locator){const b=await locator.boundingBox();expect(b).not.toBeNull();return {x:b!.x+b!.width/2,y:b!.y+b!.height/2};}
async function finger(page:Page){
  const cdp=await page.context().newCDPSession(page);
  return {down:async(p:{x:number;y:number})=>cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1,radiusX:4,radiusY:4}]}),move:async(p:{x:number;y:number})=>cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1,radiusX:4,radiusY:4}]}),up:async()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}),cancel:async()=>cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}),two:async(p:{x:number;y:number})=>cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1},{x:p.x+45,y:p.y,id:2}]})};
}
async function swipe(page:Page,start:{x:number;y:number},dy:number){const touch=await finger(page);await touch.down(start);for(let i=1;i<=12;i++){await touch.move({x:start.x,y:start.y+dy*i/12});await page.waitForTimeout(16);}await touch.up();}
test('phone catalog swipes scroll without selecting, dragging or changing panels; a following tap works',async({page},info)=>{
  test.skip(info.project.name!=='phone');await setup(page,true);await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'法术',exact:true}).tap();
  const list=page.locator('.catalog-list');await expect(list).toHaveAttribute('data-total-rows','80');
  for(let i=0;i<3;i++){
    const b=(await list.boundingBox())!,before=await list.evaluate(el=>el.scrollTop);const p={x:b.x+65,y:b.y+b.height-27};await swipe(page,p,-90);
    await expect.poll(()=>list.evaluate(el=>el.scrollTop)).toBeGreaterThan(before+20);await expect(page.locator('.pointer-ghost')).toHaveCount(0);await expect(page.locator('.catalog-row.active')).toHaveCount(0);
  }
  expect(await page.evaluate(()=>(window as any).dragStarts)).toBe(0);await expect(page.locator('.wiki-pane')).toHaveClass(/mobile-active/);
  // Stop inertia and choose the row under an actual finger, not an off-screen virtual row.
  const b=(await list.boundingBox())!,p={x:b.x+65,y:b.y+b.height/2};await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(60);await page.touchscreen.tap(p.x,p.y);
  await expect(page.locator('.detail-title')).toBeVisible();await expect(page.getByRole('tooltip')).toHaveCount(0);
});
test('phone document title and inline-reference swipes keep reading without ghost, collapse or tooltip',async({page},info)=>{
  test.skip(info.project.name!=='phone');await setup(page,true);await page.locator('.catalog-row').filter({hasText:'测试法师'}).first().tap();
  const article=page.locator('.entry-detail');await expect(article).toBeVisible();
  await swipe(page,await center(article.locator('.detail-title')),-65);await expect.poll(()=>article.evaluate(el=>el.scrollTop)).toBeGreaterThan(10);expect(await page.evaluate(()=>(window as any).dragStarts)).toBe(0);
  await article.evaluate(el=>{el.scrollTop=0;});const reference=article.locator('.inline-reference').filter({hasText:'微光术'}).first();await reference.scrollIntoViewIfNeeded();
  const before=await article.evaluate(el=>el.scrollTop);await swipe(page,await center(reference),-70);await expect.poll(()=>article.evaluate(el=>el.scrollTop)).toBeGreaterThan(before+10);
  await expect(article.locator('.detail-title')).toContainText('测试法师');await expect(page.getByRole('tooltip')).toHaveCount(0);await expect(page.locator('.wiki-pane')).toHaveClass(/mobile-active/);
  await page.screenshot({path:'test-results/touch187/phone-reading.png'});
});
test('phone long press can still drag a Wiki entry to the card and restores Wiki after release',async({page},info)=>{
  test.skip(info.project.name!=='phone');await setup(page,true);const touch=await finger(page),row=page.locator('.catalog-row').filter({hasText:'测试法师'}).first();
  await touch.down(await center(row));await page.waitForTimeout(380);await expect(page.locator('.pointer-ghost:not([data-landing])')).toHaveCount(1);await expect(page.locator('.sheet-pane')).toHaveClass(/mobile-active/);
  const p=await center(page.locator('.identity-class'));await touch.move(p);await page.waitForTimeout(60);await expect(page.locator('.pointer-ghost:not([data-landing])')).toHaveCount(1);await touch.up();
  await expect(page.locator('.identity-class')).toContainText('测试法师');await expect(page.locator('.wiki-pane')).toHaveClass(/mobile-active/);await expect(page.locator('.pointer-ghost')).toHaveCount(0);await expect(page.locator('.catalog-row.active')).toHaveCount(0);
});
test('phone second finger and cancelled contact disarm a pending drag',async({page},info)=>{
  test.skip(info.project.name!=='phone');await setup(page,true);const touch=await finger(page),p=await center(page.locator('.catalog-row').first());
  await touch.down(p);await touch.two(p);await page.waitForTimeout(400);await touch.cancel();await expect(page.locator('.pointer-ghost')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).dragStarts)).toBe(0);
  await touch.down(p);await touch.cancel();await page.waitForTimeout(400);expect(await page.evaluate(()=>(window as any).dragStarts)).toBe(0);
});
test('mouse drag, tooltip pinning and keyboard preview remain immediate',async({page},info)=>{
  test.skip(info.project.name!=='desktop');await setup(page,false);await page.getByRole('switch',{name:'编辑模式'}).click();const row=page.locator('.catalog-row').filter({hasText:'测试法师'}).first();
  await row.click();const reference=page.locator('.entry-detail .inline-reference').filter({hasText:'微光术'}).first();await reference.hover();await expect(page.getByRole('tooltip')).toBeVisible();await reference.click({button:'right'});await expect(page.locator('.keyword-preview.is-pinned')).toHaveCount(1);await page.keyboard.press('Escape');
  await page.mouse.move(1,1);await page.keyboard.press('Tab');await reference.focus();await expect(page.getByRole('tooltip')).toBeVisible();await page.keyboard.press('Escape');
  await row.dragTo(page.locator('.identity-class'));await expect(page.locator('.identity-class')).toContainText('测试法师');expect(await page.evaluate(()=>(window as any).dragStarts)).toBe(1);
});
