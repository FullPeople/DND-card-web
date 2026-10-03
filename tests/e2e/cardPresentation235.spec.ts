import {test,expect,type Page} from '@playwright/test';
import {newCharacter} from '../../src/core/model';
import {mockSource,suppressAnnouncement} from './fixtures';
async function stored(page:Page){return page.evaluate(()=>new Promise<any>((resolve,reject)=>{const request=indexedDB.open('dnd-card-workspace');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,get=db.transaction('documents').objectStore('documents').get('workspace');get.onsuccess=()=>{const workspace=get.result;resolve(workspace.characters.find((c:any)=>c.id===workspace.activeId));db.close();};get.onerror=()=>reject(get.error);};}));}
for(const mode of ['a4','screen'] as const)test(`235 ${mode}: spell eye hides only the overview panel, persists and expands heritage`,async({page})=>{
 await mockSource(page,{displayMode:mode});await suppressAnnouncement(page);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 const c=newCharacter();c.name='法术框显示测试';await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'display235.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 const spell=page.locator('.overview-spells'),heritage=page.locator('.heritage-features');await expect(spell).toBeVisible();await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 const eye=page.getByRole('button',{name:'隐藏主要页法术框',exact:true});await expect(eye).toHaveAttribute('aria-pressed','false');const title=await spell.locator('.cell-heading h3').boundingBox(),icon=await eye.boundingBox();expect(icon!.x-title!.x-title!.width).toBeGreaterThanOrEqual(0);expect(icon!.x-title!.x-title!.width).toBeLessThanOrEqual(6);
 const before=await heritage.boundingBox();await eye.click();await expect(eye).toHaveAttribute('aria-pressed','true');await expect(spell).toBeVisible();await expect.poll(async()=>(await stored(page)).overviewSpellsHidden).toBe(true);
 await eye.focus();await page.keyboard.press('Space');await expect(eye).toHaveAttribute('aria-pressed','false');await page.keyboard.press('Enter');await expect(eye).toHaveAttribute('aria-pressed','true');
 await page.emulateMedia({media:'print'});await expect(spell).toBeHidden();await page.emulateMedia({media:'screen'});await expect(spell).toBeVisible();
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await expect(spell).toHaveCount(0);await expect(heritage).toBeVisible();if(mode==='a4'){const after=(await heritage.boundingBox())!;expect(after.width).toBeGreaterThan(before!.width+50);}
 await page.reload();await expect(page.locator('.overview-spells')).toHaveCount(0);await expect.poll(async()=>(await stored(page)).overviewSpellsHidden).toBe(true);expect((await stored(page)).selections).toEqual(c.selections);
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await expect(eye).toHaveAttribute('aria-pressed','true');await eye.click();await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await expect(spell).toBeVisible();await expect.poll(async()=>(await stored(page)).overviewSpellsHidden).toBe(false);
 await page.screenshot({path:test.info().outputPath(`235-spell-eye-${mode}.png`)});
});
