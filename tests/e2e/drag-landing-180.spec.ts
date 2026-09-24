import {test,expect,type Page,type Locator} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter,type Entry} from '../../src/core/model';
const output='F:/CodexWork/2026-09-20/w-xu/tests180-drag';
async function harness(page:Page,width=1400){
 page.on('pageerror',error=>console.error('drag180 harness:',error.message));
 await page.setViewportSize({width,height:1400});
 await page.route('**/drag180-harness',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8">${['style','workspace','workbench','overview','library','cardAtmosphere','libraryRefine','characterPages','suiteTheme','responsive176','responsive177'].map(name=>`<link rel="stylesheet" href="/src/ui/${name}.css">`).join('')}<style>body{height:auto;overflow:auto}#test-root{padding:12px;box-sizing:border-box}.dm-console{overflow:visible}.drag180-sources{position:sticky;top:0;z-index:500;display:flex;gap:6px;background:#ddd;padding:4px}.drag180-sources button{width:120px;height:30px}</style></head><body><div id="test-root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/tests/e2e/dragLanding180.harness.jsx"></script></body></html>`}));
 await page.goto('/drag180-harness#suite=drag180&bridge='+encodeURIComponent('http://127.0.0.1:5179'));
 await expect(page.locator('[data-resource-target="hero0"]')).toBeVisible();
}
async function boundedDrag(page:Page,source:Locator,target:Locator,screenshot?:string){
 await source.scrollIntoViewIfNeeded();const a=(await source.boundingBox())!;
 await page.evaluate(()=>{const w=window as any;w.dragFrames=[];w.dragEnds=[];w.dragRecord=true;const sample=()=>{if(!w.dragRecord)return;const ghost=document.querySelector<HTMLElement>('.pointer-ghost');if(ghost){const s=getComputedStyle(ghost);w.dragFrames.push({w:parseFloat(s.width),h:parseFloat(s.height),landing:ghost.dataset.landing==='true'});if(ghost.dataset.landing==='true'&&!w.dragEnds.length)w.dragEnds=ghost.getAnimations().flatMap(a=>(a.effect as KeyframeEffect).getKeyframes()).map(f=>({w:parseFloat(String(f.width)),h:parseFloat(String(f.height))}));}requestAnimationFrame(sample);};requestAnimationFrame(sample);});
 await page.mouse.move(a.x+Math.min(12,a.width/2),a.y+Math.min(8,a.height/2));await page.mouse.down();
 const b=(await target.boundingBox())!;await page.mouse.move(b.x+b.width*.45,b.y+Math.min(b.height/2,40),{steps:12});
 await expect(page.locator('.pointer-ghost')).toHaveCount(1);
 const lifted=await page.locator('.pointer-ghost').evaluate(el=>({w:parseFloat(getComputedStyle(el).width),h:parseFloat(getComputedStyle(el).height)}));
 if(screenshot)await page.screenshot({path:`${output}/${screenshot}.png`});
 await page.mouse.up();
 await expect(page.locator('.pointer-ghost')).toHaveCount(0);
 const {frames,endFrames}=await page.evaluate(()=>{const w=window as any;w.dragRecord=false;return {frames:w.dragFrames as {w:number;h:number;landing:boolean}[],endFrames:w.dragEnds as {w:number;h:number}[]};});
 expect(frames.some(f=>f.landing)).toBe(true);
 expect(endFrames.length).toBeGreaterThanOrEqual(2);
 for(const frame of [...frames,...endFrames]){expect(frame.w).toBeLessThanOrEqual(Math.max(lifted.w,240)+2);expect(frame.h).toBeLessThanOrEqual(Math.max(lifted.h,80)+2);}
 return {lifted,frames,endFrames};
}
for(const width of [1400,420])test(`Wiki, stock and condition transfers land compactly on overview at ${width}px`,async({page})=>{
 await harness(page,width);const recipient=page.locator('[data-resource-target="hero1"]');
 await boundedDrag(page,page.locator('#wiki-item'),recipient,`wiki-overview-${width}`);
 await expect.poll(()=>page.evaluate(()=>(window as any).inventory.containers['card:hero1'].items.length)).toBe(1);
 await boundedDrag(page,page.locator('.public-stock [data-stock-id="stock-rope"]'),recipient,`stock-overview-${width}`);
 await expect.poll(()=>page.evaluate(()=>(window as any).requests.filter((r:any)=>r.type==='inventory').at(-1)?.operation.to)).toBe('card:hero1');
 await boundedDrag(page,page.locator('[data-resource-target="hero0"] [data-overview-condition="prone"]'),recipient);
 await expect(recipient.locator('[data-overview-condition="prone"]')).toBeVisible();
 await boundedDrag(page,page.locator('#wiki-condition'),recipient);
 await expect(recipient.locator('[data-overview-condition="poisoned"]')).toBeVisible();
});
test('monster roster accepts Wiki and warehouse items without using its whole frame for landing',async({page})=>{
 await harness(page,900);await page.getByRole('button',{name:'怪物',exact:true}).click();const target=page.locator('[data-resource-target="beast"]');
 await boundedDrag(page,page.locator('#wiki-item'),target,'monster-overview');await expect.poll(()=>page.evaluate(()=>(window as any).inventory.containers['monster:beast'].items.length)).toBe(1);
 await boundedDrag(page,page.locator('.public-stock [data-stock-id="stock-rope"]'),target);await expect.poll(()=>page.evaluate(()=>(window as any).requests.filter((r:any)=>r.type==='inventory').at(-1)?.operation.to)).toBe('monster:beast');
 await boundedDrag(page,page.locator('#wiki-condition'),target);await expect(target.locator('[data-overview-condition="poisoned"]')).toBeVisible();
});
test('Wiki item fits an actual monster backpack slot and the received data persists',async({page})=>{
 await harness(page,900);await page.evaluate(()=>(window as any).renderMode('monster'));await page.getByRole('tab',{name:'背包',exact:true}).click();
 await boundedDrag(page,page.locator('#wiki-item'),page.locator('.paper .stock-empty').first(),'monster-backpack');await expect(page.locator('.paper [data-entry-id="rope"]')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).inventory.containers['monster:beast'].items[0].entry.id)).toBe('rope');
});
for(const width of [900,420])test(`monster main card receives Wiki items and condition bubbles at ${width}px`,async({page})=>{
 await harness(page,width);await page.evaluate(()=>(window as any).renderMode('monster'));const target=page.locator('.workbench-monster');
 await expect(target).toHaveAttribute('data-inventory-recipient','monster:beast');await boundedDrag(page,page.locator('#wiki-item'),target,`monster-main-${width}`);await expect.poll(()=>page.evaluate(()=>(window as any).inventory.containers['monster:beast'].items.length)).toBe(1);
 await boundedDrag(page,page.locator('#wiki-condition'),target);await expect(target.locator('[data-overview-condition="poisoned"]')).toBeVisible();await page.getByRole('tab',{name:'背包',exact:true}).click();await expect(page.locator('.paper [data-entry-id="rope"]')).toBeVisible();
});
test('an actual character item still morphs into an equipment chip and remains in its backpack',async({page})=>{
 await mockSource(page);const c=newCharacter();const entry:Entry={id:'test-rope',kind:'item',name:'旅人绳索',english:'Test Rope',source:'XPHB',edition:'2024',packId:'test',revision:'1',entries:['测试绳索'],raw:{weight:2,value:100}};c.selections.push({id:'rope-selection',entry,quantity:2,level:1,equipped:false});
 await page.goto('/');await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'drag180.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await page.getByRole('button',{name:'关闭弹窗'}).click();await page.getByRole('tab',{name:'背包',exact:true}).click();
 const tile=page.locator('[data-stock-id="rope-selection"]');await boundedDrag(page,tile,page.locator('[data-stock-mark="equipped"]'),'character-equipment-morph');await expect(tile).toBeVisible();await expect(tile).toHaveClass(/stock-equipped/);await expect(page.locator('[data-stock-ref-id="rope-selection"]')).toHaveText('旅人绳索');await page.reload();await page.getByRole('tab',{name:'背包',exact:true}).click();await expect(page.locator('[data-stock-ref-id="rope-selection"]')).toBeVisible();
});
