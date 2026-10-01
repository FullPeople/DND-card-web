import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,type Character,type Entry} from '../../src/core/model';

async function seed(page:Page,card:Character){
 await mockSource(page,{displayMode:'default'});await suppressAnnouncement(page);
 await page.addInitScript(card=>{
  const open=indexedDB.open('dnd-card-standalone',1);
  open.onupgradeneeded=()=>{open.result.createObjectStore('documents');open.result.createObjectStore('cache');};
  open.onsuccess=()=>{const db=open.result,tx=db.transaction('documents','readwrite');tx.objectStore('documents').put({schemaVersion:1,characters:[card],activeId:card.id,packs:[]},'workspace');tx.oncomplete=()=>db.close();};
 },card);
}
const savedCard=()=>{const card=newCharacter();card.name='恢复验收角色';card.notes='保留笔记';card.runtime.resources.manual={name:'保留次数',current:2,max:5};return card;};

test('a failed editing library exposes recovery and preserves the saved card after reconnecting',async({page,context})=>{
 const card=savedCard();await seed(page,card);
 let failures=0;await page.route('**/assets/cardRuntime-*.js',route=>{failures++;return route.abort('connectionreset');});
 await page.goto('/');await expect(page.locator('.paper')).toBeVisible();
 await expect(page.locator('.editing-load-error')).toBeVisible();
 await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeDisabled();
 await page.locator('[data-sheet-tab=背景]').click();await expect(page.locator('.paper')).toBeVisible();
 await page.screenshot({path:test.info().outputPath('editing-download-failed.png'),fullPage:true});
 expect(failures).toBeGreaterThan(0);
 await page.unroute('**/assets/cardRuntime-*.js');
 await page.getByRole('button',{name:'保存后重新加载编辑功能',exact:true}).click();
 await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();
 await expect(page.locator('.editing-load-error')).toHaveCount(0);
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 await page.getByRole('textbox',{name:'角色姓名',exact:true}).fill('网络恢复后继续编辑');
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const saved=await page.evaluate(async()=>{
  const request=indexedDB.open('dnd-card-standalone');await new Promise<void>(r=>request.onsuccess=()=>r());const db=request.result;
  const workspace=await new Promise<any>(r=>{const get=db.transaction('documents').objectStore('documents').get('workspace');get.onsuccess=()=>r(get.result);});db.close();return workspace.characters.find((c:any)=>c.id===workspace.activeId);
 });
 expect(saved.name).toBe('网络恢复后继续编辑');expect(saved.notes).toBe(card.notes);expect(saved.runtime.resources.manual).toMatchObject({current:2,max:5});
 await context.setOffline(true);await expect(page.getByRole('textbox',{name:'角色姓名',exact:true})).toHaveValue(saved.name);
});

test('class warnings are yellow before settings load and custom non-class entries stay quiet',async({page})=>{
 const card=savedCard();
 const entry:Entry={id:'old:class',name:'测试法师',english:'Test Mage',kind:'class',source:'IMPORTED',packId:'imported',edition:'both',revision:'1',entries:[],raw:{}};
 card.selections=[{id:'old-class',entry,quantity:1,level:1,equipped:false}];
 await seed(page,card);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 const banner=page.locator('.class-compatibility-banner'),icon=page.locator('.character-tabs .class-warning-icon');
 await expect(banner).toContainText('当前角色的职业尚未关联资料库，或与当前 2024 职业规则不同。可以核对并同步；其他自定义内容不会触发此提醒。');
 expect(await banner.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(255, 240, 189)');
 expect(await icon.evaluate(el=>getComputedStyle(el).color)).toBe('rgb(255, 204, 56)');
 for(const width of [1512,390]){await page.setViewportSize({width,height:982});await page.screenshot({path:test.info().outputPath('class-warning-'+width+'.png'),fullPage:true});expect(await banner.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);}
});

test('an editable card with only custom non-class content has no class warning',async({page})=>{
 const card=savedCard();
 card.selections=(['race','background','feature','feat','item','spell'] as const).map((kind,i)=>({id:'custom-'+i,entry:{id:'personal:'+kind,name:'自定义'+kind,english:'Personal '+kind,kind,source:'CUSTOM',packId:'custom',edition:'both',revision:'1',entries:[],raw:{_custom:true}},quantity:1,level:1,equipped:false}));
 await seed(page,card);await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await expect(page.locator('.class-compatibility-banner')).toHaveCount(0);await expect(page.locator('.class-warning-icon')).toHaveCount(0);
});
