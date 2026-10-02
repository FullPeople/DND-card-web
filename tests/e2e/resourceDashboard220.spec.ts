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
async function open(page:Page){await page.getByTestId('dashboard-open').click();await expect(editor(page)).toBeVisible();await expect(editor(page).locator('.resource-dashboard')).toHaveAttribute('data-overlap-count','0');return editor(page);}
async function visit(page:Page,scenario='default'){await page.goto(`${fixture}?scenario=${scenario}`);await expect(page.locator('#fixture-data')).toHaveText(/dashboard220-original-fixture/);}
async function seek(scope:Locator,id:string){await widget(scope,id).scrollIntoViewIfNeeded();await expect(widget(scope,id)).toBeVisible();}
async function pointDrag(page:Page,target:Locator,dx:number,dy:number){const rect=(await target.boundingBox())!;await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+dx,rect.y+rect.height/2+dy,{steps:5});await page.mouse.up();}

test('filters the gallery by module capacity and preserves normalized geometry in the larger editor',async({page})=>{
 await visit(page);const values=(await read(page)).runtime.resources;const before=await widget(main(page),'surge').evaluate(el=>['x','y','w','h','page'].map(k=>el.getAttribute(`data-grid-${k}`)));const dialog=await open(page);
 const single=retained.filter(id=>!['pool','poolchips','poolbars','poolpips','ready'].includes(id));
 expect(await dialog.locator('[data-template-id]').evaluateAll(nodes=>nodes.map(el=>(el as HTMLElement).dataset.templateId))).toEqual(single);
 for(const id of removed)await expect(dialog.locator(`[data-template-id="${id}"]`)).toHaveCount(0);
 await expect(dialog.locator('.resource-template-option .rm-name')).toHaveText(Array(single.length).fill('新资源'));
 expect(await widget(dialog,'surge').evaluate(el=>['x','y','w','h','page'].map(k=>el.getAttribute(`data-grid-${k}`)))).toEqual(before);
 await expect(dialog.locator('.resource-page-nav')).toHaveCount(0);await expect(dialog.locator('.resource-widget')).toHaveCount(5);
 await dialog.getByRole('button',{name:'多模块',exact:true}).click();expect(await dialog.locator('[data-template-id]').evaluateAll(nodes=>nodes.map(el=>(el as HTMLElement).dataset.templateId))).toEqual(['pool','poolchips','poolbars','poolpips']);
 expect((await read(page)).runtime.resources).toEqual(values);await dialog.screenshot({path:test.info().outputPath('dashboard-wide.png')});
 await page.setViewportSize({width:390,height:844});expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await dialog.screenshot({path:test.info().outputPath('dashboard-narrow.png')});
});

test('selection changes no values, exposes color and count icons, and double click edits one resource',async({page})=>{
 await visit(page);const initial=(await read(page)).runtime.resources;const dialog=await open(page),surge=widget(dialog,'surge');await surge.locator('.resource-widget-face').click();
 await expect(surge.locator('.resource-widget-handle')).toHaveCount(8);await expect(dialog.locator('.dashboard-configuration')).toHaveCount(1);await expect(page.locator('.resource-widget-popover')).toHaveCount(0);
 const before=(await dialog.locator('.dashboard-preview').boundingBox())!;await dialog.getByRole('button',{name:'色调 #a36d61',exact:true}).click();await dialog.getByRole('button',{name:'图标 药瓶',exact:true}).click();await dialog.getByRole('button',{name:'保存布局',exact:true}).click();
 await expect.poll(async()=>(await read(page)).quickbarLayout?.widgets?.surge.color).toBe('#a36d61');expect((await read(page)).quickbarLayout?.widgets?.surge.icon).toBe('bottle');expect((await read(page)).runtime.resources).toEqual(initial);
 const after=(await dialog.locator('.dashboard-preview').boundingBox())!;expect(after).toEqual(before);
 await surge.locator('.resource-widget-face').dblclick();await expect(dialog.getByRole('textbox',{name:'资源名称',exact:true})).toHaveValue('动作如潮');await expect(dialog.locator('.resource-module-tabs')).toHaveCount(0);
 await expect(dialog.getByText('法术位与资源记录',{exact:true})).toHaveCount(0);await dialog.getByRole('textbox',{name:'资源名称',exact:true}).fill('专属动作如潮');await dialog.getByRole('button',{name:'保存',exact:true}).click();await expect(dialog.locator('.dashboard-configuration')).toHaveCount(1);await dialog.getByRole('button',{name:'保存布局',exact:true}).click();
 await dialog.getByRole('button',{name:'关闭弹窗'}).click();await page.reload();expect((await read(page)).quickbarLayout?.widgets?.surge).toMatchObject({color:'#a36d61',icon:'bottle'});expect((await read(page)).runtime.resources.surge).toMatchObject({name:'专属动作如潮',current:3,max:5});
});

