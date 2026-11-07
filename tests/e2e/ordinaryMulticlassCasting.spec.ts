import {test,expect,type Page} from '@playwright/test';
import type {Character,Entry} from '../../src/core/model';
import {newCharacter} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';
import {spellState} from '../../src/core/characterDetails';
import {mockSource,suppressAnnouncement} from './fixtures';
import {restoreAuthoredChoices} from './authoredChoicesFixture';
import {savedCharacter} from './reviewedRuleBrowserState';
import {pointerChoiceDrop} from './pointerChoiceDrop';
import {assertOrdinaryReference,ordinaryCatalogReadyControl,ordinaryCatalogRow,ordinaryActionControl} from './ordinaryCastingLocators';
import {readMulticlassBrowserInputs,verifyMulticlassResourceBinding} from './ordinaryMulticlassSources';
import {canonicalJsonSha256} from './reviewedObservantArtifactPrivacy';

const spellId='kiwee:spell:phb:cure%20wounds::::::',mainId='multiclass-main';
async function tab(page:Page,name:'特性'|'法术'){
 const mobile=page.getByRole('button',{name:'功能页',exact:true});if(await mobile.isVisible())await mobile.click();
 const button=page.getByRole('tab',{name,exact:true});await button.click();await expect(button).toHaveAttribute('aria-selected','true');
 const panel=page.locator('.paper[data-active-sheet="true"]');await expect(panel).toHaveClass(new RegExp(`(?:^| )page-${name==='特性'?1:3}(?: |$)`));await expect(panel).toBeVisible();return panel;
}
async function persisted(page:Page){await expect(page.locator('.save-status')).toContainText('已保存到本机');return savedCharacter(page);}
async function mock(page:Page){
 const bodies=readMulticlassBrowserInputs(),binding=verifyMulticlassResourceBinding();
 test.info().annotations.push({type:'multiclass-verified-resource-sha256',description:binding.resourcesSha256},{type:'multiclass-replay-consumer',description:binding.consumer});
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'authored isolated multiclass acceptance'}}));
 await page.context().route('**/data/class/index.json',route=>route.fulfill({json:{fighter:'class-fighter.json',paladin:'class-paladin.json',ranger:'class-ranger.json',wizard:'class-wizard.json',sorcerer:'class-sorcerer.json',warlock:'class-warlock.json'}}));
 for(const [path,body] of Object.entries(bodies))await page.context().route('**/data/'+path,route=>route.fulfill({json:body}));
 await page.context().route('**/data/spells/index.json',route=>route.fulfill({json:{PHB:'spells-phb.json',XPHB:'spells-xphb.json'}}));return bodies;
}
async function ready(page:Page,mainName:'Paladin'|'Ranger',legacy=false){
 const bodies=await mock(page);await page.goto('/card/?intro=0');await persisted(page);await expect(ordinaryCatalogReadyControl(page)).toBeEnabled();
 const classes:Entry[]=await page.evaluate(async({bodies,mainName})=>{
  const catalogPath='/card/src/data/catalog.ts',catalog=await import(catalogPath),merged:Record<string,any[]>={};
  for(const path of ['class/class-fighter.json','class/class-paladin.json','class/class-ranger.json'])for(const [key,rows]of Object.entries(bodies[path]))if(Array.isArray(rows))(merged[key]||=[]).push(...rows);
  const entries=catalog.normalizeCatalogData(merged,'actual-multiclass-browser');
  return [mainName,'Fighter'].map(name=>{const rows=entries.filter((e:Entry)=>e.kind==='class'&&e.english===name&&e.source==='PHB');if(rows.length!==1)throw Error('Unique actual class required');return rows[0];});
 },{bodies,mainName});
 const c=newCharacter('2014');c.name='普通多职业验收';c.automation=newAutomationState();c.profile.enabledSources=['PHB'];c.profile.optional.multiclass=true;
 for(const key of ['str','dex','con','int','wis','cha'] as const)c.abilities[key]=16;
 c.notes='Authored multiclass persistence sentinel';c.runtime.resources.manual={name:'手工保留资源',max:9,current:2,locked:true};
 c.runtime.resources['spell-slot:9']={name:'手工九环记录',max:3,current:1};
 c.selections=classes.map((entry,i)=>({id:i===0?mainId:'multiclass-companion',entry,level:i===0?5:1,quantity:1,equipped:false}));
 expect(c.selections.every(row=>row.entry.kind==='class')).toBe(true);expect(c.spellSettings).toBeUndefined();expect(c.runtime.resources['spell-slot:2']).toBeUndefined();
 if(legacy){c.runtime.resources['spell-slot:1']={name:'Authored old automatic pool',max:3,current:1,automatic:true};c.spellSettings=structuredClone(spellState(c));c.spellSettings.slots={'1':{max:3,used:2}};}
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'authored-multiclass.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true}),imported=page.getByRole('tab',{name:/普通多职业验收（导入）/});
 await expect(review.or(imported)).toBeVisible();if(await review.isVisible())await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();
 await expect(imported).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await persisted(page);
 const database=await page.evaluate(async()=>{const path='/card/src/platform/workspaceIdentity.ts';return(await import(path)).workspaceIdentity.database;});
 await restoreAuthoredChoices(page,database,{[mainId]:true,'multiclass-companion':true});
 const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});await expect(toggle).toBeEnabled();await expect(toggle).toHaveAttribute('aria-busy','false');if(await toggle.getAttribute('aria-checked')!=='true')await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','true');
 return persisted(page);
}
async function acquire(page:Page,mainName:'Paladin'|'Ranger',classId:string){
 if(mainName==='Ranger'){
  const panel=await tab(page,'特性'),chip=panel.locator(`[data-choice-id="${mainId}:spells:learned"]`);await assertOrdinaryReference(chip,classId);await chip.click();let workspace=panel.locator('.choice-workspace');await expect(workspace).toBeVisible();
  if((page.viewportSize()?.width||0)<=760)await workspace.getByRole('button',{name:'打开候选资料',exact:true}).click();
  const row=await ordinaryCatalogRow(page,spellId);await pointerChoiceDrop(page,row,workspace.locator('.choice-slot').nth(0));await tab(page,'特性');workspace=page.locator('.paper[data-active-sheet="true"] .choice-workspace');await expect(workspace).toBeVisible();await assertOrdinaryReference(workspace.locator('.choice-slot').nth(0).locator('.choice-slot-entry'),spellId);await workspace.getByRole('button',{name:'收起选择',exact:true}).click();
 }else{
  const panel=await tab(page,'法术'),tile=panel.locator(`.spell-library [data-entry-id=${JSON.stringify(spellId)}]`);await assertOrdinaryReference(tile,spellId);await tile.click();await expect(panel.locator(`.ordinary-prepared-group [data-entry-id=${JSON.stringify(spellId)}]`)).toHaveCount(1);
 }
 await expect.poll(async()=>{const c=await persisted(page),row=c.selections.find(s=>s.entry.id===spellId&&s.entry.kind==='spell');return !!row&&c.spellSettings?.classSpells?.[mainId]?.includes(row.id);}).toBe(true);
}
async function open(page:Page){const panel=await tab(page,'法术'),tile=panel.locator(`.prepared-spell-groups [data-entry-id=${JSON.stringify(spellId)}]`);await assertOrdinaryReference(tile,spellId);await tile.click({button:'right'});await page.getByRole('menu',{name:'法术操作',exact:true}).getByRole('menuitem',{name:'普通施法',exact:true}).click();const control=ordinaryActionControl(page);await expect(control).toBeVisible();return control;}
function protectedData(c:Character){return canonicalJsonSha256([c.abilities,c.notes,c.runtime.resources.manual,c.runtime.resources['spell-slot:9'],c.inventory,c.training,c.proficiencies]);}
for(const mainName of ['Paladin','Ranger'] as const)test(`Ordinary actual 2014 ${mainName} with a noncasting class acquires through UI and retains paid second-level slots on reopen and readonly views`,async({page,context})=>{
 test.setTimeout(150000);const before=await ready(page,mainName),protectedHash=protectedData(before),owner=before.selections.find(s=>s.id===mainId)!;
 expect(before.runtime.resources['spell-slot:1'].max).toBe(4);expect(before.runtime.resources['spell-slot:2']).toMatchObject({max:2,current:2});expect(before.runtime.resources['hit-die:10'].max).toBe(6);
 await acquire(page,mainName,owner.entry.id);let control=await open(page);await control.getByRole('combobox',{name:'普通施法消耗',exact:true}).selectOption('ordinary:spell-slot:2');
 const cast=control.getByRole('button',{name:'记录普通施法',exact:true});await expect(cast).toBeEnabled();await cast.evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
 await expect.poll(async()=>(await persisted(page)).runtime.resources['spell-slot:2'].current).toBe(1);expect((await savedCharacter(page)).runtime.automationActions?.sequence).toBe(1);expect(protectedData(await savedCharacter(page))).toBe(protectedHash);
 await page.getByRole('button',{name:'关闭施放详情',exact:true}).click();await page.reload();await expect(ordinaryCatalogReadyControl(page)).toBeEnabled();control=await open(page);
 await control.getByRole('combobox',{name:'普通施法消耗',exact:true}).selectOption('ordinary:spell-slot:2');await expect(control.getByRole('button',{name:'记录普通施法',exact:true})).toBeEnabled();
 const reopened=await persisted(page);expect(reopened.runtime.resources['spell-slot:2']).toMatchObject({max:2,current:1});expect(reopened.spellSettings!.slots['2']).toEqual({max:2,used:1});expect(protectedData(reopened)).toBe(protectedHash);
 const durable=canonicalJsonSha256(reopened),other=await context.newPage();await mock(other);await other.goto('/card/?intro=0');await expect(other.locator('.card-permission-banner')).toContainText('另一标签页正在编辑');const readonly=await open(other);await expect(readonly.getByRole('button',{name:'记录普通施法',exact:true})).toBeDisabled();expect(canonicalJsonSha256(await savedCharacter(other))).toBe(durable);await other.close();
});
for(const mainName of ['Paladin','Ranger'] as const)test(`Ordinary actual legacy ${mainName} confirms missing remaining slots explicitly, spends separately and retains zero after reopen`,async({page})=>{
 test.setTimeout(150000);const before=await ready(page,mainName,true),protectedHash=protectedData(before),owner=before.selections.find(s=>s.id===mainId)!;
 expect(before.runtime.resources['spell-slot:2']).toBeUndefined();expect((before.runtime.slotCapacityReview as any).pending['spell-slot:2']).toEqual({max:2});
 const panel=await tab(page,'法术'),input=panel.getByRole('spinbutton',{name:'2环法术位剩余次数',exact:true}),confirm=panel.getByRole('button',{name:'确认2环法术位余量',exact:true});
 await expect(input).toHaveValue('');await expect(confirm).toBeDisabled();await input.fill('1');await expect(confirm).toBeEnabled();await confirm.evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
 await expect.poll(async()=>(await persisted(page)).runtime.resources['spell-slot:2']?.current).toBe(1);expect(protectedData(await savedCharacter(page))).toBe(protectedHash);
 await acquire(page,mainName,owner.entry.id);const control=await open(page);await control.getByRole('combobox',{name:'普通施法消耗',exact:true}).selectOption('ordinary:spell-slot:2');await control.getByRole('button',{name:'记录普通施法',exact:true}).click();
 await expect.poll(async()=>(await persisted(page)).runtime.resources['spell-slot:2'].current).toBe(0);await page.getByRole('button',{name:'关闭施放详情',exact:true}).click();await page.reload();await expect(ordinaryCatalogReadyControl(page)).toBeEnabled();await tab(page,'法术');
 const reopened=await persisted(page);expect(reopened.runtime.resources['spell-slot:2']).toMatchObject({max:2,current:0});expect(reopened.spellSettings!.slots['2']).toEqual({max:2,used:2});expect((reopened.runtime.slotCapacityReview as any).balances['spell-slot:2']).toEqual({spent:2,max:2,current:0});expect(protectedData(reopened)).toBe(protectedHash);await expect(page.getByRole('spinbutton',{name:'2环法术位剩余次数',exact:true})).toHaveCount(0);
});
