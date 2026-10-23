import {test,expect,type Page,type Locator} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {restoreAuthoredChoices} from './authoredChoicesFixture';
import {invocationData} from '../fixtures/invocationData';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';

// Original metadata-only PHB fixtures. Browser tests exercise real App edits,
// drag/drop, IndexedDB persistence and payment UI, not injected rule mutations.
async function mock(page:Page){
 const body=invocationData;
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local test'}}));
 await page.route('**/data/class/index.json',route=>route.fulfill({json:{invocation:'class-invocation.json'}}));
 await page.route('**/data/class/class-invocation.json',route=>route.fulfill({json:{class:body.class,classFeature:body.classFeature}}));
 await page.route('**/data/optionalfeatures.json',route=>route.fulfill({json:{optionalfeature:body.optionalfeature}}));
 await page.route('**/data/spells/index.json',route=>route.fulfill({json:{PHB:'spells-invocation.json'}}));
 await page.route('**/data/spells/spells-invocation.json',route=>route.fulfill({json:{spell:body.spell}}));
}
async function saved(page:Page){return page.evaluate(async()=>{
 const path='/card/src/platform/workspaceIdentity.ts',name=(await import(path)).workspaceIdentity.database;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{const workspace=await new Promise<any>((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return workspace.characters.find((c:any)=>c.id===workspace.activeId);}finally{db.close();}
});}
async function tab(page:Page,name:string){const control=page.getByRole('tab',{name,exact:true});await control.click();await expect(control).toHaveAttribute('aria-selected','true');return page.locator('.paper[data-active-sheet="true"]');}
async function ready(page:Page){
 await mock(page);await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];const entries:Entry[]=Object.entries(invocationData).flatMap(([category,rows])=>rows.map(raw=>({id:`invocation-fixture:${category}:${raw.name}`,name:raw.name,english:raw.ENG_name,source:raw.source,edition:'2014' as const,kind:(category==='classFeature'||category==='optionalfeature'?'feature':category) as Entry['kind'],packId:'fixture',revision:'1',entries:[],raw:{...raw,_category:category}})));c.selections=[{id:'warlock',entry:entries.find(e=>e.kind==='class')!,level:5,quantity:1,equipped:false},{id:'invocations-source',entry:entries.find(e=>e.raw._category==='classFeature')!,level:1,quantity:1,equipped:false,parentId:'warlock',grantKey:'ref:魔能祈唤|魔契师||2'}];c.name='祈唤交互验收';c.notes='保留手工技能与施法位';c.proficiencies={insight:true};c.abilities.cha=10;c.runtime.resources['pact-slot:3']={max:2,current:1};c.runtime.hp=3;
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'invocations-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true});await expect(review).toContainText('导入后保留该角色自己的规则版本');await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();
 await expect(page.getByRole('tab',{name:/祈唤交互验收（导入）/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});if(await toggle.getAttribute('aria-checked')!=='true')await toggle.click();
 const database=await page.evaluate(async()=>{const path='/card/src/platform/workspaceIdentity.ts';return (await import(path)).workspaceIdentity.database;});await restoreAuthoredChoices(page,database,{warlock:true});
}
async function learning(page:Page){const panel=await tab(page,'特性');await panel.locator('[data-choice-id="warlock:class-optional:0"]').click();const workspace=panel.getByRole('region',{name:'选择魔能祈唤',exact:true});await expect(workspace).toBeVisible();return workspace;}
async function drag(page:Page,workspace:Locator,name:string,index:number){
 if((page.viewportSize()?.width||0)<=760)await workspace.getByRole('button',{name:'打开候选资料',exact:true}).click();
 const row=page.locator('.catalog-row').filter({has:page.locator('.entry-name').filter({hasText:new RegExp(`^${name}(?:\\s|$)`)})}).first();await expect(row).toBeVisible();await row.scrollIntoViewIfNeeded();const from=await row.boundingBox();await page.mouse.move(from!.x+25,from!.y+from!.height/2);await page.mouse.down();await page.mouse.move(from!.x+40,from!.y+from!.height/2,{steps:3});
 const slot=workspace.locator('.choice-slot').nth(index);await slot.scrollIntoViewIfNeeded();const to=await slot.boundingBox();await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:15});await page.mouse.up();await expect(slot).toContainText(name);await expect(page.locator('.pointer-ghost')).toHaveCount(0);
}
async function closeLearning(page:Page,workspace:Locator){await workspace.getByRole('button',{name:'收起选择',exact:true}).click();if((page.viewportSize()?.width||0)<=760){const main=page.getByRole('button',{name:'功能页',exact:true});if(await main.isVisible())await main.click();}}
async function skill(page:Page,name:string,value:string,proficient:boolean){
 const panel=await tab(page,'主要'),row=panel.locator('.ability-skill').filter({has:page.locator(`span[title="${name}"]`)});await expect(row.locator('b').first()).toHaveText(value);await expect(row.locator('.proficiency-explanation')).toContainText(`${name}当前生效：${proficient?'熟练':'无熟练'}`);
}
async function freeCast(page:Page,name:string){
 const before=await saved(page),panel=await tab(page,'法术'),badge=panel.getByRole('button',{name:`${name}施放详情`,exact:true});await expect(badge).toContainText('免费 · 随意');await badge.click();const detail=page.getByRole('dialog',{name:`${name}施放详情`,exact:true});await expect(detail).toContainText('免费施法');await detail.getByRole('button',{name:'使用',exact:true}).click();await expect.poll(async()=>(await saved(page)).runtime.automationActions?.sequence||0).toBe((before.runtime.automationActions?.sequence||0)+1);
 const after=await saved(page);expect(after.runtime.resources).toEqual(before.runtime.resources);expect(after.runtime.automationActions.last.resourceId).toBeUndefined();await detail.getByRole('button',{name:'关闭施放详情',exact:true}).click();
}

