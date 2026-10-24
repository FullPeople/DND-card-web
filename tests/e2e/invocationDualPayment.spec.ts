import {test,expect,type Page,type Locator} from '@playwright/test';
import {mockSource,suppressAnnouncement,expandSourceBook} from './fixtures';
import {restoreAuthoredChoices} from './authoredChoicesFixture';
import {invocationDualPaymentCases as cases,invocationDualPaymentData as data} from '../fixtures/invocationDualPaymentData';
import {newCharacter,type Character,type Entry,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';

const choiceId='warlock:class-optional:0';
const manualSpellId='manual-bane';
type Learned={ownerId:string;spellId:string;resourceId:string};
const pactId='pact-slot:5';
const restoreLabel='确认已长休，恢复本祈唤次数';

async function mock(page:Page){
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local test'}}));
 await page.route('**/data/class/index.json',route=>route.fulfill({json:{invocation:'class-dual-payment-invocation.json'}}));
 await page.route('**/data/class/class-dual-payment-invocation.json',route=>route.fulfill({json:{class:data.class,classFeature:data.classFeature}}));
 await page.route('**/data/optionalfeatures.json',route=>route.fulfill({json:{optionalfeature:data.optionalfeature}}));
 await page.route('**/data/spells/index.json',route=>route.fulfill({json:{PHB:'spells-dual-payment-invocation.json'}}));
 await page.route('**/data/spells/spells-dual-payment-invocation.json',route=>route.fulfill({json:{spell:data.spell}}));
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
async function editor(page:Page){const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});if(await toggle.getAttribute('aria-checked')!=='true')await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','true');}
async function ready(page:Page,options:{level?:number;manualSpell?:boolean;secondaryClass?:boolean}={}){
 await mock(page);await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];
 const entries:Entry[]=Object.entries(data).flatMap(([category,rows])=>rows.map(raw=>({id:`dual-payment-fixture:${category}:${raw.name}`,name:raw.name,english:raw.ENG_name,source:raw.source,edition:'2014' as const,kind:(category==='classFeature'||category==='optionalfeature'?'feature':category) as Entry['kind'],packId:'authored-dual-payment',revision:'1',entries:[],raw:{...raw,_category:category}})));
 c.selections=[{id:'warlock',entry:entries.find(e=>e.kind==='class')!,level:options.level??15,quantity:1,equipped:false},{id:'invocations-source',entry:entries.find(e=>e.raw._category==='classFeature')!,level:1,quantity:1,equipped:false,parentId:'warlock',grantKey:'ref:魔能祈唤|魔契师||2'}];
 c.name='双支付祈唤交互验收';c.notes='目标、材料、豁免、专注和法术效果仍由玩家处理';c.proficiencies={insight:true};c.abilities.str=14;c.baseHp=42;c.sheetBonuses={speed:5};c.runtime.hp=17;c.runtime.tempHp=4;
 c.runtime.resources['pact-slot:5']={max:3,current:3};
 c.runtime.resources['manual-dual-payment-check']={name:'手工保留资源',max:7,current:2};
 c.runtime.resources['spell-slot:3']={name:'手工三环法术位',max:3,current:3};
 const authored=(id:string,kind:Entry['kind'],name:string):Selection=>({id,entry:{id:`${id}-entry`,kind,name,english:name,source:'PHB',edition:'2014',packId:'authored-dual-payment',revision:'1',entries:[],raw:{_category:kind}},level:1,quantity:2,equipped:false});
 c.selections.push(authored('manual-materials','item','手工材料包'),authored('manual-condition','condition','手工状态记录'));
 if(options.secondaryClass){const secondary=authored('secondary-class','class','原创副职');secondary.quantity=1;secondary.entry.raw.hd={faces:6};c.selections.push(secondary);c.profile.optional.multiclass=true;}
 if(options.manualSpell){
  // Canonical catalog identity is intentionally shared with the granted spell,
  // while the independent selection and counter have different ownership.
  const entry=await page.evaluate(async raw=>{const path='/card/src/data/catalog.ts';return (await import(path)).normalizeData({spell:[raw]},'1')[0];},data.spell.find(row=>row.ENG_name==='Bane')!);
  c.selections.push({id:manualSpellId,entry,level:1,quantity:1,equipped:false});
 }
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'dual-payment-invocations-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true});await expect(review).toContainText('导入后保留该角色自己的规则版本');await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();
 await expect(page.getByRole('tab',{name:/双支付祈唤交互验收（导入）/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await expect(page.locator('.save-status')).toContainText('已保存到本机');await editor(page);
 // This existing fixture only resumes presentation of imported blank choices.
 // Every learned choice, level change, replacement and cast below uses real UI.
 const database=await page.evaluate(async()=>{const path='/card/src/platform/workspaceIdentity.ts';return (await import(path)).workspaceIdentity.database;});await restoreAuthoredChoices(page,database,{warlock:true});
 await expect.poll(async()=>(await saved(page)).selections.find(row=>row.id==='warlock')?.level).toBe(options.level??15);
}
async function learning(page:Page){
 if((page.viewportSize()?.width||0)<=760){const main=page.getByRole('button',{name:'功能页',exact:true});if(await main.isVisible())await main.click();}
 await editor(page);const panel=await tab(page,'特性'),workspace=panel.getByRole('region',{name:'选择魔能祈唤',exact:true}),record=panel.locator(`[data-class-choice="${choiceId}"]`);await expect(record).toBeVisible();
 if(await workspace.isVisible())return workspace;
 const entrance=record.locator(`[data-choice-id="${choiceId}"]`);
 if(!await entrance.isVisible()){
  const level=(await saved(page)).selections.find(row=>row.id==='warlock')!.level;
  await panel.locator('.detail-class-features .feature-group h4').getByRole('button',{name:`职业 魔契师 Lv.${level}`,exact:true}).click({button:'right'});
  await page.getByRole('menuitem',{name:'显示自带选项',exact:true}).click();
 }
 await entrance.click();await expect(workspace).toBeVisible();return workspace;
}
async function drag(page:Page,workspace:Locator,name:string,index:number,accepted=true){
 if((page.viewportSize()?.width||0)<=760)await workspace.getByRole('button',{name:'打开候选资料',exact:true}).click();
 const row=page.locator('.catalog-row').filter({has:page.locator('.entry-name').filter({hasText:new RegExp(`^${name}(?:\\s|$)`)})}).first();await expect(row).toBeVisible();await row.scrollIntoViewIfNeeded();const from=await row.boundingBox();expect(from).not.toBeNull();
 await page.mouse.move(from!.x+25,from!.y+from!.height/2);await page.mouse.down();await page.mouse.move(from!.x+40,from!.y+from!.height/2,{steps:3});
 const slot=workspace.locator('.choice-slot').nth(index);await slot.scrollIntoViewIfNeeded();const to=await slot.boundingBox();expect(to).not.toBeNull();await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:15});await page.mouse.up();await expect(page.locator('.pointer-ghost')).toHaveCount(0);
 if(!accepted)await expect(page.locator('.suite-toast')).toContainText('此条目不属于当前可选内容');
 // Explicitly return to the live narrow-screen sheet after a Wiki drag. The
 // stale pre-drop workspace must never stand in for visible player navigation.
 if((page.viewportSize()?.width||0)<=760)workspace=await learning(page);
 if(accepted)await expect(workspace.locator('.choice-slot').nth(index)).toContainText(name);
 else await expect(workspace.locator('.choice-slot').nth(index)).toContainText('等待拖拽加入');
 return workspace;
}
async function closeLearning(page:Page,workspace:Locator){
 if((page.viewportSize()?.width||0)<=760){const main=page.getByRole('button',{name:'功能页',exact:true});if(await main.isVisible())await main.click();}
 await workspace.getByRole('button',{name:'收起选择',exact:true}).click();
}
async function level(page:Page,value:number){
 await editor(page);const panel=await tab(page,'特性'),input=panel.getByRole('spinbutton',{name:'魔契师等级',exact:true});await input.fill(String(value));await input.press('Tab');
 await expect(input).toHaveValue(String(value));await expect.poll(async()=>(await saved(page)).selections.find(row=>row.id==='warlock')?.level).toBe(value);await expect(page.locator('.save-status')).toContainText('已保存到本机');
}
function protectedState(card:Character,before:Character){
 for(const field of ['notes','abilities','baseHp','sheetBonuses','proficiencies','inventory'] as const)expect(card[field]).toEqual(before[field]);
 for(const field of ['hp','tempHp','inspiration','deathSaves'] as const)expect(card.runtime[field]).toEqual(before.runtime[field]);
 for(const id of ['manual-materials','manual-condition',manualSpellId])expect(card.selections.find(row=>row.id===id)).toEqual(before.selections.find(row=>row.id===id));
 expect(card.spellSettings?.special?.[manualSpellId]).toEqual(before.spellSettings?.special?.[manualSpellId]);
 for(const id of ['manual-dual-payment-check','spell-slot:3',`innate-spell:${manualSpellId}`])expect(card.runtime.resources[id]).toEqual(before.runtime.resources[id]);
 expect(card.selections.filter(row=>row.entry.kind==='condition')).toEqual(before.selections.filter(row=>row.entry.kind==='condition'));
}
function liveGrants(card:Character):Learned[]{
 return cases.map(rule=>{
  const owners=card.selections.filter(row=>row.entry.english===rule.english&&row.entry.source==='PHB'&&row.entry.edition==='2014'&&row.grantKey?.startsWith('choice:'));expect(owners).toHaveLength(1);const owner=owners[0];
  expect(owner.requirementId).toBe(choiceId);expect(card.answers[choiceId]).toContain(owner.entry.id);expect(owner.parentId).toBe('invocations-source');
  const grants=card.selections.filter(row=>row.parentId===owner.id&&row.entry.english===rule.spellEnglish&&row.grantKey?.startsWith('source-spell:'));expect(grants).toHaveLength(1);const grant=grants[0];
  expect(grant.entry.raw.level).toBe(rule.level);expect(grant.entry.source).toBe('PHB');expect(grant.entry.edition).toBe('2014');
  expect(card.spellSettings?.special?.[grant.id]).toMatchObject({mode:'uses',max:1,recovery:'long',sourceGrant:{ownerId:owner.id,key:grant.grantKey,active:true,usage:'invocation-pact',canUseSlots:false}});
  const resourceId=card.spellSettings!.special![grant.id].sourceGrant!.resourceKey||`innate-spell:${grant.id}`;expect(card.runtime.resources[resourceId]).toMatchObject({max:1});return {ownerId:owner.id,spellId:grant.id,resourceId};
 });
}
async function learnAll(page:Page){
 let workspace=await learning(page);for(const [index,row] of cases.entries())workspace=await drag(page,workspace,row.name,index);await closeLearning(page,workspace);
 await expect.poll(async()=>(await saved(page)).selections.filter(row=>row.grantKey?.startsWith('source-spell:')).length).toBe(7);
 const panel=await tab(page,'特性'),records=panel.locator(`[data-class-choice="${choiceId}"]`);
 for(const row of cases){
  const record=records.locator(':scope > div > div').filter({has:page.getByRole('button',{name:row.name,exact:true})});await expect(record).toContainText('手动');await expect(record).toContainText('材料');
 }
 return liveGrants(await saved(page));
}
async function closeDetail(page:Page){await page.getByRole('button',{name:'关闭施放详情',exact:true}).click();}
async function detail(page:Page,row:Learned,index:number){
 const panel=await tab(page,'法术'),group=panel.locator(`[data-source-cantrip-group="${row.ownerId}"]`),badge=group.getByRole('button',{name:`${cases[index].spell}施放详情`,exact:true});
 await expect(badge).toContainText('祈唤次数');await expect(badge).not.toContainText('免费');await badge.click();
 const dialog=page.getByRole('dialog',{name:`${cases[index].spell}施放详情`,exact:true});await expect(dialog.getByRole('radiogroup')).toHaveCount(0);await expect(dialog).toContainText('同时消耗');await expect(dialog).toContainText('不豁免材料成分');await expect(dialog.getByRole('spinbutton',{name:`${cases[index].spell}剩余次数`,exact:true})).toHaveAttribute('readonly','');
 expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);return dialog;
}
async function cast(page:Page,row:Learned,index:number){
 const before=await saved(page),dialog=await detail(page,row,index),pact=before.runtime.resources[pactId],uses=before.runtime.resources[row.resourceId];
 await expect(dialog.locator(`[data-payment-resource="${row.resourceId}"]`)).toContainText(`本祈唤次数：${uses.current} / 1`);await expect(dialog.locator(`[data-payment-resource="${pactId}"]`)).toContainText(`5环契约位：${pact.current} / 3`);
 await dialog.getByRole('button',{name:'使用',exact:true}).click();await expect(dialog.locator('.spell-action-feedback')).toHaveAttribute('data-phase','applied');
 const receipt=dialog.locator('.spell-action-feedback');await expect(receipt).toContainText('5 环施法');await expect(receipt.locator('[data-spent-resource]')).toHaveCount(2);await expect(receipt.locator(`[data-spent-resource="${row.resourceId}"] .spell-action-cost`)).toHaveText(`${uses.current}→${uses.current-1}`);await expect(receipt.locator(`[data-spent-resource="${pactId}"] .spell-action-cost`)).toHaveText(`${pact.current}→${pact.current-1}`);await expect(receipt).not.toContainText('不消耗资源');
 await expect.poll(async()=>(await saved(page)).runtime.automationActions?.sequence||0).toBe((before.runtime.automationActions?.sequence||0)+1);
 const after=await saved(page),expected=structuredClone(before.runtime.resources);expected[row.resourceId].current--;expected[pactId].current--;expect(after.runtime.resources).toEqual(expected);
 expect(after.runtime.automationActions!.last).toMatchObject({selectionId:row.spellId,mode:'cast',level:5,spent:[{resourceId:row.resourceId,before:1,after:0},{resourceId:pactId,before:pact.current,after:pact.current-1}]});expect(after.runtime.automationActions!.last!.resourceId).toBeUndefined();protectedState(after,before);
 await expect(dialog.getByRole('button',{name:'使用',exact:true})).toBeDisabled();await closeDetail(page);return after;
}
async function pactBalance(page:Page,value:number,cancel=false){
 // The player uses the existing visible resource editor. No card, resource or
 // action is injected in page.evaluate to replenish the three real pact slots.
  const before=cancel?await saved(page):undefined;
 await editor(page);const panel=await tab(page,'主要'),module=panel.locator(`[data-resource-id="${pactId}"] .resource-widget-face`);await module.scrollIntoViewIfNeeded();await module.click();
 const config=page.getByRole('dialog',{name:'资源配置',exact:true});await expect(config.getByRole('spinbutton',{name:'资源上限',exact:true})).toHaveValue('3');await config.getByRole('spinbutton',{name:'资源剩余',exact:true}).fill(String(value));
  if(cancel){
   // The inline editor intentionally hides its standalone Cancel button. Use
   // the player's visible header close, which discards this unsaved draft.
   await expect(config.getByRole('spinbutton',{name:'资源剩余',exact:true})).toHaveValue(String(value));
   await config.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect(config).toHaveCount(0);expect(await saved(page)).toEqual(before);
   await module.click();await expect(config.getByRole('spinbutton',{name:'资源剩余',exact:true})).toHaveValue(String(before!.runtime.resources[pactId].current));
   await config.getByRole('button',{name:'关闭弹窗',exact:true}).click();expect(await saved(page)).toEqual(before);
  }
 else{await config.getByRole('button',{name:'保存',exact:true}).click();await expect.poll(async()=>(await saved(page)).runtime.resources[pactId]?.current).toBe(value);}
 await expect(config).toHaveCount(0);
}
async function restore(page:Page,row:Learned,index:number,accept:boolean){
 const before=await saved(page),dialog=await detail(page,row,index);await expect(dialog.getByRole('button',{name:restoreLabel,exact:true})).toBeEnabled();
 const confirmation=page.waitForEvent('dialog');const click=dialog.getByRole('button',{name:restoreLabel,exact:true}).click();const prompt=await confirmation;expect(prompt.type()).toBe('confirm');expect(prompt.message()).toContain('已经完成长休');expect(prompt.message()).toContain('不恢复契约位、生命值或其他资源');if(accept)await prompt.accept();else await prompt.dismiss();await click;
 if(accept){
  await expect(dialog.locator('.spell-action-feedback')).toHaveAttribute('data-phase','applied');await expect.poll(async()=>(await saved(page)).runtime.resources[row.resourceId]?.current).toBe(1);
  const after=await saved(page),expected=structuredClone(before.runtime.resources);expected[row.resourceId].current=1;expect(after.runtime.resources).toEqual(expected);expect(after.runtime.automationActions!.last).toMatchObject({mode:'restore',resourceId:row.resourceId,before:0,after:1});expect(after.runtime.automationActions!.last!.spent).toBeUndefined();protectedState(after,before);
 }else{await expect(dialog.locator('.spell-action-feedback')).toHaveCount(0);expect(await saved(page)).toEqual(before);}
 await closeDetail(page);
}
async function manualCounter(page:Page){
 const panel=await tab(page,'法术'),tile=panel.locator(`.spell-library [data-spell-id="${manualSpellId}"]`);await expect(tile).toBeVisible();await tile.click({button:'right'});await page.getByRole('menuitem',{name:'设置免费施放次数',exact:true}).click();
 const group=panel.locator('[data-source-cantrip-group="manual"]');await group.getByRole('button',{name:'灾祸术施放详情',exact:true}).click();const dialog=page.getByRole('dialog',{name:'灾祸术施放详情',exact:true});
 await dialog.getByLabel('次数上限',{exact:true}).fill('3');await dialog.getByLabel('次数上限',{exact:true}).press('Enter');await dialog.getByLabel('灾祸术剩余次数',{exact:true}).fill('1');await dialog.getByLabel('灾祸术剩余次数',{exact:true}).press('Enter');await closeDetail(page);
 await expect(group.getByRole('button',{name:'灾祸术施放详情',exact:true})).toContainText('免费 1/3');await expect.poll(async()=>(await saved(page)).runtime.resources[`innate-spell:${manualSpellId}`]).toMatchObject({max:3,current:1});
}
async function source(page:Page,enabled:boolean){
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expandSourceBook(page,'PHB');const book=page.locator('.source-book').filter({has:page.locator('button[aria-label="设置来源 PHB"]')});await book.locator('input[type=checkbox]').first().setChecked(enabled);await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect.poll(async()=>(await saved(page)).profile.enabledSources.includes('PHB')).toBe(enabled);
}
function exhausted(card:Character,rows:Learned[]){for(const row of rows)expect(card.runtime.resources[row.resourceId]).toMatchObject({max:1,current:0});}

