import {test,expect,type Page} from '@playwright/test';
import {mockSource,fillFromDetail} from './fixtures';
import {source195} from '../fixtures/source195';
import {newCharacter,type Entry} from '../../src/core/model';
const raw=source195.class[0],cls:Entry={id:'test-caster',kind:'class',name:raw.name,english:raw.name,source:raw.source,edition:'2024',packId:'test',revision:'1',entries:[],raw};
async function start(page:Page){await mockSource(page);await page.route('https://5e.kiwee.top/data/class/class-test.json',r=>r.fulfill({json:source195}));await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();}
async function loadCard(page:Page){const c=newCharacter();c.name='界面核对';c.abilities.con=14;c.abilities.wis=16;c.selections=[{id:'caster',entry:cls,level:8,quantity:1,equipped:false}];c.runtime.resources={'spell-slot:1':{name:'1环法术位',current:3,max:4},'spell-slot:2':{name:'2环法术位',current:2,max:3}};await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'test195.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await page.getByRole('button',{name:'关闭弹窗'}).click();}
test('Wiki preserves nested feature prose and separate edition-qualified subclass sections',async({page})=>{
 await start(page);await page.locator('.catalog-row').first().click();await page.getByRole('button',{name:'子职',exact:true}).click();
 const feature=page.locator('.document-section').filter({has:page.getByRole('button',{name:'折叠段落 新影',exact:true})});await expect(feature).toContainText('子段甲');await expect(feature.locator('.feature-subentry')).toHaveCount(3);await expect(feature.locator('h4')).toHaveCount(1);
 await expect(feature).not.toContainText('独立的旧版正文');await expect(page.locator('.document-section').filter({has:page.getByRole('button',{name:'折叠段落 旧影',exact:true})})).toContainText('独立的旧版正文');
 await feature.scrollIntoViewIfNeeded();await page.screenshot({path:test.info().outputPath('195-wiki-hierarchy.png')});
});
test('dragging the identical class increments its existing level and can be undone',async({page})=>{
 await start(page);await page.getByRole('switch',{name:'编辑模式'}).click();await page.locator('.catalog-row').first().click();await fillFromDetail(page);await expect(page.locator('.identity-class input')).toHaveValue('1');await fillFromDetail(page);await expect(page.locator('.identity-class input')).toHaveValue('2');await expect(page.locator('.identity-class .identity-token')).toHaveCount(1);
 await page.keyboard.press('Control+z');await expect(page.locator('.identity-class input')).toHaveValue('1');await page.keyboard.press('Control+Shift+z');await expect(page.locator('.identity-class input')).toHaveValue('2');
});
test('HP level fields are square, averages locked, dice assets reused and spell slots fill the row',async({page})=>{
 await start(page);await loadCard(page);await page.getByRole('switch',{name:'编辑模式'}).click();await expect(page.locator('.life-cell .heading-settings-icon')).toBeVisible();
 await expect(page.locator('.hit-die-art img').first()).toHaveAttribute('src',/dice\/d8.png$/);
 const slot=page.locator('.quickbar-resources .spell-slot-summary');await expect(slot).toBeVisible();const fills=await slot.evaluate(el=>Math.abs(el.getBoundingClientRect().width-el.parentElement!.getBoundingClientRect().width)<5);expect(fills).toBe(true);
 await page.getByRole('button',{name:'设置生命值取值方式'}).click();await expect(page.locator('.hp-levels input')).toHaveCount(0);await expect(page.locator('.hp-level-value')).toHaveCount(8);const square=await page.locator('.hp-level-value').first().boundingBox();expect(square!.width).toBe(square!.height);
 await expect(page.locator('.hp-calculation')).toContainText('当前生命值上限：59');await expect(page.locator('.hp-calculation')).toContainText('体质调整值（2）× 等级（8）');await page.screenshot({path:test.info().outputPath('195-hp-squares.png')});
 await page.getByRole('button',{name:'逐级骰值',exact:true}).click();await page.getByLabel('测试祭司2级生命骰结果').fill('2');await page.getByLabel('测试祭司3级生命骰结果').click();await expect(page.locator('.hp-calculation')).toContainText('当前生命值上限：56');
});
test('spell ability derives from class and is edited only through its titled setting',async({page})=>{
 await start(page);await loadCard(page);await page.getByRole('tab',{name:'法术',exact:true}).click();await expect(page.locator('.spell-ability-cell')).toContainText('感知');await expect(page.getByRole('button',{name:'设置施法属性'})).toHaveCount(0);
 await page.getByRole('switch',{name:'编辑模式'}).click();await expect(page.locator('.spell-settings select')).toHaveCount(0);await expect(page.locator('.spell-ability-cell .heading-settings-icon')).toBeVisible();await page.getByRole('button',{name:'设置施法属性'}).click();await page.getByRole('group',{name:'手动施法属性'}).getByRole('button',{name:'魅力',exact:true}).click();await page.getByRole('button',{name:'关闭弹窗'}).click();await expect(page.locator('.spell-ability-cell')).toContainText('魅力');await page.screenshot({path:test.info().outputPath('195-spell-ability.png')});
 await page.getByRole('button',{name:'设置施法属性'}).click();await page.getByRole('button',{name:'跟随职业',exact:true}).last().click();await page.getByRole('button',{name:'关闭弹窗'}).click();await expect(page.locator('.spell-ability-cell')).toContainText('感知');
 const search=page.getByRole('searchbox',{name:'职业分类搜索'});expect(await search.evaluate(el=>el.clientHeight>=28)).toBe(true);
});
