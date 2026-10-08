import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';

test('top palette persists UI, Wiki and per-component card colors; right-click clones independently',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/card/?intro=0');await expect(page.locator('.paper')).toBeVisible();
 await expect(page.locator('.paper .palette')).toHaveCount(0);
 await page.getByRole('button',{name:'调色盘',exact:true}).click();const drawer=page.getByRole('dialog',{name:'调色盘',exact:true});await expect(drawer).toBeVisible();
 const change=async(name:string,value:string)=>{const field=drawer.getByRole('textbox',{name:name+'颜色代码',exact:true});await field.fill(value);await field.blur();};
 await change('页面背景','#CBDBCA');await expect.poll(()=>page.locator('.app-shell').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(203, 219, 202)');
 await drawer.getByRole('button',{name:'Wiki',exact:true}).click();await change('条目底色','#DBCABD');await change('条目链接','#663344');
 await drawer.getByRole('button',{name:'角色卡组件',exact:true}).click();await drawer.getByRole('navigation',{name:'角色卡配色组件'}).getByRole('button',{name:'六项属性',exact:true}).click();await change('内容底色','#CCDDAB');
 await expect.poll(()=>page.locator('[data-palette-component=abilities] .cell-content').first().evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(204, 221, 171)');
 await page.screenshot({path:test.info().outputPath('unified-palette.png')});await drawer.getByRole('button',{name:'关闭调色盘'}).click();await page.reload();await expect(page.locator('.paper')).toBeVisible();
 await expect.poll(()=>page.locator('[data-palette-component=abilities] .cell-content').first().evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(204, 221, 171)');
 await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'法术',exact:true}).click();const row=page.locator('.catalog-row').filter({hasText:'微光术'}).first();await expect(row).toBeVisible();
 expect(await row.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(219, 202, 189)');await page.evaluate(()=>document.documentElement.dataset.suiteNight='true');await expect.poll(()=>row.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(219, 202, 189)');await page.evaluate(()=>document.documentElement.dataset.suiteNight='false');await row.click();await expect(page.locator('.entry-detail .spell-learners')).toBeVisible();
 await row.click({button:'right'});await page.getByRole('menuitem',{name:'创建自定义副本',exact:true}).click();await expect(page.locator('.custom-entry-editor')).toBeVisible();
 await expect(page.locator('.custom-entry-editor')).toContainText('微光术');await page.screenshot({path:test.info().outputPath('wiki-clone.png')});
});

test('spell tooltip omits learners while preserving spell facts and body',async({page})=>{
 await mockSource(page);await page.route('**/data/class/class-test.json',route=>route.fulfill({json:{class:[{name:'测试法师',source:'XPHB',hd:{faces:6},entries:['可以查阅 {@spell 微光术|XPHB}。']}]}}));await suppressAnnouncement(page);await page.goto('/card/?intro=0');await expect(page.locator('.paper')).toBeVisible();
 await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'职业',exact:true}).click();await page.locator('.catalog-row').filter({hasText:'测试法师'}).first().click();
 const reference=page.locator('.entry-detail .inline-reference').filter({hasText:'微光术'}).first();await reference.hover();const tooltip=page.getByRole('tooltip');await expect(tooltip).toBeVisible();await expect(tooltip).toContainText('为测试而创作的一点微光');await expect(tooltip.locator('.spell-learners')).toHaveCount(0);await expect(tooltip).not.toContainText('谁能学');
});

test('Wiki table colors survive night mode and reload',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);await page.route('**/data/spells/spells-test.json',route=>route.fulfill({headers:{'access-control-allow-origin':'*'},json:{spell:[{name:'微光术',ENG_name:'Test Glow',source:'XPHB',level:0,entries:[{type:'table',caption:'测试配色表',colLabels:['条目','数值'],rows:[['一','1'],['二','2']]}]}]}}));
 await page.goto('/card/?intro=0');await expect(page.locator('.paper')).toBeVisible();await page.getByRole('button',{name:'调色盘',exact:true}).click();const drawer=page.getByRole('dialog',{name:'调色盘',exact:true});await drawer.getByRole('button',{name:'Wiki',exact:true}).click();
 for(const [label,value] of [['表头底色','#778899'],['表格底色','#BBDDCC'],['表格交替行','#CCDDCC']]){const field=drawer.getByRole('textbox',{name:label+'颜色代码',exact:true});await field.fill(value);await field.blur();}await drawer.getByRole('button',{name:'关闭调色盘'}).click();
 await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'法术',exact:true}).click();await page.locator('.catalog-row').filter({hasText:'微光术'}).first().click();const table=page.locator('.entry-detail .rules-prose table').first();await expect(table).toBeVisible();
 for(const night of [false,true]){await page.evaluate(value=>document.documentElement.dataset.suiteNight=String(value),night);await expect.poll(()=>table.locator('th').first().evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(119, 136, 153)');await expect(table.locator('tbody tr').first().locator('td').first()).toHaveCSS('background-color','rgb(187, 221, 204)');await expect(table.locator('tbody tr').nth(1).locator('td').first()).toHaveCSS('background-color','rgb(204, 221, 204)');}
 await page.reload();await expect(table).toBeVisible();await expect(table.locator('th').first()).toHaveCSS('background-color','rgb(119, 136, 153)');
});


test('homepage and library entries skip the intro without skipping app readiness',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/');await page.getByRole('link',{name:'打开在线车卡'}).click();await expect(page.locator('.paper')).toBeVisible();await expect(page.locator('#startup-intro')).toBeHidden();
 await page.goto('/library/');await page.getByRole('link',{name:'在线车卡',exact:true}).click();await expect(page).toHaveURL(/intro=0/);await expect(page.locator('.paper')).toBeVisible();await expect(page.locator('#startup-intro')).toBeHidden();
});
