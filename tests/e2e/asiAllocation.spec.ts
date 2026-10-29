import {test,expect,type Page,type Locator} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {restoreAuthoredChoices} from './authoredChoicesFixture';
import {asiAllocationData,asiAllocationFixture,legacyAsiAllocationData,legacyAsiAllocationFixture} from './asiAllocationFixture';
import {exportCharacter} from '../../src/core/export';

async function saved(page:Page){return page.evaluate(async()=>{
 const path='/card/src/platform/workspaceIdentity.ts',name=(await import(path)).workspaceIdentity.database;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{const workspace=await new Promise<any>((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return workspace.characters.find((c:any)=>c.id===workspace.activeId);}finally{db.close();}
});}
async function tab(page:Page,name:string){const button=page.getByRole('tab',{name,exact:true});await button.click();await expect(button).toHaveAttribute('aria-selected','true');const panel=page.locator('.paper[data-active-sheet="true"]');await expect(panel).toBeVisible();return panel;}
async function ready(page:Page,source?:'PHB'|'TCE'){
 const data=source?legacyAsiAllocationData(source):asiAllocationData,card=source?legacyAsiAllocationFixture(source):asiAllocationFixture();
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local test'}}));
 await page.context().route('**/data/class/index.json',route=>route.fulfill({json:{asi:'class-asi.json'}}));
 await page.context().route('**/data/class/class-asi.json',route=>route.fulfill({json:{class:data.class,classFeature:data.classFeature}}));
 await page.context().route('**/data/feats.json',route=>route.fulfill({json:{feat:data.feat}}));
 await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'asi-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(card)))});
 // Same-edition imports finish directly; only conflicts need review. Wait
 // for either real outcome before deciding, rather than racing isVisible().
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true}),imported=page.getByRole('tab',{name:/属性提升交互验收（导入）/});
 await expect(review.or(imported)).toBeVisible();
 if(await review.isVisible()){await expect(review).toContainText('导入后保留该角色自己的规则版本');await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();}
 await expect(imported).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});if(await toggle.getAttribute('aria-checked')!=='true')await toggle.click();
 const database=await page.evaluate(async()=>{const path='/card/src/platform/workspaceIdentity.ts';return (await import(path)).workspaceIdentity.database;});await restoreAuthoredChoices(page,database,{[card.selections[0].id]:true});
}
async function choose(page:Page,level:number,name='属性值提升'){
 const panel=await tab(page,'特性'),record=panel.locator('.detail-feats [data-class-choice]').filter({hasText:`职业 ${level} 级`});
 await expect(record).toBeVisible();
 // Completing every class choice hides its chips. Reopen through the same
 // source-heading action a player uses; do not rewrite saved fixture state.
 if(await record.locator('[data-choice-id]').count()===0){
  const ownerHeading=panel.locator('.detail-class-features .feature-group h4 > button');await expect(ownerHeading).toHaveCount(1);await ownerHeading.click({button:'right'});
  await page.getByRole('menuitem',{name:'显示自带选项',exact:true}).click();
 }
 await expect(record.locator('[data-choice-id]')).toBeVisible();
 await record.locator('[data-choice-id]').click();const workspace=panel.locator('.choice-workspace');await expect(workspace).toBeVisible();
 // A legacy synthetic plan deliberately uses inline options, not wiki drag.
 if((await record.getAttribute('data-class-choice'))?.includes(':class-legacy-feat:')){
  const option=workspace.locator('.choice-option').filter({hasText:name});await expect(option).toHaveCount(1);await option.click();await expect(option).toHaveAttribute('aria-pressed','true');
  await workspace.getByRole('button',{name:'收起选择',exact:true}).click();return record.locator('[data-asi-choice]');
 }
 if((page.viewportSize()?.width||0)<=760)await workspace.getByRole('button',{name:'打开候选资料',exact:true}).click();
 const row=page.locator('.catalog-row').filter({has:page.locator('.entry-name').filter({hasText:new RegExp(`^${name}(?:\\s|$)`)})}).first();await expect(row).toBeVisible();await row.scrollIntoViewIfNeeded();const from=await row.boundingBox();await page.mouse.move(from!.x+25,from!.y+from!.height/2);await page.mouse.down();await page.mouse.move(from!.x+40,from!.y+from!.height/2,{steps:3});
 const slot=workspace.locator('.choice-slot').first();await slot.scrollIntoViewIfNeeded();const to=await slot.boundingBox();await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:15});await page.mouse.up();await expect(slot).toContainText(name);
 if((page.viewportSize()?.width||0)<=760){const main=page.getByRole('button',{name:'功能页',exact:true});if(await main.isVisible())await main.click();}
 await workspace.getByRole('button',{name:'收起选择',exact:true}).click();return record.locator('[data-asi-choice]');
}
async function control(page:Page,level:number){const panel=await tab(page,'特性');return panel.locator('.detail-feats [data-class-choice]').filter({hasText:`职业 ${level} 级`}).locator('[data-asi-choice]');}
async function allocate(control:Locator,first:string,second?:string){
 await control.getByLabel('属性提升分配方式',{exact:true}).selectOption(second?'split':'single');await control.getByLabel('第一项提升属性',{exact:true}).selectOption(first);
 if(second)await control.getByLabel('第二项提升属性',{exact:true}).selectOption(second);
 await control.getByRole('checkbox',{name:'确认本次提升未计入基础属性',exact:true}).check();await control.getByRole('button',{name:'确认属性提升',exact:true}).click();await expect(control).toContainText('属性提升已生效');
}
async function scores(page:Page,str:number,dex:number,con=19){
 const panel=await tab(page,'主要'),toggle=page.getByRole('switch',{name:'编辑模式',exact:true});if(await toggle.getAttribute('aria-checked')==='true')await toggle.click();
 await expect(panel.getByRole('spinbutton',{name:'力量基础值',exact:true})).toHaveValue(String(str));await expect(panel.getByRole('spinbutton',{name:'敏捷基础值',exact:true})).toHaveValue(String(dex));await expect(panel.getByRole('spinbutton',{name:'体质基础值',exact:true})).toHaveValue(String(con));
 if(await toggle.getAttribute('aria-checked')!=='true')await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','true');
}
function preserved(after:any,before:any){expect(after.abilities).toEqual(before.abilities);expect(after.notes).toBe(before.notes);expect(after.runtime.hp).toBe(before.runtime.hp);expect(after.sheetBonuses).toEqual(before.sheetBonuses);}

