import {test,expect,type Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {mockSource,fillFromDetail} from './fixtures';

async function ready(page:Page,url:string){
 await mockSource(page);await page.goto(url);
 await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await expect(page.locator('.paper')).toBeVisible();
 await page.getByRole('switch',{name:'编辑模式'}).click();
 await page.getByRole('textbox',{name:'角色姓名',exact:true}).fill('旅行法师');
 await page.locator('.catalog-row').first().click();await fillFromDetail(page);
 await page.getByRole('switch',{name:'编辑模式'}).click();
}
async function geometry(page:Page){return page.evaluate(()=>{
 const box=(s:string)=>{const r=document.querySelector(s)!.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
 return {header:box('.app-header'),toolbar:box('.pane-toolbar'),status:box('.save-status'),paper:box('.paper'),viewport:box('.sheet-viewport'),overflow:document.documentElement.scrollWidth>innerWidth};
});}

test('domestic chrome gives its saved height to A4, keeps page tabs and full screen',async({page,browser,baseURL},info)=>{
 const baseline=await browser.newPage({viewport:{width:1920,height:1080}}),errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 await ready(baseline,'http://127.0.0.1:5268');await ready(page,baseURL!);
 const measures=[];
 for(const height of [1080,940]){
  await baseline.setViewportSize({width:1920,height});await page.setViewportSize({width:1920,height});
  await expect.poll(async()=>Math.round((await geometry(page)).paper.height-(await geometry(baseline)).paper.height)).toBe(68);
  const before=await geometry(baseline),after=await geometry(page);measures.push({height,before,after,gain:after.paper.height-before.paper.height});
  expect(after.status.height).toBe(0);expect(after.overflow).toBe(false);
  expect(after.paper.width/after.paper.height).toBeCloseTo(210/297,3);
  expect(after.paper.bottom).toBeLessThanOrEqual(height);
  for(const p of [baseline,page]){const close=p.locator('.suite-toast button[aria-label="关闭提示"]');if(await close.isVisible())await close.click();}
  await baseline.screenshot({path:info.outputPath(`before-1920x${height}.png`)});
  await page.screenshot({path:info.outputPath(`after-1920x${height}.png`)});
 }
 writeFileSync(info.outputPath('geometry.json'),JSON.stringify(measures,null,2));
 for(const name of ['特性','背景','法术','背包','主要']){
  await page.getByRole('tab',{name:new RegExp(name)}).click();
  expect((await geometry(page)).paper.height).toBeCloseTo(measures[1].after.paper.height,1);
 }
 await page.getByRole('button',{name:'卡片全屏',exact:true}).click();
 await expect(page.locator('.sheet-pane')).toHaveClass(/sheet-fullscreen/);
 await page.keyboard.press('Escape');await expect(page.locator('.sheet-pane')).not.toHaveClass(/sheet-fullscreen/);
 await page.getByRole('button',{name:/角色簿/}).click();
 await page.getByRole('button',{name:/2024 角色/}).click();
 await expect(page.getByRole('tablist',{name:'当前角色'}).getByRole('tab')).toHaveCount(2);
 await page.getByRole('tab',{name:'旅行法师',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'角色姓名',exact:true})).toHaveValue('旅行法师');
 for(const label of ['规则与扩展','导入 / 导出']){
  await page.getByRole('button',{name:label,exact:true}).click();await expect(page.locator('dialog[open]')).toBeVisible();
  await page.getByRole('button',{name:'关闭弹窗'}).click();
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'功能页',exact:true}).click();
 await expect(page.getByRole('button',{name:/角色簿/})).toBeInViewport();
 expect((await geometry(page)).overflow).toBe(false);await page.screenshot({path:info.outputPath('after-mobile.png')});
 expect(errors).toEqual([]);await baseline.close();
});

test('save, undo and storage failure remain usable without the status strip',async({page,baseURL})=>{
 await ready(page,baseURL!);
 await page.getByRole('switch',{name:'编辑模式'}).click();
 await page.getByRole('textbox',{name:'角色姓名',exact:true}).fill('本地存档测试');
 await expect(page.locator('.save-status')).toHaveText(/已保存到本机/);
 await page.reload();await expect(page.getByRole('textbox',{name:'角色姓名',exact:true})).toHaveValue('本地存档测试');
 await page.getByRole('spinbutton',{name:'当前生命值',exact:true}).fill('17');await page.locator('.brand').click();
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(page.getByRole('spinbutton',{name:'当前生命值',exact:true})).not.toHaveValue('17');
 await page.getByRole('button',{name:'重做',exact:true}).click();await expect(page.getByRole('spinbutton',{name:'当前生命值',exact:true})).toHaveValue('17');
 await expect(page.locator('.save-status')).toHaveText(/已保存到本机/);
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:Parameters<typeof put>){if(this.name==='documents')throw new DOMException('storage full test','QuotaExceededError');return put.apply(this,args);};});
 await page.getByRole('spinbutton',{name:'当前生命值',exact:true}).fill('18');await page.locator('.brand').click();
 await expect(page.locator('.suite-toast')).toContainText('本机保存失败');
 await expect(page.locator('.save-status')).not.toBeVisible();
});
