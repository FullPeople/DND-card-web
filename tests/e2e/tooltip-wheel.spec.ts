import {test,expect,type Locator,type Page} from '@playwright/test';

async function pin(page:Page,name:string,scope:Locator=page.locator('#reading-panel')){
  const reference=scope.getByRole('button',{name,exact:true});
  await reference.hover();
  const pane=page.getByRole('tooltip');
  await expect(pane).toContainText(name);
  await reference.click({button:'middle'});
  await expect(pane).toHaveClass(/is-pinned/);
  return page.locator(`#${await pane.getAttribute('id')}`);
}
async function over(page:Page,pane:Locator,header=false){
  const box=await pane.locator(header?'header':'.keyword-content').boundingBox();
  if(!box)throw Error('Tooltip content must be visible');
  await page.mouse.move(box.x+Math.min(60,box.width/2),box.y+Math.min(25,box.height/2));
}
test.beforeEach(async({page})=>{await page.goto('/tests/fixtures/tooltip-wheel/');await expect(page.getByRole('button',{name:'打开测试弹窗'})).toBeVisible();});

test('short pinned tooltip hands vertical wheel to the reading pane under the pointer',async({page})=>{
  const pane=await pin(page,'短说明');
  expect(await pane.locator('.keyword-content').evaluate(el=>el.scrollHeight<=el.clientHeight)).toBe(true);
  await over(page,pane);await page.mouse.wheel(0,180);
  await expect.poll(()=>page.locator('#reading-panel').evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
  await expect(pane).toHaveClass(/is-pinned/);
  await page.screenshot({path:test.info().outputPath('short-tooltip-forwarded.png')});
});
test('scrollable tooltip consumes its own wheel before the reading pane',async({page})=>{
  const pane=await pin(page,'长说明');await over(page,pane);await page.mouse.wheel(0,180);
  await expect.poll(()=>pane.locator('.keyword-content').evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
  expect(await page.locator('#reading-panel').evaluate(el=>el.scrollTop)).toBe(0);
});
test('bottom and top tooltip boundaries hand wheel back in both directions',async({page})=>{
  const pane=await pin(page,'长说明'),content=pane.locator('.keyword-content');
  await content.evaluate(el=>el.scrollTop=el.scrollHeight);await over(page,pane);await page.mouse.wheel(0,180);
  await expect.poll(()=>page.locator('#reading-panel').evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
  await content.evaluate(el=>el.scrollTop=0);const before=await page.locator('#reading-panel').evaluate(el=>el.scrollTop);
  await over(page,pane);await page.mouse.wheel(0,-120);
  await expect.poll(()=>page.locator('#reading-panel').evaluate(el=>el.scrollTop)).toBeLessThan(before-60);
});
test('wheel over the tooltip header still scrolls a long tooltip',async({page})=>{
  const pane=await pin(page,'长说明');await over(page,pane,true);await page.mouse.wheel(0,180);
  await expect.poll(()=>pane.locator('.keyword-content').evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
  expect(await page.locator('#reading-panel').evaluate(el=>el.scrollTop)).toBe(0);
});
test('short unpinned tooltip does not consume wheel over its original reference',async({page})=>{
  const reference=page.locator('#reading-panel').getByRole('button',{name:'短说明',exact:true});
  await reference.hover();await expect(page.getByRole('tooltip')).toContainText('原创短说明');await page.mouse.wheel(0,180);
  await expect.poll(()=>page.locator('#reading-panel').evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
});
test('nested wide table consumes horizontal wheel and passes its boundary to the pane below',async({page})=>{
  const pane=await pin(page,'表格说明'),table=pane.locator('.table-scroll');await table.hover();await page.mouse.wheel(220,0);
  await expect.poll(()=>table.evaluate(el=>el.scrollLeft)).toBeGreaterThan(100);
  expect(await page.locator('#reading-panel').evaluate(el=>el.scrollLeft)).toBe(0);
  await table.evaluate(el=>el.scrollLeft=el.scrollWidth);await table.hover();await page.mouse.wheel(180,0);
  await expect.poll(()=>page.locator('#reading-panel').evaluate(el=>el.scrollLeft)).toBeGreaterThan(80);
});
test('a tooltip above a modal routes to modal scrolling without moving the page behind it',async({page})=>{
  await page.getByRole('button',{name:'打开测试弹窗'}).click();
  const pane=await pin(page,'短说明',page.locator('#modal-reading'));
  await over(page,pane);await page.mouse.wheel(0,180);
  await expect.poll(()=>page.locator('#modal-reading').evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
  expect(await page.locator('#reading-panel').evaluate(el=>el.scrollTop)).toBe(0);
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);
  await page.screenshot({path:test.info().outputPath('modal-tooltip-forwarded.png')});
  await page.locator('#modal-reading').evaluate(el=>el.scrollTop=el.scrollHeight);
  await over(page,pane);await page.mouse.wheel(0,180);
  expect(await page.locator('#reading-panel').evaluate(el=>el.scrollTop)).toBe(0);
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);
  await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'滚轮测试弹窗'})).toBeVisible();
});
test('modal boundaries without CSS containment or a body lock still protect the background',async({page})=>{
  await page.getByRole('button',{name:'打开测试弹窗'}).click();
  await page.getByRole('dialog',{name:'滚轮测试弹窗'}).evaluate(el=>(el as HTMLElement).style.width='220px');
  const pane=await pin(page,'短说明',page.locator('#modal-reading'));
  await page.evaluate(()=>{document.body.style.overflow='';const modal=document.getElementById('modal-reading')!;modal.style.overscrollBehavior='auto';modal.scrollTop=modal.scrollHeight;});
  await over(page,pane);await page.mouse.wheel(0,180);
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);
  expect(await page.locator('#reading-panel').evaluate(el=>el.scrollTop)).toBe(0);
  const box=await pane.locator('.keyword-content').boundingBox();if(!box)throw Error('Tooltip content must be visible');
  const point={x:box.x+box.width-8,y:box.y+10};
  expect(await page.evaluate(point=>document.elementFromPoint(point.x,point.y)?.closest('[data-tooltip-id]')?.id,point)).toBe(await pane.getAttribute('id'));
  const modal=await page.getByRole('dialog',{name:'滚轮测试弹窗'}).boundingBox();expect(point.x).toBeGreaterThan(modal!.x+modal!.width);
  await page.mouse.move(point.x,point.y);await page.mouse.wheel(0,180);
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);
  expect(await page.locator('#reading-panel').evaluate(el=>el.scrollTop)).toBe(0);
});
test('portal boundary scrolls the independent pane under the pointer, not the reference pane',async({page})=>{
  await page.getByRole('button',{name:'显示右侧阅读区'}).click();
  const pane=await pin(page,'长说明'),content=pane.locator('.keyword-content');
  await content.evaluate(el=>el.scrollTop=el.scrollHeight);
  const box=await content.boundingBox();if(!box)throw Error('Tooltip must have a visible box');
  const point={x:box.x+box.width-15,y:box.y+30};expect(point.x).toBeGreaterThan(450);
  await page.mouse.move(point.x,point.y);await page.mouse.wheel(0,160);
  await expect.poll(()=>page.locator('#secondary-panel').evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
  expect(await page.locator('#reading-panel').evaluate(el=>el.scrollTop)).toBe(0);
});
test('a nested short tooltip hands wheel to the long parent tooltip beneath it',async({page})=>{
  const parent=await pin(page,'长说明'),reference=parent.getByRole('button',{name:'短说明',exact:true});await reference.hover();
  const child=page.getByRole('tooltip').filter({hasText:'原创短说明'});
  await expect(child).toBeVisible();await reference.click({button:'middle'});
  await expect(page.locator('.keyword-preview.is-pinned')).toHaveCount(2);
  const parentBox=await parent.boundingBox(),childBox=await child.boundingBox();
  if(!parentBox||!childBox)throw Error('Both tooltips must be visible');
  const x=Math.max(parentBox.x,childBox.x)+35,y=Math.max(parentBox.y,childBox.y)+55;
  expect(x).toBeLessThan(Math.min(parentBox.x+parentBox.width,childBox.x+childBox.width));
  expect(y).toBeLessThan(Math.min(parentBox.y+parentBox.height,childBox.y+childBox.height));
  await page.mouse.move(x,y);await page.mouse.wheel(0,160);
  await expect.poll(()=>parent.locator('.keyword-content').evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
  expect(await page.locator('#reading-panel').evaluate(el=>el.scrollTop)).toBe(0);
  await page.screenshot({path:test.info().outputPath('nested-tooltip-forwarded.png')});
});
test('the transparent pinned backdrop also forwards wheel to the reading pane',async({page})=>{
  await pin(page,'短说明');await page.mouse.move(850,450);await page.mouse.wheel(0,160);
  await expect.poll(()=>page.locator('#reading-panel').evaluate(el=>el.scrollTop)).toBeGreaterThan(100);
  await expect(page.locator('.keyword-preview.is-pinned')).toHaveCount(1);
});
test('control-wheel is left uncancelled for the browser zoom gesture',async({page})=>{
  const pane=await pin(page,'长说明');
  const accepted=await pane.evaluate(el=>el.dispatchEvent(new WheelEvent('wheel',{deltaY:160,ctrlKey:true,cancelable:true,bubbles:true})));
  expect(accepted).toBe(true);
  expect(await pane.locator('.keyword-content').evaluate(el=>el.scrollTop)).toBe(0);
  expect(await page.locator('#reading-panel').evaluate(el=>el.scrollTop)).toBe(0);
});
