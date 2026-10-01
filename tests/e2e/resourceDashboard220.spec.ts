import {test,expect,type Page,type Locator} from '@playwright/test';
import type {Character} from '../../src/core/model';

const fixture='/tests/fixtures/resource-dashboard220/index.html';
const retained=['ring','pips','pool','half','orbit','square','segments','reservoir','matrix','fraction','counter','poolchips','poolbars','poolpips','ready','diamond'];
const removed=['ticks','energy','column','ribbon','charges','number','unlimited','dual','layers'];
const read=async(page:Page):Promise<Character>=>JSON.parse((await page.locator('#fixture-data').textContent())!);
const main=(page:Page)=>page.locator('.fixture-quickbar');
const editor=(page:Page)=>page.getByRole('dialog',{name:'仪表盘',exact:true});
const canvas=(scope:Locator)=>scope.locator('.resource-widget-canvas');
const widget=(scope:Locator,id:string)=>scope.locator(`[data-resource-id="${id}"]`);
async function open(page:Page){await main(page).getByRole('button',{name:'仪表盘',exact:true}).click();await expect(editor(page)).toBeVisible();return editor(page);}
async function visit(page:Page,scenario='default'){await page.goto(`${fixture}?scenario=${scenario}`);await expect(page.locator('#fixture-data')).toHaveText(/dashboard220-original-fixture/);}
async function seek(scope:Locator,id:string){for(let i=0;i<40;i++){if(await widget(scope,id).isVisible())return;const next=scope.getByRole('button',{name:'下一页资源',exact:true});if(await next.isDisabled())break;await next.click();}throw Error(`资源 ${id} 不在可见页面`);}
async function pointDrag(page:Page,target:Locator,dx:number,dy:number){const rect=(await target.boundingBox())!;await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+dx,rect.y+rect.height/2+dy,{steps:5});await page.mouse.up();}

test('retains exactly 16 approved visual modules and mirrors the actual quickbar dimensions',async({page})=>{
 await visit(page);const values=(await read(page)).runtime.resources;const before=(await canvas(main(page)).boundingBox())!;const dialog=await open(page);
 await expect(dialog.locator('[data-template-id]')).toHaveCount(16);expect(await dialog.locator('[data-template-id]').evaluateAll(nodes=>nodes.map(el=>(el as HTMLElement).dataset.templateId))).toEqual(retained);
 for(const id of removed)await expect(dialog.locator(`[data-template-id="${id}"]`)).toHaveCount(0);
 await expect(dialog.locator('.resource-template-option .rm-name')).toHaveText(Array(16).fill('动作如潮'));
 const after=(await canvas(dialog).boundingBox())!;expect(Math.abs(after.width-before.width)).toBeLessThanOrEqual(1);expect(Math.abs(after.height-before.height)).toBeLessThanOrEqual(1);
 const sizes=await canvas(dialog).evaluate(el=>({w:el.clientWidth,h:el.clientHeight,sw:el.scrollWidth,sh:el.scrollHeight}));expect(sizes.sw).toBeLessThanOrEqual(sizes.w+1);expect(sizes.sh).toBeLessThanOrEqual(sizes.h+1);
 expect((await read(page)).runtime.resources).toEqual(values);await dialog.screenshot({path:test.info().outputPath('dashboard-wide.png')});
 await page.setViewportSize({width:390,height:844});await expect(dialog.locator('[data-template-id]')).toHaveCount(16);expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await dialog.screenshot({path:test.info().outputPath('dashboard-narrow.png')});
});

test('selection changes no values, exposes color and count icons, and double click edits one resource',async({page})=>{
 await visit(page);const initial=(await read(page)).runtime.resources;const dialog=await open(page),surge=widget(dialog,'surge');await surge.locator('.resource-widget-face').click();
 await expect(surge.locator('.resource-widget-handle')).toHaveCount(8);await expect(dialog.locator('.dashboard-configuration')).toHaveCount(0);await expect(page.locator('.resource-widget-popover')).toHaveCount(0);
 const before=(await dialog.locator('.dashboard-preview').boundingBox())!;await dialog.getByRole('button',{name:'色调 #a36d61',exact:true}).click();await dialog.getByRole('button',{name:'图标 药瓶',exact:true}).click();await dialog.getByRole('button',{name:'保存布局',exact:true}).click();
 await expect.poll(async()=>(await read(page)).quickbarLayout?.widgets?.surge.color).toBe('#a36d61');expect((await read(page)).quickbarLayout?.widgets?.surge.icon).toBe('bottle');expect((await read(page)).runtime.resources).toEqual(initial);
 const after=(await dialog.locator('.dashboard-preview').boundingBox())!;expect(after).toEqual(before);
 await surge.locator('.resource-widget-face').dblclick();await expect(dialog.getByRole('textbox',{name:'资源名称',exact:true})).toHaveValue('动作如潮');await expect(dialog.locator('.resource-module-tabs')).toHaveCount(0);
 await expect(dialog.getByText('法术位与资源记录',{exact:true})).toHaveCount(0);await dialog.getByRole('textbox',{name:'资源名称',exact:true}).fill('专属动作如潮');await dialog.getByRole('button',{name:'保存',exact:true}).click();await expect(dialog.locator('.dashboard-configuration')).toHaveCount(0);await dialog.getByRole('button',{name:'保存布局',exact:true}).click();
 await dialog.getByRole('button',{name:'关闭弹窗'}).click();await page.reload();expect((await read(page)).quickbarLayout?.widgets?.surge).toMatchObject({color:'#a36d61',icon:'bottle'});expect((await read(page)).runtime.resources.surge).toMatchObject({name:'专属动作如潮',current:3,max:5});
});

