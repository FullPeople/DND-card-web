import {test,expect,type Page,type Locator} from '@playwright/test';
import {mockSource,suppressAnnouncement,expandSourceBook} from './fixtures';
import {restoreAuthoredChoices} from './authoredChoicesFixture';
import {invocationAtwillFinalCases as cases,invocationAtwillFinalData as data} from '../fixtures/invocationAtwillFinalData';
import {newCharacter,type Character,type Entry,type Selection} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';

const choiceId='warlock:class-optional:0';
const manualSpellId='manual-false-life';
type Learned={ownerId:string;spellId:string};
type Rule=typeof cases[number];

async function mock(page:Page){
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local test'}}));
 await page.context().route('**/data/class/index.json',route=>route.fulfill({json:{invocation:'class-atwill-final-invocation.json'}}));
 await page.context().route('**/data/class/class-atwill-final-invocation.json',route=>route.fulfill({json:{class:data.class,classFeature:data.classFeature}}));
 await page.context().route('**/data/optionalfeatures.json',route=>route.fulfill({json:{optionalfeature:data.optionalfeature}}));
 await page.context().route('**/data/spells/index.json',route=>route.fulfill({json:{PHB:'spells-atwill-final-invocation.json'}}));
 await page.context().route('**/data/spells/spells-atwill-final-invocation.json',route=>route.fulfill({json:{spell:data.spell}}));
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
async function editor(page:Page){
 const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});
 // A restored edit intent is temporarily unchecked while runtime loads. Never
 // toggle that loading placeholder, which would turn a restored editor off.
 await expect(toggle).toBeEnabled();await expect(toggle).toHaveAttribute('aria-busy','false');
 if(await toggle.getAttribute('aria-checked')!=='true')await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','true');
}
async function movementAndArmor(page:Page){
 const panel=await tab(page,'主要');return {speed:await panel.locator('[data-stat="speed"]').innerText(),ac:await panel.locator('[data-stat="ac"]').innerText()};
}
async function ready(page:Page,options:{level?:number;manualSpell?:boolean;secondaryClass?:boolean}={}){
 await mock(page);await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const c=newCharacter('2014');c.automation=newAutomationState();c.profile.enabledSources=['PHB'];
 const entries:Entry[]=Object.entries(data).flatMap(([category,rows])=>rows.map(raw=>({id:`atwill-final-fixture:${category}:${raw.name}`,name:raw.name,english:raw.ENG_name,source:raw.source,edition:'2014' as const,kind:(category==='classFeature'||category==='optionalfeature'?'feature':category) as Entry['kind'],packId:'authored-atwill-final',revision:'1',entries:[],raw:{...raw,_category:category}})));
 c.selections=[{id:'warlock',entry:entries.find(e=>e.kind==='class')!,level:options.level??15,quantity:1,equipped:false},{id:'invocations-source',entry:entries.find(e=>e.raw._category==='classFeature')!,level:1,quantity:1,equipped:false,parentId:'warlock',grantKey:'ref:魔能祈唤|魔契师||2'}];
 c.name='随意施法祈唤交互验收';c.notes='手工临时生命、形态、传感器与专注记录仍由玩家处理';c.proficiencies={insight:true};c.abilities.str=14;c.baseHp=42;c.sheetBonuses={speed:5};c.runtime.hp=17;c.runtime.tempHp=4;
 c.runtime.resources[`pact-slot:${Math.min(5,Math.ceil((options.level??15)/2))}`]={max:(options.level??15)<11?2:3,current:0};
 c.runtime.resources['manual-atwill-final-check']={name:'手工保留资源',max:7,current:2};
 c.runtime.resources['spell-slot:3']={name:'手工三环法术位',max:3,current:0};
 c.identity.description='保持手工外貌';c.biography={height:'手工身高',portraitNotes:'手工传感器位置与视觉记录'};c.size='M';c.quickbarActions=[{id:'manual-attack',name:'手工武器',attack:'+4',damage:'1d6+2'}];
 const authored=(id:string,kind:Entry['kind'],name:string):Selection=>({id,entry:{id:`${id}-entry`,kind,name,english:name,source:'PHB',edition:'2014',packId:'authored-atwill-final',revision:'1',entries:[],raw:{_category:kind}},level:1,quantity:2,equipped:false});
 c.selections.push(authored('manual-materials','item','手工材料包'),authored('manual-condition','condition','手工状态记录'));
 if(options.secondaryClass){const secondary=authored('secondary-class','class','原创副职');secondary.quantity=1;secondary.entry.raw.hd={faces:6};c.selections.push(secondary);c.profile.optional.multiclass=true;}
 if(options.manualSpell){
  // Canonical catalog identity is intentionally shared with the granted spell,
  // while the independent selection and counter have different ownership.
  const entry=await page.evaluate(async raw=>{const path='/card/src/data/catalog.ts';return (await import(path)).normalizeData({spell:[raw]},'1')[0];},data.spell.find(row=>row.ENG_name==='False Life')!);
  c.selections.push({id:manualSpellId,entry,level:1,quantity:1,equipped:false});
 }
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'atwill-final-invocations-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true});await expect(review).toContainText('导入后保留该角色自己的规则版本');await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();
 await expect(page.getByRole('tab',{name:/随意施法祈唤交互验收（导入）/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await expect(page.locator('.save-status')).toContainText('已保存到本机');await editor(page);
 // This existing fixture only resumes presentation of imported blank choices.
 // Every learned choice, level change, replacement and cast below uses real UI.
 const database=await page.evaluate(async()=>{const path='/card/src/platform/workspaceIdentity.ts';return (await import(path)).workspaceIdentity.database;});await restoreAuthoredChoices(page,database,{warlock:true});
 await expect.poll(async()=>(await saved(page)).selections.find(row=>row.id==='warlock')?.level).toBe(options.level??15);await editor(page);
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
 if(!accepted)await expect(page.locator('.suite-toast')).toContainText((page.viewportSize()?.width||0)<=760?'尚未达到所需职业等级 15。':'此条目不属于当前可选内容');
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
 for(const field of ['notes','abilities','baseHp','sheetBonuses','proficiencies','inventory','identity','biography','size','quickbarActions'] as const)expect(card[field]).toEqual(before[field]);
 for(const field of ['hp','tempHp','inspiration','deathSaves'] as const)expect(card.runtime[field]).toEqual(before.runtime[field]);
 for(const id of ['manual-materials','manual-condition',manualSpellId])expect(card.selections.find(row=>row.id===id)).toEqual(before.selections.find(row=>row.id===id));
 expect(card.spellSettings?.special?.[manualSpellId]).toEqual(before.spellSettings?.special?.[manualSpellId]);
 for(const id of ['manual-atwill-final-check','spell-slot:3',`innate-spell:${manualSpellId}`])expect(card.runtime.resources[id]).toEqual(before.runtime.resources[id]);
 expect(card.selections.filter(row=>row.entry.kind==='condition')).toEqual(before.selections.filter(row=>row.entry.kind==='condition'));
}
function liveGrants(card:Character,rules:readonly Rule[]=cases):Learned[]{
 return rules.map(rule=>{
  const owners=card.selections.filter(row=>row.entry.english===rule.english&&row.entry.source==='PHB'&&row.entry.edition==='2014'&&row.grantKey?.startsWith('choice:'));expect(owners).toHaveLength(1);const owner=owners[0];
  expect(owner.requirementId).toBe(choiceId);expect(card.answers[choiceId]).toContain(owner.entry.id);expect(owner.parentId).toBe('invocations-source');
  const grants=card.selections.filter(row=>row.parentId===owner.id&&row.entry.english===rule.spellEnglish&&row.grantKey?.startsWith('source-spell:'));expect(grants).toHaveLength(1);const grant=grants[0];
  expect(grant.entry.raw.level).toBe(rule.level);expect(grant.entry.source).toBe('PHB');expect(grant.entry.edition).toBe('2014');
  expect(card.spellSettings?.special?.[grant.id]).toMatchObject({mode:'locked',sourceGrant:{ownerId:owner.id,key:grant.grantKey,active:true,usage:'free',canUseSlots:false}});
  expect(card.runtime.resources[`innate-spell:${grant.id}`]).toBeUndefined();return {ownerId:owner.id,spellId:grant.id};
 });
}
async function learn(page:Page,rules:readonly Rule[]=cases,start=0){
 let workspace=await learning(page);for(const [index,row] of rules.entries())workspace=await drag(page,workspace,row.name,start+index);await closeLearning(page,workspace);
 for(const rule of rules)await expect.poll(async()=>(await saved(page)).selections.filter(row=>row.entry.english===rule.spellEnglish&&row.grantKey?.startsWith('source-spell:')).length).toBe(1);
 const panel=await tab(page,'特性'),records=panel.locator(`[data-class-choice="${choiceId}"]`);
 for(const row of rules){
  const record=records.locator(':scope > div > div').filter({has:page.getByRole('button',{name:row.name,exact:true})});
  await expect(record).toContainText(row.manualBoundary);await expect(record).toContainText(row.materialBoundary);
  if(row.selfOnly)await expect(record).toContainText('仅对自身');else await expect(record).not.toContainText('仅对自身');
  if(!row.materialWaived)await expect(record).not.toContainText('不消耗法术位和材料成分');
 }
 return liveGrants(await saved(page),rules);
}
async function closeDetail(page:Page){await page.getByRole('button',{name:'关闭施放详情',exact:true}).click();}
async function detail(page:Page,rule:{spell:string;selfOnly:boolean},row:Learned){
 const panel=await tab(page,'法术'),group=panel.locator(`[data-source-cantrip-group="${row.ownerId}"]`),badge=group.getByRole('button',{name:`${rule.spell}施放详情`,exact:true});
 await expect(badge).toContainText('免费 · 随意');await badge.click();
 const dialog=page.getByRole('dialog',{name:`${rule.spell}施放详情`,exact:true});
 await expect(dialog).toContainText(rule.selfOnly?'免费施法（仅自身）':'免费施法');if(!rule.selfOnly)await expect(dialog).not.toContainText('仅自身');
 await expect(dialog.getByRole('radiogroup')).toHaveCount(0);await expect(dialog.getByRole('spinbutton')).toHaveCount(0);await expect(dialog.getByRole('button',{name:/恢复/})).toHaveCount(0);
 expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);return dialog;
}
async function freeCast(page:Page,rule:{spell:string;level:number;selfOnly:boolean},row:Learned){
 const before=await saved(page),dialog=await detail(page,rule,row);await expect(dialog.getByRole('button',{name:'使用',exact:true})).toBeEnabled();
 await dialog.getByRole('button',{name:'使用',exact:true}).click();await expect(dialog.locator('.spell-action-feedback')).toHaveAttribute('data-phase','applied');await expect(dialog.locator('.spell-action-feedback')).toContainText('不消耗资源');await expect(dialog.locator('[data-spent-resource]')).toHaveCount(0);
 await expect.poll(async()=>(await saved(page)).runtime.automationActions?.sequence||0).toBe((before.runtime.automationActions?.sequence||0)+1);
 const after=await saved(page),receipt=after.runtime.automationActions!.last!;expect(receipt).toMatchObject({selectionId:row.spellId,mode:'cast',level:rule.level,sequence:before.runtime.automationActions?.sequence||0});
 for(const field of ['resourceId','before','after','spent'] as const)expect(receipt[field]).toBeUndefined();
 expect(after.runtime.resources).toEqual(before.runtime.resources);expect(after.selections).toEqual(before.selections);expect(after.spellSettings).toEqual(before.spellSettings);protectedState(after,before);
 const {automationActions:_after,...runtimeAfter}=after.runtime,{automationActions:_before,...runtimeBefore}=before.runtime;expect(runtimeAfter).toEqual(runtimeBefore);
 // Pure offers are observed from a detached persisted card only. All grants and
 // casts above are created by the actual player controls, never module calls.
 const offer=await page.evaluate(async({card,id})=>{const path='/card/src/core/automation/actions.ts';return (await import(path)).spellPayments(card,id);},{card:after,id:row.spellId});
 expect(offer.options).toEqual([{id:'free',label:rule.selfOnly?'免费施法（仅自身）':'免费施法',level:rule.level,cost:0,available:true}]);
 await expect(dialog.getByRole('button',{name:'使用',exact:true})).toBeEnabled();await closeDetail(page);
}
async function castAll(page:Page,ids:Learned[]){for(const [index,row] of cases.entries())await freeCast(page,row,ids[index]);}
async function unavailable(page:Page,ids:Learned[]){
 const before=await saved(page);
 // Only detached persisted-card copies are used for stale-action probes. These
 // module calls never stand in for the real UI selection, level edit or cast.
 const results=await page.evaluate(async({card,ids})=>{
  const actionPath='/card/src/core/automation/actions.ts',statePath='/card/src/core/automation/sourceSpellState.ts';
  const {spellPayments,spellActionRequest,performSpellAction}=await import(actionPath),{sourceSpellEnabled}=await import(statePath);
  return ids.map(({spellId},index)=>{const copy=structuredClone(card),old=JSON.stringify(copy),offer=spellPayments(copy,spellId),enabled=sourceSpellEnabled(copy,spellId),result=performSpellAction(copy,spellActionRequest(copy,spellId,'free',`atwill-final-revoked-${index}`));return {offer,enabled,result,unchanged:JSON.stringify(copy)===old};});
 },{card:before,ids});
 for(const result of results){expect(result.enabled).toBe(false);expect(result.offer.options).toEqual([]);expect(result.result).toMatchObject({status:'rejected',message:'此来源法术当前不可用。'});expect(result.unchanged).toBe(true);}
 expect(await saved(page)).toEqual(before);
}
function archived(card:Character,active:Character,ids:Learned[]){
 for(const id of ids){
  expect(card.selections.some(row=>row.id===id.ownerId||row.id===id.spellId)).toBe(false);
  const archive=card.classChoiceArchive?.[id.ownerId];expect(archive?.choiceId).toBe(choiceId);
  for(const rowId of [id.ownerId,id.spellId])expect(archive?.selections.find(row=>row.id===rowId)).toEqual(active.selections.find(row=>row.id===rowId));
  expect(card.spellSettings?.special?.[id.spellId]).toEqual(active.spellSettings?.special?.[id.spellId]);
 }
}
async function manualCounter(page:Page){
 const panel=await tab(page,'法术'),tile=panel.locator(`.spell-library [data-spell-id="${manualSpellId}"]`);await expect(tile).toBeVisible();await tile.click({button:'right'});
 await page.getByRole('menuitem',{name:'设置免费施放次数',exact:true}).click();const group=panel.locator('[data-source-cantrip-group="manual"]');
 await group.getByRole('button',{name:'虚假生命施放详情',exact:true}).click();const detail=page.getByRole('dialog',{name:'虚假生命施放详情',exact:true});
 await detail.getByLabel('次数上限',{exact:true}).fill('3');await detail.getByLabel('次数上限',{exact:true}).press('Enter');await detail.getByLabel('虚假生命剩余次数',{exact:true}).fill('1');await detail.getByLabel('虚假生命剩余次数',{exact:true}).press('Enter');await detail.getByRole('button',{name:'关闭施放详情',exact:true}).click();
 await expect(group.getByRole('button',{name:'虚假生命施放详情',exact:true})).toContainText('免费 1/3');await expect.poll(async()=>(await saved(page)).runtime.resources[`innate-spell:${manualSpellId}`]).toMatchObject({max:3,current:1});
 await expect.poll(async()=>(await saved(page)).spellSettings?.special?.[manualSpellId]).toMatchObject({mode:'uses',max:3});
}
async function source(page:Page,enabled:boolean){
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expandSourceBook(page,'PHB');const book=page.locator('.source-book').filter({has:page.locator('button[aria-label="设置来源 PHB"]')});
 await book.locator('input[type=checkbox]').first().setChecked(enabled);await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).profile.enabledSources.includes('PHB')).toBe(enabled);
}

