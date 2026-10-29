import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';

test('fixed source overrides reach the actual catalog worker and the rendered App',async({page,context})=>{
 await mockSource(page);await suppressAnnouncement(page);
 let workerStarted=false,served=0;
 page.on('worker',worker=>{if(worker.url().includes('catalogReader.worker'))workerStarted=true;});
 await context.route('**/data/class/class-test.json',async route=>{
  served++;
  await route.fulfill({json:{class:[{name:'Worker fixture sentinel',ENG_name:'Worker fixture sentinel',source:'XPHB',hd:{faces:6},classFeatures:[]}]},headers:{'access-control-allow-origin':'*'}});
 });
 await page.goto('/card/?intro=0');
 await expect(page.getByRole('button',{name:'更新资料',exact:true,includeHidden:true})).toBeEnabled();
 expect(workerStarted).toBe(true);expect(served).toBeGreaterThan(0);
 if((page.viewportSize()?.width||0)<=760)await page.getByRole('button',{name:'Wiki',exact:true}).click();
 await expect(page.locator('.catalog-row').filter({hasText:'Worker fixture sentinel'})).toHaveCount(1);
 await expect(page.locator('.catalog-row').filter({hasText:'测试法师'})).toHaveCount(0);
});
