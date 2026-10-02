import {test,expect,type Page,type Locator} from '@playwright/test';
import type {Character} from '../../src/core/model';

const fixture='/tests/fixtures/resource-dashboard220/index.html?scenario=interaction';
const read=async(page:Page):Promise<Character>=>JSON.parse((await page.locator('#fixture-data').textContent())!);
const editor=(page:Page)=>page.getByRole('dialog',{name:'仪表盘',exact:true});
const dashboard=(page:Page)=>editor(page).locator('.resource-dashboard');
const canvas=(page:Page)=>editor(page).locator('.resource-widget-canvas');
const widget=(page:Page,id:string)=>editor(page).locator(`[data-resource-id="${id}"]`);
const save=(page:Page)=>editor(page).getByRole('button',{name:'保存布局',exact:true});
const discard=(page:Page)=>editor(page).getByRole('button',{name:'放弃修改',exact:true});
const edits=async(page:Page)=>Number(await page.locator('#fixture-edits').textContent());
async function open(page:Page){await page.locator('.fixture-quickbar').getByRole('button',{name:'仪表盘',exact:true}).click();await expect(editor(page)).toBeVisible();}
async function visit(page:Page){await page.goto(fixture);await expect(page.locator('#fixture-data')).toHaveText(/dashboard220-original-fixture/);await open(page);}
async function geometry(node:Locator){return node.evaluate(el=>Object.fromEntries(['x','y','w','h','page'].map(key=>[key,Number(el.getAttribute(`data-grid-${key}`))])));}
async function dragBy(page:Page,target:Locator,dx:number,dy:number){const box=(await target.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy,{steps:6});await page.mouse.up();}
async function moveCells(page:Page,id:string,x:number,y:number,handle='.resource-widget-face'){const box=(await canvas(page).boundingBox())!;await dragBy(page,widget(page,id).locator(handle),x*box.width/12,y*box.height/6);}
async function startTemplate(page:Page,id='ring'){const sample=editor(page).locator(`[data-template-id="${id}"]`);await sample.scrollIntoViewIfNeeded();const rect=(await sample.boundingBox())!;await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+12,rect.y+rect.height/2-12,{steps:3});await expect(page.getByTestId('resource-template-ghost')).toBeVisible();}
async function finishOnCanvas(page:Page,column:number,row:number){const rect=(await canvas(page).boundingBox())!;await page.mouse.move(rect.x+rect.width*column/12,rect.y+rect.height*row/6,{steps:8});await expect(page.getByTestId('resource-template-drop-preview')).toBeVisible();await expect(page.getByTestId('resource-template-ghost')).toHaveAttribute('data-over-canvas','true');await page.mouse.up();}
const draftIds=async(page:Page)=>editor(page).locator('.resource-widget').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('data-resource-id')!));

test('overlapping movement keeps neighbors fixed, blocks saving, then commits once after correction',async({page})=>{
 await visit(page);const initial=await read(page),neighbor=await geometry(widget(page,'beta')),attacks=await geometry(widget(page,'__attacks__'));
 await moveCells(page,'alpha',2,0);await expect(widget(page,'alpha')).toHaveAttribute('data-overlapping','true');await expect(widget(page,'beta')).toHaveAttribute('data-overlapping','true');
 expect(await geometry(widget(page,'alpha'))).toMatchObject({x:2,y:0,w:4,h:2,page:0});expect(await geometry(widget(page,'beta'))).toEqual(neighbor);expect(await geometry(widget(page,'__attacks__'))).toEqual(attacks);
 await expect(save(page)).toBeDisabled();expect(await edits(page)).toBe(0);expect(await read(page)).toEqual(initial);await editor(page).screenshot({path:test.info().outputPath('overlap-save-blocked.png')});
 await moveCells(page,'alpha',0,2);await expect(save(page)).toBeEnabled();expect(await geometry(widget(page,'beta'))).toEqual(neighbor);expect(await read(page)).toEqual(initial);
 await save(page).click();expect(await edits(page)).toBe(1);const saved=await read(page);expect(saved.quickbarLayout!.widgets!.alpha).toMatchObject({x:2,y:2,w:4,h:2,page:0});expect(saved.quickbarLayout!.widgets!.beta).toMatchObject(neighbor);expect(saved.runtime.resources).toEqual(initial.runtime.resources);
 await page.reload();expect((await read(page)).quickbarLayout).toEqual(saved.quickbarLayout);expect((await read(page)).runtime.resources).toEqual(initial.runtime.resources);expect(await geometry(page.locator('.fixture-quickbar [data-resource-id="alpha"]'))).toMatchObject({x:2,y:2,w:4,h:2,page:0});
});

