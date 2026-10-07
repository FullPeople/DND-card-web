import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Character} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';
import {source,shieldTrainingEntries} from '../helpers/shieldTrainingFixture';

async function savedCard(page:Page){return page.evaluate(async()=>{
 const request=indexedDB.open('dnd-card-standalone'),db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{return await new Promise<Character>((resolve,reject)=>{const get=db.transaction('documents').objectStore('documents').get('workspace');get.onsuccess=()=>resolve(get.result.characters.find((c:Character)=>c.id===get.result.activeId));get.onerror=()=>reject(get.error);});}finally{db.close();}
});}
async function ready(page:Page,edition:'2014'|'2024',manualArmor?:string,mobile=false){
 await mockSource(page,{displayMode:mobile?'screen':'a4'});await suppressAnnouncement(page);
 await page.route('**/data/class/class-test.json',route=>route.fulfill({json:{class:source.projection.class}}));
 await page.route('**/data/items-base.json',route=>route.fulfill({json:{baseitem:source.projection.baseitem,itemType:['PHB','XPHB'].map(source=>({name:'盾牌',ENG_name:'Shield',source,entries:['原创装备类型碰撞夹具。']}))}}));
 await page.route('**/data/spells/spells-test.json',route=>route.fulfill({json:{spell:['PHB','XPHB'].map(source=>({name:'盾牌',ENG_name:'Shield',source,level:1,entries:['原创法术碰撞夹具；不授予装备训练。']}))}}));
 const c=newCharacter(edition);c.name='盾牌训练入口 '+edition;c.automation=newAutomationState();c.abilities.dex=10;c.training={tools:'手工工具记录',languages:'手工语言'};c.runtime.hp=7;c.runtime.resources={manual:{current:1,max:4}};
 c.selections=shieldTrainingEntries().filter(e=>e.edition===edition).map(entry=>({id:entry.kind==='class'?'class':'shield',entry,quantity:1,level:1,equipped:entry.kind==='item'}));
 if(manualArmor!==undefined)c.training!.armor=manualArmor;
 await page.goto('/');if(mobile)await page.getByRole('button',{name:'Wiki',exact:true}).click();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();if(mobile)await page.getByRole('button',{name:'功能页',exact:true}).click();
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'synthetic-shield-entry-card.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 if(edition==='2014')await page.getByRole('dialog',{name:'导入前核对',exact:true}).getByRole('button',{name:'保留全部记录并导入',exact:true}).click();
 await expect(page.getByRole('tab',{name:c.name+'（导入）',exact:true})).toHaveAttribute('aria-selected','true');await page.getByRole('dialog',{name:'导入与导出',exact:true}).getByRole('button',{name:'关闭弹窗',exact:true}).click();
 return c;
}
const armor=(page:Page)=>page.locator('.training-row').filter({has:page.locator('dt').filter({hasText:/^护甲$/})});
async function enableEditing(page:Page){const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});if(await toggle.getAttribute('aria-checked')!=='true')await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','true');}
for(const edition of ['2014','2024'] as const)test(`${edition} automatic shield training binds the category, not the equipment`,async({page})=>{
 await ready(page,edition);await expect(page.locator('.armor-cell [data-stat="ac"]')).toHaveText('12');
 const before=await savedCard(page);
 const shield=armor(page).getByRole('button',{name:'盾牌',exact:true});await expect(shield).toHaveAttribute('data-reference',`itemProperty:entry:dnd-card.weapon-training:${edition}:shield`);
 await shield.hover();await expect(page.locator('.entry-detail')).toContainText('装备熟练类别：盾牌');
 expect(await savedCard(page)).toEqual(before);
 await page.screenshot({path:test.info().outputPath('shield-training-category.png')});
});
for(const edition of ['2014','2024'] as const)test(`${edition} saving the automatic armor record preserves training, AC, undo/redo and manual values`,async({page})=>{
 const c=await ready(page,edition);await expect(page.locator('.armor-cell [data-stat="ac"]')).toHaveText('12');
 await enableEditing(page);await page.getByRole('button',{name:'编辑装备训练与其他熟练',exact:true}).click();
 const input=page.getByRole('textbox',{name:'护甲熟练记录',exact:true});await input.press('Enter');await expect(page.locator('.armor-cell [data-stat="ac"]')).toHaveText('12');
 await expect.poll(async()=>(await savedCard(page)).training?.armor).toContain(`{@itemProperty 盾牌|${edition==='2014'?'PHB':'XPHB'}}`);
 await page.reload();await expect(page.locator('.armor-cell [data-stat="ac"]')).toHaveText('12');const saved=await savedCard(page);expect(saved.training?.tools).toBe(c.training!.tools);expect(saved.training?.languages).toBe(c.training!.languages);expect(saved.runtime.resources.manual.current).toBe(1);expect(saved.runtime.hp).toBe(7);
 await enableEditing(page);
 await armor(page).getByRole('button',{name:'盾牌',exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'移除',exact:true}).click();await expect(armor(page).getByRole('button',{name:'盾牌',exact:true})).toHaveCount(0);await expect(page.locator('.armor-cell [data-stat="ac"]')).toHaveText(edition==='2014'?'12':'10');
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(page.locator('.armor-cell [data-stat="ac"]')).toHaveText('12');
 await expect(armor(page).getByRole('button',{name:'盾牌',exact:true})).toHaveCount(1);
 await page.getByRole('button',{name:'重做',exact:true}).click();await expect(armor(page).getByRole('button',{name:'盾牌',exact:true})).toHaveCount(0);await expect(page.locator('.armor-cell [data-stat="ac"]')).toHaveText(edition==='2014'?'12':'10');
 await page.reload();await expect(page.locator('.armor-cell [data-stat="ac"]')).toHaveText(edition==='2014'?'12':'10');expect((await savedCard(page)).runtime.resources.manual.current).toBe(1);
});
for(const edition of ['2014','2024'] as const)test(`${edition} manual aliases stay literal and named item/spell records never grant category training`,async({page})=>{
 const book=edition==='2014'?'PHB':'XPHB',raw=`sHiElD、{@itemProperty SHIELDS|${book.toLowerCase()}|玩家标签}、手工未收录说明`;
 await ready(page,edition,raw);await expect(page.locator('.armor-cell [data-stat="ac"]')).toHaveText('12');const before=await savedCard(page);
 for(const label of ['盾牌','玩家标签'])await expect(armor(page).getByRole('button',{name:label,exact:true})).toHaveAttribute('data-reference',`itemProperty:entry:dnd-card.weapon-training:${edition}:shield`);
 await armor(page).getByRole('button',{name:'玩家标签',exact:true}).hover();await expect(page.locator('.entry-detail')).toContainText('装备熟练类别：盾牌');expect(await savedCard(page)).toEqual(before);
 await enableEditing(page);await page.getByRole('button',{name:'编辑装备训练与其他熟练',exact:true}).click();
 const input=page.getByRole('textbox',{name:'护甲熟练记录',exact:true});
 for(const kind of ['item','spell']){
  const text=`{@${kind} Shield|${book}|玩家${kind}记录}、手工未收录说明`;await input.fill(text);await input.press('Enter');await expect(page.locator('.armor-cell [data-stat="ac"]')).toHaveText(edition==='2014'?'12':'10');await expect.poll(async()=>(await savedCard(page)).training!.armor).toBe(text);
 }
 await page.getByRole('button',{name:'编辑装备训练与其他熟练',exact:true}).click();
 await expect(armor(page).getByRole('button',{name:'玩家spell记录',exact:true})).toHaveAttribute('data-reference',`spell:Shield|${book}|玩家spell记录`);
 await page.reload();await expect(page.locator('.armor-cell [data-stat="ac"]')).toHaveText(edition==='2014'?'12':'10');expect((await savedCard(page)).training!.tools).toBe('手工工具记录');
});
test('mobile manual shield alias binds without mutating the saved record',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page,'2024','SHIELD',true);await expect(page.locator('.armor-cell [data-stat="ac"]')).toHaveText('12');
 const shield=armor(page).getByRole('button',{name:'盾牌',exact:true});await shield.scrollIntoViewIfNeeded();await expect(shield).toBeVisible();await expect(shield).toHaveAttribute('data-reference','itemProperty:entry:dnd-card.weapon-training:2024:shield');expect((await savedCard(page)).training!.armor).toBe('SHIELD');await page.screenshot({path:test.info().outputPath('mobile-shield-training.png')});
});
test('the new supporter alias/50 record loads in the announcement without duplicate requests',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);let requests=0;
 // Select the real public record from the built response so random marquee
 // order does not turn a data update check into a long probabilistic wait.
 await page.route('**/support/supporters.json',async route=>{
  requests++;const response=await route.fetch(),rows=await response.json();const added=rows.filter((row:{name:string})=>row.name==='别名');expect(added).toEqual([{name:'别名',amount:50}]);await route.fulfill({response,json:added});
 });
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await page.getByRole('button',{name:'公告',exact:true}).click();await expect(page.locator('.supporter-flight').filter({hasText:'别名'}).first()).toBeVisible();expect(requests).toBe(1);await page.screenshot({path:test.info().outputPath('supporter-alias-50.png')});
});
