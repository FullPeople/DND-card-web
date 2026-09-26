import {test,expect,type Page} from '@playwright/test';
import {newCharacter,type Entry} from '../../src/core/model';
import {mockSource,suppressAnnouncement} from './fixtures';

function card(){const c=newCharacter();c.name='测试审阅者';c.player='测试玩家';c.runtime.hp=20;c.baseHp=25;const entry:Entry={id:'fixture-class',kind:'class',name:'测试职业',english:'Review Class',source:'PHB',edition:'2014',packId:'source',revision:'1',entries:['测试规则正文。'],raw:{hd:{faces:8}}};c.selections=[{id:'class-selection',entry,level:3,quantity:1,equipped:false}];c.sheetBonuses={ac:2};return c;}
async function harness(page:Page,module:string,component:string,value:any){
 await page.route('**/__feedback-harness',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><style>body{font:14px system-ui;max-width:980px;margin:24px auto}</style><div id="root"></div><script type="module">import React from '/node_modules/.vite/deps/react.js';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';const createRoot=ReactDOM.createRoot;import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;const {${component}}=await import('${module}');window.mount=(value)=>createRoot(document.getElementById('root')).render(React.createElement(${component},value));</script>`}));
 await page.goto('/__feedback-harness');await page.waitForFunction(()=>typeof(window as any).mount==='function');await page.evaluate(({value,component})=>{(window as any).saved=[];(window as any).mount(component==='MonsterEditor'?{value,busy:false,save:async(next:any)=>{(window as any).saved.push(next);}}:{c:value});},{value,component});
}
test('DM review groups disabled levels and manual adjustments without editing the character',async({page})=>{
 await harness(page,'/src/ui/CharacterReview.tsx','CharacterReview',card());
 await expect(page.getByText('记录等级 3 与当前规则下生效等级 0 不一致，请核对职业来源与版本。')).toBeVisible();
 await page.getByRole('button',{name:'查看 1 项受限条目'}).click();await expect(page.locator('.review-selection')).toHaveCount(1);await page.locator('.review-selection summary').click();await expect(page.getByText('测试规则正文。')).toBeVisible();
 await page.getByRole('button',{name:'裁定与依据',exact:true}).click();await expect(page.getByRole('cell',{name:'+2',exact:true})).toBeVisible();await page.getByRole('button',{name:'概况与风险',exact:true}).click();await page.screenshot({path:test.info().outputPath('dm-review.png')});
});
test('monster form edits common fields, orders actions and refuses bad JSON before saving',async({page})=>{
 const value={name:'测试守卫',ac:[{ac:14,from:['皮甲']},{ac:16,condition:'持盾时'}],hp:{average:20,formula:'3d8+6'},speed:{walk:30,fly:{number:40,condition:'变形时'}},str:14,dex:12,con:14,int:10,wis:12,cha:9,action:[{name:'刺击',entries:['{@damage 1d6+2} 点穿刺伤害。'],custom:'keep'}],unknown:{keep:true}};
 await harness(page,'/src/ui/MonsterEditor.tsx','MonsterEditor',value);await page.getByLabel('怪物护甲等级',{exact:true}).fill('15');await page.getByLabel('怪物护甲等级',{exact:true}).press('Tab');await page.getByLabel('怪物生命值上限').fill('24');await page.getByLabel('怪物生命值上限').press('Tab');await page.screenshot({path:test.info().outputPath('monster-form.png')});
 await page.getByRole('button',{name:'特质与动作',exact:true}).click();await page.getByLabel('动作 1 名称',{exact:true}).fill('长矛刺击');await page.getByRole('button',{name:'保存资料',exact:true}).click();
 const saved=await page.evaluate(()=>(window as any).saved[0]);expect(saved.ac[0]).toEqual({ac:15,from:['皮甲']});expect(saved.ac[1]).toEqual(value.ac[1]);expect(saved.hp).toEqual({average:24,formula:'3d8+6'});expect(saved.action[0]).toEqual({...value.action[0],name:'长矛刺击'});expect(saved.unknown).toEqual({keep:true});
 await page.getByRole('button',{name:'高级 JSON',exact:true}).click();await page.getByLabel('怪物完整 JSON').fill('{"name":""}');await page.getByRole('button',{name:'保存资料',exact:true}).click();await expect(page.getByRole('alert')).toContainText('名称不能为空');expect(await page.evaluate(()=>(window as any).saved.length)).toBe(1);
});
test('health arithmetic persists and Wiki menu respects edit mode',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/');await expect(page.locator('.paper')).toBeVisible();
 const hp=page.getByLabel('当前生命值',{exact:true});await hp.fill('=20');await hp.press('Enter');await expect(hp).toHaveValue('20');await hp.fill('-5');await hp.press('Enter');await expect(hp).toHaveValue('15');await hp.fill('+(3*2)');await hp.press('Enter');await expect(hp).toHaveValue('21');await page.reload();await expect(hp).toHaveValue('21');
 const row=page.locator('.catalog-row').filter({hasText:'测试法师'}).first();await expect(row).toBeVisible();await row.click({button:'right'});await expect(page.getByRole('menuitem',{name:'添加至角色卡'})).toBeDisabled();await page.keyboard.press('Escape');
 await page.getByRole('switch',{name:'编辑模式'}).click();await row.click({button:'right'});await page.getByRole('menuitem',{name:'添加至角色卡'}).click();await expect(page.locator('.identity-token')).toHaveCount(1);await page.getByRole('switch',{name:'编辑模式'}).click();expect(await page.locator('.identity-token').evaluate(e=>getComputedStyle(e).cursor)).toBe('default');
});
test('legacy reader opens native five-page JSON without loading Wiki and rejects xlsx',async({page})=>{
 await page.setViewportSize({width:884,height:850});
 const c=card();const requests:string[]=[];page.on('request',request=>{if(request.url().includes('kiwee.top'))requests.push(request.url());});await page.route('**/viewer-card.json',route=>route.fulfill({json:{dnd_card_web:c}}));
 await page.goto('/?legacyViewer=1&data_url='+encodeURIComponent('http://127.0.0.1:5192/viewer-card.json'));await expect(page.getByText('2024 · 只读角色卡')).toBeVisible();await expect(page.getByLabel('当前生命值',{exact:true})).toBeDisabled();await expect(page.locator('.wiki-pane')).toHaveCount(0);
 for(const title of ['特性','背景','法术','背包','主要']){await page.getByRole('tab',{name:title,exact:true}).click();await expect(page.getByRole('tab',{name:title,exact:true})).toHaveAttribute('aria-selected','true');}
 expect(requests).toEqual([]);await expect(page.locator('.paper')).toBeVisible();expect(await page.locator('.player-viewer').evaluate(e=>getComputedStyle(e).display)).toBe('flex');expect((await page.locator('.paper').boundingBox())?.width).toBeGreaterThan(300);await page.screenshot({path:test.info().outputPath('legacy-reader.png')});await page.goto('/?legacyViewer=1&data_url='+encodeURIComponent('http://127.0.0.1:5192/test.xlsx'));await expect(page.getByRole('alert')).toContainText('只接受角色 JSON');
});
