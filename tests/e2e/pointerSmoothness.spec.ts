import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';

async function harness(page:Page){
  page.on('pageerror',error=>console.error('pointer smoothness harness:',error.message));
  await page.route('**/pointer-smoothness-harness',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:20px;font:14px sans-serif}.wiki-layout{display:flex;width:900px;height:220px;background:#eee}.catalog{flex:0 0 var(--catalog-width,380px)}.wiki-splitter{flex:0 0 10px;cursor:col-resize;touch-action:none;background:#aaa}.reader{flex:1}
    #source{margin:30px 0;width:120px;height:34px}#target{position:absolute;left:400px;top:280px;width:140px;height:80px;background:#ddd}
    .pointer-ghost{position:fixed;left:0;top:0;pointer-events:none;background:#ddd;z-index:9999}.sheet-pane{width:280px;height:180px;overflow:auto;position:absolute;left:700px;top:290px}.outer-content{height:650px}.cell-content{height:180px;overflow:auto}.inner-content{height:500px;background:#eee}
    </style></head><body><div id="root"></div><button id="source">Drag source</button><div id="target">Drop target</div><div id="outer" class="sheet-pane"><div class="outer-content"><div id="inner" class="cell-content"><div class="inner-content">Scrollable target</div></div></div></div>
    <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
    <script type="module" src="/tests/e2e/pointerSmoothness.harness.jsx"></script></body></html>`}));
  await page.goto('/pointer-smoothness-harness');
  await expect(page.getByRole('separator')).toBeVisible();
}

test('Wiki splitter coalesces a pointer burst and persists the exact release position',async({page},info)=>{
  await harness(page);
  const divider=page.getByRole('separator'),original=Number(await divider.getAttribute('aria-valuenow')),box=(await divider.boundingBox())!,x=box.x+box.width/2,y=box.y+40;
  await page.mouse.move(x,y);await page.mouse.down();
  const result=await page.evaluate(({x,y})=>{
    const parent=document.querySelector<HTMLElement>('.wiki-layout')!,original=parent.style.setProperty.bind(parent.style),writes:string[]=[];
    parent.style.setProperty=(property,value,priority)=>{if(property==='--catalog-width')writes.push(value||'');original(property,value,priority);};
    for(let i=1;i<=90;i++)document.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,isPrimary:true,clientX:x+i,clientY:y}));
    document.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,isPrimary:true,clientX:x+40,clientY:y}));
    return {writes,width:parseFloat(parent.style.getPropertyValue('--catalog-width'))};
  },{x,y});
  await page.mouse.up();
  expect(result.writes).toHaveLength(1);expect(result.width).toBeCloseTo(original+40,0);
  await expect(divider).toBeFocused();await expect(page.locator('body')).not.toHaveClass(/wiki-resizing/);
  await divider.press('ArrowLeft');const remembered=await divider.getAttribute('aria-valuenow');
  await page.reload();await expect(page.getByRole('separator')).toHaveAttribute('aria-valuenow',remembered!);
  await info.attach('splitter-burst.json',{body:JSON.stringify({pointerMoves:90,writes:result.writes.length,releaseWidth:result.width},null,2),contentType:'application/json'});
});

test('Wiki splitter ignores another pointer cancellation and rolls back pending work on Escape',async({page})=>{
  await harness(page);const divider=page.getByRole('separator'),original=await divider.getAttribute('aria-valuenow'),box=(await divider.boundingBox())!,x=box.x+box.width/2,y=box.y+40;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.evaluate(({x,y})=>{
    document.dispatchEvent(new PointerEvent('pointercancel',{pointerId:2,isPrimary:false}));
    document.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,isPrimary:true,clientX:x+60,clientY:y}));
  },{x,y});
  await expect(divider).not.toHaveAttribute('aria-valuenow',original!);
  await page.evaluate(({x,y})=>{
    document.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,isPrimary:true,clientX:x+120,clientY:y}));
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  },{x,y});
  await page.mouse.up();await expect(divider).toHaveAttribute('aria-valuenow',original!);await expect(page.locator('body')).not.toHaveClass(/wiki-resizing/);
  expect(await page.evaluate(()=>localStorage.getItem('dnd-card:wiki-column-ratio'))).toBeNull();
});

test('stationary drag does not repeat callbacks but follows a changed target and final drop',async({page},info)=>{
  await harness(page);const source=(await page.locator('#source').boundingBox())!;
  await page.mouse.move(source.x+12,source.y+12);await page.mouse.down();await page.mouse.move(450,320,{steps:5});
  await expect(page.locator('.pointer-ghost')).toHaveCount(1);await page.waitForTimeout(60);
  const before=await page.evaluate(()=>(window as any).dragMoves.length);await page.waitForTimeout(200);
  const after=await page.evaluate(()=>(window as any).dragMoves.length);expect(after-before).toBe(0);
  await page.evaluate(()=>{const target=document.querySelector('#target')!;target.innerHTML='<div id="replacement" style="width:100%;height:100%">New target</div>';});
  await expect.poll(()=>page.evaluate(()=>(window as any).dragMoves.at(-1)?.hit)).toBe('replacement');
  await page.mouse.up();await expect(page.locator('.pointer-ghost')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).dragFinishes)).toEqual([{point:{x:450,y:320},hit:'replacement'}]);
  await info.attach('stationary-drag.json',{body:JSON.stringify({stationaryWindowMs:200,duplicateMoveCallbacks:after-before},null,2),contentType:'application/json'});
});

test('stationary edge drag scrolls the parent after its inner region reaches the end',async({page})=>{
  await harness(page);await page.locator('#inner').evaluate(node=>{node.scrollTop=node.scrollHeight;});
  const source=(await page.locator('#source').boundingBox())!,outer=(await page.locator('#outer').boundingBox())!;
  await page.mouse.move(source.x+12,source.y+12);await page.mouse.down();await page.mouse.move(outer.x+50,outer.y+outer.height-5,{steps:5});
  await expect.poll(()=>page.locator('#outer').evaluate(node=>node.scrollTop)).toBeGreaterThan(21);
  await page.keyboard.press('Escape');await page.mouse.up();await expect(page.locator('.pointer-ghost')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).dragFinishes)).toHaveLength(0);expect(await page.evaluate(()=>(window as any).dragCancels)).toBe(1);
});

test('drop uses release coordinates even when no move event reached that target',async({page})=>{
  await harness(page);const source=(await page.locator('#source').boundingBox())!;
  await page.mouse.move(source.x+12,source.y+12);await page.mouse.down();await page.mouse.move(source.x+40,source.y+12);
  await expect(page.locator('.pointer-ghost')).toHaveCount(1);
  await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,isPrimary:true,clientX:450,clientY:320})));
  await page.mouse.up();await expect(page.locator('.pointer-ghost')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).dragFinishes)).toEqual([{point:{x:450,y:320},hit:'target'}]);
});

test('dragging at the responsive card viewport edge scrolls without committing a cancelled drop',async({page},info)=>{
  await page.setViewportSize({width:1512,height:650});await mockSource(page,{displayMode:'screen'});await page.goto('/');
  await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
  const announcement=page.locator('.announcement[open]');
  if(await announcement.isVisible()){
    await announcement.getByRole('button',{name:'我知道了',exact:true}).click();
    await expect(announcement).toBeHidden();
  }
  await page.getByRole('switch',{name:'编辑模式'}).click();
  const viewport=page.locator('.sheet-viewport'),source=(await page.locator('.catalog-row').filter({hasText:'测试法师'}).first().boundingBox())!;
  expect(await viewport.evaluate(node=>node.scrollHeight-node.clientHeight)).toBeGreaterThan(40);
  const initial=await viewport.evaluate(node=>node.scrollTop),box=(await viewport.boundingBox())!;
  await page.mouse.move(source.x+15,source.y+12);await page.mouse.down();await page.mouse.move(box.x+box.width*.5,box.y+box.height-5,{steps:8});
  await expect.poll(()=>viewport.evaluate(node=>node.scrollTop)).toBeGreaterThan(initial+35);
  await page.screenshot({path:info.outputPath('card-edge-drag.png')});
  await page.keyboard.press('Escape');await page.mouse.up();await expect(page.locator('.pointer-ghost')).toHaveCount(0);
  await expect(page.locator('.identity-class')).not.toContainText('测试法师');await expect(page.locator('.drag-lifted')).toHaveCount(0);
});
