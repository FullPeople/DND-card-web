import {test,expect,type Page} from '@playwright/test';
import type {Character} from '../../src/core/model';

const fixture='/tests/fixtures/resource-dashboard220/index.html';
const read=async(page:Page):Promise<Character>=>JSON.parse((await page.locator('#fixture-data').textContent())!);
async function open(page:Page,scenario='default'){
 await page.goto(`${fixture}?scenario=${scenario}`);await page.locator('.fixture-quickbar').getByRole('button',{name:'仪表盘',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'仪表盘',exact:true});await expect(dialog).toBeVisible();return dialog;
}

test('name and numbers preview before creating, persist after explicit save, and preserve existing pools',async({page})=>{
 const dialog=await open(page),before=(await read(page)).runtime.resources;
 await dialog.getByRole('textbox',{name:'新模块名称',exact:true}).fill('旅途储备');
 await dialog.getByRole('spinbutton',{name:'新模块上限',exact:true}).fill('8');
 await dialog.getByRole('spinbutton',{name:'新模块当前值',exact:true}).fill('5');
 const sample=dialog.locator('[data-template-id="pips"]');await expect(sample.locator('.rm-name')).toHaveText('旅途储备');await expect(sample.locator('.rm-icon-count')).toHaveText('5 / 8');
 const previewColor=await sample.locator('.resource-dashboard-icon').first().evaluate(el=>getComputedStyle(el).color);
 expect((await read(page)).runtime.resources).toEqual(before);
 await sample.click();const added=dialog.locator('.resource-widget[data-selected=true]');await expect(added.locator('.rm-name')).toHaveText('旅途储备');await expect(added.locator('.rm-icon-count')).toHaveText('5 / 8');
 await expect(added.locator('.resource-dashboard-icon').first()).toHaveCSS('color',previewColor);
 const id=(await added.getAttribute('data-resource-id'))!;
 await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const saved=(await read(page)).runtime.resources;expect(saved[id]).toMatchObject({name:'旅途储备',current:5,max:8});for(const [key,value] of Object.entries(before))expect(saved[key]).toEqual(value);
 await dialog.screenshot({path:test.info().outputPath('resource-gray-preview-wide.png')});
 await page.reload();expect((await read(page)).runtime.resources).toEqual(saved);
});

test('color changes only icons and explicit counts remain readable in the narrow gallery',async({page})=>{
 const dialog=await open(page),module=dialog.locator('[data-resource-id="surge"]');await module.locator('.resource-widget-face').click();
 const face=module.locator('.resource-module-art'),icon=face.locator('.resource-dashboard-icon').first();
 const original=await face.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,color:s.color,border:s.borderColor};});
 await dialog.getByRole('button',{name:'色调 #a36d61',exact:true}).click();
 expect(await face.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,color:s.color,border:s.borderColor};})).toEqual(original);
 await expect(icon).toHaveCSS('color','rgb(163, 109, 97)');expect((await icon.boundingBox())!.height).toBeGreaterThan(8);await expect(face.locator('.rm-icon-count')).toHaveText('3 / 5');
 await page.setViewportSize({width:390,height:844});await expect(dialog.getByRole('textbox',{name:'新模块名称'})).toBeVisible();
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await expect(dialog.locator('.resource-template-option')).toHaveCount(16);
 await dialog.screenshot({path:test.info().outputPath('resource-gray-preview-narrow.png')});
});

test('unbounded values display a single number without infinity and keep old data unchanged',async({page})=>{
 const dialog=await open(page),before=(await read(page)).runtime.resources;
 await dialog.getByRole('checkbox',{name:'新模块有上限'}).uncheck();await dialog.getByRole('spinbutton',{name:'新模块当前值'}).fill('123456');
 const sample=dialog.locator('[data-template-id="ring"]');await expect(sample.locator('.rm-readout')).toHaveText('123456');await expect(sample.locator('.rm-track')).toHaveCount(0);
 expect(await dialog.innerText()).not.toContain('∞');await sample.click();await dialog.getByRole('button',{name:'保存布局',exact:true}).click();
 const current=(await read(page)).runtime.resources,id=Object.keys(current).find(key=>!Object.hasOwn(before,key))!;expect(current[id]).toMatchObject({current:123456,unlimited:true,type:'number'});for(const [key,value] of Object.entries(before))expect(current[key]).toEqual(value);
 await dialog.getByRole('button',{name:'关闭弹窗'}).click();await page.reload();await page.locator('.fixture-quickbar').getByRole('button',{name:'下一页资源'}).click();
 await expect(page.locator('[data-resource-id="coins"] .rm-readout')).toHaveText('1874');
});