test('level-two Vigor and level-fifteen Forms and Visions repeat free casts at their own spell levels without applying spell effects',async({page},info)=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page,{level:2});
 const initial=await saved(page),initialStats=await movementAndArmor(page),vigor=await learn(page,[cases[0]]);expect(initial.runtime.resources['pact-slot:1'].current).toBe(0);
 expect((await saved(page)).selections.find(row=>row.id==='warlock')!.level).toBe(2);await freeCast(page,cases[0],vigor[0]);await freeCast(page,cases[0],vigor[0]);protectedState(await saved(page),initial);
 await level(page,15);await learn(page,cases.slice(1),1);const ids=liveGrants(await saved(page)),learned=await saved(page);
 expect(ids[0]).toEqual(vigor[0]);expect(learned.answers[choiceId].filter(Boolean)).toHaveLength(3);expect(learned.runtime.resources['spell-slot:3'].current).toBe(0);
 for(let round=0;round<2;round++)await castAll(page,ids);
 const after=await saved(page);expect(after.runtime.resources).toEqual(learned.runtime.resources);expect(after.runtime.automationActions?.sequence).toBe((learned.runtime.automationActions?.sequence||0)+6);expect(after.runtime.tempHp).toBe(4);protectedState(after,initial);expect(await movementAndArmor(page)).toEqual(initialStats);
 await detail(page,cases[2],ids[2]);await page.screenshot({path:info.outputPath('atwill-three-free-casts-and-manual-effects.png'),fullPage:true});expect(errors).toEqual([]);
});

