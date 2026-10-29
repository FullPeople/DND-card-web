import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {returningWeaponFixture} from './returningWeaponFixture';
import {infusionData} from './infusionFixture';
import {exportCharacter} from '../../src/core/export';

async function mock(page:Page){
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local test'}}));
 await page.context().route('**/data/class/index.json',route=>route.fulfill({json:{infusion:'class-infusion.json'},headers:{'access-control-allow-origin':'*'}}));
 await page.context().route('**/data/class/class-infusion.json',route=>route.fulfill({json:{class:infusionData.class,classFeature:infusionData.classFeature},headers:{'access-control-allow-origin':'*'}}));
 const entries=returningWeaponFixture().entries.filter(entry=>entry.raw._category==='optionalfeature').map(entry=>entry.raw);
 await page.context().route('**/data/optionalfeatures.json',route=>route.fulfill({json:{optionalfeature:entries},headers:{'access-control-allow-origin':'*'}}));
}
async function saved(page:Page){return page.evaluate(async()=>{
 const path='/card/src/platform/workspaceIdentity.ts',name=(await import(path)).workspaceIdentity.database;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{const workspace=await new Promise<any>((resolve,reject)=>{const request=db.transaction('documents').objectStore('documents').get('workspace');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return workspace.characters.find((card:any)=>card.id===workspace.activeId);}finally{db.close();}
});}
async function features(page:Page){
 const tab=page.getByRole('tab',{name:'特性',exact:true});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');const panel=page.locator('.paper[data-active-sheet="true"] .detail-class-features');await expect(panel).toBeVisible();return panel;
}
async function formulas(page:Page,returning:boolean,target='spear'){
 await page.getByRole('button',{name:'自动化设置',exact:true}).click();const panel=page.locator('.automation-panel');
 if(target==='spear')for(const [mode,die] of [['近战','1d6'],['投掷','1d6'],['双手','1d8']])await expect(panel.locator('summary').filter({hasText:`灌注测试长矛 · ${mode}：`})).toHaveText(`灌注测试长矛 · ${mode}：命中 ${returning?8:7}，伤害 ${die}+${returning?4:3}`);
 else await expect(panel.locator('summary').filter({hasText:'回力测试飞镖 · 投掷：'})).toHaveText(`回力测试飞镖 · 投掷：命中 ${returning?8:7}，伤害 1d4+${returning?4:3}`);
 await page.keyboard.press('Escape');
}

test('level-ten returning weapon stays +1, rejects competing infusion, saves target replacement and exposes manual return boundary',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await mock(page);await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const {c,entry,choiceId,enhanced}=returningWeaponFixture();c.selections.find(row=>row.id==='infusion-owner')!.level=10;c.classChoiceSnapshots![enhanced.id]=enhanced;c.answers[choiceId].push(enhanced.id);
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'returning-weapon-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true});await expect(review).toContainText('导入后保留该角色自己的规则版本');await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();await expect(page.getByRole('tab',{name:/回力武器交互验收（导入）/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 let panel=await features(page),control=panel.locator(`[data-infusion-entry="${entry.id}"]`);const before=await saved(page);await formulas(page,false);
 const select=control.getByLabel('回力武器灌注目标');await expect(select.locator('option')).toHaveCount(3);await expect(select).not.toContainText('长弓');await expect(control).toContainText('未记录持手／投出状态');
 await select.selectOption('weapon-0');expect((await saved(page)).infusions).toBeUndefined();await control.getByRole('button',{name:'确认回力武器灌注'}).click();await expect.poll(async()=>((await saved(page)).infusions?.bindings||[]).map((row:any)=>row.targetId)).toEqual(['weapon-0']);await formulas(page,true);
 const other=panel.locator(`[data-infusion-entry="${enhanced.id}"]`);await other.getByLabel('增强武器灌注目标').selectOption('weapon-0');await other.getByRole('button',{name:'确认增强武器灌注'}).click();await expect(other.getByRole('alert')).toContainText('这件物品已有注法');expect((await saved(page)).infusions.bindings).toHaveLength(1);
 await control.getByLabel('回力武器灌注目标').selectOption('weapon-2');await control.getByRole('button',{name:'确认回力武器灌注'}).click();await expect(control).toContainText('回力测试飞镖（未装备，不生成自动攻击）');await formulas(page,false);
 await page.getByRole('button',{name:'自动化设置',exact:true}).click();await page.getByRole('checkbox',{name:'装备 回力测试飞镖',exact:true}).check();await page.keyboard.press('Escape');await formulas(page,true,'dart');await expect.poll(async()=>((await saved(page)).infusions?.bindings||[]).map((row:any)=>row.targetId)).toEqual(['weapon-2']);
 await page.reload();panel=await features(page);control=panel.locator(`[data-infusion-entry="${entry.id}"]`);await expect(control.getByLabel('回力武器灌注目标')).toHaveValue('weapon-2');await formulas(page,true,'dart');await expect(control).toContainText('不会自动移动物品或结算回手');
 await page.screenshot({path:info.outputPath('returning-weapon-target.png'),fullPage:true});const bounds=await control.evaluate(element=>{const parent=element.closest('.cell-content')!.getBoundingClientRect(),select=element.querySelector('select')!.getBoundingClientRect();return {right:select.right,limit:parent.right};});expect(bounds.right).toBeLessThanOrEqual(bounds.limit+1);
 await control.getByRole('button',{name:'撤回回力武器灌注'}).click();await expect.poll(async()=>(await saved(page)).infusions?.bindings).toEqual([]);await formulas(page,false,'dart');
 const after=await saved(page),expectedItems=before.selections.filter((row:any)=>row.entry.kind==='item');expectedItems.find((row:any)=>row.id==='weapon-2').equipped=true;expect(after.selections.filter((row:any)=>row.entry.kind==='item')).toEqual(expectedItems);expect(after.quickbarActions).toEqual(before.quickbarActions);expect(after.notes).toBe(before.notes);expect(after.runtime.hp).toBe(before.runtime.hp);expect(errors).toEqual([]);
});