test('typed Fighter 4/6 ASI grants require explicit allocation, independently persist and withdraw',async({page},info)=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);const before=await saved(page);
 let first=await choose(page,4);await expect(first).toContainText('尚未确认属性提升');await expect(first.getByRole('button',{name:'确认属性提升',exact:true})).toBeDisabled();expect((await saved(page)).asiAllocations).toBeUndefined();await scores(page,16,14);
 first=await control(page,4);await allocate(first,'str');await expect.poll(async()=>(await saved(page)).asiAllocations?.bindings.length).toBe(1);await scores(page,18,14);await expect(page.locator('.paper[data-active-sheet="true"] .heritage-features [data-asi-choice]')).toContainText('属性提升已生效');
 let second=await choose(page,6);await expect(second).toContainText('尚未确认属性提升');await allocate(second,'str','dex');await expect.poll(async()=>(await saved(page)).asiAllocations?.bindings.length).toBe(2);await scores(page,19,15);
 const allocated=await saved(page);expect(new Set(allocated.asiAllocations.bindings.map((b:any)=>b.selectionId)).size).toBe(2);expect(new Set(allocated.asiAllocations.bindings.map((b:any)=>b.choiceId)).size).toBe(2);preserved(allocated,before);
 await page.reload();await scores(page,19,15);expect((await saved(page)).asiAllocations).toEqual(allocated.asiAllocations);
 first=await control(page,4);await first.getByRole('button',{name:'撤回属性提升',exact:true}).click();await expect.poll(async()=>(await saved(page)).asiAllocations?.bindings.length).toBe(1);await scores(page,17,15);
 second=await control(page,6);await expect(second).toContainText('属性提升已生效');await page.screenshot({path:info.outputPath('asi-independent-allocation.png'),fullPage:true});
 const bounds=await second.evaluate(element=>{const box=element.getBoundingClientRect();return {left:box.left,right:box.right,width:window.innerWidth};});expect(bounds.left).toBeGreaterThanOrEqual(0);expect(bounds.right).toBeLessThanOrEqual(bounds.width+1);
 await second.getByRole('button',{name:'撤回属性提升',exact:true}).click();await expect.poll(async()=>(await saved(page)).asiAllocations?.bindings).toEqual([]);await page.reload();await scores(page,16,14);preserved(await saved(page),before);expect(errors).toEqual([]);
});

test('replacement deactivates the old allocation without mutating manual abilities or erasing its record',async({page})=>{
 test.setTimeout(90000);await ready(page);const before=await saved(page);await allocate(await choose(page,4),'str');await scores(page,18,14);const allocated=await saved(page);
 await choose(page,4,'原创替代记录');await scores(page,16,14);const replaced=await saved(page);expect(replaced.asiAllocations).toEqual(allocated.asiAllocations);preserved(replaced,before);
 await page.reload();await scores(page,16,14);preserved(await saved(page),before);
 const panel=await tab(page,'特性'),retained=panel.locator('.detail-feats [data-asi-choice]');await expect(retained).toHaveCount(1);await expect(retained).toContainText('属性提升记录已保留');await retained.getByRole('button',{name:'撤回属性提升',exact:true}).click();await expect.poll(async()=>(await saved(page)).asiAllocations?.bindings).toEqual([]);preserved(await saved(page),before);
});

