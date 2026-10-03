import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement,fillFromDetail} from './fixtures';
import {authorBrowserCatalogue,installBrowserAutomation} from './automationFixtures';
async function ready(page:Page){
 await mockSource(page);await suppressAnnouncement(page);
 const data={race:[{name:'原创矮人',source:'XPHB',speed:25,size:['M'],entries:['原创预览验收。',...['年龄','体型','速度'].map((name,i)=>({type:'entries',name,entries:Array.from({length:i+1},()=>`${name}原创说明。`)}))]}]};const authored=authorBrowserCatalogue(data);await installBrowserAutomation(page,authored.entries,false);
 await page.route('**/data/races.json',route=>route.fulfill({json:authored.body}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'种族',exact:true}).click();await page.locator('.catalog-row').filter({hasText:'原创矮人'}).click();const editing=page.getByRole('switch',{name:'编辑模式',exact:true});await editing.click();await expect(editing).toHaveAttribute('aria-checked','true');await fillFromDetail(page);
 // A drag completing is not evidence that a readonly sheet accepted the race.
 await expect(page.locator('.pointer-ghost')).toHaveCount(0);await expect(page.locator('.identity-race')).toContainText('原创矮人');
 await editing.click();await expect(editing).toHaveAttribute('aria-checked','false');await page.getByRole('tab',{name:'特性',exact:true}).click();
 const traits=page.locator('.detail-race-features .feature-caption');await expect(traits).toHaveCount(3);for(const name of ['年龄','体型','速度'])await expect(traits.filter({hasText:name})).toBeVisible();
}
for(const reducedMotion of ['no-preference','reduce'] as const)test(`Wiki section highlight moves on one document and restores reading (${reducedMotion})`,async({page})=>{
 await page.emulateMedia({reducedMotion});await ready(page);
 const reader=page.locator('.wiki-pane .entry-detail'),overlay=reader.locator('.reading-focus-overlay');
 await reader.evaluate(node=>{(window as any).motionReader=node;});
 for(const name of ['年龄','体型','速度','年龄']){
  await page.locator('.paper .feature-caption').filter({hasText:name}).hover();
  await expect(reader.locator('.document-section.reading-highlight')).toContainText(name);await expect(overlay).toHaveAttribute('data-active','true');
  expect(await reader.evaluate(node=>node===(window as any).motionReader)).toBe(true);
  await expect.poll(()=>reader.evaluate(node=>{const a=node.querySelector('.reading-focus-overlay')!.getBoundingClientRect(),b=node.querySelector('.reading-highlight')!.getBoundingClientRect();return Math.max(Math.abs(a.left-b.left),Math.abs(a.top-b.top),Math.abs(a.width-b.width),Math.abs(a.height-b.height));})).toBeLessThan(1);
 }
 await page.screenshot({path:test.info().outputPath(`wiki-highlight-${reducedMotion}.png`)});
 await page.mouse.move(1,1);await expect(reader).not.toHaveClass(/is-sheet-preview/);await expect(overlay).toHaveAttribute('data-active','false');await expect(reader).not.toHaveAttribute('data-wiki-preview-transition');
 if(reducedMotion==='reduce')await expect(overlay).toHaveCSS('transition-duration','0s');
 // Different-entry replacement and exit restore the original selected document.
 await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'职业',exact:true}).click();await page.locator('.catalog-row').first().click();await expect(reader).toContainText('测试法师');
 await reader.evaluate(node=>{node.scrollTop=150;});const before=await reader.evaluate(node=>node.scrollTop);
 await page.locator('.paper .feature-caption').filter({hasText:'年龄'}).hover();await expect(reader).toContainText('原创矮人');
 await page.mouse.move(1,1);await expect(reader).toContainText('测试法师');await expect.poll(()=>reader.evaluate(node=>node.scrollTop)).toBe(before);await expect(reader).not.toHaveAttribute('data-wiki-preview-transition');
});
