import {test,expect,type Page,type Locator} from '@playwright/test';
import {mockSource,suppressAnnouncement,expandSourceBook} from './fixtures';
import {restoreAuthoredChoices} from './authoredChoicesFixture';
import {reviewedPassiveFeatData as data,reviewedPassiveFeatFixture} from './reviewedPassiveFeatFixture';
import {exportCharacter} from '../../src/core/export';
import type {Character} from '../../src/core/model';

async function mock(page:Page){
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local test'}}));
 await page.route('**/data/class/index.json',route=>route.fulfill({json:{passive:'class-passive-feats.json'}}));
 await page.route('**/data/class/class-passive-feats.json',route=>route.fulfill({json:{class:data.class,classFeature:data.classFeature}}));
 await page.route('**/data/feats.json',route=>route.fulfill({json:{feat:data.feat}}));
}
async function saved(page:Page):Promise<Character>{return page.evaluate(async()=>{
 const path='/card/src/platform/workspaceIdentity.ts',name=(await import(path)).workspaceIdentity.database;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{const workspace=await new Promise<any>((resolve,reject)=>{const request=db.transaction('documents').objectStore('documents').get('workspace');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return workspace.characters.find((card:any)=>card.id===workspace.activeId);}finally{db.close();}
});}
async function tab(page:Page,name:string){
 const button=page.getByRole('tab',{name,exact:true});await button.click();await expect(button).toHaveAttribute('aria-selected','true');
 const panel=page.locator('.paper[data-active-sheet="true"]');await expect(panel).toHaveClass(new RegExp(`(?:^| )page-${['主要','特性','背景','法术','背包'].indexOf(name)}(?: |$)`));await expect(panel).toBeVisible();return panel;
}
async function editor(page:Page,enabled=true){
 const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});await expect(toggle).toBeEnabled();await expect(toggle).toHaveAttribute('aria-busy','false');
 if(await toggle.getAttribute('aria-checked')!==String(enabled))await toggle.click();await expect(toggle).toHaveAttribute('aria-checked',String(enabled));
}
async function ready(page:Page,manualHp=false){
 await mock(page);await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const card=reviewedPassiveFeatFixture();if(manualHp){card.selections[0].level=6;card.baseHp=40;card.sheetBonuses!.hp=2;}
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'reviewed-passive-feats-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(card)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true}),imported=page.getByRole('tab',{name:/被动专长交互验收（导入）/});await expect(review.or(imported)).toBeVisible();
 if(await review.isVisible()){await expect(review).toContainText('导入后保留该角色自己的规则版本');await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();}
 await expect(imported).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await expect(page.locator('.save-status')).toContainText('已保存到本机');await editor(page);
 // Only initial imported-empty-choice presentation is resumed here. All actual
 // feat selections, confirmations, replacements and removals use live controls.
 const database=await page.evaluate(async()=>{const path='/card/src/platform/workspaceIdentity.ts';return (await import(path)).workspaceIdentity.database;});await restoreAuthoredChoices(page,database,{'passive-fighter':true});await editor(page);
 return saved(page);
}
async function workspace(page:Page,level:number){
 await editor(page);const panel=await tab(page,'特性');await expect(panel.locator('.detail-feats')).toBeVisible();
 const record=panel.locator('.detail-feats [data-class-choice]').filter({hasText:`职业 ${level} 级`});await expect(record).toBeVisible();
 if(await record.locator('[data-choice-id]').count()===0){
  const heading=panel.locator('.detail-class-features .feature-group h4 > button');await expect(heading).toHaveCount(1);await heading.click({button:'right'});await page.getByRole('menuitem',{name:'显示自带选项',exact:true}).click();
 }
 await record.locator('[data-choice-id]').click();const choices=panel.locator('.choice-workspace');await expect(choices).toBeVisible();return choices;
}
async function choose(page:Page,level:number,name:string,selected=true){
 const choices=await workspace(page,level),option=choices.locator('.choice-option').filter({hasText:new RegExp(`^${name}(?:\\s|$)`)});await expect(option).toHaveCount(1);await option.click();await expect(option).toHaveAttribute('aria-pressed',String(selected));await choices.getByRole('button',{name:'收起选择',exact:true}).click();
}
async function control(page:Page,kind:'tough'|'resilient'){
 const panel=await tab(page,'特性'),value=panel.locator(`.detail-feats [data-reviewed-feat-kind="${kind}"]`);await expect(value).toHaveCount(1);await expect(value).toBeVisible();return value;
}
async function confirm(page:Page,kind:'tough'|'resilient',ability?:string){
 const value=await control(page,kind),name=kind==='tough'?'健壮':'强健';
 if(kind==='resilient')await value.getByLabel('强健提升属性',{exact:true}).selectOption(ability!);
 await expect(value.getByRole('button',{name:`确认${name}`,exact:true})).toBeDisabled();await value.getByRole('checkbox',{name:kind==='tough'?'确认健壮未计入手工生命值':'确认强健未计入手工基础属性',exact:true}).check();await value.getByRole('button',{name:`确认${name}`,exact:true}).click();await expect(value).toContainText(`${name}已生效`);
}
async function hp(page:Page,value:number){
 const panel=await tab(page,'主要');await expect(panel.locator('[data-stat="hp"]')).toHaveText(String(value));await expect(panel.getByRole('spinbutton',{name:'当前生命值',exact:true})).toHaveValue('7');await expect(panel.getByRole('spinbutton',{name:'临时生命值',exact:true})).toHaveValue('3');
}
async function score(page:Page,ability:'str'|'dex'|'con'|'int'|'wis',value:number,save:number,proficient:boolean){
 const names={str:'力量',dex:'敏捷',con:'体质',int:'智力',wis:'感知'},panel=await tab(page,'主要');await editor(page,false);const box=panel.locator(`.ability-${ability}`);
 await expect(box.getByRole('spinbutton',{name:`${names[ability]}基础值`,exact:true})).toHaveValue(String(value));await expect(box.locator('.ability-save > b')).toHaveText(`${save>=0?'+':''}${save}`);await expect(box.locator('.ability-save .proficiency-mark')).toHaveAttribute('aria-label',`${names[ability]}豁免${proficient?'熟练':'无熟练'}`);await editor(page);
}
async function level(page:Page,value:number){
 await editor(page);const panel=await tab(page,'特性'),input=panel.getByRole('spinbutton',{name:'战士等级',exact:true});await input.fill(String(value));await input.press('Tab');await expect(input).toHaveValue(String(value));await expect.poll(async()=>(await saved(page)).selections.find(row=>row.id==='passive-fighter')?.level).toBe(value);
}
async function constitutionBase(page:Page,value:number){
 await editor(page);const panel=await tab(page,'主要');await panel.getByRole('spinbutton',{name:'体质基础值',exact:true}).click();const trace=page.getByRole('dialog',{name:'体质数据追溯',exact:true});await expect(trace).toBeVisible();const input=trace.getByRole('spinbutton',{name:'体质追溯输入',exact:true});await input.fill(String(value));await input.press('Enter');await expect(trace).toHaveCount(0);await expect.poll(async()=>(await saved(page)).abilities.con).toBe(value);
}
async function source(page:Page,enabled:boolean){
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expandSourceBook(page,'PHB');const book=page.locator('.source-book').filter({has:page.locator('button[aria-label="设置来源 PHB"]')});await book.locator('input[type=checkbox]').first().setChecked(enabled);await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect.poll(async()=>(await saved(page)).profile.enabledSources.includes('PHB')).toBe(enabled);
}
function protectedState(after:Character,before:Character){
 for(const field of ['abilities','baseHp','sheetBonuses','saveBonuses','proficiencies','notes','adjustments','inventory'] as const)expect(after[field]).toEqual(before[field]);
 expect(after.runtime).toEqual(before.runtime);expect(after.selections.filter(row=>row.entry.kind==='feat')).toEqual([]);
}
async function fits(control:Locator){const box=await control.evaluate(element=>{const bounds=element.getBoundingClientRect();return {left:bounds.left,right:bounds.right,width:window.innerWidth,overflow:element.scrollWidth>element.clientWidth+1};});expect(box.left).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(box.width+1);expect(box.overflow).toBe(false);}

