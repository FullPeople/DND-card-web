import {test,expect} from '@playwright/test';
import {ready,raw} from './automationChoiceFixture';

test('Wiki favorites work while reading, stay in the favorites tab, persist after refresh and can be removed',async({page},info)=>{
 await ready(page);await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 await page.locator('.category-tabs').getByRole('button',{name:'职业',exact:true}).click();
 const row=page.locator('.catalog-row').filter({hasText:'测试职业'}).first();await expect(row).toBeVisible();
 await row.click({button:'right'});await page.getByRole('menuitem',{name:'添加至收藏',exact:true}).click();
 await page.locator('.category-tabs').getByRole('button',{name:'收藏',exact:true}).click();await expect(page.locator('[data-library-tab="favorites"] .catalog-row')).toHaveCount(1);
 await page.locator('[data-library-tab="favorites"] .catalog-row').click();await expect(page.locator('[data-library-tab="favorites"]')).toBeVisible();
 await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toHaveAttribute('aria-checked','false');
 await page.reload();await expect(page.locator('[data-library-tab="favorites"] .catalog-row')).toHaveCount(1);
 await page.screenshot({path:info.outputPath('wiki-favorites.png')});
 await page.locator('[data-library-tab="favorites"] .catalog-row').click({button:'right'});await page.getByRole('menuitem',{name:'移除收藏',exact:true}).click();
 await expect(page.locator('[data-library-tab="favorites"] .catalog-row')).toHaveCount(0);await page.reload();await expect(page.locator('[data-library-tab="favorites"] .catalog-row')).toHaveCount(0);
});

test('same-name 2014 and 2024 entries are distinct favorites and remain bookmarked across cards',async({page})=>{
 await ready(page,{...raw,class:[...raw.class,{...raw.class[0],source:'PHB',classFeatures:[]}]});
 await page.locator('.category-tabs').getByRole('button',{name:'职业',exact:true}).click();
 await page.getByRole('combobox',{name:'资料版本',exact:true}).selectOption('all');
 const rows=page.locator('.catalog-row').filter({hasText:'测试职业'});await expect(rows).toHaveCount(2);
 for(let i=0;i<2;i++){await rows.nth(i).click({button:'right'});await page.getByRole('menuitem',{name:'添加至收藏',exact:true}).click();}
 await page.locator('.category-tabs').getByRole('button',{name:'收藏',exact:true}).click();await page.getByRole('combobox',{name:'资料版本',exact:true}).selectOption('all');
 await expect(page.locator('[data-library-tab="favorites"] .catalog-row')).toHaveCount(2);
 const tabs=page.locator('.character-tabs [role="tab"]');await expect(tabs).toHaveCount(2);await tabs.first().click();
 await expect(page.locator('[data-library-tab="favorites"] .catalog-row')).toHaveCount(2);
 await page.locator('[data-library-tab="favorites"] .catalog-row').first().click({button:'right'});await page.getByRole('menuitem',{name:'移除收藏',exact:true}).click();
 await expect(page.locator('[data-library-tab="favorites"] .catalog-row')).toHaveCount(1);
});
