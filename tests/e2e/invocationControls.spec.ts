import {test,expect,type Page,type Locator} from '@playwright/test';
import {mockSource,suppressAnnouncement,expandSourceBook} from './fixtures';
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
 await page.context().route('**/data/class/index.json',route=>route.fulfill({json:{invocation:'class-invocation.json'}}));
 await page.context().route('**/data/class/class-invocation.json',route=>route.fulfill({json:{class:body.class,classFeature:body.classFeature}}));
 await page.context().route('**/data/optionalfeatures.json',route=>route.fulfill({json:{optionalfeature:body.optionalfeature}}));
 await page.context().route('**/data/spells/index.json',route=>route.fulfill({json:{PHB:'spells-invocation.json'}}));
 await page.context().route('**/data/spells/spells-invocation.json',route=>route.fulfill({json:{spell:body.spell}}));
}
async function saved(page:Page){return page.evaluate(async()=>{
 const path='/card/src/platform/workspaceIdentity.ts',name=(await import(path)).workspaceIdentity.database;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{const workspace=await new Promise<any>((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return workspace.characters.find((c:any)=>c.id===workspace.activeId);}finally{db.close();}
});}
async function tab(page:Page,name:string){const control=page.getByRole('tab',{name,exact:true});await control.click();await expect(control).toHaveAttribute('aria-selected','true');return page.locator('.paper[data-active-sheet="true"]');}
async function ready(page:Page,manualSpell=false){
 await mock(page);await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];const entries:Entry[]=Object.entries(invocationData).flatMap(([category,rows])=>rows.map(raw=>({id:`invocation-fixture:${category}:${raw.name}`,name:raw.name,english:raw.ENG_name,source:raw.source,edition:'2014' as const,kind:(category==='classFeature'||category==='optionalfeature'?'feature':category) as Entry['kind'],packId:'fixture',revision:'1',entries:[],raw:{...raw,_category:category}})));c.selections=[{id:'warlock',entry:entries.find(e=>e.kind==='class')!,level:5,quantity:1,equipped:false},{id:'invocations-source',entry:entries.find(e=>e.raw._category==='classFeature')!,level:1,quantity:1,equipped:false,parentId:'warlock',grantKey:'ref:魔能祈唤|魔契师||2'}];c.name='祈唤交互验收';c.notes='保留手工技能与施法位';c.proficiencies={insight:true};c.abilities.cha=10;c.runtime.resources['pact-slot:3']={max:2,current:1};c.runtime.hp=3;
 // An independent authored spell uses the catalog's canonical identity, not the
 // import fixture ID. Its selection and manual counter never belong to a grant.
 if(manualSpell){const entry=await page.evaluate(async raw=>{const path='/card/src/data/catalog.ts';return (await import(path)).normalizeData({spell:[raw]},'1')[0];},invocationData.spell.find(row=>row.ENG_name==='Silent Image')!);c.selections.push({id:'manual-silent-image',entry,level:1,quantity:1,equipped:false});c.runtime.resources['manual-invocation-check']={name:'手工保留资源',max:7,current:2};}
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'invocations-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true});await expect(review).toContainText('导入后保留该角色自己的规则版本');await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();
 await expect(page.getByRole('tab',{name:/祈唤交互验收（导入）/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});if(await toggle.getAttribute('aria-checked')!=='true')await toggle.click();
 const database=await page.evaluate(async()=>{const path='/card/src/platform/workspaceIdentity.ts';return (await import(path)).workspaceIdentity.database;});await restoreAuthoredChoices(page,database,{warlock:true});
}
async function learning(page:Page){
 if((page.viewportSize()?.width||0)<=760){const main=page.getByRole('button',{name:'功能页',exact:true});if(await main.isVisible())await main.click();}
 const panel=await tab(page,'特性'),workspace=panel.getByRole('region',{name:'选择魔能祈唤',exact:true}),record=panel.locator('[data-class-choice="warlock:class-optional:0"]');await expect(record).toBeVisible();
 // A completed third drop leaves the real workspace open while the redundant
 // choice chip automatically hides. Return to the visible sheet and reuse it.
 if(await workspace.isVisible())return workspace;
 const entrance=record.locator('[data-choice-id="warlock:class-optional:0"]');
 // Reopening completed choices follows the same visible title menu as players;
 // never inject the presentation setting or assume the unfinished chip survives.
 if(!await entrance.isVisible()){
  await panel.locator('.detail-class-features .feature-group h4').getByRole('button',{name:'职业 魔契师 Lv.5',exact:true}).click({button:'right'});
  await page.getByRole('menuitem',{name:'显示自带选项',exact:true}).click();
 }
 await entrance.click();await expect(workspace).toBeVisible();return workspace;
}
async function drag(page:Page,workspace:Locator,name:string,index:number){
 if((page.viewportSize()?.width||0)<=760)await workspace.getByRole('button',{name:'打开候选资料',exact:true}).click();
 const row=page.locator('.catalog-row').filter({has:page.locator('.entry-name').filter({hasText:new RegExp(`^${name}(?:\\s|$)`)})}).first();await expect(row).toBeVisible();await row.scrollIntoViewIfNeeded();const from=await row.boundingBox();await page.mouse.move(from!.x+25,from!.y+from!.height/2);await page.mouse.down();await page.mouse.move(from!.x+40,from!.y+from!.height/2,{steps:3});
 const slot=workspace.locator('.choice-slot').nth(index);await slot.scrollIntoViewIfNeeded();const to=await slot.boundingBox();await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:15});await page.mouse.up();await expect(page.locator('.pointer-ghost')).toHaveCount(0);
 // Narrow Wiki drops can leave the old workspace. Reopen the actual player
 // entrance before asserting instead of waiting on a detached former slot.
 if((page.viewportSize()?.width||0)<=760)workspace=await learning(page);
 await expect(workspace.locator('.choice-slot').nth(index)).toContainText(name);
}
async function closeLearning(page:Page,workspace:Locator){if((page.viewportSize()?.width||0)<=760){const main=page.getByRole('button',{name:'功能页',exact:true});if(await main.isVisible())await main.click();}await workspace.getByRole('button',{name:'收起选择',exact:true}).click();}
async function skill(page:Page,name:string,value:string,proficient:boolean){
 const panel=await tab(page,'主要'),row=panel.locator('.ability-skill').filter({has:page.locator(`span[title="${name}"]`)});await expect(row.locator('b').first()).toHaveText(value);await expect(row.locator('.proficiency-explanation')).toContainText(`${name}当前生效：${proficient?'熟练':'无熟练'}`);
}
async function freeCast(page:Page,name:string,owner?:string){
 const before=await saved(page),panel=await tab(page,'法术'),scope=owner?panel.locator('.source-spell-group').filter({has:page.locator('h4').filter({hasText:`来自${owner}`})}):panel,badge=scope.getByRole('button',{name:`${name}施放详情`,exact:true});await expect(badge).toContainText('免费 · 随意');await badge.click();const detail=page.getByRole('dialog',{name:`${name}施放详情`,exact:true});await expect(detail).toContainText('免费施法');await detail.getByRole('button',{name:'使用',exact:true}).click();await expect.poll(async()=>(await saved(page)).runtime.automationActions?.sequence||0).toBe((before.runtime.automationActions?.sequence||0)+1);
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
 const other=await context.newPage();await mock(other);await other.goto('/card/?intro=0');const readonly=await tab(other,'特性');await expect(readonly.locator('[data-class-choice="warlock:class-optional:0"] [data-choice-id="warlock:class-optional:0"]')).toBeDisabled();const before=await saved(other);await expect(readonly).toContainText('仅对自身');expect(await saved(other)).toEqual(before);await other.close();await page.screenshot({path:info.outputPath('invocation-free-armor.png'),fullPage:true});
});


