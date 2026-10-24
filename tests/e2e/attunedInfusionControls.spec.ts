import {test,expect,type Page,type Locator} from '@playwright/test';
import {mockSource,suppressAnnouncement,expandSourceBook} from './fixtures';
import {restoreAuthoredChoices} from './authoredChoicesFixture';
import {attunedInfusionFixture,attunedInfusionData} from './attunedInfusionFixture';
import {exportCharacter} from '../../src/core/export';

async function saved(page:Page){return page.evaluate(async()=>{
 const path='/card/src/platform/workspaceIdentity.ts',name=(await import(path)).workspaceIdentity.database;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{const workspace=await new Promise<any>((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return workspace.characters.find((c:any)=>c.id===workspace.activeId);}finally{db.close();}
});}
async function tab(page:Page,name:string){const button=page.getByRole('tab',{name,exact:true});await button.click();await expect(button).toHaveAttribute('aria-selected','true');const panel=page.locator('.paper[data-active-sheet="true"]');await expect(panel).toBeVisible();return panel;}
async function ready(page:Page,learned=false){
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local test'}}));
 await page.route('**/data/class/index.json',route=>route.fulfill({json:{attuned:'class-attuned.json'},headers:{'access-control-allow-origin':'*'}}));
 await page.route('**/data/class/class-attuned.json',route=>route.fulfill({json:{class:attunedInfusionData.class,classFeature:attunedInfusionData.classFeature},headers:{'access-control-allow-origin':'*'}}));
 await page.route('**/data/optionalfeatures.json',route=>route.fulfill({json:{optionalfeature:attunedInfusionData.optionalfeature},headers:{'access-control-allow-origin':'*'}}));
 await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const {c}=attunedInfusionFixture(learned);
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'attuned-infusions-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true}),imported=page.getByRole('tab',{name:/同调灌注交互验收（导入）/});
 await expect(review.or(imported)).toBeVisible();if(await review.isVisible())await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();
 await expect(imported).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});if(await toggle.getAttribute('aria-checked')!=='true')await toggle.click();
 const database=await page.evaluate(async()=>{const path='/card/src/platform/workspaceIdentity.ts';return (await import(path)).workspaceIdentity.database;});await restoreAuthoredChoices(page,database,{'attuned-owner':true});
}
async function workspace(page:Page){
 const panel=await tab(page,'特性'),record=panel.locator('.detail-class-features [data-class-choice="attuned-owner:class-optional:0"]');await expect(record).toBeVisible();
 // Completed records reopen through the actual class heading, never a fixture rewrite.
 if(await record.locator('[data-choice-id]').count()===0){await panel.locator('.detail-class-features .feature-group h4 > button').first().click({button:'right'});await page.getByRole('menuitem',{name:'显示自带选项',exact:true}).click();}
 await record.locator('[data-choice-id]').click();const pane=panel.locator('.choice-workspace');await expect(pane).toBeVisible();return pane;
}
async function choose(page:Page,name:string,index:number){
 const pane=await workspace(page);
 if((page.viewportSize()?.width||0)<=760)await pane.getByRole('button',{name:'打开候选资料',exact:true}).click();
 const row=page.locator('.catalog-row').filter({has:page.locator('.entry-name').filter({hasText:new RegExp(`^${name}(?:\\s|$)`)})}).first();await expect(row).toBeVisible();await row.scrollIntoViewIfNeeded();const entryId=await row.getAttribute('data-entry-id');expect(entryId).toBeTruthy();
 const from=await row.boundingBox();await page.mouse.move(from!.x+25,from!.y+from!.height/2);await page.mouse.down();await page.mouse.move(from!.x+40,from!.y+from!.height/2,{steps:3});
 const slot=pane.locator('.choice-slot').nth(index);await slot.scrollIntoViewIfNeeded();const to=await slot.boundingBox();await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:15});await page.mouse.up();
 // Narrow drag returns to Wiki, so return through the actual player navigation
 // before asserting the sheet. Verify the exact persisted catalog identity too.
 if((page.viewportSize()?.width||0)<=760)await page.getByRole('button',{name:'功能页',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).answers['attuned-owner:class-optional:0']?.[index]).toBe(entryId);
 await tab(page,'特性');await expect(slot).toContainText(name);await pane.getByRole('button',{name:'收起选择',exact:true}).click();const learned=await control(page,name);await expect(learned).toBeVisible();return learned;
}
async function control(page:Page,name:string){const panel=await tab(page,'特性');return panel.locator('.detail-class-features [data-infusion-entry]').filter({has:page.getByLabel(`${name}灌注目标`,{exact:true})});}
async function bind(control:Locator,name:string,target:string,type?:string){await control.getByLabel(`${name}灌注目标`,{exact:true}).selectOption(target);if(type)await control.getByLabel(`${name}抗性伤害类型`,{exact:true}).selectOption(type);await control.getByRole('button',{name:`确认${name}灌注`,exact:true}).click();}
async function stats(page:Page,ac:number,resistance='无',shot=false){
 await page.getByRole('button',{name:'自动化设置',exact:true}).click();await expect(page.getByTestId('automation-ac')).toHaveText(String(ac));await expect(page.getByTestId('automation-resistances')).toHaveText(resistance);
 await expect(page.locator('.automation-panel summary').filter({hasText:'原创弹药短弓'})).toHaveText(new RegExp(`原创弹药短弓 · 远程：命中 [+-]?\\d+，伤害 ${shot?'1d6\\+1':'1d6'}$`));await page.keyboard.press('Escape');
}
async function source(page:Page,enabled:boolean){await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expandSourceBook(page,'TCE');const book=page.locator('.source-book').filter({has:page.locator('button[aria-label="设置来源 TCE"]')});await book.locator('input[type=checkbox]').first().setChecked(enabled);await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();}
async function mark(page:Page,id:string,key:'attuned'|'equipped',enabled:boolean){
 const panel=await tab(page,'背包');
 if(enabled)await panel.locator(`[data-stock-id="${id}"]`).dragTo(panel.locator(`[data-stock-mark="${key}"]`));
 else await panel.locator(`[data-stock-mark="${key}"] [data-stock-ref-id="${id}"]`).dragTo(panel.locator('.page-caption'));
 await expect.poll(async()=>(await saved(page)).selections.find((row:any)=>row.id===id)[key]).toBe(enabled);
}
function preserved(after:any,before:any){expect(after.notes).toBe(before.notes);expect(after.runtime).toEqual(before.runtime);expect(after.sheetBonuses).toEqual(before.sheetBonuses);expect(after.abilities).toEqual(before.abilities);expect(after.selections.filter((row:any)=>row.entry.kind==='item').map((row:any)=>[row.id,row.quantity])).toEqual(before.selections.filter((row:any)=>row.entry.kind==='item').map((row:any)=>[row.id,row.quantity]));}

