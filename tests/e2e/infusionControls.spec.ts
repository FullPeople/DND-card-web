import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement,expandSourceBook} from './fixtures';
import {infusionFixture,infusionData} from './infusionFixture';
import {exportCharacter} from '../../src/core/export';
import {setInfusionTarget} from '../../src/core/automation/infusions';

async function mock(page:Page){
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local test'}}));
 await page.context().route('**/data/class/index.json',route=>route.fulfill({json:{infusion:'class-infusion.json'},headers:{'access-control-allow-origin':'*'}}));
 await page.context().route('**/data/class/class-infusion.json',route=>route.fulfill({json:{class:infusionData.class,classFeature:infusionData.classFeature},headers:{'access-control-allow-origin':'*'}}));
 await page.context().route('**/data/optionalfeatures.json',route=>route.fulfill({json:{optionalfeature:infusionData.optionalfeature},headers:{'access-control-allow-origin':'*'}}));
}
async function saved(page:Page){return page.evaluate(async()=>{
 const path='/card/src/platform/workspaceIdentity.ts',name=(await import(path)).workspaceIdentity.database;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{const workspace=await new Promise<any>((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return workspace.characters.find((c:any)=>c.id===workspace.activeId);}finally{db.close();}
});}
async function assertAc(page:Page,value:number){await page.getByRole('button',{name:'自动化设置',exact:true}).click();const dialog=page.getByRole('dialog',{name:/^基础自动化(?:\s|$)/});await expect(dialog.getByTestId('automation-ac')).toHaveText(String(value));await dialog.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect(dialog).toBeHidden();}
async function features(page:Page){
 const tab=page.getByRole('tab',{name:'特性',exact:true});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');
 const panel=page.locator('.paper[data-active-sheet="true"] .detail-class-features');await expect(panel).toBeVisible();return panel;
}
async function assertArmor(page:Page,value:number){
 const tab=page.getByRole('tab',{name:'主要',exact:true});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');
 await expect(page.locator('.paper[data-active-sheet="true"] [data-stat="ac"]')).toHaveText(String(value));await features(page);
}
async function start(page:Page,active=false,unlearned=false){
 await mock(page);await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const {c,entry,choiceId}=infusionFixture();if(active)setInfusionTarget(c,choiceId,entry.id,'infusion-item-0');if(unlearned)c.answers[choiceId]=[];
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'infusion-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true});await expect(review).toContainText('导入后保留该角色自己的规则版本');await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();
 await expect(page.getByRole('tab',{name:/灌注交互验收（导入）/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 return features(page);
}
test('explicit target preview, activation, reload, target replacement and withdrawal preserve manual values',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));let panel=await start(page),control=panel.locator('[data-infusion-entry]');
 await expect(control).toContainText('尚未指定灌注目标');const before=await saved(page);expect(before.infusions).toBeUndefined();await assertAc(page,13);await assertArmor(page,13);
 await expect(control.getByRole('button',{name:'确认增强防御灌注'})).toBeDisabled();await control.getByLabel('增强防御灌注目标').selectOption('infusion-item-0');expect((await saved(page)).infusions).toBeUndefined();
 await control.getByRole('button',{name:'确认增强防御灌注'}).click();await expect(control).toContainText('已指定灌注目标：灌注测试皮甲');await expect.poll(async()=>((await saved(page)).infusions?.bindings||[]).map((row:any)=>row.targetId)).toEqual(['infusion-item-0']);await assertAc(page,14);
 await assertArmor(page,14);await page.reload();panel=await features(page);control=panel.locator('[data-infusion-entry]');await expect(control.getByLabel('增强防御灌注目标')).toHaveValue('infusion-item-0');await assertAc(page,14);await assertArmor(page,14);
 await control.getByLabel('增强防御灌注目标').selectOption('infusion-item-1');await control.getByRole('button',{name:'确认增强防御灌注'}).click();await expect(control).toContainText('灌注测试盾牌（未装备，不计 AC）');
 await expect.poll(async()=>((await saved(page)).infusions?.bindings||[]).map((row:any)=>row.targetId)).toEqual(['infusion-item-1']);await assertAc(page,13);
 await assertArmor(page,13);
 await page.screenshot({path:info.outputPath('infusion-target.png'),fullPage:true});
 const bounds=await control.evaluate(el=>{const p=el.closest('.cell-content')!.getBoundingClientRect(),select=el.querySelector('select')!.getBoundingClientRect();return {right:select.right,limit:p.right};});expect(bounds.right).toBeLessThanOrEqual(bounds.limit+1);
 await control.getByRole('button',{name:'撤回增强防御灌注'}).click();await expect(control).toContainText('尚未指定灌注目标');await expect.poll(async()=>(await saved(page)).infusions?.bindings).toEqual([]);
 await assertAc(page,13);const after=await saved(page);expect(after.selections.filter((row:any)=>row.entry.kind==='item')).toEqual(before.selections.filter((row:any)=>row.entry.kind==='item'));expect(after.sheetBonuses).toEqual(before.sheetBonuses);expect(after.notes).toBe(before.notes);expect(after.runtime.hp).toBe(before.runtime.hp);expect(errors).toEqual([]);
});
test('source restriction suspends activation but keeps explicit withdrawal',async({page})=>{
 const panel=await start(page,true);await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expandSourceBook(page,'TCE');
 const book=page.locator('.source-book').filter({has:page.locator('button[aria-label="设置来源 TCE"]')});await book.locator('input[type=checkbox]').first().uncheck();await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 const control=panel.locator('[data-infusion-entry]');await expect(control.getByLabel('增强防御灌注目标')).toBeDisabled();await expect(control.getByRole('button',{name:'确认增强防御灌注'})).toBeDisabled();await expect(control.getByRole('button',{name:'撤回增强防御灌注'})).toBeEnabled();
 expect((await saved(page)).infusions.bindings).toHaveLength(1);await control.getByRole('button',{name:'撤回增强防御灌注'}).click();await expect.poll(async()=>(await saved(page)).infusions?.bindings).toEqual([]);
});
test('unlearned bindings remain cleanup-only and a second tab cannot modify them',async({page,context})=>{
 const panel=await start(page,true,true);await expect(panel.getByLabel('已保留灌注记录')).toBeVisible();await expect(panel.getByRole('button',{name:'确认增强防御灌注'})).toHaveCount(0);
 const other=await context.newPage();await mock(other);await other.goto('/card/?intro=0');const readonly=await features(other);await expect(readonly.getByRole('button',{name:'撤回增强防御灌注'})).toBeDisabled();expect((await saved(other)).infusions.bindings).toHaveLength(1);await other.close();
 await panel.getByRole('button',{name:'撤回增强防御灌注'}).click();await expect.poll(async()=>(await saved(page)).infusions?.bindings).toEqual([]);await expect(panel.getByLabel('已保留灌注记录')).toHaveCount(0);
});