test('all eight drag handles resize and Escape cancels without consuming resources',async({page})=>{
 for(const handle of ['nw','n','ne','e','se','s','sw','w']){
  await visit(page,'resize');await page.getByRole('button',{name:'重置测试卡',exact:true}).click();const dialog=await open(page),probe=widget(dialog,'probe');await probe.locator('.resource-widget-face').click();
  const before=(await read(page)).quickbarLayout!.widgets!.probe,rect=(await canvas(dialog).boundingBox())!;
  await pointDrag(page,probe.locator(`.handle-${handle}`),handle.includes('w')?-rect.width/12:handle.includes('e')?rect.width/12:0,handle.includes('n')?-rect.height/(Number(await canvas(dialog).getAttribute('data-bands'))*6):handle.includes('s')?rect.height/(Number(await canvas(dialog).getAttribute('data-bands'))*6):0);
  await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const after=(await read(page)).quickbarLayout!.widgets!.probe;expect(after).not.toEqual(before);expect(after.x+after.w).toBeLessThanOrEqual(12);expect(after.y+after.h).toBeLessThanOrEqual(6);expect((await read(page)).runtime.resources.probe.current).toBe(2);
 }
 const dialog=editor(page),probe=widget(dialog,'probe'),before=(await read(page)).quickbarLayout;const box=(await probe.locator('.resource-widget-face').boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+45,box.y+box.height/2+15,{steps:4});await page.keyboard.press('Escape');await page.mouse.up();expect((await read(page)).quickbarLayout).toEqual(before);
 await expect(dialog).toBeVisible();await dialog.screenshot({path:test.info().outputPath('resize-eight-handles.png')});
});

test('moving between vertical bands preserves every module and its saved geometry',async({page})=>{
 await visit(page,'resize');const dialog=await open(page),probe=widget(dialog,'probe'),before=(await read(page)).runtime.resources;
 const face=probe.locator('.resource-widget-face');await face.focus();await face.press('PageDown');await expect(probe).toHaveAttribute('data-grid-page','1');await expect(dialog.locator('.resource-page-nav')).toHaveCount(0);
 await dialog.getByRole('button',{name:'保存布局',exact:true}).click();expect((await read(page)).quickbarLayout!.widgets!.probe.page).toBe(1);
 await seek(dialog,'probe');await face.focus();await face.press('PageUp');await expect(probe).toHaveAttribute('data-grid-page','0');await expect(probe).toHaveAttribute('data-overlapping','false');
 await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const saved=(await read(page)).quickbarLayout;await page.reload();expect((await read(page)).quickbarLayout).toEqual(saved);expect((await read(page)).runtime.resources).toEqual(before);
});