test('resizing into neighbors leaves every other module in place and dragging back clears the conflict',async({page})=>{
 await visit(page);const initial=await read(page),neighbor=await geometry(widget(page,'beta')),attacks=await geometry(widget(page,'__attacks__'));await widget(page,'alpha').locator('.resource-widget-face').click();
 await moveCells(page,'alpha',2,0,'.handle-e');expect(await geometry(widget(page,'alpha'))).toMatchObject({x:0,y:0,w:6,h:2});expect(await geometry(widget(page,'beta'))).toEqual(neighbor);expect(await geometry(widget(page,'__attacks__'))).toEqual(attacks);await expect(save(page)).toBeDisabled();
 await moveCells(page,'alpha',-2,0,'.handle-e');await expect(widget(page,'alpha')).not.toHaveAttribute('data-overlapping','true');expect(await read(page)).toEqual(initial);expect(await edits(page)).toBe(0);
 await moveCells(page,'alpha',0,1,'.handle-s');await expect(save(page)).toBeEnabled();await save(page).click();expect(await edits(page)).toBe(1);expect((await read(page)).runtime.resources).toEqual(initial.runtime.resources);
});

test('collisions are scoped to a page and paging a module never relocates other modules',async({page})=>{
 await visit(page);const initial=await read(page);await expect(dashboard(page)).toHaveAttribute('data-overlap-count','0');const face=widget(page,'alpha').locator('.resource-widget-face');await face.focus();await face.press('PageDown');
 await expect(editor(page).locator('.resource-page-nav output')).toHaveText('2/2');await expect(widget(page,'alpha')).toHaveAttribute('data-overlapping','true');expect(await geometry(widget(page,'peer'))).toMatchObject({x:0,y:0,w:4,h:3,page:1});await expect(save(page)).toBeDisabled();
 await moveCells(page,'alpha',0,3);await expect(save(page)).toBeEnabled();await save(page).click();const saved=await read(page);expect(saved.quickbarLayout!.widgets!.alpha.page).toBe(1);expect(saved.quickbarLayout!.widgets!.peer).toMatchObject({x:0,y:0,w:4,h:3,page:1});expect(saved.quickbarLayout!.widgets!.beta).toMatchObject({x:4,y:0,w:4,h:2,page:0});expect(saved.runtime.resources).toEqual(initial.runtime.resources);
});

test('palette, configuration and additions remain draft until saving; discard and close restore the card',async({page})=>{
 await visit(page);const initial=await read(page);await widget(page,'beta').locator('.resource-widget-face').click();await editor(page).getByRole('button',{name:'色调 #a36d61',exact:true}).click();await editor(page).getByRole('button',{name:'图标 药瓶',exact:true}).click();
 await widget(page,'beta').locator('.resource-widget-face').dblclick();await editor(page).getByRole('textbox',{name:'资源名称',exact:true}).fill('草稿中的名称');await editor(page).getByRole('button',{name:'保存',exact:true}).click();
 await editor(page).locator('[data-template-id="matrix"]').click();await expect(dashboard(page)).toHaveAttribute('data-dirty','true');expect(await read(page)).toEqual(initial);expect(await edits(page)).toBe(0);
 await discard(page).click();expect(await read(page)).toEqual(initial);expect(await edits(page)).toBe(0);await expect(dashboard(page)).toHaveAttribute('data-dirty','false');
 await editor(page).locator('[data-template-id="diamond"]').click();await editor(page).getByRole('button',{name:'关闭弹窗',exact:true}).click();await open(page);await expect(dashboard(page)).toHaveAttribute('data-dirty','false');expect(await read(page)).toEqual(initial);await page.reload();expect(await read(page)).toEqual(initial);
});

