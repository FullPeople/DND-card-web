import {readFile} from 'node:fs/promises';
import {test,expect,type Page,type Locator} from '@playwright/test';
import {mockSource,suppressAnnouncement,expandSourceBook} from './fixtures';
import {pointerChoiceDrop} from './pointerChoiceDrop';
import {restoreAuthoredChoices} from './authoredChoicesFixture';
import {invocationSkillGuardData as data} from '../fixtures/invocationSkillGuardData';
import {newCharacter,type Character,type Entry,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';

const choiceId='warlock:class-optional:0',name='祈唤技能资格验收';
const sourceKey='ref:魔能祈唤|魔契师||2',sourceEntryId='kiwee:feature:phb:eldritch%20invocations:phb:%E9%AD%94%E5%A5%91%E5%B8%88:::2:';
// These tests exercise ordinary player edits and native persistence. They do not
// mutate live selections/effects or call evaluate to manufacture UI evidence.
// Raw source-identity tampering has no ordinary editor control: the dedicated
// unit tests, not these synchronized UI flows, prove that pre-sync guard.
async function mock(page:Page){
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local test'}}));
 await page.context().route('**/data/class/index.json',route=>route.fulfill({json:{invocation:'class-skill-guard.json'}}));
 await page.context().route('**/data/class/class-skill-guard.json',route=>route.fulfill({json:{class:data.class,classFeature:data.classFeature}}));
 await page.context().route('**/data/optionalfeatures.json',route=>route.fulfill({json:{optionalfeature:data.optionalfeature}}));
 await page.context().route('**/data/spells/index.json',route=>route.fulfill({json:{PHB:'spells-skill-guard.json'}}));
 await page.context().route('**/data/spells/spells-skill-guard.json',route=>route.fulfill({json:{spell:data.spell}}));
}
async function saved(page:Page):Promise<Character>{return page.evaluate(async()=>{
 const path='/card/src/platform/workspaceIdentity.ts',name=(await import(path)).workspaceIdentity.database;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{const workspace=await new Promise<any>((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return workspace.characters.find((c:any)=>c.id===workspace.activeId);}finally{db.close();}
});}
async function tab(page:Page,name:string){
 const button=page.getByRole('tab',{name,exact:true});await button.click();await expect(button).toHaveAttribute('aria-selected','true');
 const panel=page.locator('.paper[data-active-sheet="true"]');await expect(panel).toHaveClass(new RegExp(`(?:^| )page-${['主要','特性','背景','法术','背包'].indexOf(name)}(?: |$)`));await expect(panel).toBeVisible();return panel;
}
async function editor(page:Page,enabled=true){
 const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});
 // Restored edit intent is temporarily unchecked while the runtime loads.
 await expect(toggle).toBeEnabled();await expect(toggle).toHaveAttribute('aria-busy','false');
 if(await toggle.getAttribute('aria-checked')!==String(enabled))await toggle.click();
 await expect(toggle).toHaveAttribute('aria-checked',String(enabled));
}
async function importBackup(page:Page,buffer:Buffer,review=false){
 const oldId=(await saved(page)).id;
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'invocation-skill-guard.json',mimeType:'application/json',buffer});
 if(review){const dialog=page.getByRole('dialog',{name:'导入前核对',exact:true});await expect(dialog).toContainText('导入后保留该角色自己的规则版本');await dialog.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();}
 await expect.poll(async()=>(await saved(page)).id).not.toBe(oldId);await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();await editor(page);
}
async function ready(page:Page){
 await mock(page);await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];
 // Normalize only the initial imported class record, without changing live state.
 const entry:Entry=await page.evaluate(async raw=>{const path='/card/src/data/catalog.ts';return (await import(path)).normalizeData({class:[raw]},'authored-skill-guard')[0];},data.class[0]);
 c.selections=[{id:'warlock',entry,level:1,quantity:1,equipped:false}];
 c.name=name;c.notes='保留独立熟练、专精、额外调整和已用资源';c.abilities.cha=14;c.proficiencies={insight:true};c.expertise={};c.skillBonuses={persuasion:1};c.baseHp=20;c.runtime.hp=7;c.runtime.tempHp=3;c.runtime.resources['manual-skill-guard']={name:'手工已用资源',max:5,current:2};
 await importBackup(page,Buffer.from(JSON.stringify(exportCharacter(c))),true);
 // Only resume presentation of this imported blank authoring fixture. Every
 // learned choice, source/level edit and manual skill toggle below uses real UI.
 const database=await page.evaluate(async()=>{const path='/card/src/platform/workspaceIdentity.ts';return (await import(path)).workspaceIdentity.database;});await restoreAuthoredChoices(page,database,{warlock:true});await editor(page);
 // Start before the source feature exists, then let the actual level editor
 // create its canonical catalog grant. Never seed a synthetic source parent.
 await level(page,2);await expect.poll(async()=>(await saved(page)).selections.filter(row=>row.parentId==='warlock'&&row.grantKey===sourceKey).length).toBe(1);sourceGrant(await saved(page));
}
async function learning(page:Page){
 if((page.viewportSize()?.width||0)<=760){const main=page.getByRole('button',{name:'功能页',exact:true});if(await main.isVisible())await main.click();}
 await editor(page);const panel=await tab(page,'特性'),workspace=panel.getByRole('region',{name:'选择魔能祈唤',exact:true}),record=panel.locator(`[data-class-choice="${choiceId}"]`);await expect(record).toBeVisible();
 if(await workspace.isVisible())return workspace;
 const entrance=record.locator(`[data-choice-id="${choiceId}"]`);
 if(!await entrance.isVisible()){
  const at=(await saved(page)).selections.find(row=>row.id==='warlock')!.level;
  await panel.locator('.detail-class-features .feature-group h4').getByRole('button',{name:`职业 魔契师 Lv.${at}`,exact:true}).click({button:'right'});
  await page.getByRole('menuitem',{name:'显示自带选项',exact:true}).click();
 }
 await entrance.click();await expect(workspace).toBeVisible();return workspace;
}
async function drag(page:Page,workspace:Locator,name:string){
 if((page.viewportSize()?.width||0)<=760)await workspace.getByRole('button',{name:'打开候选资料',exact:true}).click();
 const row=page.locator('.catalog-row').filter({has:page.locator('.entry-name').filter({hasText:new RegExp(`^${name}(?:\\s|$)`)})}).first();await pointerChoiceDrop(page,row,workspace.locator('.choice-slot').first());
 if((page.viewportSize()?.width||0)<=760)workspace=await learning(page);
 await expect(workspace.locator('.choice-slot').first()).toContainText(name);return workspace;
}
async function closeLearning(page:Page,workspace:Locator){
 if((page.viewportSize()?.width||0)<=760){const main=page.getByRole('button',{name:'功能页',exact:true});if(await main.isVisible())await main.click();}
 await workspace.getByRole('button',{name:'收起选择',exact:true}).click();
}
function sourceIdentity(row:Selection){
 expect(row.parentId).toBe('warlock');expect(row.grantKey).toBe(sourceKey);
 expect(row.entry).toMatchObject({id:sourceEntryId,kind:'feature',english:'Eldritch Invocations',source:'PHB',edition:'2014',packId:'kiwee'});
 expect(row.entry.raw).toMatchObject({_category:'classFeature',ENG_name:'Eldritch Invocations',source:'PHB',className:'魔契师',classSource:'PHB',level:2});
}
function sourceGrant(card:Character):Selection{
 const rows=card.selections.filter(row=>row.parentId==='warlock'&&row.grantKey===sourceKey);expect(rows).toHaveLength(1);sourceIdentity(rows[0]);return rows[0];
}
function learned(card:Character):Selection{
 const rows=card.selections.filter(row=>row.entry.english==='Beguiling Influence'&&row.grantKey?.startsWith('choice:'));expect(rows).toHaveLength(1);const row=rows[0];
 expect(row.entry.source).toBe('PHB');expect(row.entry.edition).toBe('2014');expect(row.requirementId).toBe(choiceId);expect(row.parentId).toBe(sourceGrant(card).id);expect(card.answers[choiceId]).toContain(row.entry.id);return row;
}
async function learn(page:Page){
 let workspace=await learning(page);workspace=await drag(page,workspace,'诱导话术');await closeLearning(page,workspace);
 await expect.poll(async()=>(await saved(page)).selections.filter(row=>row.entry.english==='Beguiling Influence'&&row.grantKey?.startsWith('choice:')).length).toBe(1);return learned(await saved(page));
}
async function skill(page:Page,name:string,value:string,state:'熟练'|'专精'|'无熟练'){
 const panel=await tab(page,'主要'),row=panel.locator('.ability-skill').filter({has:page.locator(`span[title="${name}"]`)});await expect(row.locator('b').first()).toHaveText(value);
 await expect(row.locator('.proficiency-explanation')).toContainText(`${name}当前生效：${state}`);return row;
}
async function skills(page:Page,active:boolean,manualDeception=false){
 await editor(page);await skill(page,'欺瞒',active||manualDeception?'+4':'+2',active||manualDeception?'熟练':'无熟练');await skill(page,'游说',active?'+5':'+3',active?'熟练':'无熟练');await skill(page,'洞悉','+2','熟练');
}
async function manual(page:Page,key:'deception'|'persuasion',kind:'proficiency'|'expertise',enabled:boolean){
 await editor(page);const panel=await tab(page,'主要'),name=key==='deception'?'欺瞒':'游说';
 await panel.getByRole('checkbox',{name:`${name}${kind==='proficiency'?'手动熟练':'专精'}`,exact:true}).setChecked(enabled);
 await expect.poll(async()=>kind==='proficiency'?(await saved(page)).proficiencies?.[key]:(await saved(page)).expertise?.[key]).toBe(enabled);
}
async function source(page:Page,enabled:boolean){
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expandSourceBook(page,'PHB');const book=page.locator('.source-book').filter({has:page.locator('button[aria-label="设置来源 PHB"]')});
 await book.locator('input[type=checkbox]').first().setChecked(enabled);await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).profile.enabledSources.includes('PHB')).toBe(enabled);
}
async function level(page:Page,value:number){
 await editor(page);const panel=await tab(page,'特性'),input=panel.getByRole('spinbutton',{name:'魔契师等级',exact:true});await input.fill(String(value));await input.press('Tab');await expect(input).toHaveValue(String(value));
 await expect.poll(async()=>(await saved(page)).selections.find(row=>row.id==='warlock')?.level).toBe(value);await expect(page.locator('.save-status')).toContainText('已保存到本机');
}
function preserved(card:Character,before:Character){
 for(const field of ['notes','abilities','baseHp','proficiencies','expertise','skillBonuses','inventory'] as const)expect(card[field]).toEqual(before[field]);
 for(const field of ['hp','tempHp','inspiration','deathSaves'] as const)expect(card.runtime[field]).toEqual(before.runtime[field]);
 expect(card.runtime.resources['manual-skill-guard']).toEqual(before.runtime.resources['manual-skill-guard']);
}
function archived(card:Character,row:Selection,source:Selection){
 expect(card.selections.some(current=>current.id===row.id)).toBe(false);expect(card.classChoiceArchive?.[row.id]?.choiceId).toBe(choiceId);expect(card.classChoiceArchive?.[row.id]?.selections).toEqual([row]);
 const parent=card.classChoiceArchive?.[row.id]?.parent;expect(parent).toEqual(source);expect(parent!.id).toBe(row.parentId);sourceIdentity(parent!);
}
async function reload(page:Page){await page.reload();await expect(page.locator('.save-status')).toContainText('已保存到本机');await editor(page);}
async function downloadBackup(page:Page){
 await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'下载 JSON',exact:true}).click();const download=await pending,path=await download.path();expect(path).not.toBeNull();const buffer=await readFile(path!);
 await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();return buffer;
}

