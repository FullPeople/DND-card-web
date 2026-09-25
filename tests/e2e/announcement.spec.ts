import {test,expect,type Locator,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {ANNOUNCEMENT_KEY,APP_VERSION} from '../../src/platform/announcement';

const dialog=(page:Page)=>page.getByRole('dialog',{name:'欢迎使用这款开源禁商用车卡/Wiki网站！'});
async function open(page:Page){
 await mockSource(page);await page.goto('/');
 await expect(page.locator('.paper')).toBeVisible();
 await expect(dialog(page)).toBeVisible();
}
async function finger(page:Page){
 const cdp=await page.context().newCDPSession(page);
 return {down:async(p:{x:number;y:number})=>cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1,radiusX:4,radiusY:4}]}),move:async(p:{x:number;y:number})=>cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1,radiusX:4,radiusY:4}]}),up:async()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})};
}
async function swipe(page:Page,start:{x:number;y:number},dy:number){const touch=await finger(page);await touch.down(start);for(let i=1;i<=12;i++){await touch.move({x:start.x,y:start.y+dy*i/12});await page.waitForTimeout(16);}await touch.up();}
async function center(locator:Locator){const box=await locator.boundingBox();expect(box).not.toBeNull();return {x:box!.x+box!.width/2,y:box!.y+box!.height/2};}
// 展开答案会平滑滑入可见范围，测量前先等滚动停住。
async function settle(page:Page,scroller:Locator){let last=-1;for(let i=0;i<25;i++){const value=await scroller.evaluate(node=>node.scrollTop);if(value===last)return;last=value;await page.waitForTimeout(80);}throw new Error('滚动位置未稳定');}

test('首次打开单机站弹出公告，版本、问题清单与默认展开的 Q&A 完整',async({page})=>{
 await open(page);
 await expect(dialog(page).locator('.announcement-version')).toHaveText(`版本 v${APP_VERSION}`);
 await expect(dialog(page)).toContainText('目前还有诸多没有完善的内容');
 await expect(dialog(page).locator('.announcement-issues li')).toHaveCount(6);
 await expect(dialog(page).locator('.announcement-issues')).toContainText('法术栏目更新不及时');
 await expect(dialog(page).locator('.announcement-issues')).toContainText('导入卡时如果版本不对');
 await expect(dialog(page).locator('.announcement-issues')).toContainText('兼职功能勾选与否都可以兼职');
 await expect(dialog(page).locator('.announcement-issues')).toContainText('生命值上限目前只能按照期望取值');
 await expect(dialog(page).locator('.announcement-issues')).toContainText('选择子职的时候默认跳转的是主职');
 await expect(dialog(page).locator('.announcement-issues')).toContainText('每个资料条目界面需要独立有一个属于自己的搜索栏');
 await expect(dialog(page)).toContainText('这些问题会在不久的将来修复！');
 const faq=dialog(page).locator('.announcement-faq').first();
 await expect(faq.locator('details')).toHaveCount(4);
 expect(await faq.evaluate(node=>(node as HTMLDetailsElement).open)).toBe(true);
 await expect(faq).toContainText('可以车20145e/20245r的卡吗？');
 await expect(faq).toContainText('所有扩展都有吗？第三方也有吗？');
 await expect(faq).toContainText('可以单独设置某扩展吗？');
 await expect(faq).toContainText('我填了xxx，我的数据怎么没反应？');
 const first=faq.locator('details').first();
 expect(await first.evaluate(node=>(node as HTMLDetailsElement).open)).toBe(false);
 await expect(first.locator('p')).toBeHidden();
 await expect(first).toHaveCSS('border-radius','0px');
 await expect(first).toHaveCSS('background-color','rgb(246, 247, 240)');
 await first.locator('> summary').click();
 await expect(first.locator('p')).toBeVisible();
 await expect(first.locator('p')).toHaveText('可以的，在右上角规则与扩展中切换');
 await expect(faq.locator('details').nth(1).locator('p')).toBeHidden();
 await expect(dialog(page).getByRole('checkbox',{name:'下次版本更新之前不再弹出'})).not.toBeChecked();
 await page.screenshot({path:'test-results-standalone/announcement.png'});
});

test('弹窗高度固定：展开答案只滚动正文，超出部分可滑下去看',async({page})=>{
 await open(page);
 const body=dialog(page).locator('.announcement-body');
 const height=async()=>(await dialog(page).boundingBox())!.height;
 const before=await height();
 const questions=dialog(page).locator('.announcement-faq details');
 for(let i=0;i<await questions.count();i++){
  await questions.nth(i).locator('> summary').click();
  await expect(questions.nth(i).locator('p')).toBeVisible();
  expect(Math.abs(await height()-before)).toBeLessThan(1);
 }
 await expect.poll(()=>body.evaluate(node=>node.scrollHeight-node.clientHeight)).toBeGreaterThan(0);
 await expect(body).toHaveCSS('overscroll-behavior','contain');
 await expect.poll(()=>body.evaluate(node=>node.scrollTop)).toBeGreaterThan(0);
 await settle(page,body);
 const last=questions.last();
 expect(await last.evaluate(node=>{const outer=node.closest('.announcement-body')!.getBoundingClientRect(),box=node.getBoundingClientRect();return box.top>=outer.top-1&&box.bottom<=outer.bottom+1;})).toBe(true);
 await body.evaluate(node=>{node.scrollTop=node.scrollHeight;});
 await settle(page,body);
 await expect(questions.nth(1).locator('p')).toBeVisible();
 await page.screenshot({path:'test-results-standalone/announcement-scrolled.png'});
});

