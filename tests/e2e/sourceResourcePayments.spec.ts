import {expect,test,type Page} from '@playwright/test';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {exportCharacter} from '../../src/core/export';
import {mockSource,suppressAnnouncement} from './fixtures';

const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']={}):Entry=>({id,kind,name:id,english:id,source:'XPHB',edition:'2024',packId:'authored',revision:'fixture',entries:[],raw});
function card(){
 const c=newCharacter();c.name='原创点数施法验收';c.automation=newAutomationState();
 c.selections=[{id:'class',entry:entry('原创导引者','class',{classTableGroups:[{colLabels:['原创星火'],rows:Array.from({length:20},(_,i)=>[i+1])}]}),level:6,quantity:1,equipped:false},{id:'owner',parentId:'class',entry:entry('原创引火法','feature',{additionalSpells:[{ability:'wis',resourceName:'Authored Sparks',innate:{3:{resource:{2:['原创光焰|XPHB']}}}}]}),level:3,quantity:1,equipped:false},{id:'catalog-spell',entry:entry('原创光焰','spell',{level:1,school:'E'}),level:1,quantity:1,equipped:false}];return c;
}
async function stored(page:Page){return page.evaluate(async()=>{
 const request=indexedDB.open('dnd-card-automation-choices-20261001');await new Promise<void>((resolve,reject)=>{request.onerror=()=>reject(request.error);request.onupgradeneeded=()=>{request.transaction?.abort();reject(Error('Expected saved choice-preview workspace'));};request.onsuccess=()=>resolve();});
 const db=request.result;try{return await new Promise<any>((resolve,reject)=>{const read=db.transaction('documents').objectStore('documents').get('workspace');read.onerror=()=>reject(read.error);read.onsuccess=()=>resolve(read.result.characters.find((c:any)=>c.id===read.result.activeId));});}finally{db.close();}
});}
async function importCard(page:Page,value:unknown){await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'authored-points.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect(page.locator('.save-status')).toContainText('已保存到本机');}
async function ready(page:Page){await mockSource(page);await suppressAnnouncement(page);await page.goto('/');await expect(page.getByRole('button',{name:'导入 / 导出',exact:true})).toBeEnabled();await importCard(page,exportCharacter(card()));}
async function bind(page:Page){await page.getByRole('button',{name:'自动化设置',exact:true}).click();await page.getByRole('combobox',{name:'原创引火法的Authored Sparks资源',exact:true}).selectOption('原创星火');await expect.poll(async()=>Object.values((await stored(page)).runtime.resources).find((r:any)=>r.name==='原创星火')).toMatchObject({max:6,current:6});await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();}
async function points(page:Page){return Object.values((await stored(page)).runtime.resources).find((r:any)=>r.name==='原创星火') as any;}
async function spellDialog(page:Page){await page.getByRole('tab',{name:'法术',exact:true}).click();await page.getByRole('button',{name:'原创光焰施放详情',exact:true}).click();return page.getByRole('dialog',{name:'原创光焰施放详情',exact:true});}

test('explicit point binding and paid casts survive native import and leveling without a free or slot fallback',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);expect(await points(page)).toBeUndefined();await bind(page);
 let dialog=await spellDialog(page);await expect(dialog).toContainText('Authored Sparks（消耗 2；6 / 6）');await expect(dialog.getByRole('combobox')).toHaveCount(0);await expect(dialog.getByRole('button',{name:/恢复/})).toHaveCount(0);
 await dialog.getByRole('button',{name:'使用',exact:true}).click();await expect.poll(()=>points(page)).toMatchObject({current:4});await page.getByRole('button',{name:'关闭施放详情',exact:true}).click();
 await importCard(page,exportCharacter(await stored(page)));await expect.poll(()=>points(page)).toMatchObject({max:6,current:4});await page.getByRole('tab',{name:'主要',exact:true}).click();await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 const level=page.getByRole('spinbutton',{name:'原创导引者等级',exact:true});await level.fill('8');await level.press('Tab');await expect.poll(()=>points(page)).toMatchObject({max:8,current:6});await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 dialog=await spellDialog(page);for(const remaining of [4,2,0]){await dialog.getByRole('button',{name:'使用',exact:true}).click();await expect.poll(()=>points(page)).toMatchObject({current:remaining});}
 await expect(dialog.getByRole('button',{name:'使用',exact:true})).toBeDisabled();await expect(dialog.getByRole('combobox')).toHaveCount(0);await page.getByRole('button',{name:'关闭施放详情',exact:true}).click();await page.reload();await expect.poll(()=>points(page)).toMatchObject({max:8,current:0});
 dialog=await spellDialog(page);await expect(dialog.getByRole('button',{name:'使用',exact:true})).toBeDisabled();expect(errors).toEqual([]);
});
test('narrow resource-column selection stays usable and keeps its saved binding after reload',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);await bind(page);await page.reload();await page.getByRole('button',{name:'自动化设置',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'基础自动化',exact:true});await expect(dialog.getByRole('combobox',{name:'原创引火法的Authored Sparks资源',exact:true})).toHaveValue('原创星火');expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
 await expect(page.getByRole('button',{name:/短休|长休|恢复以上/})).toHaveCount(0);expect(await points(page)).toMatchObject({max:6,current:6});
});