test('module settings use name and upper limit, preview immediately, and cancel without changing resources',async({page})=>{
 const dialog=await open(page),before=(await read(page)).runtime.resources;await dialog.locator('[data-resource-id="surge"] .resource-widget-face').dblclick();
 await expect(dialog.locator('.resource-editor-form .segmented')).toHaveCount(0);
 await dialog.getByRole('textbox',{name:'资源名称',exact:true}).fill('试填资源');await dialog.getByRole('spinbutton',{name:'资源剩余',exact:true}).fill('1');
 const preview=dialog.getByLabel('资源设置预览');await expect(preview.locator('.rm-name')).toHaveText('试填资源');await expect(preview.locator('.rm-icon-count')).toHaveText('1 / 5');
 await dialog.getByRole('checkbox',{name:'资源有上限'}).uncheck();await expect(preview.locator('.rm-readout')).toHaveText('1');
 await dialog.getByRole('button',{name:'返回模块库',exact:true}).click();expect((await read(page)).runtime.resources).toEqual(before);
 await dialog.getByRole('button',{name:'关闭弹窗'}).click();expect((await read(page)).runtime.resources).toEqual(before);
});

test('resource menus preserve spend and rest confirmation while the quickbar keeps its height',async({page})=>{
 await page.goto(fixture);const quickbar=page.locator('.fixture-quickbar'),before=await read(page),bounds=(await quickbar.locator('.resource-widget-canvas').boundingBox())!;
 await expect(quickbar.getByRole('button',{name:'短休',exact:true})).toHaveCount(0);await expect(quickbar.getByRole('button',{name:'长休',exact:true})).toHaveCount(0);
 await quickbar.locator('[data-resource-id="surge"] .resource-widget-face').click();const menu=page.getByRole('dialog',{name:'动作如潮资源操作',exact:true});
 await expect(menu.locator('.resource-current-label')).toHaveText('3 / 5');await menu.getByRole('button',{name:'动作如潮 3',exact:true}).click();expect((await read(page)).runtime.resources.surge.current).toBe(2);
 await menu.getByRole('button',{name:'长休',exact:true}).click();const rest=page.getByRole('dialog',{name:'长休',exact:true});await expect(rest).toBeVisible();await expect(menu).toHaveCount(0);await rest.getByRole('button',{name:'关闭休息',exact:true}).click();
 expect((await read(page)).runtime.resources['spell-slot:1']).toEqual(before.runtime.resources['spell-slot:1']);
 await quickbar.locator('[data-resource-id="surge"] .resource-widget-face').click();await menu.getByRole('button',{name:'短休',exact:true}).click();await page.getByRole('dialog',{name:'短休',exact:true}).getByRole('button',{name:'确认短休',exact:true}).click();
 expect((await read(page)).runtime.resources['pact-slot:2'].current).toBe(2);expect((await read(page)).runtime.resources['spell-slot:1'].current).toBe(3);
 await quickbar.locator('[data-resource-id="surge"] .resource-widget-face').click();await menu.getByRole('button',{name:'长休',exact:true}).click();await rest.getByRole('button',{name:'确认长休',exact:true}).click();
 const after=await read(page);expect(after.runtime.resources['spell-slot:1'].current).toBe(4);expect(after.runtime.resources.surge.current).toBe(2);expect(after.runtime.rests?.sequence).toBe(2);
 const changed=(await quickbar.locator('.resource-widget-canvas').boundingBox())!;expect(changed).toEqual(bounds);
 await quickbar.locator('[data-resource-id="surge"] .resource-widget-face').click();await menu.screenshot({path:test.info().outputPath('resource-gray-operation-menu.png')});await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await page.reload();expect((await read(page)).runtime.resources).toEqual(after.runtime.resources);
});

test('invalid previews cannot add modules and closing a valid draft discards it',async({page})=>{
 const dialog=await open(page),before=await read(page);await dialog.getByRole('spinbutton',{name:'新模块当前值'}).fill('9');await expect(dialog.locator('[data-template-id="matrix"]')).toBeDisabled();
 await dialog.getByRole('spinbutton',{name:'新模块上限'}).fill('12');await dialog.locator('[data-template-id="matrix"]').click();await expect(dialog).toContainText('尚未保存');await dialog.getByRole('button',{name:'关闭弹窗'}).click();expect(await read(page)).toEqual(before);
});

test('custom name and values follow the drag ghost into the draft without changing live balances',async({page})=>{
 const dialog=await open(page,'interaction'),before=(await read(page)).runtime.resources;
 await dialog.getByRole('textbox',{name:'新模块名称'}).fill('幽灵储备');await dialog.getByRole('spinbutton',{name:'新模块上限'}).fill('7');await dialog.getByRole('spinbutton',{name:'新模块当前值'}).fill('2');
 const sample=dialog.locator('[data-template-id="ring"]');await sample.scrollIntoViewIfNeeded();const rect=(await sample.boundingBox())!;
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+15,rect.y+rect.height/2-10,{steps:3});
 const ghost=page.getByTestId('resource-template-ghost');await expect(ghost.locator('.rm-name')).toHaveText('幽灵储备');await expect(ghost.locator('.rm-readout')).toHaveText('2/ 7');
 const canvas=(await dialog.locator('.resource-widget-canvas').boundingBox())!;await page.mouse.move(canvas.x+canvas.width*10.5/12,canvas.y+canvas.height*4.5/6,{steps:8});await page.mouse.up();
 await expect(ghost).toHaveCount(0);const added=dialog.locator('.resource-widget[data-resource-name="幽灵储备"]');await expect(added).toHaveCount(1);await expect(added.locator('.rm-readout')).toHaveText('2/ 7');expect((await read(page)).runtime.resources).toEqual(before);
 await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const saved=(await read(page)).runtime.resources;for(const [key,value] of Object.entries(before))expect(saved[key]).toEqual(value);
 expect(Object.values(saved).find(r=>r.name==='幽灵储备')).toMatchObject({current:2,max:7});
});

