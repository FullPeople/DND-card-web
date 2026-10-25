import {test,expect,type Page,type Locator} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {restoreAuthoredChoices} from './authoredChoicesFixture';
import {reviewedArmorFeatData as data,reviewedArmorFeatFixture} from './reviewedArmorFeatFixture';
import {exportCharacter} from '../../src/core/export';
import type {Character} from '../../src/core/model';
import {savedCharacter as saved,setSiteSource} from './reviewedRuleBrowserState';

type ArmorKind='lightly-armored'|'moderately-armored'|'heavily-armored';
const names:Record<ArmorKind,string>={'lightly-armored':'轻甲运用','moderately-armored':'中甲运用','heavily-armored':'重甲运用'};
async function mock(page:Page){
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local test'}}));
 await page.route('**/data/class/index.json',route=>route.fulfill({json:{armor:'class-armor-feats.json'}}));
 await page.route('**/data/class/class-armor-feats.json',route=>route.fulfill({json:{class:data.class,classFeature:data.classFeature}}));
 await page.route('**/data/feats.json',route=>route.fulfill({json:{feat:data.feat}}));
}
async function tab(page:Page,name:string){
 const button=page.getByRole('tab',{name,exact:true});await button.click();await expect(button).toHaveAttribute('aria-selected','true');
 const panel=page.locator('.paper[data-active-sheet="true"]');await expect(panel).toHaveClass(new RegExp(`(?:^| )page-${['主要','特性','背景','法术','背包'].indexOf(name)}(?: |$)`));await expect(panel).toBeVisible();return panel;
}
async function editor(page:Page,enabled=true){
 const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});await expect(toggle).toBeEnabled();await expect(toggle).toHaveAttribute('aria-busy','false');if(await toggle.getAttribute('aria-checked')!==String(enabled))await toggle.click();await expect(toggle).toHaveAttribute('aria-checked',String(enabled));
}
async function ready(page:Page,cap=false){
 await mock(page);await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');const c=reviewedArmorFeatFixture();if(cap){c.abilities.str=20;c.abilities.dex=19;}
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'reviewed-armor-feats-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true}),imported=page.getByRole('tab',{name:/护甲专长交互验收（导入）/});await expect(review.or(imported)).toBeVisible();if(await review.isVisible()){await expect(review).toContainText('导入后保留该角色自己的规则版本');await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();}
 await expect(imported).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await expect(page.locator('.save-status')).toContainText('已保存到本机');await editor(page);
 // Only imported-empty-choice visibility is resumed. All feat choices, consent,
 // manual edits, suspension and withdrawal below use real player controls.
 const database=await page.evaluate(async()=>{const path='/card/src/platform/workspaceIdentity.ts';return (await import(path)).workspaceIdentity.database;});await restoreAuthoredChoices(page,database,{'armor-fighter':true});await editor(page);return saved(page);
}
async function workspace(page:Page,level:number){
 await editor(page);const panel=await tab(page,'特性');await expect(panel.locator('.detail-feats')).toBeVisible();const record=panel.locator('.detail-feats [data-class-choice]').filter({hasText:`职业 ${level} 级`});await expect(record).toBeVisible();
 if(await record.locator('[data-choice-id]').count()===0){const heading=panel.locator('.detail-class-features .feature-group h4 > button');await expect(heading).toHaveCount(1);await heading.click({button:'right'});await page.getByRole('menuitem',{name:'显示自带选项',exact:true}).click();}
 await record.locator('[data-choice-id]').click();const choices=panel.locator('.choice-workspace');await expect(choices).toBeVisible();return choices;
}
// Choice hints are adjacent SMALL nodes: textContent concatenates them, while
// the actual accessible button name separates the rendered hint from its name.
function featOption(workspace:Locator,name:string){return workspace.getByRole('button',{name:new RegExp(`^${name}(?:\\s|$)`)}).and(workspace.locator('.choice-option'));}
async function choose(page:Page,level:number,name:string,selected=true){const choices=await workspace(page,level),option=featOption(choices,name);await expect(option).toHaveCount(1);await expect(option).toHaveAttribute('aria-disabled','false');await option.click();await expect(option).toHaveAttribute('aria-pressed',String(selected));await choices.getByRole('button',{name:'收起选择',exact:true}).click();}
async function control(page:Page,kind:ArmorKind){const panel=await tab(page,'特性'),value=panel.locator(`.detail-feats [data-reviewed-feat-kind="${kind}"]`);await expect(value).toHaveCount(1);await expect(value).toBeVisible();return value;}
async function confirm(page:Page,kind:ArmorKind,ability?:'str'|'dex'){
 const value=await control(page,kind),name=names[kind];if(kind!=='heavily-armored')await value.getByLabel(`${name}提升属性`,{exact:true}).selectOption(ability!);else await expect(value.locator('select')).toHaveCount(0);
 await expect(value.getByRole('button',{name:`确认${name}`,exact:true})).toBeDisabled();await value.getByRole('checkbox',{name:`确认${name}未计入手工基础属性`,exact:true}).check();await value.getByRole('button',{name:`确认${name}`,exact:true}).click();await expect(value).toContainText(`${name}已生效`);
}
async function summary(page:Page,str:number,dex:number,trainings:string[],ac:number){
 await editor(page,false);const panel=await tab(page,'主要');await expect(panel.getByRole('spinbutton',{name:'力量基础值',exact:true})).toHaveValue(String(str));await expect(panel.getByRole('spinbutton',{name:'敏捷基础值',exact:true})).toHaveValue(String(dex));await expect(panel.locator('[data-stat="ac"]')).toHaveText(String(ac));await expect(panel.locator('[data-stat="hp"]')).toHaveText('42');await expect(panel.getByRole('textbox',{name:'当前生命值',exact:true})).toHaveValue('7');await expect(panel.getByRole('textbox',{name:'临时生命值',exact:true})).toHaveValue('3');
 const armor=panel.locator('.training-row').filter({has:page.locator('dt').filter({hasText:/^护甲$/})});for(const name of ['轻甲','中甲','重甲','盾牌'])await expect(armor.getByRole('button',{name,exact:true})).toHaveCount(trainings.includes(name)?1:0);await editor(page);
}
async function manualTraining(page:Page,value:string){await editor(page);const panel=await tab(page,'主要');await panel.getByRole('button',{name:'编辑装备训练与其他熟练',exact:true}).click();const input=panel.getByRole('textbox',{name:'护甲熟练记录',exact:true});await input.fill(value);await input.press('Enter');await expect.poll(async()=>(await saved(page)).training?.armor).toBe(value);await panel.getByRole('button',{name:'编辑装备训练与其他熟练',exact:true}).click();}
async function base(page:Page,ability:'str'|'dex',value:number){await editor(page);const panel=await tab(page,'主要'),name=ability==='str'?'力量':'敏捷';await panel.getByRole('spinbutton',{name:`${name}基础值`,exact:true}).click();const trace=page.getByRole('dialog',{name:`${name}数据追溯`,exact:true});await expect(trace).toBeVisible();const input=trace.getByRole('spinbutton',{name:`${name}追溯输入`,exact:true});await input.fill(String(value));await input.press('Enter');await expect(trace).toHaveCount(0);await expect.poll(async()=>(await saved(page)).abilities[ability]).toBe(value);}
async function level(page:Page,value:number){await editor(page);const panel=await tab(page,'特性'),input=panel.getByRole('spinbutton',{name:'战士等级',exact:true});await input.fill(String(value));await input.press('Tab');await expect.poll(async()=>(await saved(page)).selections.find(row=>row.id==='armor-fighter')?.level).toBe(value);}
function protectedState(after:Character,before:Character){for(const field of ['abilities','training','baseHp','sheetBonuses','proficiencies','notes','adjustments','inventory'] as const)expect(after[field]).toEqual(before[field]);expect(after.runtime).toEqual(before.runtime);expect(after.selections.filter(row=>row.entry.kind==='feat')).toEqual([]);}
async function fits(value:Locator){await value.scrollIntoViewIfNeeded();const box=await value.evaluate(el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,width:window.innerWidth,overflow:el.scrollWidth>el.clientWidth+1};});expect(box.left).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(box.width+1);expect(box.overflow).toBe(false);}
async function chain(page:Page){await choose(page,4,'轻甲运用');await confirm(page,'lightly-armored','dex');await choose(page,6,'中甲运用');await confirm(page,'moderately-armored','str');await choose(page,8,'重甲运用');await confirm(page,'heavily-armored');await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings.length).toBe(3);}