test('all eight drag handles resize and Escape cancels without consuming resources',async({page})=>{
 for(const handle of ['nw','n','ne','e','se','s','sw','w']){
  await visit(page,'resize');await page.getByRole('button',{name:'重置测试卡',exact:true}).click();const dialog=await open(page),probe=widget(dialog,'probe');await probe.locator('.resource-widget-face').click();
  const before=(await read(page)).quickbarLayout!.widgets!.probe,rect=(await canvas(dialog).boundingBox())!;
  await pointDrag(page,probe.locator(`.handle-${handle}`),handle.includes('w')?-rect.width/12:handle.includes('e')?rect.width/12:0,handle.includes('n')?-rect.height/6:handle.includes('s')?rect.height/6:0);
  await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const after=(await read(page)).quickbarLayout!.widgets!.probe;expect(after).not.toEqual(before);expect(after.x+after.w).toBeLessThanOrEqual(12);expect(after.y+after.h).toBeLessThanOrEqual(6);expect((await read(page)).runtime.resources.probe.current).toBe(2);
 }
 const dialog=editor(page),probe=widget(dialog,'probe'),before=(await read(page)).quickbarLayout;const box=(await probe.locator('.resource-widget-face').boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+45,box.y+box.height/2+15,{steps:4});await page.keyboard.press('Escape');await page.mouse.up();expect((await read(page)).quickbarLayout).toEqual(before);
 await expect(dialog).toBeVisible();await dialog.screenshot({path:test.info().outputPath('resize-eight-handles.png')});
});

test('dragging either canvas edge changes page and reload preserves its geometry and balance',async({page})=>{
 await visit(page,'resize');const dialog=await open(page),probe=widget(dialog,'probe');await probe.locator('.resource-widget-face').click();
 const before=(await read(page)).runtime.resources,rect=(await canvas(dialog).boundingBox())!,face=(await probe.locator('.resource-widget-face').boundingBox())!;
 await page.mouse.move(face.x+face.width/2,face.y+face.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width+4,rect.y+rect.height/2,{steps:5});await expect(canvas(dialog)).toHaveAttribute('data-edge','right');await page.waitForTimeout(650);await page.mouse.up();
 await dialog.getByRole('button',{name:'保存布局',exact:true}).click();await expect.poll(async()=>(await read(page)).quickbarLayout!.widgets!.probe.page).toBe(1);await expect(dialog.locator('.resource-page-nav output')).toHaveText('2/2');
 const onSecond=(await probe.locator('.resource-widget-face').boundingBox())!;await page.mouse.move(onSecond.x+onSecond.width/2,onSecond.y+onSecond.height/2);await page.mouse.down();await page.mouse.move(rect.x-4,rect.y+rect.height/2,{steps:5});await expect(canvas(dialog)).toHaveAttribute('data-edge','left');await page.waitForTimeout(650);await page.mouse.up();
 await expect(probe).toHaveAttribute('data-grid-page','0');await expect(dialog.getByRole('button',{name:'保存布局',exact:true})).toBeDisabled();await expect(probe).toHaveAttribute('data-overlapping','true');
 // A left-edge drop may overlap the weapon block. Move it clear explicitly; neighbors must stay put.
 await pointDrag(page,probe.locator('.resource-widget-face'),rect.width*3/12,0);
 await dialog.getByRole('button',{name:'保存布局',exact:true}).click();await expect.poll(async()=>(await read(page)).quickbarLayout!.widgets!.probe.page).toBe(0);expect((await read(page)).runtime.resources).toEqual(before);
 const saved=(await read(page)).quickbarLayout;await page.reload();expect((await read(page)).quickbarLayout).toEqual(saved);expect((await read(page)).runtime.resources).toEqual(before);
});

