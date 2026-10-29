import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {arcaneFocusFixture} from './arcaneFocusFixture';
import {exportCharacter} from '../../src/core/export';
import {syncSourceSpells} from '../../src/core/automation/sourceSpells';
import type {Entry} from '../../src/core/model';

function fixture(){
 const state=arcaneFocusFixture(),{c}=state,owner=c.selections.find(row=>row.id==='infusion-owner')!;
 c.selections.find(row=>row.id==='focus-1')!.equipped=true;c.selections.find(row=>row.id==='focus-1')!.attuned=true;
 const second:Entry={...structuredClone(owner.entry),id:'focus-wis-caster',name:'原创感知施法者',english:'Authored Wisdom Caster',source:'PHB',raw:{_category:'class',name:'原创感知施法者',source:'PHB',spellcastingAbility:'wis',casterProgression:'full',classFeatures:[]}};
 const spell:Entry={id:'focus-check-spell',kind:'spell',name:'原创法器检验术',english:'Authored Focus Test',source:'PHB',edition:'2014',packId:'fixture',revision:'1',entries:[],raw:{_category:'spell',name:'原创法器检验术',source:'PHB',level:0,entries:[]}};
 const gift:Entry={...spell,id:'focus-spell-gift',kind:'feat',name:'原创法器施法来源',english:'Authored Focus Gift',raw:{_category:'feat',name:'原创法器施法来源',source:'PHB',additionalSpells:[{ability:'wis',known:{'_':['原创法器检验术|PHB']}}]}};
 c.selections.push({id:'focus-caster-2',entry:second,level:1,quantity:1,equipped:false},{id:'focus-gift',entry:gift,level:1,quantity:1,equipped:false});
 syncSourceSpells(c,[spell]);return {...state,entries:[...state.entries,second,spell,gift],spell};
}
async function mock(page:Page){
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local test'}}));
 const {entries,spell}=fixture();
 await page.context().route('**/data/class/index.json',route=>route.fulfill({json:{infusion:'class-infusion.json'},headers:{'access-control-allow-origin':'*'}}));
 await page.context().route('**/data/class/class-infusion.json',route=>route.fulfill({json:{class:entries.filter(row=>row.kind==='class').map(row=>row.raw),classFeature:entries.filter(row=>row.raw._category==='classFeature').map(row=>row.raw)},headers:{'access-control-allow-origin':'*'}}));
 await page.context().route('**/data/optionalfeatures.json',route=>route.fulfill({json:{optionalfeature:entries.filter(row=>row.raw._category==='optionalfeature').map(row=>row.raw)},headers:{'access-control-allow-origin':'*'}}));
 await page.context().route('**/data/spells/index.json',route=>route.fulfill({json:{PHB:'spells-focus.json'},headers:{'access-control-allow-origin':'*'}}));
 await page.context().route('**/data/spells/spells-focus.json',route=>route.fulfill({json:{spell:[spell.raw]},headers:{'access-control-allow-origin':'*'}}));
}
async function saved(page:Page){return page.evaluate(async()=>{
 const path='/card/src/platform/workspaceIdentity.ts',name=(await import(path)).workspaceIdentity.database;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{const workspace=await new Promise<any>((resolve,reject)=>{const request=db.transaction('documents').objectStore('documents').get('workspace');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return workspace.characters.find((card:any)=>card.id===workspace.activeId);}finally{db.close();}
});}
async function features(page:Page){
 const tab=page.getByRole('tab',{name:'特性',exact:true});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');const panel=page.locator('.paper[data-active-sheet="true"] .detail-class-features');await expect(panel).toBeVisible();return panel;
}
async function stats(page:Page,held:boolean){
 const tab=page.getByRole('tab',{name:'法术',exact:true});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');const sheet=page.locator('.paper[data-active-sheet="true"]');
 await expect(sheet.locator('.sheet-cell[aria-label="法术攻击加值"] .page-value')).toHaveText(held?'+8':'+7');await expect(sheet.locator('.sheet-cell[aria-label="法术豁免 DC"] .page-value')).toHaveText('16');
 const rows=sheet.getByRole('region',{name:'各职业施法'}).locator('tbody tr');await expect(rows.nth(0).locator('td').nth(1)).toHaveText(held?'+8':'+7');await expect(rows.nth(0).locator('td').nth(2)).toHaveText('16');await expect(rows.nth(1).locator('td').nth(1)).toHaveText(held?'+7':'+6');await expect(rows.nth(1).locator('td').nth(2)).toHaveText('15');
 await sheet.getByRole('button',{name:'原创法器检验术施放详情',exact:true}).click();const dialog=page.getByRole('dialog',{name:'原创法器检验术施放详情',exact:true});await expect(dialog).toContainText(`感知 · 攻击 ${held?'+7':'+6'} · DC 15`);await dialog.getByRole('button',{name:'关闭施放详情'}).click();
 await features(page);
}

test('explicit holding updates all spell attack consumers, persists, resets on replacement and withdraws without touching manual settings',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await mock(page);await page.goto('/card/?intro=0');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const {c,entry}=fixture();expect(c.selections.some(row=>row.grantKey?.startsWith('source-spell:'))).toBe(true);
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'arcane-focus-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true});await expect(review).toContainText('导入后保留该角色自己的规则版本');await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();await expect(page.getByRole('tab',{name:/增强法器交互验收（导入）/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 let panel=await features(page),control=panel.locator(`[data-infusion-entry="${entry.id}"]`);const before=await saved(page);await stats(page,false);
 await expect(control.getByLabel('增强奥术法器灌注目标').locator('option')).toHaveCount(4);await expect(control).not.toContainText('法器测试水晶');await expect(control).toContainText('半身掩护仍需手动');
 await control.getByLabel('增强奥术法器灌注目标').selectOption('focus-0');expect((await saved(page)).infusions).toBeUndefined();await control.getByRole('button',{name:'确认增强奥术法器灌注'}).click();await expect(control.getByRole('checkbox',{name:'确认当前持握此法器'})).not.toBeChecked();await stats(page,false);
 await control.getByRole('checkbox',{name:'确认当前持握此法器'}).check();await expect.poll(async()=>(await saved(page)).infusions?.bindings[0]?.held).toBe(true);await stats(page,true);
 await page.reload();panel=await features(page);control=panel.locator(`[data-infusion-entry="${entry.id}"]`);await expect(control.getByRole('checkbox',{name:'确认当前持握此法器'})).toBeChecked();await stats(page,true);
 await control.getByLabel('增强奥术法器灌注目标').selectOption('focus-1');await control.getByRole('button',{name:'确认增强奥术法器灌注'}).click();await expect(control.getByRole('checkbox',{name:'确认当前持握此法器'})).not.toBeChecked();await stats(page,false);
 await control.getByRole('checkbox',{name:'确认当前持握此法器'}).check();await stats(page,true);await page.screenshot({path:info.outputPath('arcane-focus-held-target.png'),fullPage:true});
 const bounds=await control.evaluate(element=>{const parent=element.closest('.cell-content')!.getBoundingClientRect(),select=element.querySelector('select')!.getBoundingClientRect();return {right:select.right,limit:parent.right};});expect(bounds.right).toBeLessThanOrEqual(bounds.limit+1);
 await page.getByRole('tab',{name:'背包',exact:true}).click();const inventory=page.locator('.paper[data-active-sheet="true"]');await inventory.locator('[data-stock-mark="attuned"] [data-stock-ref-id="focus-1"]').dragTo(inventory.locator('.page-caption'));await expect.poll(async()=>(await saved(page)).selections.find((row:any)=>row.id==='focus-1').attuned).toBe(false);await expect.poll(async()=>(await saved(page)).infusions?.bindings[0]?.held).toBeUndefined();await features(page);await expect(control.getByRole('checkbox',{name:'确认当前持握此法器'})).not.toBeChecked();await expect(control.getByRole('checkbox',{name:'确认当前持握此法器'})).toBeDisabled();await stats(page,false);await control.getByRole('button',{name:'撤回增强奥术法器灌注'}).click();await expect.poll(async()=>(await saved(page)).infusions?.bindings).toEqual([]);
 const after=await saved(page);const expectedItems=before.selections.filter((row:any)=>row.entry.kind==='item');expectedItems.find((row:any)=>row.id==='focus-1').attuned=false;expect(after.selections.filter((row:any)=>row.entry.kind==='item')).toEqual(expectedItems);expect(after.spellSettings.attackBonus).toBe(2);expect(after.spellSettings.dcBonus).toBe(3);expect(after.notes).toBe(before.notes);expect(after.runtime.hp).toBe(before.runtime.hp);expect(errors).toEqual([]);
});