test('seven legal learned invocations each pay a separate long-rest use and one real pact slot at its current level',async({page},info)=>{
 test.setTimeout(210000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);const rows=await learnAll(page),initial=await saved(page);
 expect(initial.selections.find(row=>row.id==='warlock')!.level).toBe(15);expect(initial.answers[choiceId]).toHaveLength(7);expect(initial.runtime.resources[pactId]).toMatchObject({max:3,current:3});expect(new Set(rows.map(row=>row.resourceId)).size).toBe(7);
 for(let index=0;index<cases.length;index++){
  if(index===3||index===6){
   const before=await saved(page),dialog=await detail(page,rows[index],index);await expect(dialog.getByRole('button',{name:'使用',exact:true})).toBeDisabled();await expect(dialog).toContainText('契约位不足');await expect(dialog.locator(`[data-payment-resource="${rows[index].resourceId}"]`)).toContainText('1 / 1');expect(before.runtime.resources['spell-slot:3']).toMatchObject({max:3,current:3});expect(await saved(page)).toEqual(before);await closeDetail(page);await pactBalance(page,3);
  }
  const after=await cast(page,rows[index],index);exhausted(after,rows.slice(0,index+1));for(const row of rows.slice(index+1))expect(after.runtime.resources[row.resourceId].current).toBe(1);
 }
 const complete=await saved(page);expect(complete.runtime.resources[pactId]).toMatchObject({max:3,current:2});exhausted(complete,rows);protectedState(complete,initial);
 const blocked=await detail(page,rows[0],0);await expect(blocked).toContainText('祈唤长休次数不足');await expect(blocked.getByRole('button',{name:'使用',exact:true})).toBeDisabled();expect(await saved(page)).toEqual(complete);await closeDetail(page);
 await page.reload();expect(liveGrants(await saved(page))).toEqual(rows);exhausted(await saved(page),rows);expect((await saved(page)).runtime.resources).toEqual(complete.runtime.resources);await detail(page,rows[6],6);await page.screenshot({path:info.outputPath('dual-payment-seven-independent-invocations.png'),fullPage:true});expect(errors).toEqual([]);
});

