import {expect,test,type Page} from '@playwright/test';
import {newCharacter,type Entry} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';
import {planFeatureResources} from '../../src/core/automation/featureResources';
import {exportCharacter} from '../../src/core/export';
import {mockSource,suppressAnnouncement,waitForCatalog,expandSourceBook} from './fixtures';

// Authored data only. Read durable documents; never inject an App draft.
async function saved(page:Page){return page.evaluate(async()=>{
 const path=new URL('src/platform/workspaceIdentity.ts',document.baseURI).pathname;
 const database=(await import(path)).workspaceIdentity.database;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(database);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{const store=db.transaction('documents','readonly').objectStore('documents'),read=(key:string)=>new Promise<any>((resolve,reject)=>{const request=store.get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const [workspace,navigation]=await Promise.all([read('workspace'),read('workspace-active-id')]),activeId=navigation===undefined?workspace.activeId:navigation;
  if(typeof activeId!=='string'||!workspace.characters.some((row:any)=>row.id===activeId))throw Error('Invalid durable active character');
  return workspace.characters.find((row:any)=>row.id===activeId);
 }finally{db.close();}
});}

function fixture(){
 const c=newCharacter('2024');c.name='手工次数归属验收';c.automation=newAutomationState();c.profile.enabledSources=['XPHB'];
 const entry:Entry={id:'authored-owner',kind:'class',name:'Authored owner',english:'Authored owner',source:'XPHB',edition:'2024',packId:'authored',revision:'1',entries:[],raw:{}};
 c.selections=[{id:'owner',entry,level:2,quantity:1,equipped:false},{id:'feature',parentId:'owner',entry:{...entry,id:'authored-feature',kind:'feature',name:'Authored resource',english:'Authored resource',raw:{resources:[{max:3,recovery:'long'}]}},level:1,quantity:1,equipped:false}];
 const key=planFeatureResources(c).grants[0].key;
 c.runtime.resources[key]={name:'Authored manual record',max:9,current:2,automatic:false,locked:true};c.notes='Authored manual note';
 return {c,key,manual:structuredClone(c.runtime.resources[key])};
}

async function source(page:Page,enabled:boolean){
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expandSourceBook(page,'XPHB');
 const book=page.locator('.source-book').filter({has:page.locator('button[aria-label="设置来源 XPHB"]')});await book.locator('input[type=checkbox]').first().setChecked(enabled);
 await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
}

for(const [display,viewport] of [['desktop',{width:1512,height:982}],['narrow',{width:390,height:844}]] as const)test.describe(display,()=>{
 test.use({viewport,hasTouch:display==='narrow'});
test('actual imported manual resource survives reconciliation, reopening, source restoration and readonly viewing',async({page,context},info)=>{
 expect(page.viewportSize()).toEqual(viewport);
 const f=fixture(),errors:string[]=[],writes:string[]=[];
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 await context.route('**/api/**',route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))writes.push(route.request().method());return route.fulfill({status:401,json:{error:'authored isolated resource acceptance'}});});
 page.on('pageerror',error=>errors.push(error.message));await page.goto('./?intro=0');await waitForCatalog(page);
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'authored-manual-collision.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportCharacter(f.c)))});
 const review=page.getByRole('dialog',{name:'导入前核对',exact:true}),imported=page.getByRole('tab',{name:/^手工次数归属验收（导入）(?:旧卡资料需要核对)?$/,exact:true});await expect(review.or(imported)).toBeVisible();
 if(await review.isVisible())await review.getByRole('button',{name:'保留全部记录并导入',exact:true}).click();await expect(imported).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');
 await expect.poll(async()=>(await saved(page)).runtime.resources[f.key]).toEqual(f.manual);
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.getByRole('button',{name:'自动化设置',exact:true}).click();await expect(page.locator('.automation-panel').getByRole('alert').filter({hasText:'已有其他资源记录'})).toBeVisible();
 await page.screenshot({path:info.outputPath('manual-resource-held.png')});await page.keyboard.press('Escape');
 await page.reload();await waitForCatalog(page);await expect.poll(async()=>(await saved(page)).runtime.resources[f.key]).toEqual(f.manual);
 await source(page,false);await expect.poll(async()=>(await saved(page)).runtime.resources[f.key]).toEqual(f.manual);
 await source(page,true);await page.reload();await waitForCatalog(page);const reopened=await saved(page);
 expect(reopened.runtime.resources[f.key]).toEqual(f.manual);expect(reopened.notes).toBe(f.c.notes);expect(reopened.runtime.featureResourceArchive?.[f.key]).toBeUndefined();
 const other=await context.newPage();await mockSource(other,{displayMode:'screen'});await suppressAnnouncement(other);other.on('pageerror',error=>errors.push(error.message));await other.goto('./?intro=0');await waitForCatalog(other);
 await expect(other.locator('.card-permission-banner')).toContainText('另一标签页正在编辑');await expect(other.getByRole('switch',{name:'编辑模式',exact:true})).toBeDisabled();
 await other.getByRole('button',{name:'自动化设置',exact:true}).click();await expect(other.locator('.automation-panel').getByRole('alert').filter({hasText:'已有其他资源记录'})).toBeVisible();
 expect((await saved(other)).runtime.resources[f.key]).toEqual(f.manual);await other.close();expect(errors).toEqual([]);expect(writes).toEqual([]);
});

});