test('learned skills update the real sheet, survive reopen and revoke without deleting manual skill intent',async({page},info)=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);await skill(page,'欺瞒','+0',false);await skill(page,'游说','+0',false);await skill(page,'洞悉','+3',true);
 let workspace=await learning(page);await drag(page,workspace,'诱导话术',0);await closeLearning(page,workspace);await skill(page,'欺瞒','+3',true);await skill(page,'游说','+3',true);
 await expect.poll(async()=>(await saved(page)).selections.filter((row:any)=>row.entry.english==='Beguiling Influence'&&row.grantKey?.startsWith('choice:')).length).toBe(1);const learned=(await saved(page)).selections.find((row:any)=>row.entry.english==='Beguiling Influence'&&row.grantKey?.startsWith('choice:'));
 await page.reload();await skill(page,'欺瞒','+3',true);await skill(page,'游说','+3',true);expect((await saved(page)).selections.find((row:any)=>row.id===learned.id)).toBeDefined();
 await page.locator('.paper[data-active-sheet="true"]').getByRole('checkbox',{name:'欺瞒手动熟练',exact:true}).check();await expect.poll(async()=>(await saved(page)).proficiencies.deception).toBe(true);
 workspace=await learning(page);await drag(page,workspace,'魔能视界',0);await closeLearning(page,workspace);await skill(page,'欺瞒','+3',true);await skill(page,'游说','+0',false);await skill(page,'洞悉','+3',true);await freeCast(page,'侦测魔法');
 workspace=await learning(page);await workspace.getByRole('button',{name:'移除魔能视界',exact:true}).click();await closeLearning(page,workspace);await expect.poll(async()=>(await saved(page)).selections.filter((row:any)=>row.grantKey?.startsWith('source-spell:')).length).toBe(0);
 workspace=await learning(page);await drag(page,workspace,'诱导话术',0);await closeLearning(page,workspace);await skill(page,'游说','+3',true);workspace=await learning(page);await workspace.getByRole('button',{name:'移除诱导话术',exact:true}).click();await closeLearning(page,workspace);await page.reload();await skill(page,'欺瞒','+3',true);await skill(page,'游说','+0',false);await skill(page,'洞悉','+3',true);
 const final=await saved(page);expect(final.notes).toBe('保留手工技能与施法位');expect(final.runtime.hp).toBe(3);expect(final.proficiencies).toMatchObject({deception:true,insight:true});await page.screenshot({path:info.outputPath('invocation-skill-revoke.png'),fullPage:true});expect(errors).toEqual([]);
});
test('at-will armor remains self-only manual effect, while readonly UI cannot edit learning',async({page,context},info)=>{
 test.setTimeout(90000);await ready(page);const initial=await saved(page);const workspace=await learning(page);await drag(page,workspace,'幽影护甲',0);await closeLearning(page,workspace);let panel=await tab(page,'特性');await expect(panel.locator('[data-class-choice="warlock:class-optional:0"]')).toContainText('仅对自身');await expect(panel).toContainText('不自动加护甲');await freeCast(page,'法师护甲');
 panel=await tab(page,'主要');await expect(panel.locator('[data-stat="ac"]')).toHaveText('10');await page.reload();await freeCast(page,'法师护甲');expect((await saved(page)).runtime.resources).toEqual(initial.runtime.resources);
 const other=await context.newPage();await mock(other);await other.goto('/card/?intro=0');const readonly=await tab(other,'特性');await expect(readonly.locator('[data-choice-id="warlock:class-optional:0"]')).toBeDisabled();const before=await saved(other);await expect(readonly).toContainText('仅对自身');expect(await saved(other)).toEqual(before);await other.close();await page.screenshot({path:info.outputPath('invocation-free-armor.png'),fullPage:true});
});