test('learned attuned infusions require explicit binding and damage type, persist and suspend safely',async({page},info)=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);const before=await saved(page);await stats(page,15);
 let shot=await choose(page,'连发射击',0);await expect(shot).toContainText('尚未指定灌注目标');await shot.getByLabel('连发射击灌注目标',{exact:true}).selectOption('attuned-item-2');expect((await saved(page)).infusions).toBeUndefined();await stats(page,15);
 await shot.getByRole('button',{name:'确认连发射击灌注',exact:true}).click();await expect(shot.getByTestId('infusion-active-status')).toContainText('当前已生效');await stats(page,15,'无',true);
 await mark(page,'attuned-item-2','attuned',false);shot=await control(page,'连发射击');await expect(shot).toContainText('未同调');await stats(page,15);await mark(page,'attuned-item-2','attuned',true);await stats(page,15,'无',true);
 const shield=await choose(page,'斥力盾牌',1);await bind(shield,'斥力盾牌','attuned-item-1');await expect(shield.getByRole('checkbox',{name:'确认当前持握此盾牌',exact:true})).not.toBeChecked();await stats(page,15,'无',true);
 await shield.getByRole('checkbox',{name:'确认当前持握此盾牌',exact:true}).check();await stats(page,16,'无',true);await shield.getByRole('checkbox',{name:'确认当前持握此盾牌',exact:true}).uncheck();await stats(page,15,'无',true);await shield.getByRole('checkbox',{name:'确认当前持握此盾牌',exact:true}).check();
 let armor=await choose(page,'抗性护甲',2);await armor.getByLabel('抗性护甲灌注目标',{exact:true}).selectOption('attuned-item-0');await expect(armor.getByLabel('抗性护甲抗性伤害类型',{exact:true})).toHaveValue('');await expect(armor.getByRole('button',{name:'确认抗性护甲灌注',exact:true})).toBeDisabled();
 await armor.getByLabel('抗性护甲抗性伤害类型',{exact:true}).selectOption('fire');await expect.poll(async()=>(await saved(page)).infusions.bindings.length).toBe(2);await stats(page,16,'无',true);
 await armor.getByRole('button',{name:'确认抗性护甲灌注',exact:true}).click();await stats(page,16,'fire',true);await armor.getByLabel('抗性护甲抗性伤害类型',{exact:true}).selectOption('cold');await stats(page,16,'fire',true);await armor.getByRole('button',{name:'确认抗性护甲灌注',exact:true}).click();await stats(page,16,'cold',true);
 await expect.poll(async()=>(await saved(page)).infusions.bindings.find((row:any)=>row.targetId==='attuned-item-0')?.damageType).toBe('cold');const active=await saved(page);preserved(active,before);
 await page.reload();armor=await control(page,'抗性护甲');await expect(armor.getByLabel('抗性护甲抗性伤害类型',{exact:true})).toHaveValue('cold');await stats(page,16,'cold',true);expect((await saved(page)).infusions).toEqual(active.infusions);
 await source(page,false);armor=await control(page,'抗性护甲');await expect(armor).toContainText('当前暂停生效');await expect(armor.getByLabel('抗性护甲抗性伤害类型',{exact:true})).toBeDisabled();await stats(page,15);expect((await saved(page)).infusions).toEqual(active.infusions);
 await source(page,true);await stats(page,16,'cold',true);armor=await control(page,'抗性护甲');await page.screenshot({path:info.outputPath('attuned-infusion-resistance.png'),fullPage:true});
 const bounds=await armor.evaluate(element=>{const parent=element.closest('.cell-content')!.getBoundingClientRect();return [...element.querySelectorAll('select')].map(select=>({left:select.getBoundingClientRect().left,right:select.getBoundingClientRect().right,min:parent.left,max:parent.right}));});for(const bound of bounds){expect(bound.left).toBeGreaterThanOrEqual(bound.min-1);expect(bound.right).toBeLessThanOrEqual(bound.max+1);}
 await source(page,false);for(const name of ['抗性护甲','斥力盾牌','连发射击'])await (await control(page,name)).getByRole('button',{name:`撤回${name}灌注`,exact:true}).click();await expect.poll(async()=>(await saved(page)).infusions.bindings).toEqual([]);await page.reload();await stats(page,15);preserved(await saved(page),before);expect(errors).toEqual([]);
});