test('Tough uses a real PHB class alternative, explicit HP consent, history, level changes and replacement reconfirmation',async({page},info)=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));const before=await ready(page);await choose(page,4,'健壮');
 let value=await control(page,'tough');await expect(value).toContainText('尚未确认健壮');await expect(value.getByRole('button',{name:'确认健壮',exact:true})).toBeDisabled();expect((await saved(page)).reviewedFeats).toBeUndefined();await hp(page,28);
 await confirm(page,'tough');await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings.length).toBe(1);await hp(page,36);
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings.length||0).toBe(0);await hp(page,28);await page.getByRole('button',{name:'重做',exact:true}).click();await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings.length).toBe(1);await hp(page,36);
 const allocated=await saved(page);protectedState(allocated,before);await page.reload();await hp(page,36);expect((await saved(page)).reviewedFeats).toEqual(allocated.reviewedFeats);
 await level(page,5);await hp(page,44);await level(page,3);await hp(page,22);value=await control(page,'tough');await expect(value).toContainText('健壮记录已保留，当前不生效');await expect(value.getByRole('button',{name:'确认健壮',exact:true})).toBeDisabled();expect((await saved(page)).reviewedFeats).toEqual(allocated.reviewedFeats);
 await level(page,4);await hp(page,36);await choose(page,4,'原创替代记录');await hp(page,28);await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings).toEqual([]);await page.reload();await hp(page,28);
 await choose(page,4,'健壮');value=await control(page,'tough');await expect(value).toContainText('尚未确认健壮');await hp(page,28);await confirm(page,'tough');await hp(page,36);
 value=await control(page,'tough');await fits(value);await page.screenshot({path:info.outputPath('tough-explicit-class-consent.png'),fullPage:true});await value.getByRole('button',{name:'撤回健壮',exact:true}).click();await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings).toEqual([]);await page.reload();await hp(page,28);protectedState(await saved(page),before);expect(errors).toEqual([]);
});

