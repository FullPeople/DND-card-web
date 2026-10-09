import {test,expect} from '@playwright/test';
import {ready,raw} from './automationChoiceFixture';

test('global search follows the rule base version even when the category shows all editions',async({page})=>{
 await ready(page,{...raw,class:[...raw.class,{...raw.class[0],source:'PHB',ENG_name:'Edition 2014 Marker',classFeatures:[]}]});
 await page.locator('.category-tabs').getByRole('button',{name:'职业',exact:true}).click();await page.getByRole('combobox',{name:'资料版本',exact:true}).selectOption('all');await expect(page.locator('.catalog-row').filter({hasText:'测试职业'})).toHaveCount(2);
 const search=page.getByRole('textbox',{name:'搜索规则资料',exact:true});await search.fill('测试职业');await expect(page.locator('.global-result')).toHaveCount(1);await expect(page.locator('.global-result')).toContainText('Fixture Class');
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await page.getByRole('radio',{name:'2014',exact:true}).click();await page.keyboard.press('Escape');await search.click();await expect(page.locator('.global-result')).toHaveCount(1);await expect(page.locator('.global-result')).toContainText('Edition 2014 Marker');
});

test('selected filter and class navigation remain animated with readable contrast after the click ends',async({page},info)=>{
 await ready(page);const filter=page.locator('.custom-visibility');
 await expect(filter).toHaveAttribute('data-mode','all');expect(await filter.evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('none');
 await filter.click();await expect(filter).toHaveAttribute('data-mode','native');
 const state=await filter.evaluate(el=>({ink:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor,motion:getComputedStyle(el,'::after').animationIterationCount}));expect(state).toEqual({ink:'rgb(255, 255, 255)',background:'rgb(73, 73, 73)',motion:'infinite'});
 await page.locator('.catalog-row').filter({hasText:'测试职业'}).first().click();const selected=page.locator('.class-jumps button[aria-pressed="true"]');await expect(selected).toHaveText('主体');expect(await selected.evaluate(el=>getComputedStyle(el,'::after').animationIterationCount)).toBe('infinite');
 await page.locator('.class-jumps').getByRole('button',{name:'子职',exact:true}).click();await expect(selected).toHaveText('子职');await expect(selected).toHaveCSS('color','rgb(255, 255, 255)');await expect(selected).toHaveCSS('background-color','rgb(73, 73, 73)');await page.screenshot({path:info.outputPath('persistent-wiki-state.png')});
 await filter.click();await expect(filter).toHaveAttribute('data-mode','custom');expect(await filter.evaluate(el=>getComputedStyle(el,'::after').animationIterationCount)).toBe('infinite');await filter.click();await expect(filter).toHaveAttribute('data-mode','all');expect(await filter.evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('none');
});

test('reduced motion keeps a static visible selected state',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await ready(page);const filter=page.locator('.custom-visibility');await filter.click();await expect(filter).toHaveCSS('color','rgb(255, 255, 255)');expect(await filter.evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('none');expect(await filter.evaluate(el=>getComputedStyle(el,'::after').width)).not.toBe('0px');
});
