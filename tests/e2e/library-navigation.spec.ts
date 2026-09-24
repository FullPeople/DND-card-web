import { test, expect } from '@playwright/test';
import { mockSource } from './fixtures';
test.beforeEach(async({page})=>{await mockSource(page);});

test('source-off entries remain normal; explicit exclusions alone are struck through',async({page})=>{
 await page.route('**/data/spells/spells-test.json',r=>r.fulfill({json:{spell:[{name:'扩展法术',source:'XGE',level:1,entries:['扩展正文。']}]}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'法术',exact:true}).click();
 await expect(page.locator('.catalog-row')).not.toHaveClass(/entry-disabled/);
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();let book=page.locator('.source-book').filter({has:page.getByRole('button',{name:'设置来源 XGE'})});await book.locator('input[type=checkbox]').first().check();await book.getByRole('button',{name:'设置来源 XGE'}).click();await page.getByRole('dialog',{name:/来源设置/}).getByRole('checkbox',{name:'启用条目 扩展法术'}).uncheck();await page.getByRole('button',{name:'关闭来源设置'}).click();await page.getByRole('button',{name:'关闭弹窗'}).click();await expect(page.locator('.catalog-row')).toHaveClass(/entry-disabled/);
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();book=page.locator('.source-book').filter({has:page.getByRole('button',{name:'设置来源 XGE'})});await book.locator('input[type=checkbox]').first().uncheck();await page.getByRole('button',{name:'关闭弹窗'}).click();await expect(page.locator('.catalog-row')).not.toHaveClass(/entry-disabled/);
});

test('original dense full-width table scrolls the document and feature headings drag without previews',async({page})=>{
 await page.route('**/data/class/class-test.json',r=>r.fulfill({json:{class:[{name:'测试法师',source:'XPHB',classFeatures:['施法|测试法师|XPHB|1'],classTableGroups:[{colLabels:['次数','法术位'],rows:Array.from({length:20},()=>[2,3])}]}],classFeature:[{name:'施法',source:'XPHB',className:'测试法师',classSource:'XPHB',level:1,entries:Array.from({length:40},(_,i)=>`特性正文${i}。`)}]}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.locator('.catalog-row').first().click();
 const table=page.locator('.document-prose table');await expect(table.locator('tbody tr')).toHaveCount(20);await expect(table.locator('[rowspan]:not([rowspan="1"])')).toHaveCount(0);
 const boxes=await table.evaluate(e=>({width:e.getBoundingClientRect().width,parent:e.parentElement!.getBoundingClientRect().width,row:e.querySelector('tbody tr')!.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize)}));expect(Math.abs(boxes.width-boxes.parent)).toBeLessThan(3);expect(boxes.row).toBeLessThan(18);expect(boxes.font).toBeLessThanOrEqual(9);
 await table.locator('tbody tr').first().hover();await expect(page.getByRole('tooltip')).toHaveCount(0);await page.mouse.wheel(0,240);await expect.poll(()=>page.locator('.entry-detail').evaluate(e=>e.scrollTop)).toBeGreaterThan(100);
 const heading=page.getByRole('button',{name:'折叠段落 施法',exact:true});await heading.hover();await expect(page.getByRole('tooltip')).toHaveCount(0);await heading.dragTo(page.locator('.class-features'));await expect(page.locator('.class-features .feature-caption')).toContainText('施法');
});

test('cross-category back stack restores the feat and its scroll, then traverses another link',async({page})=>{
 await page.route('**/data/feats.json',r=>r.fulfill({json:{feat:[{name:'联结专长',source:'XPHB',entries:[...Array.from({length:25},(_,i)=>`段落${i}。`),'最后查阅 {@spell 微光术|XPHB}。']}]}}));
 await page.route('**/data/spells/spells-test.json',r=>r.fulfill({json:{spell:[{name:'微光术',source:'XPHB',level:0,entries:['参阅 {@race 测试旅人|XPHB}。']}]}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'专长',exact:true}).click();await page.locator('.catalog-row').click();const link=page.locator('.document-prose').getByRole('button',{name:'微光术',exact:true});await link.scrollIntoViewIfNeeded();const top=await page.locator('.entry-detail').evaluate(e=>e.scrollTop);await link.click();await expect(page.locator('.detail-heading')).toContainText('微光术');await page.locator('.document-prose').getByRole('button',{name:'测试旅人',exact:true}).click();await expect(page.locator('.detail-heading')).toContainText('测试旅人');
 await page.getByRole('button',{name:'← 上一条',exact:true}).click();await expect(page.locator('.detail-heading')).toContainText('微光术');await page.getByRole('button',{name:'← 上一条',exact:true}).click();await expect(page.locator('.detail-heading')).toContainText('联结专长');await expect.poll(()=>page.locator('.entry-detail').evaluate(e=>e.scrollTop)).toBeCloseTo(top,0);
});

test('catalog windows reach the final row; glossary excludes unrelated data and conditions show all sources',async({page})=>{
 await page.route('**/data/spells/spells-test.json',r=>r.fulfill({json:{spell:Array.from({length:190},(_,i)=>({name:`测试法术${String(i).padStart(3,'0')}`,source:'XPHB',level:0,entries:['正文']}))}}));
 await page.route('**/data/deities.json',r=>r.fulfill({json:{deity:[{name:'测试神祇',source:'XPHB',entries:['神祇正文']}]}}));
 await page.route('**/data/generated/gendata-variantrules.json',r=>r.fulfill({json:{variantrule:[{name:'测试术语',source:'XPHB',entries:['术语正文']}]}}));
 await page.route('**/data/conditionsdiseases.json',r=>r.fulfill({json:{condition:[{name:'核心状态',source:'XPHB',entries:['核心']},{name:'扩展状态',source:'XGE',entries:['扩展']}],disease:[{name:'测试疾病',source:'XPHB',entries:['疾病']}]}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();const tabs=page.getByRole('navigation',{name:'资料分类'});await tabs.getByRole('button',{name:'法术',exact:true}).click();await expect(page.locator('.catalog-list')).toHaveAttribute('data-total-rows','190');await page.locator('.catalog-list').evaluate(e=>{e.scrollTop=e.scrollHeight;});await expect(page.locator('.catalog-row').last()).toContainText('测试法术189');expect(await page.locator('.catalog-row').count()).toBeLessThan(70);
 await tabs.getByRole('button',{name:'术语汇编',exact:true}).click();await expect(page.locator('.catalog-list')).toContainText('测试术语');await expect(page.locator('.catalog-list')).not.toContainText('测试神祇');await tabs.getByRole('button',{name:'其他资料',exact:true}).click();await expect(page.locator('.catalog-list')).toContainText('测试神祇');
 await tabs.getByRole('button',{name:'状态',exact:true}).click();await expect(page.locator('.catalog-row').first()).toContainText('核心状态');await expect(page.locator('.catalog-row')).toHaveCount(2);await page.reload();await expect(page.locator('.catalog-row')).toHaveCount(2);
});
