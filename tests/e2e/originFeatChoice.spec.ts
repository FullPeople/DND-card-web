import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {originFeatData} from '../fixtures/originFeatChoice';
import {exportCharacter} from '../../src/core/export';
import {newCharacter,type Character} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {dragWiki} from './automationChoiceFixture';

async function ready(page:Page){
 await mockSource(page);await suppressAnnouncement(page);
 await page.route('**/data/races.json',route=>route.fulfill({json:{race:originFeatData.race}}));
 await page.route('**/data/feats.json',route=>route.fulfill({json:{feat:originFeatData.feat}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 const c=newCharacter();c.name='起源专长验收';c.automation=newAutomationState();const raw=originFeatData.race[0];c.selections=[{id:'origin-race',entry:{id:'fixture-origin-race',kind:'race',name:raw.name,english:raw.ENG_name,source:raw.source,edition:'2024',packId:'fixture',revision:'1',entries:raw.entries,raw},level:1,quantity:1,equipped:false}];
 await page.getByTestId('character-file').setInputFiles({name:'origin-choice.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 await expect(page.getByRole('tab',{name:'起源专长验收（导入）',exact:true})).toHaveAttribute('aria-selected','true');
 await page.keyboard.press('Escape');await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 await page.locator('[data-feature-id="origin-race:trait:0"] .feature-caption').click();
 await expect(page.getByRole('region',{name:'选择起源选择验收',exact:true})).toBeVisible();
}
async function saved(page:Page):Promise<Character>{return page.evaluate(async()=>{
 const dbName=(await indexedDB.databases()).find(db=>['dnd-card-standalone','dnd-card-workspace'].includes(db.name||''))?.name;if(!dbName)throw Error('Workspace database absent');
 return new Promise<Character>((resolve,reject)=>{const request=indexedDB.open(dbName);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,get=db.transaction('documents').objectStore('documents').get('workspace');get.onerror=()=>reject(get.error);get.onsuccess=()=>{db.close();resolve(get.result.characters.find((c:Character)=>c.id===get.result.activeId));};};});
});}
test('origin filter allows a valid feat, persists ownership, rejects duplicates and clears safely',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);
 await expect(page.locator('.choice-slot')).toHaveCount(1);await expect(page.locator('.catalog-row')).toHaveCount(2);
 await dragWiki(page,'验收警觉',0);await dragWiki(page,'验收警觉',0);
 await expect.poll(async()=>(await saved(page)).selections.filter(s=>s.entry.kind==='feat').length).toBe(1);
 const initial=await saved(page),grant=initial.selections.find(s=>s.entry.kind==='feat')!;expect(grant.parentId).toBe('origin-race:trait:0');expect(grant.requirementId).toBe('origin-race:trait:0:filter:0');
 await page.screenshot({path:info.outputPath('origin-feat-selected.png')});await page.getByRole('button',{name:'完成并返回',exact:true}).click();
 await expect(page.locator('[data-feature-id="origin-race:trait:0"]')).toContainText('起源选择验收：验收警觉');
 await page.reload();await expect(page.locator('.save-status')).toContainText('已保存到本机');
 expect((await saved(page)).selections.find(s=>s.id===grant.id)).toEqual(grant);
 await page.locator('[data-feature-id="origin-race:trait:0"] .feature-caption').click();
 await page.locator('[data-feature-id="origin-race:trait:0"]').getByRole('button',{name:'调整起源选择验收 1/1',exact:true}).click();
 await expect(page.locator('.choice-slot')).toContainText('验收警觉');
 await page.getByRole('button',{name:'移除验收警觉',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).selections.filter(s=>s.entry.kind==='feat').length).toBe(0);
 await dragWiki(page,'验收艺能',0);await page.getByRole('navigation',{name:'职业选择项'}).getByRole('button',{name:'熟练项 0/2',exact:true}).click();
 await expect(page.locator('.choice-slot')).toHaveCount(2);await expect(page.getByRole('region',{name:'选择熟练项',exact:true})).toBeVisible();
 expect(errors).toEqual([]);
});