test('actual Warlock fifteen, not combined character level, gates Forms and Visions and exact grants survive downgrade and restore',async({page},info)=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page,{level:14,secondaryClass:true});
 const before=await saved(page);expect(before.selections.filter(row=>row.entry.kind==='class').reduce((sum,row)=>sum+row.level,0)).toBe(15);
 let workspace=await learning(page);for(const [index,row] of cases.slice(1).entries())workspace=await drag(page,workspace,row.name,index+1,false);await closeLearning(page,workspace);
 const refused=await saved(page);expect(refused.answers[choiceId]?.filter(Boolean)||[]).toEqual([]);expect(refused.selections.filter(row=>row.grantKey?.startsWith('choice:')||row.grantKey?.startsWith('source-spell:'))).toEqual([]);expect(refused.runtime.resources).toEqual(before.runtime.resources);protectedState(refused,before);
 const vigor=await learn(page,[cases[0]]);await level(page,15);await learn(page,cases.slice(1),1);const ids=liveGrants(await saved(page));expect(ids[0]).toEqual(vigor[0]);await castAll(page,ids);const active=await saved(page);
 await level(page,14);await expect.poll(async()=>(await saved(page)).selections.filter(row=>row.grantKey?.startsWith('source-spell:')).length).toBe(1);
 const lowered=await saved(page);expect(liveGrants(lowered,[cases[0]])).toEqual(vigor);expect(lowered.answers[choiceId]).toEqual(active.answers[choiceId]);expect(lowered.runtime.automationActions).toEqual(active.runtime.automationActions);archived(lowered,active,ids.slice(1));protectedState(lowered,active);
 const records=(await tab(page,'特性')).locator(`[data-class-choice="${choiceId}"]`);await expect(records.locator('.is-restricted')).toHaveCount(2);for(const row of cases)await expect(records.getByRole('button',{name:row.name,exact:true})).toBeVisible();
 workspace=await learning(page);for(const index of [1,2])await expect(workspace.locator('.choice-slot').nth(index)).toContainText('15');await closeLearning(page,workspace);
 await page.reload();await expect(page.locator('.save-status')).toContainText('已保存到本机');let panel=await tab(page,'法术');for(const row of cases.slice(1))await expect(panel.getByRole('button',{name:`${row.spell}施放详情`,exact:true})).toHaveCount(0);archived(await saved(page),active,ids.slice(1));await unavailable(page,ids.slice(1));await freeCast(page,cases[0],vigor[0]);
 const lowCast=await saved(page);await level(page,15);await expect.poll(async()=>(await saved(page)).selections.filter(row=>row.grantKey?.startsWith('source-spell:')).length).toBe(3);expect(liveGrants(await saved(page))).toEqual(ids);expect((await saved(page)).runtime.automationActions).toEqual(lowCast.runtime.automationActions);
 await page.reload();await expect(page.locator('.save-status')).toContainText('已保存到本机');expect(liveGrants(await saved(page))).toEqual(ids);await castAll(page,ids);protectedState(await saved(page),before);panel=await tab(page,'特性');await expect(panel.locator(`[data-class-choice="${choiceId}"] .is-restricted`)).toHaveCount(0);
 await page.screenshot({path:info.outputPath('atwill-actual-warlock-level-restoration.png'),fullPage:true});expect(errors).toEqual([]);
});

