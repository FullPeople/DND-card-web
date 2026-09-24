import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter,type Character,type Entry} from '../../src/core/model';

const spell=(name:string):Entry=>({id:`spell:${name}`,kind:'spell',name,english:name,source:'XPHB',edition:'2024',packId:'test',revision:'1',raw:{level:1},entries:[`${name}的完整正文。`]});
async function load(page:Page,c:Character){await mockSource(page);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true,includeHidden:true})).toBeEnabled();await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'spell.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await page.getByRole('button',{name:'关闭弹窗'}).click();}
const character=()=>{const c=newCharacter();for(const name of ['星光矢','星盾']){const e=spell(name);c.selections.push({id:e.id,entry:e,quantity:1,level:1,equipped:false});}c.spellSettings={ability:'int',mode:'prepared',capacity:3,prepared:[],slots:{},attackBonus:0,dcBonus:0};return c;};

test('visible Wiki previews, left-click preparation, context navigation and pointer transfers are distinct',async({page})=>{
 await load(page,character());await page.getByRole('tab',{name:'法术',exact:true}).click();
 const learned=page.locator('.spell-library [data-spell-id="spell:星光矢"]');
 await learned.hover();await expect(page.locator('.entry-detail.is-sheet-preview')).toContainText('星光矢的完整正文');await expect(page.getByRole('tooltip')).toHaveCount(0);
 await learned.click({button:'right'});await page.getByRole('menuitem',{name:'在 Wiki 中查看'}).click();await expect(page.locator('.entry-detail')).not.toHaveClass(/is-sheet-preview/);await expect(page.locator('.prepared-cell [data-spell-id]')).toHaveCount(0);
 await learned.click();await expect(page.locator('.prepared-cell [data-spell-id]')).toHaveCount(1);
 const prepared=page.locator('.prepared-cell [data-spell-id="spell:星光矢"]');await prepared.click();await expect(prepared).toHaveCount(0);
 await learned.dragTo(page.getByRole('button',{name:'预备空位2',exact:true}));await expect(page.locator('[data-prepared-slot="1"] [data-spell-id="spell:星光矢"]')).toBeVisible();
 await prepared.dragTo(page.locator('.spell-library .cell-heading'));await expect(prepared).toHaveCount(0);await expect(learned).toBeVisible();
 await expect(page.locator('.spell-prepare-hint')).toHaveText('左键或拖拽加入 / 移除');
});

test('narrow card hover uses a tooltip and left-click prepares without pinning or opening hidden Wiki',async({page})=>{
 await page.setViewportSize({width:560,height:980});await load(page,character());await page.getByRole('tab',{name:'法术',exact:true}).click();
 const learned=page.locator('.spell-library [data-spell-id="spell:星光矢"]');await learned.hover();await expect(page.getByRole('tooltip')).toContainText('星光矢的完整正文');await expect(page.locator('.wiki-pane')).not.toBeVisible();
 await learned.click();await expect(page.locator('.prepared-cell [data-spell-id="spell:星光矢"]')).toBeVisible();await expect(page.locator('.keyword-preview.is-pinned')).toHaveCount(0);await expect(page.locator('.wiki-pane')).not.toBeVisible();
 const prepared=page.locator('.prepared-cell [data-spell-id="spell:星光矢"]');await prepared.hover();await prepared.click({button:'right'});await page.getByRole('menuitem',{name:'在 Wiki 中查看'}).click();await expect(page.locator('.wiki-pane')).toBeVisible();await expect(page.locator('.detail-heading')).toContainText('星光矢');
});

test('subclass mode starts closed and shows child documents with a compact contents list',async({page})=>{
 await mockSource(page);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true,includeHidden:true})).toBeEnabled();await page.locator('.catalog-row').first().click();
 const toggle=page.getByRole('button',{name:'子职',exact:true});await expect(toggle).toHaveAttribute('aria-expanded','false');
 await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(page.locator('.class-subclasses')).toHaveCount(0);await expect(page.locator('.document-nav')).toContainText('测试学派');await expect(page.locator('.document-prose')).toContainText('测试学派');
 await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(page.locator('.detail-heading')).toContainText('测试法师');
});

test('individually excluded rules strike headings and every nested description without disabling navigation',async({page})=>{
 await mockSource(page);await page.route('**/data/class/class-test.json',route=>route.fulfill({json:{class:[{name:'测试法师',source:'XPHB',classFeatures:['禁止特性|测试法师|XPHB|1']}],classFeature:[{name:'禁止特性',source:'XPHB',className:'测试法师',classSource:'XPHB',level:1,entries:[{type:'entries',name:'嵌套标题',entries:['嵌套文字与 {@spell 微光术|XPHB}。']}]}]}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true,includeHidden:true})).toBeEnabled();await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await page.getByRole('button',{name:'设置来源 XPHB',exact:true}).click();const settings=page.getByRole('dialog',{name:/来源设置/});await settings.getByRole('checkbox',{name:'启用条目 禁止特性',exact:true}).uncheck();await settings.getByRole('checkbox',{name:'启用条目 微光术',exact:true}).uncheck();await page.getByRole('button',{name:'关闭来源设置'}).click();await page.getByRole('button',{name:'关闭弹窗'}).click();
 await page.locator('.catalog-row').first().click();const nested=page.locator('.document-section').filter({has:page.locator('h4',{hasText:'嵌套标题'})});await expect(nested).toHaveClass(/entry-disabled/);await expect(nested.locator('p')).toHaveCSS('text-decoration-line','line-through');await expect(nested.locator('p button')).toHaveCSS('text-decoration-line','line-through');await expect(nested.locator('h4 button')).toHaveCSS('text-decoration-line','line-through');
 await nested.locator('p button').click();await expect(page.locator('.entry-detail')).toHaveClass(/entry-disabled/);await expect(page.locator('.detail-title')).toHaveCSS('text-decoration-line','line-through');await expect(page.locator('.document-prose p')).toHaveCSS('text-decoration-line','line-through');
});


test('fullscreen card hover uses portal tooltips and explicit navigation exits fullscreen',async({page})=>{
 await load(page,character());await page.getByRole('tab',{name:'法术',exact:true}).click();await page.getByRole('button',{name:'卡片全屏',exact:true}).click();
 const learned=page.locator('.spell-library [data-spell-id="spell:星光矢"]');await learned.hover();await expect(page.getByRole('tooltip')).toContainText('星光矢的完整正文');
 await expect(page.locator('.sheet-pane')).toHaveClass(/sheet-fullscreen/);await learned.click();await expect(page.locator('.sheet-pane')).not.toHaveClass(/sheet-fullscreen/);await expect(page.locator('.detail-heading')).toContainText('星光矢');
});
