import {test,expect} from '@playwright/test';
import {mockSource} from './fixtures';

test.beforeEach(async({page})=>{await mockSource(page);});

test('cross-category navigation replaces the old facts and body without leaving duplicate documents',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await page.locator('.catalog-row').filter({hasText:'测试法师'}).first().click();
 const article=page.locator('.entry-detail');await expect(article).toContainText('初始特性');await expect(article.locator('.entry-facts')).toHaveCount(1);
 const input=page.getByRole('textbox',{name:'搜索规则资料',exact:true}),results=page.getByRole('region',{name:'全局搜索结果'});
 await input.fill('微光术');await expect(results).toHaveAttribute('aria-busy','false');await expect(results.locator('.global-result')).toHaveCount(1);
 await input.press('ArrowDown');await input.press('Enter');await expect(article).toHaveAttribute('data-entry-kind','spell');
 await expect(article.locator('.entry-facts')).toHaveCount(1);await expect(article.locator('.entry-facts')).toContainText('学派');await expect(article.locator('.entry-facts')).not.toContainText('生命骰');
 await expect(article).toContainText('为测试而创作的一点微光');await expect(article).not.toContainText('起始熟练项');await expect(article.locator('.raw-details')).toHaveCount(1);await expect(article.locator('.library-document')).toHaveCount(1);
 await page.goBack();await expect(article).toHaveAttribute('data-entry-kind','class');await expect(article.locator('.entry-facts')).toHaveCount(1);await expect(article.locator('.entry-facts')).toContainText('生命骰');await expect(article.locator('.library-document')).toHaveCount(1);await expect(article.locator('.raw-details')).toHaveCount(1);await expect(article).not.toContainText('为测试而创作的一点微光');
});

test('global search keeps typing focus, wraps to the last virtual result and opens it with Enter',async({page})=>{
 await page.context().route('**/data/items.json',route=>route.fulfill({json:{item:Array.from({length:1000},(_,index)=>({name:`检索物品${String(index).padStart(4,'0')}`,ENG_name:`Lookup Item ${index}`,source:'XPHB',entries:['原创搜索键盘验收正文。']}))}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 const input=page.getByRole('textbox',{name:'搜索规则资料',exact:true}),results=page.getByRole('region',{name:'全局搜索结果'});
 await input.fill('检索物品');await expect(results.locator('.virtual-list')).toHaveAttribute('data-total-rows','1000');await expect(results).toHaveAttribute('aria-busy','false');
 await input.press('ArrowUp');await expect(input).toBeFocused();await expect(page.locator('.global-result[data-keyboard-active=true]')).toContainText('检索物品0999');
 await expect.poll(()=>input.evaluate(element=>{const id=element.getAttribute('aria-activedescendant');return !!id&&document.getElementById(id)?.textContent?.includes('检索物品0999');})).toBe(true);
 expect(await page.locator('.global-result').count()).toBeLessThan(60);
 await input.press('ArrowDown');await expect(page.locator('.global-result[data-keyboard-active=true]')).toContainText('检索物品0000');
 await input.press('End');await input.pressSequentially('0999');await expect(input).toHaveValue('检索物品0999');await expect(results.locator('.virtual-list')).toHaveAttribute('data-total-rows','1');
 await input.press('ArrowDown');await input.press('Enter');await expect(page.locator('.entry-detail h1')).toContainText('检索物品0999');await expect(results).toHaveCount(0);
 await input.click();await expect(results).toBeVisible();await input.press('Escape');await expect(results).toHaveCount(0);await expect(input).toHaveValue('检索物品0999');await expect(page.locator('.entry-detail h1')).toContainText('检索物品0999');
 const toggle=page.getByRole('button',{name:'全局搜索结果',exact:true});await toggle.click();await expect(results).toBeVisible();await toggle.click();await expect(results).toHaveCount(0);
});

test('filter choices survive closing, exclusion and category changes without changing catalog data',async({page})=>{
 await page.context().route('**/data/spells/spells-test.json',route=>route.fulfill({json:{spell:[{name:'初阶检索术',source:'XPHB',level:1,school:'V',entries:['原创一环验收正文。']},{name:'高阶检索术',source:'XPHB',level:3,school:'A',entries:['原创三环验收正文。']}]}}));
 await page.goto('/?tab=spell&edition=all');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await expect(page.locator('.catalog-list')).toHaveAttribute('data-total-rows','2');
 await page.getByRole('button',{name:'筛选',exact:true}).click();const dialog=page.getByRole('dialog',{name:'筛选规则资料'});
 await dialog.getByRole('navigation',{name:'筛选维度'}).getByRole('button',{name:/环阶/}).click();await dialog.getByRole('checkbox',{name:'1 级 / 环'}).check();await expect(dialog.locator('header')).toContainText('1 / 2 条');
 await dialog.getByRole('button',{name:'完成 · 查看结果'}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('.catalog-row')).toContainText('初阶检索术');
 await page.getByRole('button',{name:'筛选 · 1',exact:true}).click();await dialog.getByRole('navigation',{name:'筛选维度'}).getByRole('button',{name:/环阶/}).click();await expect(dialog.getByRole('checkbox',{name:'1 级 / 环'})).toBeChecked();
 await dialog.getByRole('button',{name:'排除1',exact:true}).click();await expect(dialog.getByRole('checkbox',{name:'1 级 / 环'})).not.toBeChecked();await expect(dialog.getByRole('button',{name:'排除1',exact:true})).toHaveAttribute('aria-pressed','true');await expect(dialog.locator('header')).toContainText('1 / 2 条');
 await page.keyboard.press('Escape');await expect(page.locator('.catalog-row')).toContainText('高阶检索术');
 await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'装备',exact:true}).click();await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'法术',exact:true}).click();await expect(page.locator('.catalog-row')).toContainText('高阶检索术');
 await page.getByRole('button',{name:'清空',exact:true}).click();await expect(page.locator('.catalog-list')).toHaveAttribute('data-total-rows','2');
});

test('a query in progress does not expose a false empty result or allow Enter to open stale results',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 const input=page.getByRole('textbox',{name:'搜索规则资料',exact:true}),results=page.getByRole('region',{name:'全局搜索结果'});
 await input.fill('测试');await expect(results).toHaveAttribute('aria-busy','false');await input.press('ArrowDown');
 await input.fill('不存在的结果');await input.press('Enter');await expect(page.locator('.entry-detail')).toHaveCount(0);await expect(results).toHaveAttribute('aria-busy','false');await expect(results).toContainText('没有匹配结果');
});

test('a failed search finishes its busy state and does not enable results from the previous query',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 const input=page.getByRole('textbox',{name:'搜索规则资料',exact:true}),results=page.getByRole('region',{name:'全局搜索结果'});
 await input.fill('测试');await expect(results).toHaveAttribute('aria-busy','false');await expect(page.locator('.global-result').first()).toBeVisible();
 await page.route('**/assets/search-*.js',route=>route.abort('failed'));
 await input.fill('test');await expect(results.getByRole('status')).toContainText('搜索失败');await expect(results).toHaveAttribute('aria-busy','false');await expect(page.locator('.global-result')).toHaveCount(0);await expect(results).not.toContainText('没有匹配结果');
});