test('只有“我知道了”能关闭公告',async({page})=>{
 await open(page);
 await page.keyboard.press('Escape');
 await expect(dialog(page)).toBeVisible();
 await page.mouse.click(4,4);
 await expect(dialog(page)).toBeVisible();
 expect(await page.getByRole('button',{name:'规则与扩展',exact:true}).click({timeout:900}).then(()=>false,()=>true)).toBe(true);
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.getByRole('button',{name:'我知道了'}).click();
 await expect(dialog(page)).toBeHidden();
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'规则与扩展'})).toBeVisible();
});

test('勾选后本版本不再弹出，换版本仍会弹出，未勾选则下次打开继续弹出',async({page})=>{
 await open(page);
 await page.getByRole('checkbox',{name:'下次版本更新之前不再弹出'}).check();
 await page.getByRole('button',{name:'我知道了'}).click();
 await expect(dialog(page)).toBeHidden();
 expect(await page.evaluate(key=>localStorage.getItem(key),ANNOUNCEMENT_KEY)).toBe(APP_VERSION);
 await page.reload();
 await expect(page.locator('.paper')).toBeVisible();
 await expect(dialog(page)).toHaveCount(0);
 await page.evaluate(key=>localStorage.setItem(key,'0.1.3'),ANNOUNCEMENT_KEY);
 await page.reload();
 await expect(dialog(page)).toBeVisible();
 await page.getByRole('button',{name:'我知道了'}).click();
 await expect(dialog(page)).toBeHidden();
 expect(await page.evaluate(key=>localStorage.getItem(key),ANNOUNCEMENT_KEY)).toBe(null);
 await page.reload();
 await expect(dialog(page)).toBeVisible();
});

test('角色簿左侧的公告按钮可以反复查看，并保持已确认状态',async({page})=>{
 await open(page);
 await page.getByRole('checkbox',{name:'下次版本更新之前不再弹出'}).check();
 await page.getByRole('button',{name:'我知道了'}).click();
 await expect(dialog(page)).toBeHidden();
 await page.reload();
 await expect(page.locator('.paper')).toBeVisible();
 const announcement=page.getByRole('button',{name:'公告',exact:true});
 const book=page.getByRole('button',{name:/角色簿/});
 await expect(announcement).toBeVisible();
 const boxes={announcement:await announcement.boundingBox(),book:await book.boundingBox()};
 expect(boxes.announcement!.x+boxes.announcement!.width).toBeLessThanOrEqual(boxes.book!.x);
 expect(Math.abs(boxes.announcement!.y-boxes.book!.y)).toBeLessThan(2);
 expect(Math.abs(boxes.announcement!.height-boxes.book!.height)).toBeLessThan(2);
 await announcement.click();
 await expect(dialog(page)).toBeVisible();
 await expect(page.getByRole('checkbox',{name:'下次版本更新之前不再弹出'})).toBeChecked();
 await page.getByRole('button',{name:'我知道了'}).click();
 await expect(dialog(page)).toBeHidden();
 await page.reload();
 await expect(page.locator('.paper')).toBeVisible();
 await expect(dialog(page)).toHaveCount(0);
 await announcement.click();
 await expect(dialog(page)).toBeVisible();
 await page.locator('.announcement-faq details').first().locator('> summary').click();
 await expect(page.locator('.announcement-faq details').first().locator('p')).toBeVisible();
 await page.screenshot({path:'test-results-standalone/announcement-reopened.png'});
});

test('手机端弹窗内滑动正常：只滚正文、不误触、不换面板',async({browser,baseURL})=>{
 const context=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true,baseURL});
 const page=await context.newPage();
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await open(page);
 const panel=page.locator('.sheet-pane');
 await expect(panel).toHaveClass(/mobile-active/);
 const body=dialog(page).locator('.announcement-body');
 const height=(await dialog(page).boundingBox())!.height;
 const questions=dialog(page).locator('.announcement-faq details');
 for(let i=0;i<await questions.count();i++){
  await questions.nth(i).locator('> summary').tap();
  await expect(questions.nth(i).locator('p')).toBeVisible();
  expect(Math.abs((await dialog(page).boundingBox())!.height-height)).toBeLessThan(1);
 }
 await expect.poll(()=>body.evaluate(node=>node.scrollHeight-node.clientHeight)).toBeGreaterThan(0);
 await settle(page,body);
 await body.evaluate(node=>{node.scrollTop=0;});
 await settle(page,body);
 expect(await body.evaluate(node=>node.scrollTop)).toBe(0);
 const box=(await body.boundingBox())!;
 for(let i=0;i<2;i++){
  const before=await body.evaluate(node=>node.scrollTop);
  await swipe(page,{x:box.x+box.width/2,y:box.y+box.height-24},-80);
  await expect.poll(()=>body.evaluate(node=>node.scrollTop)).toBeGreaterThan(before+10);
 }
 await expect(dialog(page)).toBeVisible();
 await expect(page.locator('.wiki-pane')).not.toHaveClass(/mobile-active/);
 await expect(panel).toHaveClass(/mobile-active/);
 await expect(page.locator('.pointer-ghost')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollTop)).toBe(0);
 await body.evaluate(node=>{node.scrollTop=node.scrollHeight;});
 await settle(page,body);
 await expect(questions.last().locator('p')).toBeVisible();
 expect(await questions.last().evaluate(node=>{const outer=node.closest('.announcement-body')!.getBoundingClientRect(),box=node.getBoundingClientRect();return box.top>=outer.top-1&&box.bottom<=outer.bottom+1;})).toBe(true);
 await page.screenshot({path:'test-results-standalone/announcement-phone.png'});
 expect(errors).toEqual([]);
 await context.close();
});