test('choosing a sample adds one module in free vertical space without changing existing resources',async({page})=>{
 await visit(page);const initial=(await read(page)).runtime.resources,dialog=await open(page);
 await dialog.locator('[data-template-id="matrix"]').click();await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const after=await read(page),id=Object.keys(after.runtime.resources).find(key=>!Object.hasOwn(initial,key))!;expect(id).toBeTruthy();expect(after.quickbarLayout?.widgets?.[id].style).toBe('matrix');
 await seek(dialog,id);await expect(widget(dialog,id).locator('.resource-widget-handle')).toHaveCount(8);for(const [key,value] of Object.entries(initial))expect(after.runtime.resources[key]).toEqual(value);
 const face=widget(dialog,id).locator('.resource-widget-face');await face.focus();await face.press('PageDown');await seek(dialog,id);const rect=(await canvas(dialog).boundingBox())!,before=after.quickbarLayout!.widgets![id];await pointDrag(page,face,(before.x>0?-1:1)*rect.width/12,0);await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const moved=await read(page);expect(moved.quickbarLayout!.widgets![id].x).not.toBe(before.x);expect(moved.runtime.resources[id]).toEqual(after.runtime.resources[id]);
 await page.reload();expect((await read(page)).quickbarLayout!.widgets![id]).toEqual(moved.quickbarLayout!.widgets![id]);
});

for(const [maximum,style] of [[2,'orbit'],[8,'segments'],[30,'ring'],[9999,'ring']] as const)test(`manual resource with maximum ${maximum} retains the chosen style and balance`,async({page})=>{
 await visit(page);const before=(await read(page)).runtime.resources,dialog=await open(page);
 await dialog.getByLabel('新模块名称',{exact:true}).fill(`上限 ${maximum} 的测试资源`);await dialog.getByLabel('新模块上限',{exact:true}).fill(String(maximum));await dialog.getByLabel('新模块当前值',{exact:true}).fill(String(maximum));await dialog.locator(`[data-template-id="${style}"]`).click();
 await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const after=await read(page),id=Object.keys(after.runtime.resources).find(key=>!Object.hasOwn(before,key))!;expect(id).toBeTruthy();expect(after.quickbarLayout!.widgets![id].style).toBe(style);expect(after.runtime.resources[id]).toMatchObject({current:maximum,max:maximum});
 for(const [key,value] of Object.entries(before))expect(after.runtime.resources[key]).toEqual(value);await page.reload();expect((await read(page)).quickbarLayout!.widgets![id].style).toBe(style);
});

test('shared spell slots and pact slots remain separate when spending, editing and reloading',async({page})=>{
 await visit(page);const scope=main(page);await expect(widget(scope,'spell-slot:1').locator('[data-subresource-id]')).toHaveCount(3);await expect(widget(scope,'spell-slot:1').locator('.rm-pool-label')).toHaveText(['I','II','III']);await expect(widget(scope,'pact-slot:2').locator('[data-subresource-id]')).toHaveCount(1);
 await widget(scope,'spell-slot:1').locator('.resource-widget-face').click();const operation=page.getByRole('dialog',{name:'法术位（共用）资源操作',exact:true});await operation.getByRole('button',{name:'2环法术位 2',exact:true}).click();await operation.getByRole('button',{name:'关闭资源操作',exact:true}).click();
 const c=await read(page);expect(c.runtime.resources['spell-slot:2'].current).toBe(1);expect(c.runtime.resources['pact-slot:2'].current).toBe(1);expect(c.runtime.resources['spell-slot:1'].current).toBe(3);expect(c.runtime.resources['spell-slot:3'].current).toBe(1);
 const dialog=await open(page);await widget(dialog,'pact-slot:2').locator('.resource-widget-face').dblclick();await expect(dialog.getByRole('textbox',{name:'资源名称'})).toHaveValue('2环契约位');await expect(dialog.locator('.resource-module-tabs button')).toHaveCount(0);await dialog.getByRole('spinbutton',{name:'资源剩余',exact:true}).fill('2');await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.getByRole('button',{name:'保存布局',exact:true}).click();await page.reload();
 expect((await read(page)).runtime.resources['pact-slot:2'].current).toBe(2);expect((await read(page)).runtime.resources['spell-slot:2'].current).toBe(1);
});
