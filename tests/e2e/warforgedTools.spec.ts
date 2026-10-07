import {test,expect,type Page} from '@playwright/test';
import {newCharacter,type Character} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';
import {mockSource,suppressAnnouncement} from './fixtures';
import {source,warforgedToolEntries} from '../helpers/warforgedToolFixture';
async function saved(page:Page){return page.evaluate(async()=>{
 const req=indexedDB.open('dnd-card-standalone'),db=await new Promise<IDBDatabase>((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 try{return await new Promise<Character>((resolve,reject)=>{const get=db.transaction('documents').objectStore('documents').get('workspace');get.onsuccess=()=>resolve(get.result.characters.find((c:Character)=>c.id===get.result.activeId));get.onerror=()=>reject(get.error);});}finally{db.close();}
});}
async function ready(page:Page,book:'ERLW'|'EFA',mobile=false){
 await mockSource(page,{displayMode:mobile?'screen':'a4'});await suppressAnnouncement(page);
 await page.route('**/data/races.json',route=>route.fulfill({json:{race:source.projection.race}}));
 await page.route('**/data/items-base.json',route=>route.fulfill({json:{baseitem:source.projection.baseitem}}));
 await page.route('**/data/skills.json',route=>route.fulfill({json:{skill:['PHB','XPHB'].map(source=>({name:'运动',ENG_name:'Athletics',source,entries:['原创拖拽技能验收夹具。']}))}}));
 const c=newCharacter(book==='ERLW'?'2014':'2024');c.name='战俑工具入口 '+book;c.automation=newAutomationState();c.profile.enabledSources.push(book);c.training={tools:'手工工具记录',languages:'手工语言'};c.runtime.hp=7;c.runtime.resources={spent:{current:1,max:4}};c.selections=[{id:'race',entry:warforgedToolEntries().find(e=>e.kind==='race'&&e.source===book)!,quantity:1,level:1,equipped:false}];
 await page.goto('/');if(mobile)await page.getByRole('button',{name:'Wiki',exact:true}).click();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();if(mobile)await page.getByRole('button',{name:'功能页',exact:true}).click();
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'synthetic-warforged-tools.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});
 if(book==='ERLW')await page.getByRole('dialog',{name:'导入前核对',exact:true}).getByRole('button',{name:'保留全部记录并导入',exact:true}).click();await page.getByRole('dialog',{name:'导入与导出',exact:true}).getByRole('button',{name:'关闭弹窗',exact:true}).click();
 const toggle=page.getByRole('switch',{name:'编辑模式',exact:true});if(await toggle.getAttribute('aria-checked')!=='true')await toggle.click();return c;
}
for(const book of ['ERLW','EFA'] as const)test(`${book} real Warforged skill/tool slots accept drags, replacement, undo and persisted removal`,async({page})=>{
 await ready(page,book);await page.getByRole('button',{name:'工具熟练 0/1',exact:true}).click();const tools=page.getByRole('region',{name:'选择工具熟练',exact:true}),slot=tools.locator('[aria-label="工具熟练选择格 1"]');await expect(slot).toBeVisible();
 await page.locator('.catalog-row').filter({hasText:'炼金工具'}).dragTo(slot);await expect(tools.getByRole('status')).toContainText('1/1');await expect(slot).toContainText('炼金工具');
 await page.locator('.catalog-row').filter({hasText:'风笛'}).dragTo(slot);await expect(slot).toContainText('风笛');await expect(slot).not.toContainText('炼金工具');await tools.getByRole('button',{name:'完成并返回',exact:true}).click();
 await page.getByRole('button',{name:'熟练项 0/1',exact:true}).click();const skills=page.getByRole('region',{name:'选择熟练项',exact:true});await page.locator('.catalog-row').filter({hasText:'运动'}).dragTo(skills.locator('[aria-label="熟练项选择格 1"]'));await expect(skills.getByRole('status')).toContainText('1/1');await skills.getByRole('button',{name:'完成并返回',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).answers['race:tools:0']?.[0]).toBe(warforgedToolEntries().find(e=>e.name==='风笛'&&e.source===(book==='ERLW'?'PHB':'XPHB'))!.id);const chosen=await saved(page);expect(chosen.training?.tools).toBe('手工工具记录');expect(chosen.runtime.resources.spent.current).toBe(1);expect(chosen.selections).toHaveLength(1);
 await page.reload();await expect(page.getByRole('button',{name:'工具熟练 1/1',exact:true})).toBeVisible();await page.getByRole('button',{name:'工具熟练 1/1',exact:true}).click();await tools.getByRole('button',{name:'移除风笛',exact:true}).click();await expect(slot).toContainText('等待拖拽加入');await tools.getByRole('button',{name:'完成并返回',exact:true}).click();
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(page.getByRole('button',{name:'工具熟练 1/1',exact:true})).toBeVisible();await page.getByRole('button',{name:'重做',exact:true}).click();await expect(page.getByRole('button',{name:'工具熟练 0/1',exact:true})).toBeVisible();await page.reload();expect((await saved(page)).answers['race:tools:0']).toEqual(['']);expect((await saved(page)).training).toEqual(chosen.training);expect((await saved(page)).runtime).toEqual(chosen.runtime);await page.screenshot({path:test.info().outputPath('warforged-tools-'+book+'.png')});
});