test('explicit long-rest confirmation restores only one invocation; cancel, manual same-name data and app reopen preserve both balances',async({page:initialPage,context},info)=>{
 test.setTimeout(210000);let page=initialPage;const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page,{manualSpell:true});await manualCounter(page);const manual=await saved(page),rows=await learnAll(page);await cast(page,rows[0],0);await cast(page,rows[1],1);await cast(page,rows[2],2);
 const spent=await saved(page);await restore(page,rows[0],0,false);expect(await saved(page)).toEqual(spent);await pactBalance(page,3,true);expect(await saved(page)).toEqual(spent);
 await restore(page,rows[0],0,true);const recovered=await saved(page);expect(recovered.runtime.resources[pactId].current).toBe(0);exhausted(recovered,rows.slice(1,3));for(const row of rows.slice(3))expect(recovered.runtime.resources[row.resourceId].current).toBe(1);protectedState(recovered,manual);
 const blocked=await detail(page,rows[0],0);await expect(blocked).toContainText('契约位不足');await expect(blocked.getByRole('button',{name:'使用',exact:true})).toBeDisabled();await expect(blocked.getByRole('button',{name:restoreLabel,exact:true})).toBeDisabled();await closeDetail(page);
 await page.reload();expect((await saved(page)).runtime.resources).toEqual(recovered.runtime.resources);expect((await saved(page)).runtime.automationActions).toEqual(recovered.runtime.automationActions);
 await page.close();page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await mock(page);await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');expect(liveGrants(await saved(page))).toEqual(rows);expect((await saved(page)).runtime.resources).toEqual(recovered.runtime.resources);
 await pactBalance(page,3);await cast(page,rows[0],0);const final=await saved(page);exhausted(final,rows.slice(0,3));protectedState(final,manual);
 const panel=await tab(page,'法术');await expect(panel.locator('[data-source-cantrip-group="manual"]').getByRole('button',{name:'灾祸术施放详情',exact:true})).toContainText('免费 1/3');await page.screenshot({path:info.outputPath('dual-payment-single-restore-manual-protection.png'),fullPage:true});expect(errors).toEqual([]);
});

