import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
async function ready(page:Page,url:string){
 await mockSource(page);await page.route('https://5e.kiwee.top/data/items.json',r=>r.fulfill({json:{item:[{name:'全站测试物品',ENG_name:'Shared Test Item',source:'XGE',type:'G',entries:['此条目用于验证资料来源共享。']}]}}));
 await page.goto(url);await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
}
const xge=(page:Page)=>page.locator('.source-book').filter({has:page.getByRole('button',{name:'设置来源 XGE',exact:true})});
async function rules(page:Page){await page.getByRole('button',{name:'规则与扩展',exact:true}).click();}
async function close(page:Page){await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();}
async function newCard(page:Page,edition='2014'){
 await page.getByRole('button',{name:/角色簿/}).click();await page.getByRole('button',{name:new RegExp(edition+' 角色')}).click();
}
async function stored(page:Page){return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('dnd-card-standalone');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 return new Promise<any>(resolve=>{const request=db.transaction('documents').objectStore('documents').get('workspace');request.onsuccess=()=>{db.close();resolve(request.result);};});
});}

test('source toggles belong to the website across new cards, switches, imports and reload',async({page,baseURL})=>{
 await ready(page,baseURL!);await rules(page);await expect(xge(page).getByRole('checkbox')).toBeChecked();await xge(page).getByRole('checkbox').uncheck();await close(page);
 await newCard(page);await rules(page);await expect(xge(page).getByRole('checkbox')).not.toBeChecked();
 await expect(page.getByRole('radio',{name:'2014',exact:true})).toBeChecked();await close(page);
 await page.getByRole('button',{name:'装备',exact:true}).click();await page.getByLabel('资料版本').selectOption('all');
 await expect(page.locator('.catalog-row').filter({hasText:'全站测试物品'})).toHaveCount(0);
 await page.getByRole('tablist',{name:'当前角色'}).getByRole('tab').first().click();
 await expect(page.getByLabel('资料版本')).toHaveValue('all');await rules(page);await expect(xge(page).getByRole('checkbox')).not.toBeChecked();await expect(page.getByRole('radio',{name:'2024',exact:true})).toBeChecked();
 await close(page);await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const snapshot=await stored(page),imported=structuredClone(snapshot.characters[0]);imported.profile.enabledSources=['XGE'];imported.name='异配置角色';
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
 await page.getByTestId('character-file').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({character:imported}))});await close(page);
 await rules(page);await expect(xge(page).getByRole('checkbox')).not.toBeChecked();await close(page);
 await page.reload();await rules(page);await expect(xge(page).getByRole('checkbox')).not.toBeChecked();
 await xge(page).getByRole('checkbox').check();await close(page);await page.getByRole('tablist',{name:'当前角色'}).getByRole('tab').nth(1).click();
 await expect(page.locator('.catalog-row').filter({hasText:'全站测试物品'})).toHaveCount(1);
});

test('per-entry disabled marks are shared and remain searchable; rule toggles and edition remain personal',async({page,baseURL})=>{
 await ready(page,baseURL!);await newCard(page);await rules(page);
 await page.getByRole('checkbox',{name:/专长规则/}).uncheck();
 await page.getByRole('button',{name:'设置来源 XGE',exact:true}).click();await page.getByRole('checkbox',{name:'启用条目 全站测试物品',exact:true}).uncheck();
 await page.getByRole('button',{name:'关闭来源设置',exact:true}).click();await close(page);
 await page.getByRole('tablist',{name:'当前角色'}).getByRole('tab').first().click();await rules(page);
 await expect(page.getByRole('checkbox',{name:/专长规则/})).toBeChecked();await expect(page.getByRole('radio',{name:'2024',exact:true})).toBeChecked();await close(page);
 await page.getByRole('button',{name:'装备',exact:true}).click();const row=page.locator('.catalog-row').filter({hasText:'全站测试物品'});
 await expect(row).toHaveClass(/entry-disabled/);await row.click();await expect(page.locator('.entry-detail')).toHaveClass(/entry-disabled/);
 await page.getByLabel('搜索规则资料').fill('全站测试物品');await expect(page.locator('.global-result').filter({hasText:'全站测试物品'})).toHaveClass(/entry-disabled/);
 await page.getByRole('button',{name:'关闭搜索结果',exact:true}).click();
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(row).not.toHaveClass(/entry-disabled/);
 await page.getByRole('button',{name:'重做',exact:true}).click();await expect(row).toHaveClass(/entry-disabled/);
});

test('legacy per-card sources migrate from the active card once, preserving original choices',async({page,baseURL})=>{
 await ready(page,baseURL!);await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('dnd-card-standalone');r.onsuccess=()=>resolve(r.result);});
  const read=db.transaction('documents').objectStore('documents').get('workspace');const w:any=await new Promise(resolve=>{read.onsuccess=()=>resolve(read.result);});
  const a=w.characters[0],b=structuredClone(a);a.name='旧角色甲';a.edition='2014';a.profile.enabledSources=['PHB'];delete a.profile.autoSourceDefaults;
  b.id='legacy-b';b.name='旧角色乙';b.edition='2024';b.profile.enabledSources=['XPHB','XGE'];delete b.profile.autoSourceDefaults;
  w.characters=[a,b];w.activeId=a.id;delete w.siteSources;delete w.legacySourceProfiles;
  await new Promise<void>(resolve=>{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put(w,'workspace');tx.oncomplete=()=>resolve();});db.close();
 });await page.reload();await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await rules(page);await expect(xge(page).getByRole('checkbox')).not.toBeChecked();await close(page);
 await page.getByRole('tab',{name:'旧角色乙',exact:true}).click();await rules(page);await expect(xge(page).getByRole('checkbox')).not.toBeChecked();await close(page);
 const w=await stored(page);expect(w.siteSources.enabledSources).toEqual(['PHB']);expect(w.legacySourceProfiles['legacy-b'].enabledSources).toEqual(['XPHB','XGE']);
});

test('source configuration code changes sources without changing card version or optional rules',async({page,baseURL})=>{
 await ready(page,baseURL!);await rules(page);await page.getByRole('button',{name:'导出配置',exact:true}).click();
 await expect(page.getByLabel('规则配置码')).not.toHaveValue('');const code=await page.getByLabel('规则配置码').inputValue();await close(page);await newCard(page);await rules(page);
 await page.getByRole('checkbox',{name:/专长规则/}).uncheck();await page.getByRole('button',{name:'全部禁用',exact:true}).click();
 await page.getByLabel('规则配置码').fill(code);await page.getByRole('button',{name:'导入配置',exact:true}).click();
 await expect(xge(page).getByRole('checkbox')).toBeChecked();await expect(page.getByRole('radio',{name:'2014',exact:true})).toBeChecked();await expect(page.getByRole('checkbox',{name:/专长规则/})).not.toBeChecked();
});
