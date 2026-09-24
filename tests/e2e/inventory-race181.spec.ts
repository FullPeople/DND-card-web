import {test,expect,type Page} from '@playwright/test';
async function harness(page:Page){
 await page.route('**/inventory181-harness',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8">${['style','workspace','workbench','overview','library','cardAtmosphere','characterPages','suiteTheme'].map(name=>`<link rel="stylesheet" href="/src/ui/${name}.css">`).join('')}<style>body{height:auto;overflow:auto}#test-root{width:660px;padding:16px;box-sizing:border-box}.stock-board{height:430px}</style></head><body><div id="test-root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/tests/e2e/inventoryRace181.harness.jsx"></script></body></html>`}));
 await page.goto('/inventory181-harness#suite=inventory181&bridge='+encodeURIComponent(String(test.info().project.use.baseURL)));await expect(page.locator('[data-stock-id="coin"]')).toBeVisible();
}
async function move(page:Page,slot:number){
 const from=(await page.locator('[data-stock-id="coin"]').boundingBox())!,to=(await page.locator(`[data-stock-slot="${slot}"]`).boundingBox())!;
 await page.mouse.move(from.x+15,from.y+12);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8});await page.mouse.up();await expect(page.locator('.pointer-ghost')).toHaveCount(0);
}
test('two rapid moves serialize against fresh authority while an unrelated remote edit remains visible',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await harness(page);
 await move(page,5);await expect(page.locator('[data-stock-id="coin"]')).toHaveAttribute('data-stock-slot','5');
 await page.evaluate(()=>(window as any).remoteQuantity());await expect(page.getByRole('button',{name:'金币数量'})).toHaveText('x11');await expect(page.getByRole('button',{name:'银币数量'})).toHaveText('x9');
 await move(page,8);await expect(page.locator('[data-stock-id="coin"]')).toHaveAttribute('data-stock-slot','8');
 expect(await page.evaluate(()=>(window as any).requests.length)).toBe(1);
 await page.evaluate(()=>{(window as any).slotFrames=[];(window as any).respondNext();});
 await expect.poll(()=>page.evaluate(()=>(window as any).requests.length)).toBe(2);
 const operations=await page.evaluate(()=>(window as any).requests.map((r:any)=>r.operation));expect(operations[0].observedSlots).toEqual({coin:0});expect(operations[1].observedSlots).toEqual({coin:5});expect(operations[1].expected['card:hero']).toBe(3);
 await expect(page.locator('[data-stock-id="coin"]')).toHaveAttribute('data-stock-slot','8');await expect(page.getByRole('button',{name:'金币数量'})).toHaveText('x11');
 await page.evaluate(()=>(window as any).respondNext());await page.evaluate(()=>(window as any).refresh());await expect(page.locator('[data-stock-id="coin"]')).toHaveAttribute('data-stock-slot','8');await expect(page.getByRole('button',{name:'金币数量'})).toHaveText('x11');
 expect(await page.evaluate(()=>(window as any).slotFrames.every((slot:number)=>slot===8))).toBe(true);expect(await page.evaluate(()=>(window as any).errors)).toEqual([]);expect(errors).toEqual([]);
});
test('a real rejected move reports through the toast channel without moving the stock grid',async({page})=>{
 await harness(page);const grid=page.locator('.stock-collection'),before=(await grid.boundingBox())!;await move(page,5);await page.evaluate(()=>(window as any).respondNext(true));await expect.poll(()=>page.evaluate(()=>(window as any).errors.length)).toBe(1);
 await expect(page.locator('.stock-board [role="alert"]')).toHaveCount(0);const after=(await grid.boundingBox())!;expect(after.y).toBe(before.y);expect(after.height).toBe(before.height);expect(await page.evaluate(()=>(window as any).errors[0].message)).toContain('背包已被其他人修改');
});