test('choosing a sample adds one module and moves it onto a free page without changing existing resources',async({page})=>{
 await visit(page);const initial=(await read(page)).runtime.resources,dialog=await open(page);
 await dialog.locator('[data-template-id="matrix"]').click();await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const after=await read(page),id=Object.keys(after.runtime.resources).find(key=>!Object.hasOwn(initial,key))!;expect(id).toBeTruthy();expect(after.quickbarLayout?.widgets?.[id].style).toBe('matrix');
 await expect(widget(dialog,id)).toBeVisible();await expect(widget(dialog,id).locator('.resource-widget-handle')).toHaveCount(8);for(const [key,value] of Object.entries(initial))expect(after.runtime.resources[key]).toEqual(value);
 const rect=(await canvas(dialog).boundingBox())!,before=after.quickbarLayout!.widgets![id];await pointDrag(page,widget(dialog,id).locator('.resource-widget-face'),rect.width/12,0);await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const moved=await read(page);expect(moved.quickbarLayout!.widgets![id].x).not.toBe(before.x);expect(moved.runtime.resources[id]).toEqual(after.runtime.resources[id]);
 await page.reload();expect((await read(page)).quickbarLayout!.widgets![id]).toEqual(moved.quickbarLayout!.widgets![id]);
});

for(const [maximum,styles] of [[2,['orbit','diamond']],[8,['orbit','segments','diamond']],[30,['segments','fraction']],[9999,['fraction']]] as const)test(`default resource with maximum ${maximum} persists an allowed capacity-based style`,async({page})=>{
 await visit(page);const before=(await read(page)).runtime.resources,dialog=await open(page);await dialog.getByRole('button',{name:'默认添加资源',exact:true}).click();
 await dialog.getByRole('textbox',{name:'资源名称',exact:true}).fill(`上限 ${maximum} 的测试资源`);await dialog.getByRole('spinbutton',{name:'资源上限',exact:true}).fill(String(maximum));await dialog.getByRole('button',{name:'保存',exact:true}).click();
 await expect(dialog.locator('.dashboard-configuration')).toHaveCount(0);await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const after=await read(page),id=Object.keys(after.runtime.resources).find(key=>!Object.hasOwn(before,key))!;expect(id).toBeTruthy();expect(styles).toContain(after.quickbarLayout!.widgets![id].style);expect(after.runtime.resources[id]).toMatchObject({current:maximum,max:maximum});
 for(const [key,value] of Object.entries(before))expect(after.runtime.resources[key]).toEqual(value);const style=after.quickbarLayout!.widgets![id].style;await page.reload();expect((await read(page)).quickbarLayout!.widgets![id].style).toBe(style);
});

test('shared spell slots and pact slots remain separate when spending, editing and reloading',async({page})=>{
 await visit(page);const scope=main(page);await expect(widget(scope,'spell-slot:1').locator('[data-subresource-id]')).toHaveCount(3);await expect(widget(scope,'spell-slot:1').locator('.rm-pool-label')).toHaveText(['I','II','III']);await expect(widget(scope,'pact-slot:2').locator('[data-subresource-id]')).toHaveCount(1);
 await widget(scope,'spell-slot:1').locator('.resource-widget-face').click();const operation=page.getByRole('dialog',{name:'法术位（共用）资源操作',exact:true});await operation.getByRole('button',{name:'2环法术位 2',exact:true}).click();await operation.getByRole('button',{name:'关闭资源操作',exact:true}).click();
 const c=await read(page);expect(c.runtime.resources['spell-slot:2'].current).toBe(1);expect(c.runtime.resources['pact-slot:2'].current).toBe(1);expect(c.runtime.resources['spell-slot:1'].current).toBe(3);expect(c.runtime.resources['spell-slot:3'].current).toBe(1);
 const dialog=await open(page);await widget(dialog,'pact-slot:2').locator('.resource-widget-face').dblclick();await expect(dialog.getByRole('textbox',{name:'资源名称'})).toHaveValue('2环契约位');await expect(dialog.locator('.resource-module-tabs button')).toHaveCount(0);await dialog.getByRole('spinbutton',{name:'资源剩余',exact:true}).fill('2');await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.getByRole('button',{name:'保存布局',exact:true}).click();await page.reload();
 expect((await read(page)).runtime.resources['pact-slot:2'].current).toBe(2);expect((await read(page)).runtime.resources['spell-slot:2'].current).toBe(1);
});
