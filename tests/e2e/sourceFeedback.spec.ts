import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter} from '../../src/core/model';
const classes={class:[{name:'测试工匠',ENG_name:'Test Artisan',source:'TCE',edition:'classic',hd:{faces:8},entries:['较新资料正文。']},{name:'测试工匠',ENG_name:'Test Artisan',source:'ERLW',edition:'classic',hd:{faces:8},entries:['较早资料正文。']},{name:'新版工匠',ENG_name:'Test Artisan',source:'EFA',edition:'one',hd:{faces:8},entries:['2024 规则正文。']}]};
async function setup(page:Page,sourceList=false){await mockSource(page);await suppressAnnouncement(page);await page.route('**/data/class/class-test.json',r=>r.fulfill({json:classes}));await page.route('**/data/books.json',r=>r.fulfill({json:{book:[{id:'TCE',name:'测试新扩展',published:'2020-11-17'},{id:'ERLW',name:'测试旧扩展',published:'2019-11-19'},{id:'EFA',name:'测试新版',published:'2025-11-18'}]}}));if(sourceList)await page.route('**/data/items.json',r=>r.fulfill({json:{item:[...Array.from({length:24},(_,i)=>`SCROLL${i}`),'AU','AUD','UATHEMYSTICCLASS'].map(source=>({name:`列表滚动测试 ${source}`,source,entries:['原创滚动验收资料。']}))}}));await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();}
async function rules(page:Page){await page.getByRole('button',{name:'规则与扩展',exact:true}).click();return page.getByRole('dialog',{name:'规则与扩展',exact:true});}
async function saved(page:Page){await expect(page.locator('.save-status')).toContainText('已保存到本机');await expect.poll(()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((ok,fail)=>{const r=indexedDB.open('dnd-card-standalone');r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error);});return new Promise<any>((ok,fail)=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>{db.close();ok(r.result);};r.onerror=()=>fail(r.error);});})).toBeTruthy();}
test('five collapsible source groups toggle as a whole, retain defaults and show narrow layouts',async({page})=>{
 await setup(page,true);const d=await rules(page);await d.getByRole('radio',{name:'2014',exact:true}).click();await expect(d.locator('.source-group > summary strong')).toHaveText(['三宝书','核心规则','模组内容','第三方','威世智每月更新']);const monthly=d.locator('.source-group').filter({has:page.getByRole('checkbox',{name:'启用威世智每月更新',exact:true})});await expect(monthly.locator('[aria-label="设置来源 AU"]')).toHaveCount(1);await expect(monthly.locator('[aria-label="设置来源 AUD"]')).toHaveCount(1);await expect(monthly.locator('[aria-label="设置来源 UATHEMYSTICCLASS"]')).toHaveCount(0);const group=d.locator('.source-group').filter({has:page.getByRole('checkbox',{name:'启用核心规则',exact:true})});await expect(group.getByRole('checkbox',{name:'启用核心规则',exact:true})).toBeChecked();
 await group.getByRole('checkbox',{name:'启用核心规则',exact:true}).uncheck();await group.locator(':scope > summary').click();await expect(group.locator('.source-book input:checked')).toHaveCount(0);await group.getByRole('checkbox',{name:'启用核心规则',exact:true}).check();await expect(group.locator('.source-book input:not(:checked)')).toHaveCount(0);
 const scroller=d.locator('.source-groups'),summary=group.locator(':scope > summary');
 await expect(d.locator('.source-conflict-notice')).toHaveCount(0);
 for(const viewport of [{width:1512,height:982,label:'wide'},{width:390,height:844,label:'narrow'}]){
  await page.setViewportSize(viewport);await scroller.scrollIntoViewIfNeeded();
  expect(await d.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);
  await page.screenshot({path:test.info().outputPath(`sources-${viewport.label}.png`)});
  await scroller.scrollIntoViewIfNeeded();
  await group.evaluate(el=>{const parent=el.parentElement!;parent.scrollTop=parent.scrollTop+el.getBoundingClientRect().top-parent.getBoundingClientRect().top+180;});
  const box=await scroller.boundingBox(),pinned=await summary.boundingBox();
  expect(Math.abs(pinned!.y-box!.y)).toBeLessThan(3);
  expect(await summary.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+40,r.y+r.height/2));})).toBe(true);
  await page.screenshot({path:test.info().outputPath(`sources-sticky-${viewport.label}.png`)});
 }
 await group.getByRole('checkbox',{name:'启用核心规则',exact:true}).uncheck();await expect(group.locator('.source-book input:checked')).toHaveCount(0);
 await group.getByRole('checkbox',{name:'启用核心规则',exact:true}).check();await expect(d.getByRole('button',{name:'手动比较',exact:true})).toHaveCount(0);
});
test('shows all expansion names even with saved latest or manual choices and still separates editions',async({page})=>{
 await setup(page);let d=await rules(page);await d.getByRole('radio',{name:'2014',exact:true}).click();await expect(d.locator('.source-conflict-notice')).toHaveCount(0);await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await expect(page.locator('.catalog-row')).toHaveCount(2);await saved(page);
 for(const mode of ['latest','manual'] as const){
  await page.evaluate(async(mode)=>{
   const db=await new Promise<IDBDatabase>((ok,fail)=>{const q=indexedDB.open('dnd-card-standalone');q.onsuccess=()=>ok(q.result);q.onerror=()=>fail(q.error);});
   await new Promise<void>((ok,fail)=>{const tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents'),q=store.get('workspace');q.onsuccess=()=>{const w=q.result;w.siteSources.sourceConflicts={mode,selected:{legacy:[]}};store.put(w,'workspace');};tx.oncomplete=()=>ok();tx.onerror=()=>fail(tx.error);});db.close();
  },mode);
  await page.reload();await expect(page.locator('.catalog-row')).toHaveCount(2);await expect(page.locator('.catalog-row').filter({hasText:'TCE'})).toHaveCount(1);await expect(page.locator('.catalog-row').filter({hasText:'ERLW'})).toHaveCount(1);
 }
 d=await rules(page);await expect(d.getByRole('button',{name:'手动比较',exact:true})).toHaveCount(0);await d.getByRole('radio',{name:'2024',exact:true}).click();await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect(page.locator('.catalog-row')).toHaveCount(1);await expect(page.locator('.catalog-row')).toContainText('新版工匠');
});
test('class tab warning follows incompatible cards while cache and prose changes do not warn',async({page})=>{
 await setup(page);const compatible=newCharacter('2014');compatible.name='正确职业测试';const e={id:['kiwee','class','tce','test artisan','','','','','',''].map(encodeURIComponent).join(':'),kind:'class' as const,name:'测试工匠',english:'Test Artisan',source:'TCE',edition:'2014' as const,packId:'kiwee',revision:'old-cache',entries:['旧译文'],raw:{...classes.class[0],_category:'class'}};e.entries=['旧译文'];compatible.selections=[{id:'class',entry:e,level:1,quantity:1,equipped:false}];const wrong=structuredClone(compatible);wrong.id='wrong-edition';wrong.name='旧版职业测试';wrong.edition='2024';
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByLabel('批量导入角色文件',{exact:true}).setInputFiles([{name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(compatible))},{name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(wrong))}]);
 await page.getByRole('button',{name:'确认导入这批角色',exact:true}).click();await expect(page.getByRole('dialog',{name:'角色簿',exact:true})).toBeVisible();await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 // The existing batch workflow is intentionally used; wait for its explicit review below.
 await expect(page.locator('.character-tabs').getByRole('tab',{name:'正确职业测试',exact:true})).toBeVisible();await page.locator('.character-tabs').getByRole('tab',{name:'正确职业测试',exact:true}).click();await expect(page.locator('.class-compatibility-banner')).toHaveCount(0);await page.locator('.character-tabs').getByRole('tab',{name:/旧版职业测试/}).click();await expect(page.locator('.character-tabs .class-warning-icon')).toHaveCount(1);await expect(page.locator('.class-compatibility-banner')).toContainText('2024');await page.screenshot({path:test.info().outputPath('class-warning.png')});
});
