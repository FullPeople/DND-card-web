import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {xlsxFixture} from './xlsxFixtures';
import {newCharacter} from '../../src/core/model';
import {exportCharacter} from '../../src/core/export';

async function setup(page:Page){
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/');
 await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
}
async function workspace(page:Page){return page.evaluate(async()=>{
 const name=location.hash.includes('suite=')?'dnd-card-workspace':'dnd-card-standalone';
 const db=await new Promise<IDBDatabase>(resolve=>{const request=indexedDB.open(name);request.onsuccess=()=>resolve(request.result);});
 try{return await new Promise<any>(resolve=>{const request=db.transaction('documents').objectStore('documents').get('workspace');request.onsuccess=()=>resolve(request.result);});}finally{db.close();}
});}
const payload=async(edition='2024')=>({name:`card-${edition}.xlsx`,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:await xlsxFixture(edition)});

test('click upload asks before importing; cancel synchronization saves one custom card with its Excel values',async({page})=>{
 await setup(page);const before=await workspace(page),blocked:string[]=[];
 await page.route('**/api/character/**',route=>{blocked.push(route.request().url());return route.abort();});
 const chooser=page.waitForEvent('filechooser');await page.locator('.transfer-panel .json-file-drop').click();
 const input=await chooser;expect(await input.element().getAttribute('accept')).toContain('.xlsx');await input.setFiles(await payload());
 const dialog=page.getByRole('dialog',{name:'Excel 导入方式',exact:true});await expect(dialog).toContainText('是否同步为 5etools 资料');
 expect((await workspace(page)).characters).toEqual(before.characters);await page.screenshot({path:test.info().outputPath('excel-import-choice.png')});
 await dialog.getByRole('button',{name:'取消同步，导入自定义卡',exact:true}).click();await expect(dialog).toHaveCount(0);
 const after=await workspace(page),card=after.characters.find((row:any)=>row.id===after.activeId);
 expect(after.characters).toHaveLength(before.characters.length+1);expect(card.name).toBe('Excel 验收角色');expect(card.edition).toBe('2024');
 expect(card.runtime).toMatchObject({hp:22,tempHp:3,resources:{'xlsx:resource:0':{current:1,max:4}}});
 expect(card.inventory.coins.gp).toBe(17);expect(card.biography.story).toBe('人物故事原文');
 expect(await page.evaluate(async card=>{const path='/src/core/engine.ts';const {evaluate}=await import(/* @vite-ignore */path);return evaluate(card).ac;},card)).toBe(15);
 expect(card.selections.find((row:any)=>row.entry.kind==='class').entry.source).toBe('IMPORTED');
 expect(card.selections.find((row:any)=>row.entry.name==='旅行物品')).toMatchObject({quantity:3});expect(blocked).toEqual([]);
 await page.reload();await expect(page.locator('.paper')).toBeVisible();expect((await workspace(page)).characters).toHaveLength(after.characters.length);
});

