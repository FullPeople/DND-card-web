import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Entry,type Character} from '../../src/core/model';
import {exportCharacter} from '../../src/core/export';
async function workspace(page:Page){return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(ok=>{const r=indexedDB.open('dnd-card-standalone');r.onsuccess=()=>ok(r.result);});try{return await new Promise<any>(ok=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>ok(r.result);});}finally{db.close();}});}
function expectOldBackup(rows:Character[],original:Character){const backup=rows.find(card=>card.id!==original.id&&card.name===original.name+'（同步前备份）');expect(backup).toBeDefined();expect({...backup,id:original.id,name:original.name,revision:original.revision,createdAt:original.createdAt,updatedAt:original.updatedAt}).toEqual(original);}

test('multi-candidate migration recommends the current handbook, respects custom and saves only the reviewed copy',async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);
 await page.route('**/data/races.json',r=>r.fulfill({json:{race:['PHB','XPHB','XDMG','EXP-A','EXP-B'].map(source=>({name:'原创旅人',ENG_name:'Original Traveller',source,entries:['原创迁移候选 '+source]}))}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 const c=newCharacter();c.name='三宝书推荐验收';c.profile.enabledSources=['PHB','XPHB','XDMG','EXP-A','EXP-B'];
 const old=(name:string,kind:Entry['kind']):Entry=>({id:'old:'+name,name,english:name,kind,source:'IMPORTED',packId:'imported',edition:'both',revision:'1',entries:['原创旧卡'],raw:{}});
 c.selections=[old('测试法师','class'),old('原创旅人','race')].map((entry,i)=>({id:'old-'+i,entry,level:1,quantity:1,equipped:false}));
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'migration218.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(c)))});await expect(page.getByRole('tab',{name:c.name+'（导入）'})).toHaveAttribute('aria-selected','true');await expect(page.locator('.save-status')).toContainText('已保存到本机');const imported=page.getByRole('dialog',{name:'导入与导出',exact:true});await imported.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect(imported).toHaveCount(0);
 const before=await workspace(page),original=before.characters.find((row:Character)=>row.id===before.activeId);
 await page.getByRole('button',{name:'核对并同步旧卡',exact:true}).click();const dialog=page.getByRole('dialog',{name:'旧卡资料同步',exact:true}),group=dialog.getByRole('radiogroup',{name:'原创旅人同步目标',exact:true});
 const core=group.getByRole('radio',{name:'原创旅人同步目标：原创旅人（XPHB）',exact:true}),custom=group.getByRole('radio',{name:'原创旅人同步目标：自定义',exact:true});
 await expect(group.getByRole('radio')).toHaveCount(5);await expect(core).toBeChecked();await expect(custom).not.toBeChecked();
 await page.screenshot({path:test.info().outputPath('core-handbook-default.png')});
 await custom.check();await dialog.getByRole('button',{name:'确认并继续',exact:true}).click();await dialog.getByRole('button',{name:'上一步',exact:true}).click();await expect(custom).toBeChecked();
 await core.check();await dialog.getByRole('button',{name:'确认并继续',exact:true}).click();
 await expect(dialog.locator('.migration-preview')).toContainText('原创旅人');expect((await workspace(page)).characters).toEqual(before.characters);
 await dialog.getByRole('button',{name:'备份旧卡并同步当前卡',exact:true}).click();await expect(dialog).toHaveCount(0);await page.reload();await expect(page.locator('.paper')).toBeVisible();
 const after=await workspace(page),copy=after.characters.find((row:Character)=>row.id===after.activeId);expectOldBackup(after.characters,original);expect(copy.id).toBe(original.id);expect(copy.selections.find((row:any)=>row.entry.kind==='race').entry.source).toBe('XPHB');
});