test('source suspension, reduced legal choice capacity and readonly viewing never refill or spend retained invocation resources',async({page,context},info)=>{
 test.setTimeout(210000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);const rows=await learnAll(page);await cast(page,rows[0],0);await cast(page,rows[6],6);const active=await saved(page);
 const other=await context.newPage();other.on('pageerror',error=>errors.push(error.message));await mock(other);await other.goto('/card/?intro=0');await expect(other.locator('.card-permission-banner')).toContainText('另一标签页正在编辑');await expect(other.getByRole('switch',{name:'编辑模式',exact:true})).toBeDisabled();const readonlyBefore=await saved(other);
 for(const index of [0,1]){const dialog=await detail(other,rows[index],index);await expect(dialog.getByRole('button',{name:'使用',exact:true})).toBeDisabled();await expect(dialog.getByRole('button',{name:restoreLabel,exact:true})).toBeDisabled();await expect(dialog).toContainText('当前为只读');expect(await saved(other)).toEqual(readonlyBefore);await closeDetail(other);}
 await other.close();expect(await saved(page)).toEqual(active);
 await source(page,false);await expect.poll(async()=>(await saved(page)).selections.filter(row=>row.grantKey?.startsWith('source-spell:')).length).toBe(0);const suspended=await saved(page);expect(suspended.answers[choiceId]).toEqual(active.answers[choiceId]);expect(suspended.runtime.resources).toEqual(active.runtime.resources);expect(suspended.runtime.automationActions).toEqual(active.runtime.automationActions);protectedState(suspended,active);
 await page.reload();await source(page,true);await expect.poll(async()=>(await saved(page)).selections.filter(row=>row.grantKey?.startsWith('source-spell:')).length).toBe(7);expect(liveGrants(await saved(page))).toEqual(rows);exhausted(await saved(page),[rows[0],rows[6]]);
 // Warlock 14 has six legal invocation choices but the same three fifth-level
 // pact slots. This isolates archive restoration from unrelated slot resizing.
 await level(page,14);await expect.poll(async()=>(await saved(page)).selections.some(row=>row.id===rows[6].spellId)).toBe(false);const lowered=await saved(page);expect(lowered.classChoiceArchive?.[rows[6].ownerId]?.choiceId).toBe(choiceId);expect(lowered.answers[choiceId]).toEqual(active.answers[choiceId]);exhausted(lowered,[rows[0],rows[6]]);expect(lowered.runtime.resources[pactId]).toEqual(active.runtime.resources[pactId]);
 await page.reload();await level(page,15);await expect.poll(async()=>(await saved(page)).selections.filter(row=>row.grantKey?.startsWith('source-spell:')).length).toBe(7);expect(liveGrants(await saved(page))).toEqual(rows);const returned=await saved(page);expect(returned.runtime.resources).toEqual(active.runtime.resources);expect(returned.runtime.automationActions).toEqual(active.runtime.automationActions);protectedState(returned,active);
 const dialog=await detail(page,rows[6],6);await expect(dialog.getByRole('button',{name:'使用',exact:true})).toBeDisabled();await expect(dialog).toContainText('祈唤长休次数不足');await page.screenshot({path:info.outputPath('dual-payment-readonly-and-archive-restoration.png'),fullPage:true});expect(errors).toEqual([]);
});

