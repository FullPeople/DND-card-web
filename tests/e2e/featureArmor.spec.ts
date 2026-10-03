import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {dragWiki} from './automationChoiceFixture';
import {armorFeatureFixture} from '../fixtures/featureArmor';
import type {Character,Entry} from '../../src/core/model';
import {exportCharacter} from '../../src/core/export';
import {normalizeFixtureData} from '../helpers/irFixture';
import {authorBrowserCatalogue,installBrowserAutomation} from './automationFixtures';

async function saved(page:Page):Promise<Character>{return page.evaluate(async()=>{
 const request=indexedDB.open('dnd-card-standalone');
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{return await new Promise<Character>((resolve,reject)=>{const get=db.transaction('documents').objectStore('documents').get('workspace');get.onerror=()=>reject(get.error);get.onsuccess=()=>{const workspace=get.result,card=workspace?.characters?.find((row:Character)=>row.id===workspace.activeId);if(card)resolve(card);else reject(Error('Active character not saved'));};});}finally{db.close();}
});}
async function ready(page:Page,edition:'2014'|'2024'){
 const {c,data,entries}=armorFeatureFixture(edition,normalizeFixtureData),authored=authorBrowserCatalogue(data);c.name=`护甲来源${edition}`;c.runtime.resources={spent:{current:0,max:2}};
 await mockSource(page);await suppressAnnouncement(page);
 await installBrowserAutomation(page,entries,false);
 await page.route('**/data/class/index.json',r=>r.fulfill({json:{fixture:'class-armor.json'},headers:{'access-control-allow-origin':'*'}}));
 await page.route('**/data/class/class-armor.json',r=>r.fulfill({json:authored.body,headers:{'access-control-allow-origin':'*'}}));
 await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'armor.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 if(edition==='2014'){
  // The app deliberately asks before importing an older-edition card into the
  // default 2024 workspace. Complete that review rather than bypassing it.
  const review=page.getByRole('dialog',{name:'导入前核对',exact:true});await expect(review).toBeVisible();await expect(review).toContainText('导入角色使用 2014，当前规则使用 2024。导入后保留该角色自己的规则版本。');
  await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();await expect(review).toHaveCount(0);
 }
 await expect(page.getByRole('tab',{name:new RegExp(`^护甲来源${edition}（导入）`)})).toHaveAttribute('aria-selected','true');
 await page.getByRole('dialog',{name:'导入与导出',exact:true}).getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).edition).toBe(edition);
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
}
async function choose(page:Page,name:string){
 await page.getByRole('tab',{name:'特性',exact:true}).click();
 const caption=page.locator('[data-feature-id]').filter({hasText:'测试风格'}).first().locator('.feature-caption');
 if(await caption.getAttribute('aria-label').then(label=>label?.startsWith('选择')))await caption.click();else{if(await caption.getAttribute('aria-expanded')!=='true')await caption.click();await page.locator('[data-feature-id]').filter({hasText:'测试风格'}).first().getByRole('button',{name:/^调整测试风格/}).click();}
 const choices=page.getByRole('region',{name:'选择测试风格',exact:true});await expect(choices).toBeVisible();
 // Catalog-backed feature/feat choices use the actual Wiki drag/replace path,
 // unlike synthetic inline options which render buttons inside the workspace.
 await expect(choices.locator('.choice-slot')).toHaveCount(1);await dragWiki(page,name,0);await expect(choices.getByRole('status')).toContainText('测试风格 1/1');
 await expect.poll(async()=>(await saved(page)).selections.filter(row=>row.grantKey?.startsWith('choice:')).map(row=>row.entry.name)).toEqual([name]);
 await page.getByRole('button',{name:'返回特性',exact:true}).click();
 await page.getByRole('tab',{name:'主要',exact:true}).click();
}
for(const edition of ['2014','2024'] as const)test(`${edition} dashed source choice applies armor AC, replacement/undo/reload and shield-only conditions`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page,edition);const ac=page.locator('.armor-cell [data-stat="ac"]');await expect(ac).toHaveText('16');
 await page.getByRole('tab',{name:'特性',exact:true}).click();const pending=page.locator('[data-feature-id]').filter({hasText:'测试风格'}).first();await expect(pending).toHaveClass(/is-pending|choice-pending/);
 await choose(page,'测试护甲加值');await expect(ac).toHaveText('17');await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(ac).toHaveText('16');await page.getByRole('button',{name:'重做',exact:true}).click();await expect(ac).toHaveText('17');
 const offset=page.getByLabel('护甲等级调整值',{exact:true});await offset.fill('2');await offset.press('Enter');await expect(ac).toHaveText('19');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.reload({waitUntil:'domcontentloaded'});await expect(ac).toHaveText('19');await page.getByRole('button',{name:'自动化设置',exact:true}).click();
 await page.getByRole('checkbox',{name:'装备 测试盾',exact:true}).check();await expect(page.getByTestId('automation-ac')).toHaveText('21');
 await page.getByRole('checkbox',{name:'装备 测试身甲',exact:true}).uncheck();await expect(page.getByTestId('automation-ac')).toHaveText('14');
 await page.getByRole('checkbox',{name:'装备 测试身甲',exact:true}).check();await expect(page.getByTestId('automation-ac')).toHaveText('21');await page.keyboard.press('Escape');
 await choose(page,'测试替代');await expect(ac).toHaveText('20');await choose(page,'测试护甲加值');await expect(ac).toHaveText('21');
 const restored=await saved(page);expect(restored.edition).toBe(edition);expect(restored.selections.find(row=>row.grantKey?.startsWith('choice:'))?.entry.edition).toBe(edition);expect(restored.runtime.resources.spent.current).toBe(0);
 await page.locator('.armor-cell').screenshot({path:test.info().outputPath(`armor-source-${edition}.png`)});expect(errors).toEqual([]);
});
