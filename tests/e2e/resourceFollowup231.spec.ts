import {test,expect,type Page} from '@playwright/test';
import type {Character} from '../../src/core/model';

const fixture='/tests/fixtures/resource-dashboard220/index.html';
const read=async(page:Page):Promise<Character>=>JSON.parse((await page.locator('#fixture-data').textContent())!);
async function open(page:Page,scenario='default'){
 await page.goto(`${fixture}?scenario=${scenario}`);await page.getByTestId('dashboard-open').click();
 const dialog=page.getByRole('dialog',{name:'仪表盘',exact:true});await expect(dialog).toBeVisible();return dialog;
}

test('name and numbers preview before creating, persist after explicit save, and preserve existing pools',async({page})=>{
 const dialog=await open(page),before=(await read(page)).runtime.resources;
 await dialog.getByRole('textbox',{name:'新模块名称',exact:true}).fill('旅途储备');
 await dialog.getByRole('spinbutton',{name:'新模块上限',exact:true}).fill('8');
 await dialog.getByRole('spinbutton',{name:'新模块当前值',exact:true}).fill('5');
 const sample=dialog.locator('[data-template-id="pips"]');await expect(sample.locator('.rm-name')).toHaveText('旅途储备');await expect(sample.locator('.rm-icon-unit')).toHaveCount(8);await expect(sample.locator('.rm-icon-unit.is-filled')).toHaveCount(5);
 const previewColor=await sample.locator('.resource-dashboard-icon').first().evaluate(el=>getComputedStyle(el).color);
 expect((await read(page)).runtime.resources).toEqual(before);
 await sample.click();const added=dialog.locator('.resource-widget[data-selected=true]');await expect(added.locator('.rm-name')).toHaveText('旅途储备');await expect(added.locator('.rm-icon-unit')).toHaveCount(8);await expect(added.locator('.rm-icon-unit.is-filled')).toHaveCount(5);
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
 await expect(icon).toHaveCSS('color','rgb(163, 109, 97)');expect((await icon.boundingBox())!.height).toBeGreaterThan(8);await expect(face.locator('.rm-icon-unit')).toHaveCount(5);await expect(face.locator('.rm-icon-unit.is-filled')).toHaveCount(3);
 await page.setViewportSize({width:390,height:844});await expect(dialog.getByRole('textbox',{name:'资源名称'})).toHaveValue('动作如潮');
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 expect(await dialog.locator('.resource-template-option').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-template-id')))).toEqual(['ring','pips','half','orbit','square','segments','reservoir','matrix','fraction','counter','diamond']);
 await dialog.screenshot({path:test.info().outputPath('resource-gray-preview-narrow.png')});
});

test('unbounded values display a single number without infinity and keep old data unchanged',async({page})=>{
 const dialog=await open(page),before=(await read(page)).runtime.resources;
 await dialog.getByRole('checkbox',{name:'新模块有上限'}).uncheck();await dialog.getByRole('spinbutton',{name:'新模块当前值'}).fill('123456');
 const sample=dialog.locator('[data-template-id="ring"]');await expect(sample.locator('.rm-readout')).toHaveText('123456');await expect(sample.locator('.resource-module-art')).toHaveAttribute('data-module-style','ring');await expect(sample.locator('.rm-track')).toBeVisible();await expect(sample.locator('.rm-arc,.rm-readout small,.rm-value-slash')).toHaveCount(0);
 const number=(await sample.locator('.rm-readout strong').boundingBox())!,shape=(await sample.locator('.rm-shape').boundingBox())!;expect(Math.abs(number.x+number.width/2-shape.x-shape.width/2)).toBeLessThan(1.5);expect(Math.abs(number.y+number.height/2-shape.y-shape.height/2)).toBeLessThan(1.5);
 expect(await dialog.innerText()).not.toContain('∞');await sample.click();await dialog.getByRole('button',{name:'保存布局',exact:true}).click();
 const current=(await read(page)).runtime.resources,id=Object.keys(current).find(key=>!Object.hasOwn(before,key))!;expect(current[id]).toMatchObject({current:123456,unlimited:true,type:'number'});for(const [key,value] of Object.entries(before))expect(current[key]).toEqual(value);
 await dialog.getByRole('button',{name:'关闭弹窗'}).click();await page.reload();const coins=page.locator('.fixture-quickbar [data-resource-id="coins"]');await coins.scrollIntoViewIfNeeded();
 await expect(coins.locator('.rm-fraction strong')).toHaveText('1874');expect(await page.locator('.fixture-quickbar .resource-widget-scroll').evaluate(node=>node.scrollTop)).toBeGreaterThan(0);await expect(page.getByRole('button',{name:'下一页资源'})).toHaveCount(0);
});

test('module settings use name and upper limit, preview immediately, and cancel without changing resources',async({page})=>{
 const dialog=await open(page),before=(await read(page)).runtime.resources;await dialog.locator('[data-resource-id="surge"] .resource-widget-face').dblclick();
 await expect(dialog.locator('.resource-editor-form .segmented')).toHaveCount(0);
 await dialog.getByRole('textbox',{name:'资源名称',exact:true}).fill('试填资源');await dialog.getByRole('spinbutton',{name:'资源剩余',exact:true}).fill('1');
 const preview=dialog.getByLabel('资源设置预览');await expect(preview.locator('.rm-name')).toHaveText('试填资源');await expect(preview.locator('.rm-icon-unit')).toHaveCount(5);await expect(preview.locator('.rm-icon-unit.is-filled')).toHaveCount(1);
 await dialog.getByRole('checkbox',{name:'资源有上限'}).uncheck();await expect(preview.locator('.rm-count-fallback')).toHaveText('1');await expect(preview.locator('.resource-module-art')).toHaveAttribute('data-module-style','pips');
 await dialog.getByRole('button',{name:'新模块',exact:true}).click();expect((await read(page)).runtime.resources).toEqual(before);
 await dialog.getByRole('button',{name:'关闭弹窗'}).click();expect((await read(page)).runtime.resources).toEqual(before);
});

test('resource menus preserve spending and omit every rest entry',async({page})=>{
 await page.goto(fixture);const quickbar=page.locator('.fixture-quickbar'),before=await read(page),bounds=await quickbar.boundingBox();
 await quickbar.locator('[data-resource-id="surge"] .resource-widget-face').click();const menu=page.getByRole('dialog',{name:'动作如潮资源操作',exact:true});
 await expect(menu.getByRole('button',{name:/短休|长休/})).toHaveCount(0);await menu.getByRole('button',{name:'动作如潮 3',exact:true}).click();
 const after=await read(page);expect(after.runtime.resources.surge.current).toBe(2);expect(after.runtime.resources['spell-slot:1']).toEqual(before.runtime.resources['spell-slot:1']);expect(after.runtime.rests).toEqual(before.runtime.rests);expect(await quickbar.boundingBox()).toEqual(bounds);
 await menu.screenshot({path:test.info().outputPath('resource-operation-no-rest.png')});await page.keyboard.press('Escape');await page.reload();expect((await read(page)).runtime.resources).toEqual(after.runtime.resources);
});

test('invalid previews cannot add modules and closing a valid draft discards it',async({page})=>{
 const dialog=await open(page),before=await read(page);await dialog.getByRole('spinbutton',{name:'新模块当前值'}).fill('9');await expect(dialog.locator('[data-template-id="matrix"]')).toBeDisabled();
 await dialog.getByRole('spinbutton',{name:'新模块上限'}).fill('10');await dialog.locator('[data-template-id="matrix"]').click();await expect(dialog).toContainText('尚未保存');await dialog.getByRole('button',{name:'关闭弹窗'}).click();expect(await read(page)).toEqual(before);
});

test('custom name and values follow the drag ghost into the draft without changing live balances',async({page})=>{
 const dialog=await open(page,'interaction'),before=(await read(page)).runtime.resources;
 await dialog.getByRole('textbox',{name:'新模块名称'}).fill('幽灵储备');await dialog.getByRole('spinbutton',{name:'新模块上限'}).fill('7');await dialog.getByRole('spinbutton',{name:'新模块当前值'}).fill('2');
 const sample=dialog.locator('[data-template-id="ring"]'),scroll=dialog.locator('.resource-widget-scroll');await scroll.evaluate(node=>node.scrollTop=0);
 const ghost=page.getByTestId('resource-template-ghost');
 async function startGhost(){await sample.scrollIntoViewIfNeeded();const rect=(await sample.boundingBox())!;await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+15,rect.y+rect.height/2-10,{steps:3});await expect(ghost.locator('.rm-name')).toHaveText('幽灵储备');await expect(ghost.locator('.rm-readout')).toHaveText('2/ 7');}
 await startGhost();
 // The complete canvas includes offscreen vertical bands. Releasing over a
 // clipped band must cancel, even though the point is inside its DOM bounds.
 const canvas=(await dialog.locator('.resource-widget-canvas').boundingBox())!,viewport=(await scroll.boundingBox())!;
 const outside={x:canvas.x+canvas.width*10.5/12,y:canvas.y+canvas.height*4.5/6};expect(outside.y).toBeGreaterThan(viewport.y+viewport.height);
 await page.mouse.move(outside.x,outside.y,{steps:8});await expect(ghost).toHaveAttribute('data-over-canvas','false');await expect(page.getByTestId('resource-template-drop-preview')).toHaveCount(0);await page.mouse.up();
 await expect(ghost).toHaveCount(0);await expect(dialog.locator('.resource-widget[data-resource-name="幽灵储备"]')).toHaveCount(0);expect((await read(page)).runtime.resources).toEqual(before);
 await startGhost();const visible=(await scroll.boundingBox())!,target={x:visible.x+visible.width*10.5/12,y:visible.y+visible.height*4.5/6};
 expect(target.x).toBeGreaterThan(visible.x);expect(target.x).toBeLessThan(visible.x+visible.width);expect(target.y).toBeGreaterThan(visible.y);expect(target.y).toBeLessThan(visible.y+visible.height);
 await page.mouse.move(target.x,target.y,{steps:8});await expect(ghost).toHaveAttribute('data-over-canvas','true');await expect(page.getByTestId('resource-template-drop-preview')).toHaveAttribute('data-overlap','false');await page.mouse.up();
 await expect(ghost).toHaveCount(0);const added=dialog.locator('.resource-widget[data-resource-name="幽灵储备"]');await expect(added).toHaveCount(1);await expect(added).toHaveAttribute('data-grid-page','0');await expect(added).toHaveAttribute('data-grid-x','9');await expect(added).toHaveAttribute('data-grid-y','3');await expect(added.locator('.rm-readout')).toHaveText('2/ 7');expect((await read(page)).runtime.resources).toEqual(before);
 await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const saved=(await read(page)).runtime.resources;for(const [key,value] of Object.entries(before))expect(saved[key]).toEqual(value);
 expect(Object.values(saved).find(r=>r.name==='幽灵储备')).toMatchObject({current:2,max:7});
});

test('an empty dashboard adjusts its divider without creating resources or recovering health',async({page})=>{
 const dialog=await open(page,'empty'),before=await read(page),divider=dialog.getByRole('separator');
 await expect(dialog.getByRole('button',{name:/短休|长休/})).toHaveCount(0);await divider.focus();await page.keyboard.press('ArrowRight');
 await dialog.getByRole('button',{name:'保存布局',exact:true}).click();const saved=await read(page);expect(saved.runtime).toEqual(before.runtime);expect(saved.quickbarLayout?.attacks?.resourceArea).toBe(true);
});

test('discarding an icon draft preserves every live balance and saved presentation',async({page})=>{
 const dialog=await open(page),before=await read(page),surge=dialog.locator('[data-resource-id="surge"]');
 await surge.locator('.resource-widget-face').click();await dialog.getByRole('button',{name:'色调 #a36d61',exact:true}).click();await expect(dialog.getByRole('button',{name:/短休|长休/})).toHaveCount(0);
 await dialog.getByRole('button',{name:'放弃修改',exact:true}).click();expect(await read(page)).toEqual(before);await expect(surge.locator('.resource-module-art')).toHaveCSS('--rm-icon-tone','#527880');
});