test('single-file Excel upload enters synchronization immediately and saves only the reviewed card',async({page})=>{
 await setup(page);const before=await workspace(page);
 await page.getByTestId('character-file').setInputFiles(await payload());
 await page.getByRole('button',{name:'同步 5etools 资料',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Excel 资料同步',exact:true});await expect(dialog.locator('.card-migration')).toBeVisible();
 expect((await workspace(page)).characters).toEqual(before.characters);
 const label=dialog.locator('.migration-candidate').filter({has:page.getByRole('radio',{name:'测试法师同步目标：测试法师（XPHB）',exact:true})});
 await label.getByRole('radio').check();
 await dialog.getByRole('button',{name:'确认并继续',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'确认同步并导入',exact:true})).toBeEnabled();
 await page.screenshot({path:test.info().outputPath('excel-sync-review.png')});
 await dialog.getByRole('button',{name:'确认同步并导入',exact:true}).click();await expect(dialog).toHaveCount(0);
 const after=await workspace(page),card=after.characters.find((row:any)=>row.id===after.activeId);
 expect(after.characters).toHaveLength(before.characters.length+1);expect(card.name).toBe('Excel 验收角色');
 expect(after.characters.some((row:any)=>/同步前备份|资料同步副本/.test(row.name))).toBe(false);
 expect(card.selections.find((row:any)=>row.entry.kind==='class').entry.source).toBe('XPHB');expect(card.runtime.resources['xlsx:resource:0'].current).toBe(1);
});

test('migration labels do not trigger tooltips; the circle info icon shows a tooltip above the pointer and clear of the next button',async({page})=>{
 await setup(page);await page.getByTestId('character-file').setInputFiles(await payload());await page.getByRole('button',{name:'同步 5etools 资料',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Excel 资料同步',exact:true}),text=dialog.locator('.migration-original .migration-entry strong').first();
 await text.hover();await page.waitForTimeout(180);expect(await page.locator('.migration-entry-tooltip:popover-open').count()).toBe(0);
 const icon=dialog.locator('.migration-original .migration-info').first();await icon.hover();
 const tip=page.locator('.migration-entry-tooltip:popover-open');await expect(tip).toBeVisible();
 const anchor=await icon.boundingBox(),popup=await tip.boundingBox(),next=await dialog.getByRole('button',{name:'确认并继续',exact:true}).boundingBox();
 expect(popup!.y+popup!.height).toBeLessThan(anchor!.y+anchor!.height/2);expect(popup!.y+popup!.height).toBeLessThanOrEqual(next!.y);
 await icon.press('Escape');await expect(tip).toHaveCount(0);
 await icon.evaluate((node:HTMLElement)=>node.blur());await icon.focus();await expect(tip).toBeVisible();
 for(const width of [1512,390]){
  await page.setViewportSize({width,height:844});await text.hover();await page.waitForTimeout(180);await icon.hover();await expect(tip).toBeVisible();
  const box=await tip.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  await page.screenshot({path:test.info().outputPath(`migration-info-${width}.png`)});
 }
 const selected=await dialog.getByRole('radio',{name:'测试法师同步目标：测试法师（XPHB）',exact:true}).isChecked();await icon.click();expect(await dialog.getByRole('radio',{name:'测试法师同步目标：测试法师（XPHB）',exact:true}).isChecked()).toBe(selected);
});

test('dragging multiple Excel files retains both editions and imports exactly one card per file',async({page})=>{
 await setup(page);const before=await workspace(page),files=await Promise.all([payload('2014'),payload('2024')]);
 const transfer=await page.evaluateHandle(files=>{const data=new DataTransfer();for(const file of files)data.items.add(new File([Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0))],file.name,{type:file.mimeType}));return data;},files.map(file=>({name:file.name,mimeType:file.mimeType,base64:file.buffer.toString('base64')})));
 await page.locator('.transfer-panel .json-file-drop').dispatchEvent('drop',{dataTransfer:transfer});await transfer.dispose();
 const dialog=page.getByRole('dialog',{name:'Excel 导入方式',exact:true});await expect(dialog).toContainText('2 张来自 Excel');
 await dialog.getByRole('button',{name:'取消同步，导入自定义卡',exact:true}).click();await expect(dialog).toHaveCount(0);
 const after=await workspace(page);expect(after.characters).toHaveLength(before.characters.length+2);
 expect(after.characters.filter((row:any)=>row.name==='Excel 验收角色').map((row:any)=>row.edition).sort()).toEqual(['2014','2024']);
});

test('mixed Excel and JSON files share one validated batch; malformed files leave the book intact',async({page})=>{
 await setup(page);const before=await workspace(page),native=newCharacter();native.name='JSON 验收角色';
 await page.getByLabel('批量导入角色文件',{exact:true}).setInputFiles([await payload(),{name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')}]);
 await expect(page.getByRole('alert')).toBeVisible();expect((await workspace(page)).characters).toEqual(before.characters);await expect(page.getByRole('dialog',{name:'Excel 导入方式',exact:true})).toHaveCount(0);
 await page.getByLabel('批量导入角色文件',{exact:true}).setInputFiles([await payload(),{name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(native)))}]);
 await page.getByRole('button',{name:'取消同步，导入自定义卡',exact:true}).click();await expect(page.getByRole('dialog',{name:'Excel 导入方式',exact:true})).toHaveCount(0);
 const after=await workspace(page);expect(after.characters).toHaveLength(before.characters.length+2);expect(after.characters.map((row:any)=>row.name)).toContain('JSON 验收角色');
});

test('closing the synchronization question cancels the import before any character is saved',async({page})=>{
 await setup(page);const before=await workspace(page);await page.getByTestId('character-file').setInputFiles(await payload());
 const dialog=page.getByRole('dialog',{name:'Excel 导入方式',exact:true});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 expect((await workspace(page)).characters).toEqual(before.characters);
});