const spellInvocations=[
 {name:'野兽之语',english:'Beast Speech',spell:'动物交谈',spellEnglish:'Speak with Animals',boundary:'交流内容与说服结果仍手动处理'},
 {name:'千面之脸',english:'Mask of Many Faces',spell:'易容术',spellEnglish:'Disguise Self',boundary:'外貌变化、持续时间与识破检定仍手动处理'},
 {name:'迷雾幻影',english:'Misty Visions',spell:'无声幻影',spellEnglish:'Silent Image',boundary:'目标位置、影像变化、专注、持续时间与识破交互仍手动处理'},
];
async function learnSpellInvocations(page:Page){
 let workspace=await learning(page);
 for(const [index,row] of spellInvocations.entries())await drag(page,workspace,row.name,index);
 await closeLearning(page,workspace);
 const panel=await tab(page,'特性'),records=panel.locator('[data-class-choice="warlock:class-optional:0"]');
 for(const row of spellInvocations)await expect(records).toContainText(row.boundary);
 await expect(records).toContainText('不消耗法术位和材料成分');
 await expect.poll(async()=>(await saved(page)).selections.filter((row:any)=>row.grantKey?.startsWith('source-spell:')).length).toBe(3);
 const card=await saved(page);
 // Bind through canonical source identity and the saved ownership receipt. The
 // imported class snapshot and catalog records intentionally have different IDs.
 return spellInvocations.map(rule=>{
  const owners=card.selections.filter((row:any)=>row.entry.english===rule.english&&row.entry.source==='PHB'&&row.entry.edition==='2014'&&row.grantKey?.startsWith('choice:'));
  expect(owners).toHaveLength(1);const owner=owners[0];expect(card.answers[owner.requirementId]).toContain(owner.entry.id);
  const grants=card.selections.filter((row:any)=>row.parentId===owner.id&&row.entry.english===rule.spellEnglish&&row.grantKey?.startsWith('source-spell:'));
  expect(grants).toHaveLength(1);const grant=grants[0];expect(card.spellSettings.special[grant.id].sourceGrant).toMatchObject({ownerId:owner.id,key:grant.grantKey,active:true,usage:'free'});
  return {ownerId:owner.id,spellId:grant.id};
 });
}
async function manualSpellCounter(page:Page){
 // This minimal class metadata has no known-spell progression: the imported
 // independent spell is in the visible library, not a class-known spell slot.
 const panel=await tab(page,'法术'),tile=panel.locator('.spell-library [data-spell-id="manual-silent-image"]');await expect(tile).toBeVisible();await tile.click({button:'right'});
 await page.getByRole('menuitem',{name:'设置免费施放次数',exact:true}).click();
 const group=panel.locator('[data-source-cantrip-group="manual"]');await group.getByRole('button',{name:'无声幻影施放详情',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'无声幻影施放详情',exact:true});await detail.getByLabel('次数上限',{exact:true}).fill('3');await detail.getByLabel('次数上限',{exact:true}).press('Enter');
 await detail.getByLabel('无声幻影剩余次数',{exact:true}).fill('1');await detail.getByLabel('无声幻影剩余次数',{exact:true}).press('Enter');await detail.getByRole('button',{name:'关闭施放详情',exact:true}).click();
 await expect(group.getByRole('button',{name:'无声幻影施放详情',exact:true})).toContainText('免费 1/3');
 await expect.poll(async()=>(await saved(page)).runtime.resources['innate-spell:manual-silent-image']?.current).toBe(1);
}
async function source(page:Page,enabled:boolean){
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expandSourceBook(page,'PHB');
 const book=page.locator('.source-book').filter({has:page.locator('button[aria-label="设置来源 PHB"]')});await book.locator('input[type=checkbox]').first().setChecked(enabled);await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
}
function manualStatePreserved(card:any,before:any){
 expect(card.selections.find((row:any)=>row.id==='manual-silent-image')).toEqual(before.selections.find((row:any)=>row.id==='manual-silent-image'));
 expect(card.spellSettings.special['manual-silent-image']).toEqual(before.spellSettings.special['manual-silent-image']);
 expect(card.runtime.resources).toEqual(before.runtime.resources);expect(card.runtime.hp).toBe(before.runtime.hp);expect(card.notes).toBe(before.notes);expect(card.proficiencies).toEqual(before.proficiencies);
 expect(card.selections.filter((row:any)=>row.entry.kind==='condition')).toEqual(before.selections.filter((row:any)=>row.entry.kind==='condition'));
}