test('save and app reopen retain an independent same-name spell while replacement and removal revoke only their owned grants',async({page:initialPage,context},info)=>{
 test.setTimeout(180000);let page=initialPage;const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page,{manualSpell:true});await manualCounter(page);const manual=await saved(page),ids=await learn(page);await castAll(page,ids);const active=await saved(page);protectedState(active,manual);
 const sameName=active.selections.filter(row=>row.entry.english==='False Life');expect(sameName).toHaveLength(2);expect(sameName[0].entry.id).toBe(sameName[1].entry.id);expect(new Set(sameName.map(row=>row.id)).size).toBe(2);
 await page.reload();await expect(page.locator('.save-status')).toContainText('已保存到本机');expect(liveGrants(await saved(page))).toEqual(ids);expect((await saved(page)).runtime.resources).toEqual(active.runtime.resources);expect((await saved(page)).runtime.automationActions).toEqual(active.runtime.automationActions);
 await page.close();page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await mock(page);await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');expect(liveGrants(await saved(page))).toEqual(ids);protectedState(await saved(page),manual);
 let workspace=await learning(page);workspace=await drag(page,workspace,'魔能视界',0);await closeLearning(page,workspace);await expect.poll(async()=>(await saved(page)).selections.some(row=>row.id===ids[0].spellId)).toBe(false);
 const replaced=await saved(page),owner=replaced.selections.find(row=>row.entry.english==='Eldritch Sight'&&row.grantKey?.startsWith('choice:'))!;expect(owner).toBeDefined();const spell=replaced.selections.find(row=>row.parentId===owner.id&&row.grantKey?.startsWith('source-spell:'))!;expect(spell).toBeDefined();const replacement={ownerId:owner.id,spellId:spell.id};
 await freeCast(page,{spell:'侦测魔法',level:1,selfOnly:false},replacement);await freeCast(page,cases[1],ids[1]);archived(await saved(page),active,[ids[0]]);protectedState(await saved(page),manual);
 let panel=await tab(page,'法术');await expect(panel.locator(`[data-source-cantrip-group="${ids[0].ownerId}"]`)).toHaveCount(0);await expect(panel.locator('[data-source-cantrip-group="manual"]').getByRole('button',{name:'虚假生命施放详情',exact:true})).toContainText('免费 1/3');
 for(const name of ['万形之主','穹宇尽视','魔能视界']){workspace=await learning(page);await workspace.getByRole('button',{name:`移除${name}`,exact:true}).click();await closeLearning(page,workspace);}
 await expect.poll(async()=>(await saved(page)).selections.filter(row=>row.grantKey?.startsWith('source-spell:')).length).toBe(0);const removed=await saved(page);expect(removed.answers[choiceId].filter(Boolean)).toEqual([]);archived(removed,active,ids);archived(removed,replaced,[replacement]);protectedState(removed,manual);expect(removed.runtime.resources).toEqual(manual.runtime.resources);
 await page.reload();await expect(page.locator('.save-status')).toContainText('已保存到本机');panel=await tab(page,'法术');await expect(panel.locator('[data-source-spell="true"]')).toHaveCount(0);await expect(panel.locator('[data-source-cantrip-group="manual"]').getByRole('button',{name:'虚假生命施放详情',exact:true})).toContainText('免费 1/3');protectedState(await saved(page),manual);await unavailable(page,[...ids,replacement]);
 await page.screenshot({path:info.outputPath('atwill-reopen-replacement-manual-spell.png'),fullPage:true});expect(errors).toEqual([]);
});

