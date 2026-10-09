import {expect,test,type Page} from '@playwright/test';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';
import {mockSource,suppressAnnouncement} from './fixtures';

async function stored(page:Page){
 return page.evaluate(async()=>{
  const request=indexedDB.open('dnd-card-standalone');await new Promise<void>(resolve=>request.onsuccess=()=>resolve());
  const db=request.result;
  try{return await new Promise<any>((resolve,reject)=>{const read=db.transaction('documents').objectStore('documents').get('workspace');read.onerror=()=>reject(read.error);read.onsuccess=()=>resolve(read.result.characters.find((c:any)=>c.id===read.result.activeId));});}finally{db.close();}
 });
}
async function importCard(page:Page,value:unknown){
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 await page.getByTestId('character-file').setInputFiles({name:'authored-resource.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
 await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
}

test('named class resource spending survives level changes, reload and native JSON import',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await mockSource(page);await suppressAnnouncement(page);
 const c=newCharacter();c.name='原创动态资源验收';c.automation=newAutomationState();
 const entry:Entry={id:'resource-rule-owner',kind:'class',name:'原创守望者',english:'Authored Watcher',source:'XPHB',edition:'2024',packId:'authored',revision:'1',entries:[],raw:{}};
 c.selections=[{id:'owner',entry,level:2,quantity:1,equipped:false},{id:'reserve',entry:{...entry,id:'resource-rule-reserve',name:'原创储备职业',english:'Authored Reserve',raw:{identifier:'reserve'}},level:5,quantity:1,equipped:false},{id:'feature',parentId:'owner',entry:{...entry,id:'resource-rule-feature',kind:'feature',name:'原创储备次数',english:'Authored Reserve Uses',raw:{resources:[{max:'@classes.reserve.levels',recovery:'long'}]}},level:1,quantity:1,equipped:false}];
 await page.goto('/');await expect(page.getByRole('button',{name:'导入 / 导出',exact:true})).toBeEnabled();await importCard(page,exportCharacter(c));
 const resource=page.locator('.resource-widget[data-resource-name="原创储备次数"]');await expect(resource).toBeVisible();
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await resource.locator('.resource-widget-face').click();
 const editor=page.getByRole('dialog',{name:'资源设置',exact:true});await expect(editor.getByRole('spinbutton',{name:'资源上限',exact:true})).toHaveValue('5');
 await editor.getByRole('spinbutton',{name:'资源剩余',exact:true}).fill('2');await editor.getByRole('button',{name:'保存',exact:true}).click();await page.keyboard.press('Escape');
 const level=page.getByRole('spinbutton',{name:'原创储备职业等级',exact:true});await level.fill('7');await level.press('Tab');
 await expect.poll(async()=>Object.values((await stored(page)).runtime.resources).find((r:any)=>r.name==='原创储备次数')).toMatchObject({max:7,current:4});
 await page.reload();await expect(resource).toBeVisible();expect(Object.values((await stored(page)).runtime.resources).find((r:any)=>r.name==='原创储备次数')).toMatchObject({max:7,current:4});
 const saved=await stored(page);await importCard(page,exportCharacter(saved));await expect(resource).toBeVisible();
 await expect.poll(async()=>Object.values((await stored(page)).runtime.resources).find((r:any)=>r.name==='原创储备次数')).toMatchObject({max:7,current:4});
 await expect(page.getByRole('button',{name:/短休|长休/})).toHaveCount(0);expect(errors).toEqual([]);
});
