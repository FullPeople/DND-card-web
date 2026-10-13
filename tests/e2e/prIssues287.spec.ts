import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {readFileSync} from 'node:fs';
import {restoreAuthoredChoices} from './authoredChoicesFixture';

for(const edition of ['2014','2024'] as const) test(`imported lowercase class source keeps its ${edition} reading tab and references after reload`,async({page})=>{
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/card/?intro=0');await expect(page.locator('.paper')).toBeVisible();
 const pack={schemaVersion:1,id:'homebrew.reader-repro',name:'阅读回归扩展',version:'1.0.0',author:'',editions:[edition],requires:[],conflicts:[],entries:[
  {id:'class',kind:'class',name:'阅读测试职业',english:'Reader Class',entries:['原创阅读测试职业正文。'],raw:{hd:{faces:8}}},
  {id:'subclass',kind:'subclass',name:'阅读测试子职',english:'Reader Subclass',entries:['原创引用：{@deity 测试神祇|测试神系|TEST}；{@classFeature 测试职业特性|阅读测试职业|TEST|3|TEST}；{@subclassFeature 测试子职特性|阅读测试职业|TEST|阅读测试子职|TEST|3|TEST}。'],raw:{className:'阅读测试职业',classSource:'HOMEBREW.READER-REPRO',subclassFeatures:[]}}
 ]};
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();const settings=page.getByRole('dialog',{name:'规则与扩展'});
 const transfer=await page.evaluateHandle(value=>{const data=new DataTransfer();data.items.add(new File([JSON.stringify(value)],'reader.json',{type:'application/json'}));return data;},pack);
 await settings.locator('.json-file-drop').dispatchEvent('drop',{dataTransfer:transfer});await transfer.dispose();await expect(settings.locator('.pack-row')).toContainText(pack.name);await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 const tabs=page.getByRole('navigation',{name:'资料分类'});await tabs.getByRole('button',{name:'职业',exact:true}).click();await page.getByLabel('资料版本',{exact:true}).selectOption(edition);
 await page.locator('.catalog-row').filter({hasText:'阅读测试职业'}).click();await expect(page.locator('.entry-detail')).toContainText('原创阅读测试职业正文');await expect(page.locator('.custom-entry-editor')).toHaveCount(0);
 await page.getByRole('button',{name:'子职',exact:true}).click();await expect(page.locator('.entry-detail')).toContainText('阅读测试子职');await expect(page.locator('.entry-detail')).toContainText('测试神祇');await expect(page.locator('.entry-detail')).toContainText('测试职业特性');await expect(page.locator('.entry-detail')).toContainText('测试子职特性');await expect(page.locator('.entry-detail')).not.toContainText('TEST');
 await page.getByRole('button',{name:'主体',exact:true}).click();await expect(page.locator('.custom-entry-editor')).toHaveCount(0);await expect(page.locator('.entry-detail')).toContainText('原创阅读测试职业正文');await page.getByRole('button',{name:'子职',exact:true}).click();
 await page.reload();await expect(page.locator('.entry-detail')).toContainText('阅读测试子职');await page.screenshot({path:test.info().outputPath('imported-class-references.png')});
});

test('announcement links to the accessible issue tracker and keeps confirmation behavior',async({page})=>{
 await mockSource(page);await page.goto('/card/?intro=0');const announcement=page.locator('.announcement');await expect(announcement).toBeVisible();
 const link=announcement.getByRole('link',{name:'GitHub Issues',exact:true});await expect(link).toHaveAttribute('href','https://github.com/FullPeople/DND-card-web/issues');await expect(link).toHaveAttribute('target','_blank');
 await page.keyboard.press('Escape');await expect(announcement).toBeVisible();await announcement.getByRole('button',{name:'我知道了',exact:true}).click();await expect(announcement).toHaveCount(0);
});

test('source spell gift can be cleared, saved, reloaded and restored with its spent use intact',async({page})=>{
 const fixture=JSON.parse(readFileSync(new URL('./source-spell-287.fixture.json',import.meta.url),'utf8'));
 const {character:c,sourceBodies:{classBody,featBody,spellBody},expected:{grantedId,resource}}=fixture;
 expect(c.runtime.resources[resource].current).toBe(1);
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);
 for(const [path,body] of [['class/index.json',{gift:'class-gift.json'}],['class/class-gift.json',classBody],['feats.json',featBody],['spells/index.json',{XPHB:'spells-gift.json'}],['spells/spells-gift.json',spellBody]] as const)await page.route(`**/data/${path}`,route=>route.fulfill({json:body,headers:{'access-control-allow-origin':'*'}}));
 await page.goto('/card/?intro=0');await expect(page.locator('.paper')).toBeVisible();await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByTestId('character-file').setInputFiles({name:'authored-gift.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'dnd-card-web',version:1,character:c}))});
 await expect(page.getByRole('tab',{name:/赠送法术保存回归（导入）/})).toHaveAttribute('aria-selected','true');await page.keyboard.press('Escape');await restoreAuthoredChoices(page,'dnd-card-standalone',{'gift-owner':true});
 const readSaved=()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('dnd-card-standalone');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});try{const transaction=db.transaction('documents'),request=transaction.objectStore('documents').get('workspace');const workspace=await new Promise<any>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return workspace.characters.find((row:any)=>row.id===workspace.activeId);}finally{db.close();}});
 const edit=page.getByRole('switch',{name:'编辑模式',exact:true});if(await edit.getAttribute('aria-checked')!=='true')await edit.click();await page.getByRole('tab',{name:'特性',exact:true}).click();
 const choiceId=Object.keys(c.answers)[0],openChoice=async()=>{await page.locator(`[data-choice-id="${choiceId}"]`).first().click();};await openChoice();await page.locator('.choice-slot.is-filled .choice-remove').click();
 await expect.poll(async()=>{const saved=await readSaved();return saved.selections.some((row:any)=>row.entry.kind==='feat');}).toBe(false);const parked=await readSaved();expect(Object.values(parked.classChoiceArchive).some((archive:any)=>archive.selections.some((row:any)=>row.id===grantedId))).toBe(true);expect(parked.runtime.resources[resource].current).toBe(1);expect(parked.notes).toBe(c.notes);
 await page.reload();await expect(page.locator('.paper')).toBeVisible();await expect(page.getByRole('tab',{name:/赠送法术保存回归（导入）/})).toHaveAttribute('aria-selected','true');await page.getByRole('tab',{name:'特性',exact:true}).click();await openChoice();
 const row=page.locator('.catalog-row').filter({hasText:'原创赠送专长'}).first();await expect(row).toBeVisible();await row.dragTo(page.locator('.choice-slot').first());await expect.poll(async()=>{const saved=await readSaved();return saved.selections.some((row:any)=>row.id===grantedId);}).toBe(true);const restored=await readSaved();expect(restored.runtime.resources[resource].current).toBe(1);expect(restored.notes).toBe(c.notes);await page.screenshot({path:test.info().outputPath('source-spell-restored.png')});
});
