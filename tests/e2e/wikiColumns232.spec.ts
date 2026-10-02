import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';

async function ready(page:Page,preferences?:Record<string,string>){
  await mockSource(page,{displayMode:'default'});await suppressAnnouncement(page);
  if(preferences)await page.addInitScript(values=>{if(!sessionStorage.getItem('wiki232-seeded')){for(const [key,value] of Object.entries(values))localStorage.setItem(key,value);sessionStorage.setItem('wiki232-seeded','true');}},preferences);
  await page.route('**/data/items.json',route=>route.fulfill({json:{item:Array.from({length:160},(_,i)=>({name:`布局物品${String(i).padStart(3,'0')}`,source:'XPHB',type:'G',entries:Array.from({length:90},(_,n)=>`布局正文第${n+1}段。这是原创布局验收内容，用于验证各阅读区域的独立滚动。`)}))}}));
  await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
  await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'装备',exact:true}).click();
  await page.locator('.catalog-row').filter({hasText:'布局物品000'}).click();
}

test('fresh wide desktop matches44/24/32 with independent full-height Wiki columns and fixed A4',async({page},info)=>{
  await page.setViewportSize({width:1920,height:1080});await ready(page);
  await expect(page.locator('.sheet-viewport')).not.toHaveClass(/screen-mode/);
  for(const width of [1440,1512,1920,2560]){
    await page.setViewportSize({width,height:1080});await expect(page.locator('.wiki-layout')).toHaveClass(/wiki-columns/);
    await expect.poll(async()=>Math.abs((await page.locator('.catalog-shell').boundingBox())!.width/width-.24)).toBeLessThan(.01);
    const sizes=await page.evaluate(()=>{const rect=(s:string)=>document.querySelector(s)!.getBoundingClientRect();return {sheet:rect('.sheet-pane').width,list:rect('.catalog-shell').width,detail:rect('.entry-detail').width,height:rect('.entry-detail').height,listHeight:rect('.catalog-shell').height,listRight:rect('.catalog-shell').right,detailX:rect('.entry-detail').x,paper:rect('.paper').width/paperHeight()};function paperHeight(){return rect('.paper').height;}});
    expect(Math.abs(sizes.sheet/width-.44)).toBeLessThan(.01);expect(Math.abs(sizes.list/width-.24)).toBeLessThan(.01);expect(Math.abs(sizes.detail/width-.32)).toBeLessThan(.015);
    expect(sizes.detailX).toBeGreaterThan(sizes.listRight);expect(sizes.height).toBeGreaterThan(950);expect(sizes.listHeight).toBeGreaterThan(700);expect(sizes.paper).toBeCloseTo(210/297,2);
  }
  await page.setViewportSize({width:1920,height:1080});await page.screenshot({path:info.outputPath('reference-three-columns-1920.png')});
  await page.locator('.catalog-list').hover();await page.mouse.wheel(0,450);
  await expect.poll(()=>page.locator('.catalog-list').evaluate(n=>n.scrollTop)).toBeGreaterThan(100);
  const listTop=await page.locator('.catalog-list').evaluate(n=>n.scrollTop);
  expect(await page.locator('.entry-detail').evaluate(n=>n.scrollTop)).toBe(0);
  await page.locator('.entry-detail').hover();await page.mouse.wheel(0,400);
  await expect.poll(()=>page.locator('.entry-detail').evaluate(n=>n.scrollTop)).toBeGreaterThan(100);
  expect(await page.locator('.catalog-list').evaluate(n=>n.scrollTop)).toBe(listTop);
  expect(await page.evaluate(()=>document.scrollingElement!.scrollTop)).toBe(0);
  await expect(page.getByRole('button',{name:/^(短休|长休)$/})).toHaveCount(0);
});

test('saved split and responsive preferences survive reload and stacked/column transitions',async({page},info)=>{
  await page.setViewportSize({width:1920,height:720});
  await ready(page,{'dnd-card:workspace-split':'.48','dnd-card:wiki-column-ratio':'.5','dnd-card:wiki-split-ratio':'.3','dnd-card-sheet-display':'screen'});
  await expect(page.locator('.sheet-viewport')).toHaveClass(/screen-mode/);
  await expect(page.getByRole('separator',{name:'调整角色卡与规则资料宽度'})).toHaveAttribute('aria-valuenow','48');
  await page.locator('.entry-detail').evaluate(n=>{(window as any).sameReader=n;n.scrollTop=250;});
  await page.setViewportSize({width:1280,height:720});await expect(page.locator('.wiki-layout')).not.toHaveClass(/wiki-columns/);
  expect(await page.locator('.entry-detail').evaluate(n=>n===(window as any).sameReader)).toBe(true);
  await page.setViewportSize({width:1920,height:720});await expect(page.locator('.wiki-layout')).toHaveClass(/wiki-columns/);
  expect(await page.locator('.entry-detail').evaluate(n=>n===(window as any).sameReader)).toBe(true);
  await page.reload();await expect(page.locator('.entry-detail')).toContainText('布局物品000');
  expect(await page.evaluate(()=>['dnd-card:workspace-split','dnd-card:wiki-column-ratio','dnd-card:wiki-split-ratio','dnd-card-sheet-display'].map(k=>localStorage.getItem(k)))).toEqual(['0.48','.5','.3','screen']);
  const listBefore=await page.locator('.catalog-list').evaluate(n=>n.scrollTop),readerBefore=await page.locator('.entry-detail').evaluate(n=>n.scrollTop);
  await page.locator('.sheet-viewport').hover();await page.mouse.wheel(0,400);
  await expect.poll(()=>page.locator('.sheet-viewport').evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator('.catalog-list').evaluate(n=>n.scrollTop)).toBe(listBefore);expect(await page.locator('.entry-detail').evaluate(n=>n.scrollTop)).toBe(readerBefore);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Wiki',exact:true}).click();
  await expect(page.locator('.wiki-layout')).not.toHaveClass(/wiki-columns/);await expect(page.getByRole('separator',{name:'调整资料列表与正文高度'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:info.outputPath('narrow-stacked-390.png')});
});
