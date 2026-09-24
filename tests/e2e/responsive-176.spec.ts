import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';

test('narrow character sheet fills width at the top; horizontal tabs and fullscreen retain readable flow',async({page})=>{
 await mockSource(page);await page.setViewportSize({width:254,height:920});await page.goto('/');
 await expect(page.locator('.paper')).toBeVisible();await expect(page.getByRole('tablist',{name:'角色卡页面'})).toHaveAttribute('aria-orientation','horizontal');
 const positions=await measure(page);expect(positions.paper.width).toBeGreaterThan(235);expect(positions.paper.y-positions.viewport.y).toBeLessThanOrEqual(34);expect(positions.paper.height).toBeGreaterThan(positions.viewport.height);await expect(page.locator('.ability-skill').first()).toHaveCSS('font-size','12px');expect(positions.tabs.bottom).toBeLessThanOrEqual(positions.paper.y);
 await expect(page.locator('.header-tools')).toHaveCSS('overflow-x','auto');await expect(page.locator('.header-tools button').first()).toHaveCSS('white-space','nowrap');
 await page.getByRole('button',{name:'卡片全屏',exact:true}).click();await expect(page.getByRole('button',{name:'退出卡片全屏'})).toHaveAttribute('aria-pressed','true');
 expect(await page.locator('.sheet-pane').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(900);await page.getByRole('button',{name:'退出卡片全屏'}).click();
 await page.screenshot({path:'F:/CodexWork/2026-09-20/w-xu/responsive176-character.png'});
});

async function measure(page:Page){return page.evaluate(()=>{const box=(selector:string)=>{const r=document.querySelector(selector)!.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};return {paper:box('.paper'),viewport:box('.sheet-viewport'),tabs:box('.sheet-pages')};});}

async function harness(page:Page,body:string){
 page.on('pageerror',error=>console.log('HARNESS ERROR:',error.message));page.on('console',message=>{if(message.type()==='error')console.log('HARNESS CONSOLE:',message.text());});
 await page.route('**/responsive176-harness',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8">${['style','workspace','workbench','overview','library','cardAtmosphere','libraryRefine','characterPages','suiteTheme','responsive176','responsive177'].map(name=>`<link rel="stylesheet" href="/src/ui/${name}.css">`).join('')}</head><body><div id="test-root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module">import React from '/node_modules/.vite/deps/react.js';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';const {createRoot}=ReactDOM;${body}</script></body></html>`}));await page.goto('/responsive176-harness');
}

test('monster uses the same narrow paper fit and fullscreen toolbar',async({page})=>{
 await page.setViewportSize({width:254,height:920});
 await harness(page,`import {WorkbenchMonster} from '/src/ui/Workbench.tsx';const target={key:'monster:test',itemId:'test',id:'test',kind:'monster',name:'测试怪物',slug:'test',write:true,role:'GM',stats:{hp:20,maxHp:20,tempHp:0,ac:13}};createRoot(document.getElementById('test-root')).render(React.createElement('section',{className:'sheet-pane mobile-active',style:{height:'100dvh'}},React.createElement(WorkbenchMonster,{target,raw:{name:'测试怪物',source:'CUSTOM',size:['M'],type:'beast',str:12,dex:13,con:12,int:4,wis:12,cha:4,entries:[]},online:true,onLink:()=>{}})));`);
 await expect(page.locator('.paper')).toBeVisible();const positions=await measure(page);expect(positions.paper.width).toBeGreaterThan(235);expect(positions.paper.y-positions.viewport.y).toBeLessThanOrEqual(34);await expect(page.getByRole('tablist',{name:'角色卡页面'})).toHaveAttribute('aria-orientation','horizontal');
 const labels=await page.locator('.toolbar-actions button').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));expect(labels).toEqual(['卡片全屏','撤销','重做']);
 await page.screenshot({path:'F:/CodexWork/2026-09-20/w-xu/responsive176-monster.png'});
});

test('warehouse whole header and keyboard toggle; roster responds to pane width',async({page})=>{
 await harness(page,`import {StockBoard} from '/src/ui/StockBoard.tsx';const container={id:'public:test',kind:'public',name:'公共仓库',write:true,revision:1,columns:4,items:[]};createRoot(document.getElementById('test-root')).render(React.createElement('div',null,React.createElement(StockBoard,{container,gm:true,operation:async()=>{}}),React.createElement('section',{className:'resource-overview',style:{width:'900px'}},React.createElement('div',{className:'console-roster'},...[1,2,3].map(n=>React.createElement('article',{key:n},String(n)))))));`);
 const toggle=page.getByRole('button',{name:'折叠公共仓库'});await expect(toggle).toBeVisible();await page.locator('.public-stock h3').click();await expect(page.getByRole('button',{name:'展开公共仓库'})).toHaveAttribute('aria-expanded','false');await expect(page.locator('.stock-collection')).toHaveCount(0);
 await page.getByRole('button',{name:'展开公共仓库'}).focus();await page.keyboard.press('Enter');await expect(page.locator('.stock-collection')).toBeVisible();
 for(const [width,columns] of [[900,3],[600,2],[300,1]]){await page.locator('.resource-overview').evaluate((el,width)=>(el as HTMLElement).style.width=width+'px',width);await expect.poll(()=>page.locator('.console-roster').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(columns);}
});