test('gallery pointer drag has a custom ghost, drops once, and can overlap before manual correction',async({page})=>{
 await visit(page);const initial=await read(page);await page.evaluate(()=>{(window as any).__nativeDrags=0;window.addEventListener('dragstart',()=>{(window as any).__nativeDrags++;});});
 await startTemplate(page,'ring');expect(await read(page)).toEqual(initial);await finishOnCanvas(page,5,1);await expect(page.getByTestId('resource-template-ghost')).toHaveCount(0);
 const added=(await draftIds(page)).filter(id=>!['alpha','beta','__attacks__'].includes(id));expect(added).toHaveLength(1);const id=added[0];await expect(widget(page,id)).toHaveAttribute('data-overlapping','true');await expect(save(page)).toBeDisabled();expect(await edits(page)).toBe(0);expect(await page.evaluate(()=>(window as any).__nativeDrags)).toBe(0);
 const g=await geometry(widget(page,id));await moveCells(page,id,8-g.x,3-g.y);await expect(save(page)).toBeEnabled();await save(page).click();const saved=await read(page),addedIds=Object.keys(saved.runtime.resources).filter(key=>!Object.hasOwn(initial.runtime.resources,key));expect(addedIds).toEqual([id]);expect(saved.quickbarLayout!.widgets![id].style).toBe('ring');expect(await edits(page)).toBe(1);for(const [key,value]of Object.entries(initial.runtime.resources))expect(saved.runtime.resources[key]).toEqual(value);
});

test('outside release, Escape and pointercancel remove the gallery ghost without adding or saving',async({page})=>{
 await visit(page);const initial=await read(page),before=await draftIds(page);
 await startTemplate(page,'segments');await page.mouse.move(15,15,{steps:6});await page.mouse.up();await expect(page.getByTestId('resource-template-ghost')).toHaveCount(0);expect(await draftIds(page)).toEqual(before);
 await startTemplate(page,'diamond');await page.keyboard.press('Escape');await page.mouse.up();await expect(page.getByTestId('resource-template-ghost')).toHaveCount(0);await expect(editor(page)).toBeVisible();expect(await draftIds(page)).toEqual(before);
 await startTemplate(page,'pips');await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})));await page.mouse.up();await expect(page.getByTestId('resource-template-ghost')).toHaveCount(0);expect(await draftIds(page)).toEqual(before);expect(await read(page)).toEqual(initial);expect(await edits(page)).toBe(0);
});

test('a simple gallery click remains available and a selected module Escape cancels only its in-flight drag',async({page})=>{
 await visit(page);const initial=await read(page);await editor(page).locator('[data-template-id="fraction"]').click();const selected=editor(page).locator('.resource-widget[data-selected="true"]');await expect(selected).toHaveCount(1);const id=await selected.getAttribute('data-resource-id');expect(id).toBeTruthy();await expect(page.getByTestId('resource-template-ghost')).toHaveCount(0);const before=await geometry(selected),box=(await selected.locator('.resource-widget-face').boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+35,box.y+box.height/2+20,{steps:4});await page.keyboard.press('Escape');await page.mouse.up();expect(await geometry(selected)).toEqual(before);await expect(editor(page)).toBeVisible();expect(await read(page)).toEqual(initial);
 await save(page).click();expect(Object.keys((await read(page)).runtime.resources)).toHaveLength(Object.keys(initial.runtime.resources).length+1);expect(await edits(page)).toBe(1);
});

test('narrow touch pointer dragging from the gallery places one module without changing existing balances',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 try{const page=await context.newPage();await visit(page);const initial=await read(page);const sample=editor(page).locator('[data-template-id="pips"]');await sample.scrollIntoViewIfNeeded();const from=(await sample.boundingBox())!,target=(await canvas(page).boundingBox())!;expect(target.y).toBeGreaterThanOrEqual(0);const client=await context.newCDPSession(page),start={x:from.x+from.width/2,y:from.y+from.height/2},end={x:target.x+target.width*8/12,y:target.y+target.height*4/6};
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});for(let step=1;step<=8;step++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*step/8,y:start.y+(end.y-start.y)*step/8,id:1}]});await expect(page.getByTestId('resource-template-ghost')).toBeVisible();await page.screenshot({path:test.info().outputPath('touch-custom-ghost.png')});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.getByTestId('resource-template-ghost')).toHaveCount(0);
 const added=(await draftIds(page)).filter(id=>!['alpha','beta','__attacks__'].includes(id));expect(added).toHaveLength(1);expect(await read(page)).toEqual(initial);await expect(save(page)).toBeEnabled();await save(page).click();const result=await read(page);expect(Object.keys(result.runtime.resources)).toHaveLength(Object.keys(initial.runtime.resources).length+1);for(const [key,value]of Object.entries(initial.runtime.resources))expect(result.runtime.resources[key]).toEqual(value);expect(await editor(page).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 }finally{await context.close();}
});