test('armor feats require earlier confirmed training, preserve the full chain across reopen and retract dependent effects after withdrawal or replacement',async({page},info)=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const before=await ready(page);const options=await workspace(page,6);for(const name of ['中甲运用','重甲运用']){const option=featOption(options,name);await expect(option).toHaveCount(1);await expect(option).toHaveAttribute('aria-disabled','true');}await options.getByRole('button',{name:'收起选择',exact:true}).click();
 await choose(page,4,'轻甲运用');await expect(await control(page,'lightly-armored')).toContainText('尚未确认轻甲运用');await summary(page,13,13,[],14);expect((await saved(page)).reviewedFeats).toBeUndefined();
 await confirm(page,'lightly-armored','dex');await summary(page,13,14,['轻甲'],15);await choose(page,6,'中甲运用');await confirm(page,'moderately-armored','str');await summary(page,14,14,['轻甲','中甲','盾牌'],15);await choose(page,8,'重甲运用');await confirm(page,'heavily-armored');await summary(page,15,14,['轻甲','中甲','重甲','盾牌'],15);
 const active=await saved(page);protectedState(active,before);await page.reload();await summary(page,15,14,['轻甲','中甲','重甲','盾牌'],15);expect((await saved(page)).reviewedFeats).toEqual(active.reviewedFeats);
 const light=await control(page,'lightly-armored');await light.getByRole('button',{name:'撤回轻甲运用',exact:true}).click();await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings.length).toBe(2);for(const kind of ['moderately-armored','heavily-armored'] as const){const value=await control(page,kind);await expect(value).toContainText(`${names[kind]}记录已保留，当前不生效`);await expect(value).toContainText('前提');}await summary(page,13,13,[],14);
 await confirm(page,'lightly-armored','dex');await summary(page,15,14,['轻甲','中甲','重甲','盾牌'],15);await choose(page,4,'原创替代记录');await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings.length).toBe(2);await summary(page,13,13,[],14);await page.reload();await choose(page,4,'轻甲运用');await expect(await control(page,'lightly-armored')).toContainText('尚未确认轻甲运用');await summary(page,13,13,[],14);
 const value=await control(page,'moderately-armored');await fits(value);await page.screenshot({path:info.outputPath('armor-prerequisite-chain-suspended.png'),fullPage:true});protectedState(await saved(page),before);expect(errors).toEqual([]);
});

