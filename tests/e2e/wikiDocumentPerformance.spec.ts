import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/tests/fixtures/wiki-document/');await expect(page.locator('.document-section')).toHaveCount(120);});

test('typing beside a long document leaves its rendered body intact and callbacks use the latest input',async({page})=>{
 await page.locator('.reading-sources summary').click();
 const before=await page.evaluate(()=>({reads:(window as any).documentWork.bodyReads,parentRenders:(window as any).documentWork.parentRenders,body:document.querySelector('.document-prose')!.innerHTML}));
 await page.getByRole('textbox',{name:'Unrelated search'}).pressSequentially('latest');await expect(page.locator('#query')).toHaveText('latest');
 const after=await page.evaluate(()=>({reads:(window as any).documentWork.bodyReads,parentRenders:(window as any).documentWork.parentRenders,body:document.querySelector('.document-prose')!.innerHTML}));
 expect(after.parentRenders).toBeGreaterThan(before.parentRenders);expect(after.reads-before.reads).toBe(0);expect(after.body).toBe(before.body);
 await page.locator('.reading-sources').getByRole('button',{name:'Authored Reader（XPHB）'}).click();expect(await page.evaluate(()=>(window as any).documentWork.lastInspect)).toBe('latest:reader-2024');
 await page.locator('.document-prose').getByRole('button',{name:'Authored Spark',exact:true}).first().click();expect(await page.evaluate(()=>(window as any).documentWork.lastLink)).toBe('latest:spell:Authored Spark|PHB');
 await page.getByRole('button',{name:'折叠段落 Authored section 0',exact:true}).click();expect(await page.evaluate(()=>(window as any).documentWork.lastCollapse)).toBe('latest');await expect(page.getByRole('button',{name:'展开段落 Authored section 0',exact:true})).toHaveAttribute('aria-expanded','false');
 await page.getByRole('button',{name:'展开段落 Authored section 0',exact:true}).click();await expect(page.getByRole('button',{name:'折叠段落 Authored section 0',exact:true})).toHaveAttribute('aria-expanded','true');
 await page.getByRole('button',{name:'Disable entry',exact:true}).click();await expect(page.locator('.document-section').first()).toHaveClass(/entry-disabled/);
 await page.getByRole('button',{name:'Replace entry',exact:true}).click();await expect(page.locator('.document-prose')).toContainText('Updated authored document.');await expect(page.locator('.document-prose')).not.toContainText('Authored paragraph');
});

test('memoized document still responds to source and edition restrictions',async({page})=>{
 await page.getByRole('button',{name:'Toggle subclasses',exact:true}).click();await expect(page.locator('.document-prose')).toContainText('Authored subclass body 2014');await expect(page.locator('.document-prose')).toContainText('Authored subclass body 2024');
 await page.getByRole('button',{name:'Show 2014',exact:true}).click();await expect(page.locator('.document-prose')).toContainText('Authored subclass body 2014');await expect(page.locator('.document-prose')).not.toContainText('Authored subclass body 2024');
 await page.reload();await page.getByRole('button',{name:'Toggle subclasses',exact:true}).click();await page.getByRole('button',{name:'Only PHB source',exact:true}).click();await expect(page.locator('.document-prose')).toContainText('Authored subclass body 2014');await expect(page.locator('.document-prose')).not.toContainText('Authored subclass body 2024');
});