test('a failed local save leaves both old balances and receipt on disk; the next save persists both complete payments once',async({page},info)=>{
 test.setTimeout(210000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);const rows=await learnAll(page),before=await saved(page);
 // Reuse the established storage-failure boundary, not a replacement payment
 // implementation. The real UI and actual IndexedDB save pipeline still run.
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;(window as any).rejectDualPaymentSave=true;IDBObjectStore.prototype.put=function(...args:any[]){if((window as any).rejectDualPaymentSave&&this.name==='documents'&&args[1]==='workspace')throw new DOMException('injected dual payment storage failure','QuotaExceededError');return original.apply(this,args as any);};});
 let dialog=await detail(page,rows[0],0);await dialog.getByRole('button',{name:'使用',exact:true}).click();await expect(dialog.locator('.spell-action-feedback')).toHaveAttribute('data-phase','applied');await expect(dialog.locator('[data-spent-resource]')).toHaveCount(2);await expect(dialog.locator(`[data-payment-resource="${rows[0].resourceId}"]`)).toContainText('0 / 1');await expect(dialog.locator(`[data-payment-resource="${pactId}"]`)).toContainText('2 / 3');await expect(page.locator('.save-status')).toContainText('保存失败');await expect(dialog.locator('.action-save-state')).toContainText('保存失败');expect(await saved(page)).toEqual(before);await closeDetail(page);
 await page.evaluate(()=>{(window as any).rejectDualPaymentSave=false;});dialog=await detail(page,rows[1],1);await dialog.getByRole('button',{name:'使用',exact:true}).click();await expect(dialog.locator('.spell-action-feedback')).toHaveAttribute('data-phase','applied');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const after=await saved(page),expected=structuredClone(before.runtime.resources);expected[rows[0].resourceId].current=0;expected[rows[1].resourceId].current=0;expected[pactId].current=1;expect(after.runtime.resources).toEqual(expected);expect(after.runtime.automationActions?.sequence).toBe((before.runtime.automationActions?.sequence||0)+2);expect(after.runtime.automationActions!.last).toMatchObject({selectionId:rows[1].spellId,level:5,spent:[{resourceId:rows[1].resourceId,before:1,after:0},{resourceId:pactId,before:2,after:1}]});protectedState(after,before);await closeDetail(page);
 await page.reload();expect((await saved(page)).runtime.resources).toEqual(after.runtime.resources);expect((await saved(page)).runtime.automationActions).toEqual(after.runtime.automationActions);dialog=await detail(page,rows[0],0);await expect(dialog.getByRole('button',{name:'使用',exact:true})).toBeDisabled();await page.screenshot({path:info.outputPath('dual-payment-atomic-persistence-recovery.png'),fullPage:true});expect(errors).toEqual([]);
});
