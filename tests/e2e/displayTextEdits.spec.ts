import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement,selectSheetPage,waitForCatalog} from './fixtures';
import {newCharacter,type Character} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';

const labels=['角色名','玩家','故乡','年龄','性别','阵营','身高','体重','背景描述','人物形象','个性','理念','羁绊','缺陷','背景故事'];
function authoredCard(name:string){
 const c=newCharacter();c.name=name;c.automation=newAutomationState();c.notes='原有备用故事';
 c.runtime.resources.manual={name:'保留的手工次数',current:2,max:9};
 c.selections=Array.from({length:80},(_,i)=>({id:'text-entry-'+i,entry:{id:'text-entry-'+i,name:'自制记录'+i,english:'Authored record '+i,kind:'feature' as const,edition:'2024' as const,source:'XPHB',revision:'1',packId:'fixture',entries:['自制回归资料。'],raw:{}},level:1,quantity:1,equipped:false}));
 (c as any).futurePrivateField={preserve:'自制未知字段'};return c;
}
async function records(page:Page){return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('dnd-card-standalone');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{return await new Promise<any>((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}
});}
async function setup(page:Page){
 await mockSource(page);await suppressAnnouncement(page);await page.context().route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local regression'}}));
 const cards=[authoredCard('文字验收一'),authoredCard('文字验收二')];
 await page.addInitScript(cards=>{
  localStorage.setItem('dnd-card:editing','true');
  (window as any).textCardClones=[];const clone=structuredClone;
  window.structuredClone=function(value,...args){const card=value as {id?:string;selections?:unknown[]}|undefined;if(card?.id===cards[0].id&&Array.isArray(card?.selections))(window as any).textCardClones.push(card.id);return Reflect.apply(clone,this,[value,...args]);};
  const r=indexedDB.open('dnd-card-standalone',1);r.onupgradeneeded=()=>{r.result.createObjectStore('documents');r.result.createObjectStore('cache');};
  r.onsuccess=()=>{const db=r.result,tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents'),read=store.get('workspace');read.onsuccess=()=>{if(!read.result)store.put({schemaVersion:1,characters:cards,activeId:cards[0].id,packs:[]},'workspace');};tx.oncomplete=()=>db.close();};
 },cards);
 await page.goto('/?intro=0');await waitForCatalog(page);await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();
 await expect(page.locator('.save-status')).toContainText('已保存到本机');await selectSheetPage(page,'背景');
 await page.evaluate(()=>(window as any).textCardClones=[]);
 return {cards,before:await records(page)};
}
const active=(page:Page)=>page.locator('.paper[data-active-sheet="true"]');

test('all background text fields save and reopen without changing resources, selections, sources or another card',async({page})=>{
 const {cards,before}=await setup(page),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 for(const label of labels)await active(page).getByRole('textbox',{name:label,exact:true}).fill('新填的'+label);
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
 expect(await page.evaluate(()=>(window as any).textCardClones)).toEqual([]);
 const saved=await records(page),first=saved.characters.find((c:Character)=>c.id===cards[0].id),original=before.characters.find((c:Character)=>c.id===cards[0].id);
 for(const field of ['selections','runtime','profile','automation','notes','answers','futurePrivateField'])expect(first[field]).toEqual(original[field]);
 expect(saved.characters.find((c:Character)=>c.id===cards[1].id)).toEqual(before.characters.find((c:Character)=>c.id===cards[1].id));
 await page.reload();await expect(page.locator('.save-status')).toContainText('已保存到本机');await selectSheetPage(page,'背景');
 for(const label of labels)await expect(active(page).getByRole('textbox',{name:label,exact:true})).toHaveValue('新填的'+label);
 await page.screenshot({path:test.info().outputPath('saved-background-text.png'),fullPage:true});
 expect(errors).toEqual([]);
});

test('text Undo and Redo survive card switching and do not overwrite the other card',async({page})=>{
 const {cards,before}=await setup(page);const story=()=>active(page).getByRole('textbox',{name:'背景故事',exact:true});
 await story().fill('撤销后还可以重做的故事');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.locator('.character-tabs').getByRole('tab',{name:cards[1].name,exact:true}).click();
 await expect(active(page)).toHaveAttribute('data-character-id',cards[1].id);
 await page.locator('.character-tabs').getByRole('tab',{name:cards[0].name,exact:true}).click();await selectSheetPage(page,'背景');await expect(story()).toHaveValue('撤销后还可以重做的故事');
 await story().blur();await page.keyboard.press('Control+z');await expect(story()).toHaveValue('原有备用故事');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.keyboard.press('Control+Shift+z');await expect(story()).toHaveValue('撤销后还可以重做的故事');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const saved=await records(page);expect(saved.characters.find((c:Character)=>c.id===cards[1].id)).toEqual(before.characters.find((c:Character)=>c.id===cards[1].id));
 await page.reload();await selectSheetPage(page,'背景');await expect(story()).toHaveValue('撤销后还可以重做的故事');
});

test('the second tab remains read-only and receives text without losing existing data',async({page,context})=>{
 const {cards}=await setup(page),second=await context.newPage();await second.goto('/?intro=0');await expect(second.locator('.app-shell')).toBeVisible();
 await expect(second.getByText('另一标签页正在编辑，此页仅供查阅和导出。关闭另一页后将自动读取最新记录并接手。', {exact:true})).toBeVisible();
 await active(page).getByRole('textbox',{name:'背景故事',exact:true}).fill('第一标签页的新故事');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await selectSheetPage(second,'背景');await expect(active(second).locator('.bio-story')).toContainText('第一标签页的新故事');
 await expect(active(second).getByRole('textbox',{name:'背景故事',exact:true})).toHaveCount(0);
 const saved=await records(second);expect(saved.characters.find((c:Character)=>c.id===cards[0].id).runtime.resources.manual.current).toBe(2);await second.close();
});

test('a local write failure preserves the text draft and the last durable snapshot',async({page})=>{
 const {cards,before}=await setup(page);
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;(window as any).restoreTextPut=()=>{IDBObjectStore.prototype.put=put;};IDBObjectStore.prototype.put=function(value,key){if(key==='workspace')throw new DOMException('自制保存失败','QuotaExceededError');return put.apply(this,arguments as any);};});
 const story=active(page).getByRole('textbox',{name:'背景故事',exact:true});await story.fill('写入失败也要保留的草稿');await expect(page.locator('.save-status')).toContainText('保存失败');await expect(story).toHaveValue('写入失败也要保留的草稿');
 const failed=await records(page);expect(failed.characters.find((c:Character)=>c.id===cards[0].id).biography).toEqual(before.characters.find((c:Character)=>c.id===cards[0].id).biography);
 await page.evaluate(()=>(window as any).restoreTextPut());await story.fill('恢复写入后的完整故事');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.reload();await selectSheetPage(page,'背景');await expect(active(page).getByRole('textbox',{name:'背景故事',exact:true})).toHaveValue('恢复写入后的完整故事');
});