test('learned PHB skills suspend with their source and restore without becoming manual proficiencies',async({page,context},info)=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);const before=await saved(page);await skills(page,false);const row=await learn(page);await skills(page,true);preserved(await saved(page),before);
 await manual(page,'deception','proficiency',true);const manualBefore=await saved(page);
 const other=await context.newPage();other.on('pageerror',error=>errors.push(error.message));await mock(other);await other.goto('/card/?intro=0');await expect(other.locator('.card-permission-banner')).toContainText('另一标签页正在编辑');await expect(other.getByRole('switch',{name:'编辑模式',exact:true})).toBeDisabled();
 let readonly=await tab(other,'主要');await expect(readonly.getByRole('checkbox',{name:'欺瞒手动熟练',exact:true})).toHaveCount(0);await expect(readonly.locator('[aria-label="欺瞒熟练"]')).toBeVisible();await expect(readonly.locator('[aria-label="游说熟练"]')).toBeVisible();
 const readonlyBefore=await saved(other);readonly=await tab(other,'特性');await expect(readonly.getByRole('spinbutton',{name:'魔契师等级',exact:true})).toHaveAttribute('readonly','');await expect(readonly.locator(`[data-class-choice="${choiceId}"] [data-choice-id="${choiceId}"]`)).toBeDisabled();expect(await saved(other)).toEqual(readonlyBefore);await other.close();preserved(await saved(page),manualBefore);
 await source(page,false);await skills(page,false,true);const suspended=await saved(page);archived(suspended,row,sourceGrant(before));expect(suspended.answers[choiceId]).toEqual([row.entry.id,'']);preserved(suspended,manualBefore);
 const records=(await tab(page,'特性')).locator(`[data-class-choice="${choiceId}"]`);await expect(records).toContainText('来源未启用，原记录保留');await expect(records.getByRole('button',{name:'诱导话术',exact:true})).toBeVisible();
 await reload(page);await skills(page,false,true);archived(await saved(page),row,sourceGrant(before));preserved(await saved(page),manualBefore);
 await source(page,true);await skills(page,true,true);expect(learned(await saved(page))).toEqual(row);expect(sourceGrant(await saved(page))).toEqual(sourceGrant(before));expect((await saved(page)).classChoiceArchive?.[row.id]).toBeUndefined();
 await reload(page);await skills(page,true,true);expect(learned(await saved(page))).toEqual(row);expect(sourceGrant(await saved(page))).toEqual(sourceGrant(before));preserved(await saved(page),manualBefore);
 await page.screenshot({path:info.outputPath('skill-source-restored.png'),fullPage:true});expect(errors).toEqual([]);
});

