import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';

const splitter=(page:Page)=>page.getByRole('separator',{name:'调整角色卡与规则资料宽度'});
async function ready(page:Page){
 await mockSource(page);await suppressAnnouncement(page);
 await page.route('**/data/items.json',route=>route.fulfill({json:{item:Array.from({length:240},(_,i)=>({name:`原创物品${String(i).padStart(3,'0')}`,ENG_name:`Authored Item ${i}`,source:'XPHB',type:'G',entries:['原创界面测试内容。']}))}}));
 await page.route('**/data/races.json',route=>route.fulfill({json:{race:[{name:'原创旅人（甲）',source:'XPHB',entries:['原创种族甲。']},{name:'原创旅人（乙）',source:'XPHB',entries:['原创种族乙。']}]}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await expect(page.locator('html')).toHaveAttribute('data-card-startup','complete');
 await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'装备',exact:true}).click();
 await page.locator('.catalog-row').filter({hasText:'原创物品000'}).click();
}
async function drag(page:Page,share:number){
 const handle=(await splitter(page).boundingBox())!,area=(await page.locator('.workspace').boundingBox())!;
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();
 await page.mouse.move(area.x+area.width*share,handle.y+handle.height/2,{steps:6});
}

for(const side of ['sheet','wiki'] as const)test(`drag preview, ${side} hide, reload and reset preserve content`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);
 const ratio=await splitter(page).getAttribute('aria-valuenow');
 await page.locator('.entry-detail').evaluate(node=>(window as any).readerBeforeHide=node);
 await expect(page.getByRole('button',{name:'重置隐藏区域'})).toHaveCount(0);
 await drag(page,side==='sheet'?.2:.8);
 const preview=page.locator('.workspace-hide-preview');await expect(preview).toHaveAttribute('data-hide-side',side);
 await expect(preview).toContainText('隐藏该区域');await expect(preview).toHaveCSS('pointer-events','none');
 const shade=(await preview.boundingBox())!;expect(shade.y).toBe(0);expect(shade.height).toBe(982);expect(shade.width).toBeLessThan(1512/2);
 await page.screenshot({path:test.info().outputPath(`hide-${side}-preview.png`)});
 await expect(page.locator('.sheet-pane')).toBeVisible();await expect(page.locator('.wiki-pane')).toBeVisible();
 await page.mouse.up();await expect(preview).toHaveCount(0);await expect(page.locator(`.${side}-pane`)).toBeHidden();
 await expect(splitter(page)).toBeHidden();const visible=page.locator(side==='sheet'?'.wiki-pane':'.sheet-pane');await expect(visible).toBeVisible();
 expect((await visible.boundingBox())!.width).toBeCloseTo((await page.locator('.workspace').boundingBox())!.width,0);
 const reset=page.getByRole('button',{name:'重置隐藏区域',exact:true}),notice=page.getByRole('button',{name:'公告',exact:true});
 await expect(reset).toBeVisible();expect((await reset.boundingBox())!.x+(await reset.boundingBox())!.width).toBeLessThanOrEqual((await notice.boundingBox())!.x);
 expect(await page.locator('.entry-detail').evaluate(node=>node===(window as any).readerBeforeHide)).toBe(true);
 await page.screenshot({path:test.info().outputPath(`only-${side==='sheet'?'wiki':'sheet'}.png`)});
 await page.reload();await expect(reset).toBeVisible();await expect(page.locator(`.${side}-pane`)).toBeHidden();await expect(visible).toBeVisible();
 await page.setViewportSize({width:390,height:844});await expect(visible).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.setViewportSize({width:1512,height:982});await reset.click();await expect(reset).toHaveCount(0);
 await expect(splitter(page)).toBeVisible();await expect(splitter(page)).toHaveAttribute('aria-valuenow',ratio!);
 await expect(page.locator('.sheet-pane')).toBeVisible();await expect(page.locator('.entry-detail')).toContainText('原创物品000');
 await page.reload();await expect(reset).toHaveCount(0);await expect(page.locator('.wiki-pane')).toBeVisible();expect(errors).toEqual([]);
});

