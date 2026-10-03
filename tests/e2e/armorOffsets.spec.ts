import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter,type Character} from '../../src/core/model';

async function seed(page:Page,card:Character){
 await mockSource(page);
 await page.addInitScript(card=>{const request=indexedDB.open('dnd-card-workspace',1);request.onupgradeneeded=()=>{request.result.createObjectStore('documents');request.result.createObjectStore('cache');};request.onsuccess=()=>{const db=request.result,tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents'),get=store.get('workspace');get.onsuccess=()=>{if(!get.result)store.put({schemaVersion:1,characters:[card],activeId:card.id,packs:[]},'workspace');};tx.oncomplete=()=>db.close();};},card);
 await page.goto('/');await expect(page.locator('.paper')).toBeVisible();await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
}
async function saved(page:Page){return page.evaluate(async()=>{const request=indexedDB.open('dnd-card-workspace');const db=await new Promise<IDBDatabase>(resolve=>request.onsuccess=()=>resolve(request.result));try{return await new Promise<Character>(resolve=>{const get=db.transaction('documents').objectStore('documents').get('workspace');get.onsuccess=()=>resolve(get.result.characters.find((c:Character)=>c.id===get.result.activeId));});}finally{db.close();}});}
function legacy(){const card=newCharacter();card.name='旧护甲核对';card.abilities.dex=14;card.sheetBonuses={ac:2};card.adjustments=[{id:'suite-ac',target:'ac',value:16,reason:'枭熊场景'}];return card;}
const open=async(page:Page)=>{await page.getByRole('button',{name:'自动化设置',exact:true}).click();return page.getByRole('dialog',{name:'基础自动化',exact:true});};

test('new manual AC changes are offsets and clearing them restores the calculation',async({page})=>{
 const card=newCharacter();card.abilities.dex=14;await seed(page,card);const value=page.locator('.armor-cell [data-stat="ac"]');await expect(value).toHaveText('12');
 await expect(page.getByRole('button',{name:'条目 / 等级',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'数值依据与人工修正',exact:true})).toHaveCount(0);
 const dialog=await open(page);await expect(dialog.getByLabel('人工修正目标')).toHaveCount(0);
 const adjustment=dialog.getByLabel('数值面板护甲调整值');await adjustment.fill('3');await adjustment.press('Tab');await expect(value).toHaveText('15');await expect.poll(async()=>(await saved(page)).sheetBonuses?.ac).toBe(3);
 await adjustment.fill('0');await adjustment.press('Tab');await expect(value).toHaveText('12');await expect.poll(async()=>(await saved(page)).sheetBonuses?.ac).toBe(0);
 expect((await saved(page)).adjustments?.some(row=>row.target==='ac')||false).toBe(false);
});

test('legacy override recovery is explicit, reversible, and keeps original evidence on reload',async({page})=>{
 await seed(page,legacy());const value=page.locator('.armor-cell [data-stat="ac"]');await expect(value).toHaveText('18');
 const dialog=await open(page);await expect(dialog.getByRole('alert')).toContainText('旧护甲最终值覆盖');await dialog.getByRole('button',{name:/恢复规则计算/}).click();await expect(value).toHaveText('14');
 await expect.poll(async()=>(await saved(page)).armorAdjustmentHistory?.[0].records[0].id).toBe('suite-ac');
 await dialog.getByRole('button',{name:'关闭弹窗',exact:true}).click();await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(value).toHaveText('18');
 await page.getByRole('button',{name:'重做',exact:true}).click();await expect(value).toHaveText('14');await expect.poll(async()=>(await saved(page)).adjustments?.length).toBe(0);
 await page.reload();await expect(value).toHaveText('14');expect((await saved(page)).armorAdjustmentHistory?.[0]).toMatchObject({action:'restore',previousBonus:2,previousTotal:18,ruleTotal:12,resultingBonus:2});
});

test('converting old total does not double the existing offset and remains removable',async({page})=>{
 await seed(page,legacy());const value=page.locator('.armor-cell [data-stat="ac"]');const dialog=await open(page);
 await dialog.getByRole('button',{name:'将当前总值转为调整 +6',exact:true}).click();await expect(value).toHaveText('18');await expect(dialog.getByLabel('数值面板护甲调整值')).toHaveValue('6');
 await expect.poll(async()=>(await saved(page)).armorAdjustmentHistory?.length).toBe(1);await page.reload();await expect(value).toHaveText('18');
 const reopened=await open(page);await expect(reopened.getByRole('button',{name:/将当前总值/})).toHaveCount(0);await reopened.getByLabel('数值面板护甲调整值').fill('0');await reopened.getByLabel('数值面板护甲调整值').press('Tab');await expect(value).toHaveText('12');
 await expect.poll(async()=>(await saved(page)).sheetBonuses?.ac).toBe(0);expect((await saved(page)).armorAdjustmentHistory).toHaveLength(1);
});