test('armor ability cap rejects STR20, keeps DEX20 without rewriting the base and preserves literal full and empty manual training overrides',async({page},info)=>{
 test.setTimeout(150000);const before=await ready(page,true);await choose(page,4,'轻甲运用');let value=await control(page,'lightly-armored');await value.getByLabel('轻甲运用提升属性',{exact:true}).selectOption('str');await value.getByRole('checkbox',{name:'确认轻甲运用未计入手工基础属性',exact:true}).check();await value.getByRole('button',{name:'确认轻甲运用',exact:true}).click();await expect(value.getByRole('alert')).toContainText('上限 20');expect((await saved(page)).reviewedFeats).toBeUndefined();
 await confirm(page,'lightly-armored','dex');await summary(page,20,20,['轻甲'],18);protectedState(await saved(page),before);const record=(await saved(page)).reviewedFeats;
 await manualTraining(page,'盾牌、手工未收录说明');value=await control(page,'lightly-armored');await expect(value).toContainText('当前护甲训练由手工记录覆盖');await summary(page,20,20,['盾牌'],18);await manualTraining(page,'');value=await control(page,'lightly-armored');await expect(value).toContainText('（空记录）');await summary(page,20,20,[],18);expect((await saved(page)).reviewedFeats).toEqual(record);
 await base(page,'dex',20);value=await control(page,'lightly-armored');await expect(value).toContainText('轻甲运用记录已保留，当前不生效');await expect(value).toContainText('上限 20');await summary(page,20,20,[],18);await base(page,'dex',19);await summary(page,20,20,[],18);await page.reload();await summary(page,20,20,[],18);expect((await saved(page)).training?.armor).toBe('');expect((await saved(page)).reviewedFeats).toEqual(record);
 value=await control(page,'lightly-armored');await fits(value);await page.screenshot({path:info.outputPath('armor-empty-manual-override.png'),fullPage:true});await value.getByRole('button',{name:'撤回轻甲运用',exact:true}).click();await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings).toEqual([]);await page.reload();await summary(page,20,19,[],17);const expected=structuredClone(before);expected.training!.armor='';protectedState(await saved(page),expected);
});

