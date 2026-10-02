import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement,expandSourceBook} from './fixtures';

async function ready(page:Page){
  await mockSource(page);await suppressAnnouncement(page);
  await page.route('**/data/class/class-test.json',route=>route.fulfill({json:{
    class:['PHB','XPHB'].map(source=>({name:'版本测试职业',source,entries:['原创主体正文。']})),
    subclass:['PHB','XPHB'].flatMap(classSource=>['PHB','XPHB','XGE'].map(source=>({name:`${source}测试子职`,source,className:'版本测试职业',classSource,entries:[`${source}原创子职正文。`]}))),
  }}));
  await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
  await page.locator('.catalog-row').filter({hasText:'版本测试职业'}).click();await page.getByRole('button',{name:'子职',exact:true}).click();
}

test('subclass reading uses strict core publication edition in both directions and all preserves both identities',async({page})=>{
  await ready(page);const prose=page.locator('.document-prose');const version=page.getByRole('combobox',{name:'资料版本'});
  await expect(prose).toContainText('XPHB原创子职正文');
  // Match whole heading text to distinguish PHB from the XPHB substring.
  await expect(prose.locator('h4').filter({has:page.getByRole('button',{name:'折叠段落 PHB测试子职',exact:true})})).toHaveCount(0);
  await version.selectOption('2014');await expect(prose.getByRole('button',{name:'折叠段落 PHB测试子职',exact:true})).toBeVisible();
  await expect(prose.getByRole('button',{name:'折叠段落 XPHB测试子职',exact:true})).toHaveCount(0);
  await version.selectOption('2024');await expect(prose.getByRole('button',{name:'折叠段落 PHB测试子职',exact:true})).toHaveCount(0);
  await version.selectOption('all');await expect(prose.getByRole('button',{name:'折叠段落 PHB测试子职',exact:true})).toBeVisible();await expect(prose.getByRole('button',{name:'折叠段落 XPHB测试子职',exact:true})).toBeVisible();
  await expect(prose.getByRole('button',{name:'折叠段落 XGE测试子职',exact:true})).toBeVisible();
  await page.reload();await expect(version).toHaveValue('all');await expect(prose.getByRole('button',{name:'折叠段落 PHB测试子职',exact:true})).toBeVisible();
  await version.selectOption('character');await expect(prose.getByRole('button',{name:'折叠段落 PHB测试子职',exact:true})).toHaveCount(0);
});

test('all editions still respects source toggles and restores visible subclasses on re-enable',async({page})=>{
  await ready(page);await page.getByRole('combobox',{name:'资料版本'}).selectOption('all');
  const prose=page.locator('.document-prose'),old=prose.getByRole('button',{name:'折叠段落 PHB测试子职',exact:true});await expect(old).toBeVisible();
  await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expandSourceBook(page,'PHB');
  const checkbox=page.locator('.source-book').filter({has:page.getByRole('button',{name:'设置来源 PHB',exact:true})}).getByRole('checkbox');
  await checkbox.uncheck();await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect(old).toHaveCount(0);
  await expect(prose.getByRole('button',{name:'折叠段落 XPHB测试子职',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expandSourceBook(page,'PHB');await checkbox.check();await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect(old).toBeVisible();
});