test('a compact spell group keeps the saved geometry on the card and after reload without repacking neighbors',async({page})=>{
 await page.goto('/tests/fixtures/resource-dashboard220/index.html');await open(page);const initial=await read(page),pool=widget(page,'spell-slot:1'),pactBefore=await geometry(widget(page,'pact-slot:2')),surgeBefore=await geometry(widget(page,'surge'));
 await pool.locator('.resource-widget-face').click();await moveCells(page,'spell-slot:1',-8,0,'.handle-e');
 // Three actual spell pools remain legible at the supported six-cell minimum.
 await expect(pool).toHaveAttribute('data-grid-w','6');await expect(pool.locator('[data-subresource-id]')).toHaveCount(3);expect(await geometry(widget(page,'pact-slot:2'))).toEqual(pactBefore);expect(await geometry(widget(page,'surge'))).toEqual(surgeBefore);
 const arranged=await geometry(pool);await save(page).click();await editor(page).getByRole('button',{name:'关闭弹窗',exact:true}).click();const main=page.locator('.fixture-quickbar');expect(await geometry(main.locator('[data-resource-id="spell-slot:1"]'))).toEqual(arranged);expect(await geometry(main.locator('[data-resource-id="pact-slot:2"]'))).toEqual(pactBefore);expect(await geometry(main.locator('[data-resource-id="surge"]'))).toEqual(surgeBefore);
 await page.reload();expect(await geometry(main.locator('[data-resource-id="spell-slot:1"]'))).toEqual(arranged);expect((await read(page)).runtime.resources).toEqual(initial.runtime.resources);
});

test('discarding a new page resets gallery drop placement to the currently visible page',async({page})=>{
 await page.goto('/tests/fixtures/resource-dashboard220/index.html');await open(page);const initial=await read(page);await editor(page).locator('[data-template-id="ring"]').click();await expect(editor(page).locator('.resource-page-nav output')).toHaveText('2/2');await discard(page).click();await expect(editor(page).locator('.resource-page-nav output')).toHaveText('1/2');
 await startTemplate(page,'pips');await finishOnCanvas(page,8,5);const selected=editor(page).locator('.resource-widget[data-selected="true"]');await expect(selected).toHaveCount(1);await expect(selected).toHaveAttribute('data-grid-page','0');const id=(await selected.getAttribute('data-resource-id'))!;await expect(save(page)).toBeEnabled();await save(page).click();const saved=await read(page);expect(saved.quickbarLayout!.widgets![id].page).toBe(0);expect(Object.keys(saved.runtime.resources)).toHaveLength(Object.keys(initial.runtime.resources).length+1);for(const[key,value]of Object.entries(initial.runtime.resources))expect(saved.runtime.resources[key]).toEqual(value);
});

test('moving a gallery ghost does not deep-clone the character until a module is actually dropped',async({page})=>{
 await visit(page);const initial=await read(page);
 await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const original=window.structuredClone.bind(window);(window as any).__characterClones=0;(window as any).__ghostPointerMoves=0;window.structuredClone=(value,options)=>{if(value&&typeof value==='object'&&'id' in value&&value.id==='dashboard220-original-fixture')(window as any).__characterClones++;return original(value,options);};window.addEventListener('pointermove',()=>{(window as any).__ghostPointerMoves++;});});
 await startTemplate(page,'pips');const ghost=page.getByTestId('resource-template-ghost'),first=(await ghost.boundingBox())!,rect=(await canvas(page).boundingBox())!;
 for(let step=0;step<6;step++){await page.mouse.move(rect.x+rect.width*(6+step/3)/12,rect.y+rect.height*4/6,{steps:3});await page.evaluate(()=>new Promise(requestAnimationFrame));}
 await expect(ghost).toHaveAttribute('data-over-canvas','true');expect(await ghost.boundingBox()).not.toEqual(first);expect(await page.evaluate(()=>(window as any).__ghostPointerMoves)).toBeGreaterThanOrEqual(18);expect(await page.evaluate(()=>(window as any).__characterClones)).toBe(0);expect(await read(page)).toEqual(initial);expect(await edits(page)).toBe(0);
 await page.mouse.up();await expect(ghost).toHaveCount(0);expect(await page.evaluate(()=>(window as any).__characterClones)).toBeGreaterThan(0);expect(await read(page)).toEqual(initial);await expect(save(page)).toBeEnabled();await save(page).click();expect(await edits(page)).toBe(1);expect(Object.keys((await read(page)).runtime.resources)).toHaveLength(Object.keys(initial.runtime.resources).length+1);
});