test('source suspension preserves learned records and read-only viewing or casting cannot create actions or change resources',async({page,context},info)=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);const ids=await learn(page);await castAll(page,ids);const active=await saved(page);
 const other=await context.newPage();other.on('pageerror',error=>errors.push(error.message));await mock(other);await other.goto('/card/?intro=0');const readonly=await tab(other,'特性');await expect(other.locator('.card-permission-banner')).toContainText('另一标签页正在编辑');await expect(other.getByRole('switch',{name:'编辑模式',exact:true})).toBeDisabled();
 const records=readonly.locator(`[data-class-choice="${choiceId}"]`);for(const row of cases)await expect(records.getByRole('button',{name:row.name,exact:true})).toBeVisible();await expect(records.locator(`[data-choice-id="${choiceId}"]:not([disabled])`)).toHaveCount(0);await expect(readonly.getByRole('spinbutton',{name:'魔契师等级',exact:true})).toHaveAttribute('readonly','');const readonlyBefore=await saved(other);
 for(const [index,row] of cases.entries()){
  const dialog=await detail(other,row,ids[index]);await expect(dialog.getByRole('button',{name:'使用',exact:true})).toBeDisabled();await expect(dialog.locator('.spell-action-feedback')).not.toHaveAttribute('data-phase','applied');expect(await saved(other)).toEqual(readonlyBefore);await closeDetail(other);
 }
 await other.close();expect(await saved(page)).toEqual(active);
 await source(page,false);await expect.poll(async()=>(await saved(page)).selections.filter(row=>row.grantKey?.startsWith('source-spell:')).length).toBe(0);let panel=await tab(page,'特性');await expect(panel.locator(`[data-class-choice="${choiceId}"]`)).toContainText('来源未启用，原记录保留');
 const suspended=await saved(page);expect(suspended.answers[choiceId]).toEqual(active.answers[choiceId]);expect(suspended.runtime.resources).toEqual(active.runtime.resources);expect(suspended.runtime.automationActions).toEqual(active.runtime.automationActions);archived(suspended,active,ids);protectedState(suspended,active);
 await page.reload();await expect(page.locator('.save-status')).toContainText('已保存到本机');panel=await tab(page,'法术');for(const row of cases)await expect(panel.getByRole('button',{name:`${row.spell}施放详情`,exact:true})).toHaveCount(0);await unavailable(page,ids);
 await source(page,true);await expect.poll(async()=>(await saved(page)).selections.filter(row=>row.grantKey?.startsWith('source-spell:')).length).toBe(3);expect(liveGrants(await saved(page))).toEqual(ids);expect((await saved(page)).runtime.automationActions).toEqual(active.runtime.automationActions);
 await page.reload();await expect(page.locator('.save-status')).toContainText('已保存到本机');expect(liveGrants(await saved(page))).toEqual(ids);await castAll(page,ids);const restored=await saved(page);expect(restored.answers[choiceId]).toEqual(active.answers[choiceId]);expect(restored.runtime.resources).toEqual(active.runtime.resources);protectedState(restored,active);
 await page.screenshot({path:info.outputPath('atwill-source-restored-and-readonly.png'),fullPage:true});expect(errors).toEqual([]);
});
