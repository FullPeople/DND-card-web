import {test,expect,type Page} from '@playwright/test';
async function harness(page:Page){
 await page.route('**/currency181-harness',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8">${['style','workspace','workbench','overview','library','cardAtmosphere','characterPages','suiteTheme','responsive177'].map(name=>`<link rel="stylesheet" href="/src/ui/${name}.css">`).join('')}<style>body{height:auto;overflow:auto}#test-root{padding:16px}.dm-console{overflow:visible}</style></head><body><div id="test-root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/tests/e2e/resources179.harness.jsx"></script></body></html>`}));
 await page.goto('/currency181-harness#suite=resources179&bridge='+encodeURIComponent('http://127.0.0.1:5182'));
 await expect(page.locator('[data-resource-target="hero2"]')).toBeVisible();
 await page.evaluate(()=>{const w=window as any,original=w.emit;let sequence=1000;w.emit=(type:string,rest:any={})=>{if(type==='ack'&&rest.result?.snapshots)rest={...rest,result:{...rest.result,catalog:{sequence:++sequence,cards:w.cards,monsters:[]}}};if(type==='catalog')rest={...rest,sequence:++sequence};original(type,rest);};});
}
test('status add/remove fast catalog acknowledgments accept legacy nested currency without crashing or losing updates',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await harness(page);
 // This is the inventory.currency shape exported by stable Suite's 2014/2024
 // spreadsheet parser. The fast condition ACK used to publish it as card.coins.
 await page.evaluate(()=>{(window as any).cards[2].coins={wallet:{gp:12,pp:1,ep:0,sp:3,cp:4},total_gp:22.34,total_gp_raw:'22.34GP'};});
 const card=page.locator('[data-resource-target="hero2"]'),source=page.locator('#wiki-condition');const a=(await source.boundingBox())!,b=(await card.locator('.resource179-name').boundingBox())!;
 await page.mouse.move(a.x+7,a.y+7);await page.mouse.down();await page.mouse.move(b.x+12,b.y+9,{steps:10});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>(window as any).requests.filter((r:any)=>r.type==='condition').at(-1)?.action)).toBe('add');
 expect(errors).toEqual([]);await expect(card.locator('[data-overview-condition="poisoned"]')).toBeVisible();
 const coins=card.locator('.overview-character-facts');await expect(coins).toHaveText('4 铜币3 银币12 金币1 铂金币');await expect(card.getByText('凯瑟琳',{exact:true})).toBeVisible();
 const chip=card.locator('[data-overview-condition="poisoned"]'),c=(await chip.boundingBox())!;await page.mouse.move(c.x+7,c.y+7);await page.mouse.down();await page.mouse.move(4,600,{steps:10});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>(window as any).requests.filter((r:any)=>r.type==='condition').at(-1)?.action)).toBe('remove');await expect(chip).toHaveCount(0);await expect(coins).toHaveText('4 铜币3 银币12 金币1 铂金币');
 await page.evaluate(()=>(window as any).refresh());await expect(chip).toHaveCount(0);expect(errors).toEqual([]);
 expect(await page.evaluate(()=>(window as any).cards[2].conditions)).toEqual([]);
 await page.screenshot({path:'F:/CodexWork/2026-09-20/w-xu/release182-fixes/screenshots/legacy-wallet-after-condition.png'});
});

test('unknown malformed coin values never become React children and numeric legacy totals remain readable',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await harness(page);
 await page.evaluate(()=>{const w=window as any;w.cards[0].coins={cp:2,gp:{nested:true},unexpected:{gp:50}};w.cards[1].coins='13.5 GP';w.cards[2].coins=7;w.refresh();});
 await expect(page.locator('[data-resource-target="hero0"] .overview-character-facts')).toHaveText('2 铜币');await expect(page.locator('[data-resource-target="hero1"] .overview-character-facts')).toHaveText('13.5 金币');await expect(page.locator('[data-resource-target="hero2"] .overview-character-facts')).toHaveText('7 金币');expect(errors).toEqual([]);
});
