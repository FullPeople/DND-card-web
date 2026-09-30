import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
test('local dice is above native dialogs and restores focus without closing the underlying dialog',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/');
 await expect(page.locator('.app-shell')).toBeVisible();
 // Open a real app dialog before the dice, then put normal UI at the largest z-index.
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();
 const under=page.locator('dialog.dialog[open]');await expect(under).toBeVisible();
 const previous=under.getByRole('button',{name:'关闭弹窗'});await previous.focus();
 await page.evaluate(()=>{const block=document.createElement('aside');block.id='dice-layer-obstruction';block.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#7f1d1d;pointer-events:auto';document.body.append(block);window.dispatchEvent(new CustomEvent('local-dice',{detail:{expression:'1d20+5',label:'顶层测试'}}));});
 const dice=page.getByRole('dialog',{name:'本地投骰',exact:true});await expect(dice).toBeVisible();
 expect(await dice.evaluate(e=>e.matches(':modal'))).toBe(true);
 await expect(dice.getByRole('textbox',{name:'骰子表达式'})).toBeFocused();
 await dice.getByRole('button',{name:'投骰',exact:true}).click();await expect(dice.getByRole('status')).toContainText('1d20');
 await page.screenshot({path:test.info().outputPath('dice-above-dialog.png')});
 await page.keyboard.press('Escape');await expect(dice).toHaveCount(0);await expect(under).toBeVisible();await expect(previous).toBeFocused();
 await page.evaluate(()=>{document.getElementById('dice-layer-obstruction')?.remove();window.dispatchEvent(new CustomEvent('local-dice',{detail:{expression:'1d6',label:'再次投骰'}}));});
 await expect(dice).toBeVisible();await dice.getByRole('button',{name:'关闭',exact:true}).click();await expect(dice).toHaveCount(0);await expect(previous).toBeFocused();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('local-dice',{detail:{expression:'1d4',label:'点击空白关闭'}})));
 await expect(dice).toBeVisible();await dice.click({position:{x:5,y:5}});await expect(dice).toHaveCount(0);await expect(under).toBeVisible();await expect(previous).toBeFocused();
 await previous.click();await expect(under).toHaveCount(0);expect(errors).toEqual([]);
});