test('three learned at-will spells cast, reopen and revoke without adopting an independent manual spell or its uses',async({page},info)=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page,true);await manualSpellCounter(page);const before=await saved(page),ids=await learnSpellInvocations(page);
 for(const row of spellInvocations)await freeCast(page,row.spell,row.name);
 // A second use is still at will, including an independently configured
 // same-name spell whose manual resource must not be selected as payment.
 await freeCast(page,'无声幻影','迷雾幻影');manualStatePreserved(await saved(page),before);
 await page.reload();for(const row of spellInvocations)await freeCast(page,row.spell,row.name);
 const reopened=await saved(page);for(const id of ids){expect(reopened.selections.some((row:any)=>row.id===id.ownerId)).toBe(true);expect(reopened.selections.some((row:any)=>row.id===id.spellId)).toBe(true);}
 let workspace=await learning(page);await drag(page,workspace,'魔能视界',0);await closeLearning(page,workspace);
 await expect.poll(async()=>(await saved(page)).selections.some((row:any)=>row.id===ids[0].spellId)).toBe(false);
 let panel=await tab(page,'法术');await expect(panel.getByRole('button',{name:'动物交谈施放详情',exact:true})).toHaveCount(0);await freeCast(page,'侦测魔法','魔能视界');
 const replacementCard=await saved(page),replacementOwner=replacementCard.selections.find((row:any)=>row.entry.english==='Eldritch Sight'&&row.grantKey?.startsWith('choice:'));expect(replacementOwner).toBeDefined();
 const replacementTree=replacementCard.selections.filter((row:any)=>row.id===replacementOwner.id||row.parentId===replacementOwner.id);expect(replacementTree).toHaveLength(2);
 for(const name of ['千面之脸','迷雾幻影','魔能视界']){workspace=await learning(page);await workspace.getByRole('button',{name:`移除${name}`,exact:true}).click();await closeLearning(page,workspace);}
 await expect.poll(async()=>(await saved(page)).selections.filter((row:any)=>row.grantKey?.startsWith('source-spell:')).length).toBe(0);
 await page.reload();panel=await tab(page,'法术');await expect(panel.locator('[data-source-spell="true"]')).toHaveCount(0);await expect(panel.locator('[data-source-cantrip-group="manual"]').getByRole('button',{name:'无声幻影施放详情',exact:true})).toContainText('免费 1/3');
 const after=await saved(page);
 // Archival intentionally retains old special-spell settings for restoration.
 // Authorization requires an active selection, not that preserved config flag.
 for(const id of ids){
  expect(after.selections.some((row:any)=>row.id===id.ownerId||row.id===id.spellId)).toBe(false);
  const archive=after.classChoiceArchive[id.ownerId];expect(archive.choiceId).toBe('warlock:class-optional:0');
  for(const rowId of [id.ownerId,id.spellId])expect(archive.selections.find((row:any)=>row.id===rowId)).toEqual(reopened.selections.find((row:any)=>row.id===rowId));
 }
 expect(after.classChoiceArchive[replacementOwner.id].selections).toEqual(replacementTree);
 expect(after.selections.some((row:any)=>replacementTree.some((previous:any)=>previous.id===row.id))).toBe(false);
 const archivedIds=Object.values(after.classChoiceArchive).flatMap((archive:any)=>archive.selections.filter((row:any)=>row.grantKey?.startsWith('source-spell:')).map((row:any)=>({spellId:row.id})));expect(archivedIds).toHaveLength(4);
 // The UI has removed every granted action. Probe stale action IDs with current
 // revision/sequence on detached saved-card copies, never by editing live state.
 const denied=await page.evaluate(async({card,ids})=>{
  const actionsPath='/card/src/core/automation/actions.ts',statePath='/card/src/core/automation/sourceSpellState.ts';
  const {spellPayments,spellActionRequest,performSpellAction}=await import(actionsPath),{sourceSpellEnabled}=await import(statePath);
  return ids.map((id,index)=>{const copy=structuredClone(card),before=JSON.stringify(copy),enabled=sourceSpellEnabled(copy,id.spellId),offer=spellPayments(copy,id.spellId),result=performSpellAction(copy,spellActionRequest(copy,id.spellId,'free',`revoked-at-will-${index}`));return {enabled,offer,result,unchanged:JSON.stringify(copy)===before};});
 },{card:after,ids:archivedIds});
 for(const result of denied){expect(result.enabled).toBe(false);expect(result.offer.options).toEqual([]);expect(result.result).toMatchObject({status:'rejected',message:'此来源法术当前不可用。'});expect(result.unchanged).toBe(true);}
 expect(await saved(page)).toEqual(after);manualStatePreserved(after,before);
 await page.screenshot({path:info.outputPath('invocation-three-spells-manual-preserved.png'),fullPage:true});expect(errors).toEqual([]);
});