test('dropping below the actual source feature level archives learned skills and restoring level preserves their identity',async({page:initialPage,context},info)=>{
 test.setTimeout(120000);let page=initialPage;const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);const before=await saved(page),row=await learn(page);await skills(page,true);
 await level(page,1);await skills(page,false);const low=await saved(page);archived(low,row,sourceGrant(before));expect(low.answers[choiceId]).toEqual([row.entry.id,'']);preserved(low,before);
 const workspace=await learning(page);await expect(workspace.locator('.choice-slot').first()).toContainText('诱导话术');await expect(workspace.locator('.choice-slot').first()).toContainText('来源职业特性当前不可用');await closeLearning(page,workspace);
 await reload(page);await skills(page,false);archived(await saved(page),row,sourceGrant(before));preserved(await saved(page),before);
 await level(page,2);await skills(page,true);expect(learned(await saved(page))).toEqual(row);expect(sourceGrant(await saved(page))).toEqual(sourceGrant(before));expect((await saved(page)).classChoiceArchive?.[row.id]).toBeUndefined();preserved(await saved(page),before);
 await page.close();page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await mock(page);await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');await skills(page,true);expect(learned(await saved(page))).toEqual(row);expect(sourceGrant(await saved(page))).toEqual(sourceGrant(before));preserved(await saved(page),before);
 await page.screenshot({path:info.outputPath('skill-level-reopened.png'),fullPage:true});expect(errors).toEqual([]);
});

