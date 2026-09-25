import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
const items=Array.from({length:220},(_,i)=>({name:`旅行用品 ${String(i+1).padStart(3,'0')}`,ENG_name:`Travel Gear ${i+1}`,source:'XGE',type:'G',weight:1,value:100,entries:Array.from({length:80},(_,n)=>`阅读片段 ${n+1}：旅人可以在这里记录用途、来源与使用方式。这是为界面验收编写的测试条目。`)}));
async function ready(page:Page,baseURL:string){
 await mockSource(page);await page.route('https://5e.kiwee.top/data/items.json',route=>route.fulfill({json:{item:items},headers:{'access-control-allow-origin':'*'}}));await suppressAnnouncement(page);
 await page.goto(baseURL);await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'装备',exact:true}).click();
 await expect(page.locator('.catalog-row')).not.toHaveCount(0);
 await page.locator('.catalog-row').filter({hasText:'旅行用品 001'}).click();
 await expect(page.locator('.entry-detail')).toContainText('旅行用品 001');
}
async function bounds(page:Page){return page.evaluate(()=>{
 const box=(selector:string)=>{const r=document.querySelector(selector)!.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 return {list:box('.catalog-shell'),detail:box('.entry-detail'),wiki:box('.wiki-pane'),paper:box('.paper')};
});}
test('wide Wiki uses full-height side columns, narrow Wiki returns to stacked without losing reading state',async({page,baseURL},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await ready(page,baseURL!);
 await expect(page.locator('.wiki-layout')).toHaveClass(/wiki-columns/);
 let b=await bounds(page);expect(b.detail.x).toBeGreaterThan(b.list.right);expect(b.detail.height).toBeGreaterThan(900);
 expect(b.list.height).toBeGreaterThan(650);expect(b.detail.width).toBeGreaterThan(520);
 await expect(page.locator('.brand-logo')).toHaveCSS('image-rendering','auto');
 const logo=await page.locator('.brand-logo').evaluate((el:HTMLImageElement)=>({width:el.clientWidth,height:el.clientHeight,naturalWidth:el.naturalWidth,naturalHeight:el.naturalHeight}));
 expect(logo.width).toBe(logo.height);expect(logo.naturalWidth).toBe(logo.naturalHeight);
 await page.screenshot({path:info.outputPath('wide-2560.png')});
 await page.locator('.wiki-pane').screenshot({path:info.outputPath('wiki-columns.png')});
 await page.locator('.entry-detail').evaluate(node=>{(window as any).readerBeforeResize=node;node.scrollTop=250;});
 await page.locator('.catalog-list').evaluate(node=>{node.scrollTop=560;});
 await page.setViewportSize({width:1920,height:1080});
 await expect(page.locator('.wiki-layout')).not.toHaveClass(/wiki-columns/);
 b=await bounds(page);expect(b.detail.y).toBeGreaterThan(b.list.bottom);
 await expect(page.getByRole('separator',{name:'调整资料列表与正文高度'})).toBeVisible();
 expect(await page.locator('.entry-detail').evaluate(node=>node===(window as any).readerBeforeResize)).toBe(true);
 expect(await page.locator('.entry-detail').evaluate(node=>node.scrollTop)).toBeGreaterThanOrEqual(240);
 await page.setViewportSize({width:2560,height:1080});await expect(page.locator('.wiki-layout')).toHaveClass(/wiki-columns/);
 expect(await page.locator('.entry-detail').evaluate(node=>node===(window as any).readerBeforeResize)).toBe(true);
 await expect.poll(()=>page.locator('.catalog-list').evaluate(node=>node.scrollTop)).toBe(560);
 // Resizing the outer split, without changing the browser width, also switches layout.
 const outer=page.getByRole('separator',{name:'调整角色卡与规则资料宽度'});await outer.focus();
 for(let i=0;i<7;i++)await page.keyboard.press('ArrowRight');
 await expect(page.locator('.wiki-layout')).not.toHaveClass(/wiki-columns/);
 await page.keyboard.press('Home');await expect(page.locator('.wiki-layout')).toHaveClass(/wiki-columns/);
 expect(errors).toEqual([]);
});
test('column and row divider sizes are independently draggable, keyboard accessible and persistent',async({page,baseURL})=>{
 await ready(page,baseURL!);const separator=page.getByRole('separator',{name:'调整资料列表与正文宽度'});
 await expect(separator).toHaveAttribute('aria-orientation','vertical');
 const start=await bounds(page),handle=(await separator.boundingBox())!;
 await page.mouse.move(handle.x+4,handle.y+80);await page.mouse.down();await page.mouse.move(handle.x+54,handle.y+80,{steps:8});await page.mouse.up();
 await expect.poll(async()=>Math.round((await bounds(page)).list.width-start.list.width)).toBe(50);
 const width=await page.evaluate(()=>localStorage.getItem('dnd-card:wiki-column-ratio'));expect(Number(width)).toBeGreaterThan(.42);
 await page.setViewportSize({width:1920,height:1080});const row=page.getByRole('separator',{name:'调整资料列表与正文高度'});
 await row.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
 const height=await page.evaluate(()=>localStorage.getItem('dnd-card:wiki-split-ratio'));expect(height).toBeTruthy();
 await page.setViewportSize({width:2560,height:1080});await page.reload();
 await expect(separator).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('dnd-card:wiki-column-ratio'))).toBe(width);
 expect(await page.evaluate(()=>localStorage.getItem('dnd-card:wiki-split-ratio'))).toBe(height);
});
test('fresh site enables extensions; manual source choices survive refresh and new cards',async({page,baseURL})=>{
 await ready(page,baseURL!);await page.getByRole('button',{name:'规则与扩展',exact:true}).click();
 const book=page.locator('.source-book').filter({has:page.getByRole('button',{name:'设置来源 XGE',exact:true})});
 await expect(book.getByRole('checkbox')).toBeChecked();await book.getByRole('checkbox').uncheck();
 await page.getByRole('button',{name:'关闭弹窗'}).click();await expect(page.locator('.catalog-row').filter({hasText:'旅行用品'})).toHaveCount(0);
 await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.reload();
 await page.getByRole('button',{name:'更新资料',exact:true}).click();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expect(book.getByRole('checkbox')).not.toBeChecked();
 await page.getByRole('button',{name:'关闭弹窗'}).click();await page.getByRole('button',{name:/角色簿/}).click();
 await page.getByRole('button',{name:/2014 角色/}).click();
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expect(book.getByRole('checkbox')).not.toBeChecked();
 await page.getByRole('button',{name:'全部禁用',exact:true}).click();await page.getByRole('button',{name:'关闭弹窗'}).click();
 await page.getByRole('button',{name:'更新资料',exact:true}).click();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await expect(page.locator('.catalog-row')).toHaveCount(0);
});
test('mobile keeps stacked touch scrolling and the original A4 height savings',async({page,baseURL},info)=>{
 await page.setViewportSize({width:390,height:844});await mockSource(page);await suppressAnnouncement(page);await page.goto(baseURL!);
 await page.getByRole('button',{name:'Wiki',exact:true}).click();await page.locator('.catalog-row').first().click();
 await expect(page.locator('.wiki-layout')).not.toHaveClass(/wiki-columns/);
 await expect(page.getByRole('separator',{name:'调整资料列表与正文高度'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('mobile-stacked.png')});
 await page.setViewportSize({width:1920,height:1080});await expect.poll(async()=>(await bounds(page)).paper.height).toBeCloseTo(997,0);
});