test('shield target changes clear held intent; forgetting clears binding and relearning requires activation',async({page})=>{
 test.setTimeout(120000);await ready(page,true);const before=await saved(page);let shield=await control(page,'斥力盾牌');await bind(shield,'斥力盾牌','attuned-item-1');await shield.getByRole('checkbox',{name:'确认当前持握此盾牌',exact:true}).check();await stats(page,16);
 await bind(shield,'斥力盾牌','attuned-item-3');await expect(shield.getByRole('checkbox',{name:'确认当前持握此盾牌',exact:true})).not.toBeChecked();await expect(shield.getByRole('checkbox',{name:'确认当前持握此盾牌',exact:true})).toBeDisabled();await stats(page,15);
 await mark(page,'attuned-item-1','equipped',false);await mark(page,'attuned-item-3','equipped',true);await mark(page,'attuned-item-3','attuned',true);shield=await control(page,'斥力盾牌');await expect(shield.getByRole('checkbox',{name:'确认当前持握此盾牌',exact:true})).not.toBeChecked();await shield.getByRole('checkbox',{name:'确认当前持握此盾牌',exact:true}).check();await stats(page,16);
 await mark(page,'attuned-item-3','attuned',false);shield=await control(page,'斥力盾牌');await expect(shield.getByRole('checkbox',{name:'确认当前持握此盾牌',exact:true})).not.toBeChecked();await expect.poll(async()=>(await saved(page)).infusions.bindings[0].held).toBeUndefined();await stats(page,15);
 await mark(page,'attuned-item-3','attuned',true);shield=await control(page,'斥力盾牌');await expect(shield.getByRole('checkbox',{name:'确认当前持握此盾牌',exact:true})).not.toBeChecked();await shield.getByRole('checkbox',{name:'确认当前持握此盾牌',exact:true}).check();await stats(page,16);
 const learnedBefore=(await saved(page)).answers['attuned-owner:class-optional:0'],pane=await workspace(page);await pane.getByRole('button',{name:'移除斥力盾牌',exact:true}).click();await pane.getByRole('button',{name:'收起选择',exact:true}).click();
 // Explicitly forgetting is not source suspension: it removes the owned binding
 // atomically, while retaining the other learned options and every inventory item.
 await expect.poll(async()=>(await saved(page)).answers['attuned-owner:class-optional:0']).toEqual([learnedBefore[0],'',learnedBefore[2]]);
 await expect.poll(async()=>(await saved(page)).infusions.bindings).toEqual([]);
 const panel=await tab(page,'特性');await expect(panel.getByLabel('已保留灌注记录',{exact:true})).toHaveCount(0);await expect(await control(page,'斥力盾牌')).toHaveCount(0);await stats(page,15);preserved(await saved(page),before);
 await page.reload();await expect.poll(async()=>(await saved(page)).infusions.bindings).toEqual([]);await expect(await control(page,'斥力盾牌')).toHaveCount(0);await stats(page,15);
 // Relearn through the UI while the old target remains equipped and attuned.
 // This must not revive the forgotten binding or held intent, even after reload.
 shield=await choose(page,'斥力盾牌',1);await expect(shield).toContainText('尚未指定灌注目标');expect((await saved(page)).infusions.bindings).toEqual([]);await stats(page,15);
 await page.reload();shield=await control(page,'斥力盾牌');await expect(shield).toContainText('尚未指定灌注目标');expect((await saved(page)).infusions.bindings).toEqual([]);await stats(page,15);preserved(await saved(page),before);
});
