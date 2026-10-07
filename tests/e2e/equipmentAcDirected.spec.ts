import {test,expect,type Page} from '@playwright/test';
import {equipmentAcCard} from '../helpers/equipmentAcFixture';
import {loadLockedEquipment} from '../helpers/equipmentAcSource';
import {exportCharacter} from '../../src/core/export';
import type {Character} from '../../src/core/model';
import {mockSource,suppressAnnouncement} from './fixtures';

async function savedCard(page:Page){return page.evaluate(async()=>{
 const request=indexedDB.open('dnd-card-standalone'),db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{return await new Promise<Character>((resolve,reject)=>{const get=db.transaction('documents').objectStore('documents').get('workspace');get.onsuccess=()=>resolve(get.result.characters.find((c:Character)=>c.id===get.result.activeId));get.onerror=()=>reject(get.error);});}finally{db.close();}
});}
async function openCard(page:Page,c:Character){
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/');await expect(page.getByRole('button',{name:'导入 / 导出',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'authored-ac-test-card.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 if(c.edition==='2014'){const review=page.getByRole('dialog',{name:'导入前核对',exact:true});await expect(review).toContainText('导入后保留该角色自己的规则版本');await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();}
 await expect(page.getByRole('tab',{name:c.name+'（导入）',exact:true})).toHaveAttribute('aria-selected','true');await page.getByRole('dialog',{name:'导入与导出',exact:true}).getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await page.getByRole('button',{name:'自动化设置',exact:true}).click();
}
async function assertSaved(page:Page,c:Character){
 await expect(page.locator('.save-status')).toContainText('已保存到本机');const saved=await savedCard(page);
 expect(saved.edition).toBe(c.edition);expect(saved.runtime.resources.manual).toEqual(c.runtime.resources.manual);expect(saved.runtime.hp).toBe(7);expect(saved.runtime.tempHp).toBe(2);expect(saved.answers).toEqual(c.answers);expect(saved.training).toEqual(c.training);expect(saved.inventory?.coins).toEqual(c.inventory?.coins);return saved;
}
for(const edition of ['2014','2024'] as const)test(`${edition} authored policy: wear/remove, undo/redo, offset and opt-out survive saved reload`,async({page})=>{
 const c=equipmentAcCard(edition);c.abilities.dex=edition==='2014'?6:16;c.sheetBonuses={ac:1};if(edition==='2024')await page.setViewportSize({width:390,height:844});await openCard(page,c);const ac=page.getByTestId('automation-ac');
 const equip=(id:string)=>page.getByRole('checkbox',{name:'装备 '+c.selections.find(s=>s.id===id)!.entry.name,exact:true});
 await expect(ac).toHaveText(edition==='2014'?'9':'14');await equip('medium').check();await expect(ac).toHaveText(edition==='2014'?'13':'17');await equip('shield').check();await expect(ac).toHaveText(edition==='2014'?'15':'19');await equip('heavy').check();await expect(ac).toHaveText('19');await expect(equip('medium')).not.toBeChecked();
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'撤销',exact:true}).click();await page.getByRole('button',{name:'自动化设置',exact:true}).click();await expect(equip('medium')).toBeChecked();await expect(equip('heavy')).not.toBeChecked();await expect(ac).toHaveText(edition==='2014'?'15':'19');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'重做',exact:true}).click();await page.getByRole('button',{name:'自动化设置',exact:true}).click();await expect(equip('heavy')).toBeChecked();await expect(ac).toHaveText('19');await assertSaved(page,c);
 await page.reload();await page.getByRole('button',{name:'自动化设置',exact:true}).click();await expect(ac).toHaveText('19');await equip('shield').uncheck();await expect(ac).toHaveText('17');await equip('heavy').uncheck();await expect(ac).toHaveText(edition==='2014'?'9':'14');
 await page.getByRole('checkbox',{name:'启用自动计算',exact:true}).uncheck();await assertSaved(page,c);await page.reload();await page.getByRole('button',{name:'自动化设置',exact:true}).click();await expect(page.getByRole('checkbox',{name:'启用自动计算',exact:true})).not.toBeChecked();await expect(ac).toHaveText(edition==='2014'?'9':'14');await assertSaved(page,c);
 await page.screenshot({path:test.info().outputPath('authored-ac-persistence.png')});
});
for(const edition of ['2014','2024'] as const)test(`${edition} real locked item projection: structured AC and manual records survive refresh`,async({page})=>{
 test.skip(!process.env.DND_EQUIPMENT_AC_SOURCE,'Locked source file required; no synthetic fallback');
 const c=equipmentAcCard(edition,loadLockedEquipment(process.env.DND_EQUIPMENT_AC_SOURCE!));c.abilities.dex=10;await openCard(page,c);
 const equip=(id:string)=>page.getByRole('checkbox',{name:'装备 '+c.selections.find(s=>s.id===id)!.entry.name,exact:true}),ac=page.getByTestId('automation-ac');
 await expect(ac).toHaveText('10');await equip('heavy').check();await expect(ac).toHaveText('16');await equip('shield').check();await expect(ac).toHaveText('18');await equip('medium').check();await expect(ac).toHaveText('16');await expect(equip('heavy')).not.toBeChecked();await assertSaved(page,c);
 await page.reload();await page.getByRole('button',{name:'自动化设置',exact:true}).click();await expect(ac).toHaveText('16');await expect(equip('medium')).toBeChecked();const saved=await assertSaved(page,c);expect(saved.selections.map(s=>s.entry.id)).toEqual(c.selections.map(s=>s.entry.id));expect(saved.selections.find(s=>s.id==='shield')!.quantity).toBe(5);
 await page.screenshot({path:test.info().outputPath('locked-item-ac-persistence.png')});
});