test('a card without resources can rest through the dashboard and cancel, Escape and confirm preserve its layout draft',async({page})=>{
 const dialog=await open(page,'empty'),before=await read(page),dashboard=dialog.getByRole('region',{name:'仪表盘编辑器',exact:true});expect(before.runtime.resources).toEqual({});
 const attacks=dialog.locator('.resource-attacks-widget');await attacks.locator('.resource-attacks-drag').focus();await page.keyboard.press('ArrowRight');await expect(attacks).toHaveAttribute('data-grid-x','1');await expect(dashboard).toHaveAttribute('data-dirty','true');
 const menu=dialog.getByLabel('休息选项'),rest=dialog.getByRole('dialog',{name:'长休',exact:true});
 await menu.getByRole('button',{name:'长休',exact:true}).click();await expect(rest).toBeVisible();expect(await rest.evaluate(el=>el.closest('dialog')===Array.from(document.querySelectorAll('dialog[open]')).at(-1))).toBe(true);
 await rest.getByRole('button',{name:'关闭休息',exact:true}).click();await expect(rest).toHaveCount(0);await expect(dialog).toBeVisible();await expect(attacks).toHaveAttribute('data-grid-x','1');expect(await read(page)).toEqual(before);
 await menu.getByRole('button',{name:'长休',exact:true}).click();await expect(rest).toBeVisible();await page.keyboard.press('Escape');await expect(rest).toHaveCount(0);await expect(dialog).toBeVisible();await expect(dashboard).toHaveAttribute('data-dirty','true');await expect(attacks).toHaveAttribute('data-grid-x','1');expect(await read(page)).toEqual(before);
 await expect(menu.getByRole('button',{name:'长休',exact:true})).toBeFocused();await menu.getByRole('button',{name:'长休',exact:true}).click();await rest.getByRole('button',{name:'确认长休',exact:true}).click();await expect(rest).toHaveCount(0);await expect(dialog).toBeVisible();const rested=await read(page);expect(rested.runtime.hp).toBe(12);expect(rested.runtime.resources).toEqual({});expect(rested.quickbarLayout).toEqual(before.quickbarLayout);expect(rested.runtime.rests?.sequence).toBe(1);await expect(attacks).toHaveAttribute('data-grid-x','1');await expect(dashboard).toHaveAttribute('data-dirty','true');
 await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const saved=await read(page);expect(saved.quickbarLayout?.attacks?.x).toBe(1);expect(saved.runtime).toEqual(rested.runtime);await dialog.screenshot({path:test.info().outputPath('empty-resource-rest-dashboard.png')});
});

test('rest cancellation preserves every balance and confirmation merges with an unsaved icon change',async({page})=>{
 const dialog=await open(page),before=await read(page),dashboard=dialog.getByRole('region',{name:'仪表盘编辑器',exact:true}),surge=dialog.locator('[data-resource-id="surge"]');
 await surge.locator('.resource-widget-face').click();await dialog.getByRole('button',{name:'色调 #a36d61',exact:true}).click();await expect(dashboard).toHaveAttribute('data-dirty','true');
 const longRest=dialog.getByLabel('休息选项').getByRole('button',{name:'长休',exact:true}),rest=dialog.getByRole('dialog',{name:'长休',exact:true});
 await longRest.click();await rest.getByRole('button',{name:'关闭休息',exact:true}).click();expect(await read(page)).toEqual(before);await expect(dashboard).toHaveAttribute('data-dirty','true');
 await longRest.click();await expect(rest).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toBeVisible();expect(await read(page)).toEqual(before);await expect(surge.locator('.resource-module-art')).toHaveCSS('--rm-icon-tone','#a36d61');
 await longRest.click();await rest.getByRole('button',{name:'确认长休',exact:true}).click();const rested=await read(page),expected=structuredClone(before.runtime.resources);
 for(const [id,r] of Object.entries(expected))if(id.startsWith('spell-slot:')||id.startsWith('pact-slot:'))r.current=r.max;
 expect(rested.runtime.resources).toEqual(expected);expect(rested.quickbarLayout).toEqual(before.quickbarLayout);await expect(dashboard).toHaveAttribute('data-dirty','true');
 await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const saved=await read(page);expect(saved.quickbarLayout?.widgets?.surge.color).toBe('#a36d61');expect(saved.runtime.resources).toEqual(expected);await expect(dashboard).toHaveAttribute('data-dirty','false');
});
