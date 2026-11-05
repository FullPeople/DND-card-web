import {test,expect} from '@playwright/test';
import {newCharacter} from '../../src/core/model';
import {exportCharacter} from '../../src/core/export';
import {mockSource,suppressAnnouncement,waitForCatalog} from './fixtures';
import {savedCharacter} from './reviewedRuleBrowserState';

test('card colour survives fast rule settings, reading sidebar changes, website colour changes and reopen',async({page})=>{
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);await page.goto('/card/?intro=0');await waitForCatalog(page);
 const c=newCharacter();c.name='配色操作路径验收';c.abilities.str=15;c.notes='原创手工备注';c.runtime.hp=4;c.runtime.resources.manual={name:'手工次数',max:7,current:2};
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'authored-palette-paths.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 const imported=page.getByRole('tab',{name:/配色操作路径验收（导入）/}),review=page.getByRole('dialog',{name:'导入前核对',exact:true});await expect(imported.or(review)).toBeVisible();if(await review.isVisible())await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();await expect(imported).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'角色卡调色盘',exact:true}).click();const card=page.getByRole('dialog',{name:'角色卡调色盘',exact:true});await card.getByRole('button',{name:'林地苔绿',exact:true}).click();const paper=card.getByRole('textbox',{name:'纸张颜色代码',exact:true});await paper.fill('#123456');await paper.blur();await expect(page.locator('.paper[data-active-sheet="true"]')).toHaveCSS('--card-all-paper','#123456');
 // Deliberately open settings immediately, without first waiting for disk save.
 await card.getByRole('button',{name:'关闭调色盘',exact:true}).click();await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expect(page.getByRole('dialog',{name:'规则与扩展 选择规则版本与允许的书籍来源，或导入扩展包',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.paper[data-active-sheet="true"]')).toHaveCSS('--card-all-paper','#123456');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const expected=await savedCharacter(page),wiki=page.locator('.mobile-tabs').getByRole('button',{name:'Wiki',exact:true});if(await wiki.isVisible())await wiki.click();
 for(const name of ['书籍','冒险','规则条目']){await page.locator('.wiki-reading-nav').getByRole('button',{name,exact:true}).click();await expect(page.locator('.paper[data-active-sheet="true"]')).toHaveCSS('--card-all-paper','#123456');}
 const sheet=page.locator('.mobile-tabs').getByRole('button',{name:'功能页',exact:true});if(await sheet.isVisible())await sheet.click();
 await page.getByRole('button',{name:'调色盘',exact:true}).click();const site=page.getByRole('dialog',{name:'调色盘',exact:true});await site.getByRole('button',{name:'青瓷',exact:true}).click();await site.getByRole('button',{name:'关闭调色盘',exact:true}).click();await expect(page.locator('.paper[data-active-sheet="true"]')).toHaveCSS('--card-all-paper','#123456');
 await page.reload();await expect(page.locator('.paper[data-active-sheet="true"]')).toHaveCSS('--card-all-paper','#123456');const restored=await savedCharacter(page);expect(restored.palette).toEqual(expected.palette);expect(restored.componentPalette).toEqual(expected.componentPalette);expect(restored.abilities.str).toBe(15);expect(restored.notes).toBe(c.notes);expect(restored.runtime.hp).toBe(4);expect(restored.runtime.resources.manual).toEqual(c.runtime.resources.manual);await page.screenshot({path:test.info().outputPath('palette-settings-and-sidebar.png')});
});