test('three at-will grants suspend with their source and restore exact ownership while readonly casting cannot commit',async({page,context},info)=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);const ids=await learnSpellInvocations(page);for(const row of spellInvocations)await freeCast(page,row.spell,row.name);
 const active=await saved(page),answers=active.answers['warlock:class-optional:0'];
 const other=await context.newPage();await mock(other);await other.goto('/card/?intro=0');const readonly=await tab(other,'特性');
 await expect(other.locator('.card-permission-banner')).toContainText('另一标签页正在编辑');await expect(other.getByRole('switch',{name:'编辑模式',exact:true})).toBeDisabled();
 // All three records remain readable. Completed choices have a text heading,
 // not the disabled unfinished-choice chip used by the older one-slot case.
 const readonlyRecords=readonly.locator('[data-class-choice="warlock:class-optional:0"]');for(const row of spellInvocations)await expect(readonlyRecords.getByRole('button',{name:row.name,exact:true})).toBeVisible();
 await expect(readonlyRecords.locator('[data-choice-id="warlock:class-optional:0"]:not([disabled])')).toHaveCount(0);
 const readonlyBefore=await saved(other),spells=await tab(other,'法术');await spells.getByRole('button',{name:'无声幻影施放详情',exact:true}).click();const detail=other.getByRole('dialog',{name:'无声幻影施放详情',exact:true});await expect(detail.getByRole('button',{name:'使用',exact:true})).toBeDisabled();await expect(detail.locator('.spell-action-feedback')).not.toHaveAttribute('data-phase','applied');expect(await saved(other)).toEqual(readonlyBefore);await other.close();
 await source(page,false);await expect.poll(async()=>(await saved(page)).selections.filter((row:any)=>row.grantKey?.startsWith('source-spell:')).length).toBe(0);
 let panel=await tab(page,'特性');await expect(panel.locator('[data-class-choice="warlock:class-optional:0"]')).toContainText('来源未启用，原记录保留');
 await page.reload();panel=await tab(page,'法术');for(const row of spellInvocations)await expect(panel.getByRole('button',{name:`${row.spell}施放详情`,exact:true})).toHaveCount(0);
 const suspended=await saved(page);expect(suspended.answers['warlock:class-optional:0']).toEqual(answers);expect(suspended.runtime.resources).toEqual(active.runtime.resources);expect(suspended.runtime.automationActions).toEqual(active.runtime.automationActions);
 for(const id of ids)expect(suspended.classChoiceArchive[id.ownerId].selections.some((row:any)=>row.id===id.spellId)).toBe(true);
 await page.screenshot({path:info.outputPath('invocation-three-spells-source-suspended.png'),fullPage:true});
 await source(page,true);await expect.poll(async()=>(await saved(page)).selections.filter((row:any)=>row.grantKey?.startsWith('source-spell:')).length).toBe(3);
 await page.reload();for(const row of spellInvocations)await freeCast(page,row.spell,row.name);
 const restored=await saved(page);expect(restored.answers['warlock:class-optional:0']).toEqual(answers);for(const id of ids){expect(restored.selections.some((row:any)=>row.id===id.ownerId)).toBe(true);expect(restored.selections.some((row:any)=>row.id===id.spellId)).toBe(true);expect(restored.spellSettings.special[id.spellId].sourceGrant).toMatchObject({ownerId:id.ownerId,active:true,usage:'free'});}
 expect(restored.runtime.resources).toEqual(active.runtime.resources);expect(restored.runtime.hp).toBe(active.runtime.hp);expect(restored.notes).toBe(active.notes);expect(errors).toEqual([]);
});