test('allocation rejects duplicate split abilities and values above twenty before saving',async({page})=>{
 test.setTimeout(90000);await ready(page);const before=await saved(page),allocation=await choose(page,4);
 await allocation.getByLabel('第一项提升属性',{exact:true}).selectOption('con');await allocation.getByRole('checkbox',{name:'确认本次提升未计入基础属性',exact:true}).check();await allocation.getByRole('button',{name:'确认属性提升',exact:true}).click();await expect(allocation.getByRole('alert')).toBeVisible();expect((await saved(page)).asiAllocations).toBeUndefined();
 await allocation.getByLabel('属性提升分配方式',{exact:true}).selectOption('split');await allocation.getByLabel('第一项提升属性',{exact:true}).selectOption('str');await allocation.getByLabel('第二项提升属性',{exact:true}).selectOption('str');await allocation.getByRole('checkbox',{name:'确认本次提升未计入基础属性',exact:true}).check();await expect(allocation.getByRole('button',{name:'确认属性提升',exact:true})).toBeDisabled();expect((await saved(page)).asiAllocations).toBeUndefined();
 await allocate(allocation,'con','dex');await scores(page,16,15,20);preserved(await saved(page),before);
});

test('PHB Fighter source-class plans independently allocate at 4/6 without generating feat selections',async({page},info)=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page,'PHB');const before=await saved(page);
 const first=await choose(page,4,'属性提升方案');await expect(first).toContainText('尚未确认属性提升');await expect(first.getByRole('button',{name:'确认属性提升',exact:true})).toBeDisabled();await scores(page,16,14);
 await allocate(await control(page,4),'str');await allocate(await choose(page,6,'属性提升方案'),'str','dex');await expect.poll(async()=>(await saved(page)).asiAllocations?.bindings.length).toBe(2);await scores(page,19,15);
 await expect((await tab(page,'特性')).locator('.detail-feats [data-asi-choice]')).toHaveCount(2);
 const allocated=await saved(page);expect(allocated.asiAllocations.bindings.every((binding:any)=>binding.kind==='legacy-class')).toBe(true);expect(new Set(allocated.asiAllocations.bindings.map((binding:any)=>binding.choiceId)).size).toBe(2);expect(allocated.selections.filter((row:any)=>row.entry.kind==='feat')).toEqual([]);preserved(allocated,before);
 await page.reload();await scores(page,19,15);expect((await saved(page)).asiAllocations).toEqual(allocated.asiAllocations);
 await (await control(page,4)).getByRole('button',{name:'撤回属性提升',exact:true}).click();await expect.poll(async()=>(await saved(page)).asiAllocations?.bindings.length).toBe(1);await scores(page,17,15);
 const second=await control(page,6);await expect(second).toContainText('属性提升已生效');await page.screenshot({path:info.outputPath('legacy-phb-independent-asi.png'),fullPage:true});await second.getByRole('button',{name:'撤回属性提升',exact:true}).click();await expect.poll(async()=>(await saved(page)).asiAllocations?.bindings).toEqual([]);await page.reload();await scores(page,16,14);preserved(await saved(page),before);expect(errors).toEqual([]);
});

test('TCE Artificer source-class allocation reloads and a feat alternative suspends it with safe withdrawal',async({page},info)=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page,'TCE');const before=await saved(page);
 const plan=await choose(page,4,'属性提升方案');await expect(plan).toContainText('尚未确认属性提升');expect((await saved(page)).asiAllocations).toBeUndefined();await allocate(plan,'con','dex');await expect.poll(async()=>(await saved(page)).asiAllocations?.bindings.length).toBe(1);await scores(page,16,15,20);
 await expect((await tab(page,'特性')).locator('.detail-feats [data-asi-choice]')).toHaveCount(1);
 const allocated=await saved(page);expect(allocated.asiAllocations.bindings[0].kind).toBe('legacy-class');expect(allocated.selections.filter((row:any)=>row.entry.kind==='feat')).toEqual([]);preserved(allocated,before);
 await page.reload();await scores(page,16,15,20);expect((await saved(page)).asiAllocations).toEqual(allocated.asiAllocations);
 await choose(page,4,'原创替代记录');await scores(page,16,14);expect((await saved(page)).asiAllocations).toEqual(allocated.asiAllocations);await page.reload();await scores(page,16,14);
 const panel=await tab(page,'特性'),retained=panel.locator('.detail-feats [data-asi-choice]');await expect(retained).toHaveCount(1);await expect(retained).toContainText('属性提升记录已保留');await page.screenshot({path:info.outputPath('legacy-tce-replacement-asi.png'),fullPage:true});await retained.getByRole('button',{name:'撤回属性提升',exact:true}).click();await expect.poll(async()=>(await saved(page)).asiAllocations?.bindings).toEqual([]);await page.reload();await scores(page,16,14);preserved(await saved(page),before);expect(errors).toEqual([]);
});