test('Resilient rejects cap and over-cap bases, persists one same-ability save, and respects manual false without double proficiency',async({page},info)=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));const before=await ready(page);await choose(page,4,'强健');let value=await control(page,'resilient');
 for(const ability of ['str','int']){await value.getByLabel('强健提升属性',{exact:true}).selectOption(ability);await value.getByRole('checkbox',{name:'确认强健未计入手工基础属性',exact:true}).check();await value.getByRole('button',{name:'确认强健',exact:true}).click();await expect(value.getByRole('alert')).toContainText('上限 20');expect((await saved(page)).reviewedFeats).toBeUndefined();}
 await score(page,'str',20,7,true);await score(page,'int',22,6,false);await confirm(page,'resilient','dex');await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings.length).toBe(1);await score(page,'dex',14,4,true);await hp(page,28);
 const allocated=await saved(page);protectedState(allocated,before);await page.reload();await score(page,'dex',14,4,true);expect((await saved(page)).reviewedFeats).toEqual(allocated.reviewedFeats);await level(page,5);await score(page,'dex',14,5,true);
 await confirm(page,'resilient','wis');await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings.length).toBe(1);value=await control(page,'resilient');await expect(value).toContainText('当前感知豁免已手工取消熟练');await score(page,'wis',13,1,false);await score(page,'dex',13,1,false);await hp(page,34);
 value=await control(page,'resilient');await fits(value);await page.screenshot({path:info.outputPath('resilient-manual-save-override.png'),fullPage:true});protectedState(await saved(page),before);
 // A real manual base edit is separate from feat intent. CON's modifier must
 // feed the existing HP calculation, but its already-trained save gets PB once.
 await constitutionBase(page,13);const manualBefore=await saved(page);await confirm(page,'resilient','con');await score(page,'con',14,5,true);await hp(page,44);protectedState(await saved(page),manualBefore);
 value=await control(page,'resilient');await value.getByRole('button',{name:'撤回强健',exact:true}).click();await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings).toEqual([]);await page.reload();await score(page,'wis',12,1,false);await score(page,'dex',13,1,false);await score(page,'con',13,4,true);await hp(page,39);protectedState(await saved(page),manualBefore);expect(errors).toEqual([]);
});

test('source disable and readonly retain both intents, while explicit forgetting releases only its owned feat consent',async({page,context},info)=>{
 test.setTimeout(150000);const before=await ready(page,true);await choose(page,4,'健壮');await confirm(page,'tough');await choose(page,6,'强健');await confirm(page,'resilient','dex');await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings.length).toBe(2);await hp(page,54);await score(page,'dex',14,5,true);const active=await saved(page);protectedState(active,before);
 await source(page,false);await hp(page,42);for(const kind of ['tough','resilient'] as const){const value=await control(page,kind),name=kind==='tough'?'健壮':'强健';await expect(value).toContainText(`${name}记录已保留，当前不生效`);await expect(value.getByRole('button',{name:`确认${name}`,exact:true})).toBeDisabled();await expect(value.getByRole('button',{name:`撤回${name}`,exact:true})).toBeEnabled();}expect((await saved(page)).reviewedFeats).toEqual(active.reviewedFeats);
 const other=await context.newPage();await mock(other);await other.goto('/card/?intro=0');await expect(other.locator('.paper')).toBeVisible();for(const kind of ['tough','resilient'] as const){const value=await control(other,kind),name=kind==='tough'?'健壮':'强健';await expect(value.getByRole('button',{name:`确认${name}`,exact:true})).toBeDisabled();await expect(value.getByRole('button',{name:`撤回${name}`,exact:true})).toBeDisabled();}expect((await saved(other)).reviewedFeats).toEqual(active.reviewedFeats);await other.close();
 await source(page,true);await hp(page,54);await score(page,'dex',14,5,true);expect((await saved(page)).reviewedFeats).toEqual(active.reviewedFeats);
 // Clicking the chosen inline alternative is the normal player removal path.
 await choose(page,6,'强健',false);await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings.map(row=>row.intent.kind)).toEqual(['tough']);await score(page,'dex',13,1,false);await hp(page,54);
 await choose(page,6,'强健');const value=await control(page,'resilient');await expect(value).toContainText('尚未确认强健');await expect(value.getByRole('button',{name:'确认强健',exact:true})).toBeDisabled();await fits(value);await page.screenshot({path:info.outputPath('passive-feats-reselect-needs-consent.png'),fullPage:true});await page.reload();await hp(page,54);await score(page,'dex',13,1,false);protectedState(await saved(page),before);
});