test('dragging back, Escape, pointer cancellation and blur never hide a pane',async({page})=>{
 await ready(page);
 for(const action of ['back','escape','pointercancel','blur']){
  const ratio=await splitter(page).getAttribute('aria-valuenow');await drag(page,.2);await expect(page.locator('.workspace-hide-preview')).toBeVisible();
  if(action==='back')await page.mouse.move(1512*.44,450,{steps:5});
  else if(action==='escape')await page.keyboard.press('Escape');
  else if(action==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  else await splitter(page).dispatchEvent('pointercancel',{pointerId:1});
  await page.mouse.up();await expect(page.locator('.workspace-hide-preview')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'重置隐藏区域'})).toHaveCount(0);await expect(page.locator('.sheet-pane')).toBeVisible();await expect(page.locator('.wiki-pane')).toBeVisible();
  await expect(splitter(page)).toHaveAttribute('aria-valuenow',ratio!);
 }
});

test('normal resizing and keyboard adjustments persist without hiding',async({page})=>{
 await ready(page);await drag(page,.5);await page.mouse.up();await expect(splitter(page)).toHaveAttribute('aria-valuenow','50');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-card-startup','complete');await expect(splitter(page)).toHaveAttribute('aria-valuenow','50');await splitter(page).focus();await expect(splitter(page)).toBeFocused();
 await page.keyboard.press('ArrowRight');await expect(splitter(page)).toHaveAttribute('aria-valuenow','52');
 await page.keyboard.press('Home');await expect(splitter(page)).toHaveAttribute('aria-valuenow','44');await expect(page.locator('.workspace-hide-preview')).toHaveCount(0);
});

test('20px catalog rows scroll and select the final item without overlap; race groups match',async({page})=>{
 await ready(page);const rows=page.locator('.catalog-list .virtual-row'),items=page.locator('.catalog-row');
 await expect(items.first()).toHaveCSS('height','20px');await expect(rows.first()).toHaveCSS('height','20px');
 const geometry=await items.evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:b.height};}));
 for(let i=1;i<geometry.length;i++){expect(geometry[i].top).toBeGreaterThanOrEqual(geometry[i-1].bottom);expect(geometry[i].height).toBe(20);}
 await page.locator('.catalog-list').evaluate(node=>{node.scrollTop=node.scrollHeight;});
 await page.locator('.catalog-row').filter({hasText:'原创物品239'}).click();await expect(page.locator('.entry-detail')).toContainText('原创物品239');
 expect(await rows.count()).toBeLessThan(80);await page.screenshot({path:test.info().outputPath('catalog-20px.png')});
 await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'种族',exact:true}).click();
 const group=page.locator('.catalog-race-group');await expect(group).toHaveCSS('height','20px');await group.click();
 await expect(page.locator('.catalog-row.race-child')).toHaveCount(2);await expect(page.locator('.catalog-row.race-child').first()).toHaveCSS('height','20px');
});

test('narrow changelog keeps all dates readable and keyboard navigation cycles all three tabs',async({page})=>{
 await ready(page);await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'公告',exact:true}).click();
 const tabs=page.locator('.announcement-tabs');await tabs.getByRole('tab',{name:'公告内容',exact:true}).focus();
 await page.keyboard.press('ArrowLeft');await expect(tabs.getByRole('tab',{name:'更新日志',exact:true})).toBeFocused();
 const log=page.getByRole('tabpanel',{name:'更新日志',exact:true});await expect(log).toBeVisible();await expect(log.locator('details,summary')).toHaveCount(0);
 const dates=await log.locator('.announcement-log-day>h3').allTextContents();expect(new Set(dates).size).toBe(dates.length);
 expect(await log.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);await page.screenshot({path:test.info().outputPath('changelog-phone.png')});
 await page.locator('.announcement-body').evaluate(node=>{node.scrollTop=node.scrollHeight;});await expect(log.locator('.announcement-log-day').last()).toBeVisible();
 await page.keyboard.press('ArrowRight');await expect(tabs.getByRole('tab',{name:'公告内容',exact:true})).toBeFocused();
});
