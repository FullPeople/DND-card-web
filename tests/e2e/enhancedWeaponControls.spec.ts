import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement,expandSourceBook} from './fixtures';
import {enhancedWeaponFixture} from './enhancedWeaponFixture';
import {infusionData} from './infusionFixture';
import {exportCharacter} from '../../src/core/export';
import {setInfusionTarget} from '../../src/core/automation/infusions';

async function mock(page:Page){
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local test'}}));
 await page.route('**/data/class/index.json',route=>route.fulfill({json:{infusion:'class-infusion.json'},headers:{'access-control-allow-origin':'*'}}));
 await page.route('**/data/class/class-infusion.json',route=>route.fulfill({json:{class:infusionData.class,classFeature:infusionData.classFeature},headers:{'access-control-allow-origin':'*'}}));
 const entries=enhancedWeaponFixture().entries.filter(entry=>entry.raw._category==='optionalfeature').map(entry=>entry.raw);
 await page.route('**/data/optionalfeatures.json',route=>route.fulfill({json:{optionalfeature:entries},headers:{'access-control-allow-origin':'*'}}));
}
async function saved(page:Page){return page.evaluate(async()=>{
 const path='/card/src/platform/workspaceIdentity.ts',name=(await import(path)).workspaceIdentity.database;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{const workspace=await new Promise<any>((resolve,reject)=>{const request=db.transaction('documents').objectStore('documents').get('workspace');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return workspace.characters.find((card:any)=>card.id===workspace.activeId);}finally{db.close();}
});}
async function features(page:Page){
 const tab=page.getByRole('tab',{name:'特性',exact:true});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');
 const panel=page.locator('.paper[data-active-sheet="true"] .detail-class-features');await expect(panel).toBeVisible();return panel;
}
async function start(page:Page,active=false){
 await mock(page);await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const {c,entry,choiceId}=enhancedWeaponFixture();if(active)setInfusionTarget(c,choiceId,entry.id,'weapon-0');
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'enhanced-weapon-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true});await expect(review).toContainText('导入后保留该角色自己的规则版本');await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();
 await expect(page.getByRole('tab',{name:/增强武器交互验收（导入）/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');
 await expect(page.locator('.save-status')).toContainText('已保存到本机');return features(page);
}
async function assertSpear(page:Page,bonus:number,damage:number){
 await page.getByRole('button',{name:'自动化设置',exact:true}).click();const panel=page.locator('.automation-panel');
 for(const [mode,die] of [['近战','1d6'],['投掷','1d6'],['双手','1d8']])await expect(panel.locator('summary').filter({hasText:`灌注测试长矛 · ${mode}：`})).toHaveText(`灌注测试长矛 · ${mode}：命中 ${bonus}，伤害 ${die}+${damage}`);
 await page.keyboard.press('Escape');
}

test('enhanced weapon has explicit target activation, actual attack formulas, reload, replacement, undo and withdrawal',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));let panel=await start(page),control=panel.locator('[data-infusion-entry]');
 await expect(control).toContainText('尚未指定灌注目标');await expect(control).toContainText('抵抗、免疫');const before=await saved(page);expect(before.infusions).toBeUndefined();await assertSpear(page,5,3);
 const target=control.getByLabel('增强武器灌注目标');await expect(target.locator('option')).toHaveCount(3);await expect(target).not.toContainText('皮甲');
 await target.selectOption('weapon-0');expect((await saved(page)).infusions).toBeUndefined();await control.getByRole('button',{name:'确认增强武器灌注'}).click();
 await expect.poll(async()=>((await saved(page)).infusions?.bindings||[]).map((row:any)=>row.targetId)).toEqual(['weapon-0']);await assertSpear(page,6,4);
 await page.reload();panel=await features(page);control=panel.locator('[data-infusion-entry]');await expect(control.getByLabel('增强武器灌注目标')).toHaveValue('weapon-0');await assertSpear(page,6,4);
 await control.getByLabel('增强武器灌注目标').selectOption('weapon-1');await control.getByRole('button',{name:'确认增强武器灌注'}).click();await expect(control).toContainText('灌注测试长弓（未装备，不生成自动攻击）');
 await expect.poll(async()=>((await saved(page)).infusions?.bindings||[]).map((row:any)=>row.targetId)).toEqual(['weapon-1']);await assertSpear(page,5,3);
 await page.getByRole('button',{name:'自动化设置',exact:true}).click();await page.getByRole('checkbox',{name:'装备 灌注测试长弓',exact:true}).check();
 await expect(page.locator('.automation-panel summary').filter({hasText:'灌注测试长弓 · 远程：'})).toHaveText('灌注测试长弓 · 远程：命中 5，伤害 1d8+3');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect.poll(async()=>(await saved(page)).selections.find((row:any)=>row.id==='weapon-1').equipped).toBe(false);
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect.poll(async()=>((await saved(page)).infusions?.bindings||[]).map((row:any)=>row.targetId)).toEqual(['weapon-0']);await assertSpear(page,6,4);
 await page.screenshot({path:info.outputPath('enhanced-weapon-target.png'),fullPage:true});
 const bounds=await control.evaluate(element=>{const parent=element.closest('.cell-content')!.getBoundingClientRect(),select=element.querySelector('select')!.getBoundingClientRect();return {right:select.right,limit:parent.right};});expect(bounds.right).toBeLessThanOrEqual(bounds.limit+1);
 await control.getByRole('button',{name:'撤回增强武器灌注'}).click();await expect.poll(async()=>(await saved(page)).infusions?.bindings).toEqual([]);await assertSpear(page,5,3);
 const after=await saved(page);expect(after.selections.filter((row:any)=>row.entry.kind==='item')).toEqual(before.selections.filter((row:any)=>row.entry.kind==='item'));expect(after.quickbarActions).toEqual(before.quickbarActions);expect(after.notes).toBe(before.notes);expect(after.sheetBonuses).toEqual(before.sheetBonuses);expect(after.runtime.hp).toBe(before.runtime.hp);expect(errors).toEqual([]);
});

test('source restriction removes the derived weapon bonus while retaining a withdrawable target',async({page})=>{
 const panel=await start(page,true);await assertSpear(page,6,4);await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expandSourceBook(page,'TCE');
 const book=page.locator('.source-book').filter({has:page.locator('button[aria-label="设置来源 TCE"]')});await book.locator('input[type=checkbox]').first().uncheck();await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 const control=panel.locator('[data-infusion-entry]');await expect(control.getByLabel('增强武器灌注目标')).toBeDisabled();await expect(control.getByRole('button',{name:'确认增强武器灌注'})).toBeDisabled();await expect(control.getByRole('button',{name:'撤回增强武器灌注'})).toBeEnabled();
 await assertSpear(page,5,3);expect((await saved(page)).infusions.bindings).toHaveLength(1);await control.getByRole('button',{name:'撤回增强武器灌注'}).click();await expect.poll(async()=>(await saved(page)).infusions?.bindings).toEqual([]);
});