test('source restriction, level reduction and owner readonly retain armor intent; undo and explicit forgetting never duplicate consent',async({page,context},info)=>{
 test.setTimeout(150000);const before=await ready(page);await chain(page);const active=await saved(page);await level(page,6);await summary(page,14,14,['轻甲','中甲','盾牌'],15);await expect(await control(page,'heavily-armored')).toContainText('重甲运用记录已保留，当前不生效');expect((await saved(page)).reviewedFeats).toEqual(active.reviewedFeats);await level(page,8);await summary(page,15,14,['轻甲','中甲','重甲','盾牌'],15);
 await setSiteSource(page,'PHB',false);await summary(page,13,13,[],12);for(const kind of Object.keys(names) as ArmorKind[]){const value=await control(page,kind);await expect(value).toContainText(`${names[kind]}记录已保留，当前不生效`);await expect(value.getByRole('button',{name:`确认${names[kind]}`,exact:true})).toBeDisabled();await expect(value.getByRole('button',{name:`撤回${names[kind]}`,exact:true})).toBeEnabled();}expect((await saved(page)).reviewedFeats).toEqual(active.reviewedFeats);
 const other=await context.newPage();await mock(other);await other.goto('/card/?intro=0');await expect(other.locator('.paper')).toBeVisible();await expect(other.locator('.card-permission-banner')).toContainText('另一标签页正在编辑');await expect(other.getByRole('switch',{name:'编辑模式',exact:true})).toBeDisabled();for(const kind of Object.keys(names) as ArmorKind[]){const value=await control(other,kind);await expect(value.getByRole('button',{name:`确认${names[kind]}`,exact:true})).toBeDisabled();await expect(value.getByRole('button',{name:`撤回${names[kind]}`,exact:true})).toBeDisabled();}expect((await saved(other)).reviewedFeats).toEqual(active.reviewedFeats);await other.close();
 await setSiteSource(page,'PHB',true);await summary(page,15,14,['轻甲','中甲','重甲','盾牌'],15);await choose(page,8,'重甲运用',false);await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings.length).toBe(2);await summary(page,14,14,['轻甲','中甲','盾牌'],15);await page.getByRole('button',{name:'撤销',exact:true}).click();await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings.length).toBe(3);await summary(page,15,14,['轻甲','中甲','重甲','盾牌'],15);await page.getByRole('button',{name:'重做',exact:true}).click();await expect.poll(async()=>(await saved(page)).reviewedFeats?.bindings.length).toBe(2);
 await choose(page,8,'重甲运用');const value=await control(page,'heavily-armored');await expect(value).toContainText('尚未确认重甲运用');await expect(value.getByRole('button',{name:'确认重甲运用',exact:true})).toBeDisabled();await fits(value);await page.screenshot({path:info.outputPath('armor-heavy-reselect-needs-consent.png'),fullPage:true});await page.reload();await summary(page,14,14,['轻甲','中甲','盾牌'],15);protectedState(await saved(page),before);
});