test('manual proficiency and expertise survive replacement, removal and native export/import without resurrecting archived skills',async({page},info)=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);
 await manual(page,'deception','proficiency',true);await manual(page,'persuasion','expertise',true);const manualBefore=await saved(page);await skill(page,'欺瞒','+4','熟练');await skill(page,'游说','+7','专精');const row=await learn(page);preserved(await saved(page),manualBefore);
 // Clearing only the manual flags must not cancel the learned source grant.
 await manual(page,'deception','proficiency',false);await manual(page,'persuasion','proficiency',false);await skills(page,true);const automaticOnly=await saved(page);expect(automaticOnly.proficiencies).toEqual({insight:true,deception:false,persuasion:false});expect(automaticOnly.expertise).toEqual({persuasion:false,deception:false});
 // Re-enabling proficiency preserves the explicit non-expertise flag written
 // by the player's earlier uncheck; compare all other manual fields unchanged.
 const manualAfterToggles={...manualBefore,expertise:{...manualBefore.expertise,deception:false}};
 await manual(page,'deception','proficiency',true);await manual(page,'persuasion','expertise',true);preserved(await saved(page),manualAfterToggles);
 let workspace=await learning(page);const beforeCancel=await saved(page);await page.keyboard.press('Escape');await expect(workspace).not.toBeVisible();expect(await saved(page)).toEqual(beforeCancel);
 workspace=await learning(page);workspace=await drag(page,workspace,'魔能视界');await closeLearning(page,workspace);await skill(page,'欺瞒','+4','熟练');await skill(page,'游说','+7','专精');archived(await saved(page),row,sourceGrant(manualBefore));preserved(await saved(page),manualAfterToggles);
 workspace=await learning(page);await workspace.getByRole('button',{name:'移除魔能视界',exact:true}).click();await closeLearning(page,workspace);expect(await learn(page)).toEqual(row);
 workspace=await learning(page);await workspace.getByRole('button',{name:'移除诱导话术',exact:true}).click();await closeLearning(page,workspace);await skill(page,'欺瞒','+4','熟练');await skill(page,'游说','+7','专精');const removed=await saved(page);archived(removed,row,sourceGrant(manualBefore));expect(removed.answers[choiceId].filter(Boolean)).toEqual([]);preserved(removed,manualAfterToggles);
 const buffer=await downloadBackup(page),exported=JSON.parse(buffer.toString()).character as Character;expect(exported.proficiencies).toEqual(manualAfterToggles.proficiencies);expect(exported.expertise).toEqual(manualAfterToggles.expertise);archived(exported,row,sourceGrant(manualBefore));
 await importBackup(page,buffer);await skill(page,'欺瞒','+4','熟练');await skill(page,'游说','+7','专精');archived(await saved(page),row,sourceGrant(manualBefore));preserved(await saved(page),manualAfterToggles);expect((await saved(page)).selections.filter(current=>current.grantKey?.startsWith('choice:'))).toEqual([]);
 await reload(page);await skill(page,'欺瞒','+4','熟练');await skill(page,'游说','+7','专精');archived(await saved(page),row,sourceGrant(manualBefore));preserved(await saved(page),manualAfterToggles);
 await editor(page,false);const panel=await tab(page,'主要');await expect(panel.getByRole('checkbox',{name:'欺瞒手动熟练',exact:true})).toHaveCount(0);await expect(panel.locator('[aria-label="欺瞒熟练"]')).toBeVisible();await expect(panel.locator('[aria-label="游说专精"]')).toBeVisible();preserved(await saved(page),manualAfterToggles);
 await page.screenshot({path:info.outputPath('skill-manual-import-reopened.png'),fullPage:true});expect(errors).toEqual([]);
});
