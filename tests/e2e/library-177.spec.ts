import {test,expect} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter} from '../../src/core/model';
import {exportOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';
import {normalizeData} from '../../src/data/catalog';

test('subclass mode renders each child document in order with a child-only contents list',async({page})=>{
 await mockSource(page);await page.route('**/data/class/class-test.json',r=>r.fulfill({json:{class:[{name:'测试法师',source:'XPHB',entries:['主体内容']}],subclass:['甲','乙'].map(name=>({name:name+'学派',source:'XPHB',className:'测试法师',classSource:'XPHB',subclassFeatures:[name+'能力|测试法师|XPHB|'+name+'|XPHB|3'],shortName:name})),subclassFeature:['甲','乙'].map(name=>({name:name+'能力',source:'XPHB',className:'测试法师',classSource:'XPHB',subclassShortName:name,subclassSource:'XPHB',level:3,entries:[name+'学派的专有正文。']}))}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true,includeHidden:true})).toBeEnabled();await page.locator('.catalog-row').first().click();
 await page.getByRole('button',{name:'子职',exact:true}).click();await expect(page.locator('.class-subclasses')).toHaveCount(0);await expect(page.locator('.document-prose')).toContainText('甲学派的专有正文');await expect(page.locator('.document-prose')).toContainText('乙学派的专有正文');
 await expect(page.locator('.document-nav button')).toHaveCount(2);await expect(page.locator('.document-nav')).not.toContainText('能力');await page.locator('.document-nav').getByRole('button',{name:'乙学派',exact:true}).click();
 await expect(page.locator('.document-section[data-described-entry]').filter({has:page.locator('h4',{hasText:'乙学派'})})).toHaveCount(1);
 await page.getByRole('button',{name:'主体',exact:true}).click();await expect(page.locator('.document-prose')).toContainText('主体内容');await expect(page.locator('.document-prose')).not.toContainText('学派的专有正文');
});

test('player rules are a compact immutable room overview while source display remains personal',async({page})=>{
 await mockSource(page);const c=newCharacter();c.name='只读规则验收';c.profile.enabledSources=['XPHB'];
 await page.goto('/#suite=rules177&bridge='+encodeURIComponent(String(test.info().project.use.baseURL)));await expect(page.locator('.app-shell')).toBeVisible();
 const target={key:'r:card:one',itemId:'card:one',cardId:'one',name:c.name,kind:'character',role:'PLAYER',write:true,documentRevision:1,stats:{},resources:[]};
 const disabled=normalizeData({feat:[{name:'旅行笔记',ENG_name:'Travel Notes',source:'XPHB'}]},'1')[0].id;
 c.profile.disabledEntries=[disabled];
 const shared={key:'room:rules177',scope:'room',revision:1,rules:{edition:c.edition,sourceMode:'short',profile:c.profile,packs:[],customEntries:[]}};
 await page.evaluate(({target,shared,document})=>{window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window,data:{protocol:'full-suite-workbench/v1',session:'rules177',hostStarted:100,type:'ready'}}));window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window,data:{protocol:'full-suite-workbench/v1',session:'rules177',hostStarted:100,type:'catalog',sequence:1,role:'PLAYER',cards:[{...target,id:'one',locked:false,inScene:true}],monsters:[],enabled:{},shared}}));window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window,data:{protocol:'full-suite-workbench/v1',session:'rules177',hostStarted:100,type:'selection',sequence:2,state:target,document}}));},{target,shared,document:{...exportOwlbear(c,evaluate(c)),dnd_card_web:c,_suiteRevision:1}});
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.locator('.room-rules-summary')).toBeVisible();await expect(dialog.getByRole('button',{name:'导入扩展包'})).toHaveCount(0);await expect(dialog.locator('.source-summary-book')).toHaveCount(1);await expect(dialog.locator('.room-rule-flags')).toContainText('兼职');
 await dialog.locator('.source-summary-book summary').click();await expect(dialog.locator('.source-summary-book')).toContainText('旅行笔记');await dialog.getByRole('radio',{name:'纯文本',exact:true}).click();await expect(dialog.getByRole('radio',{name:'纯文本',exact:true})).toHaveAttribute('aria-checked','true');expect(await page.evaluate(()=>localStorage.getItem('dnd-source-display'))).toBe('full');
 // A later room snapshot must not overwrite a player's display preference.
 await page.evaluate(shared=>window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window,data:{protocol:'full-suite-workbench/v1',session:'rules177',hostStarted:100,type:'catalog',sequence:3,role:'PLAYER',cards:[],monsters:[],enabled:{},shared:{...shared,revision:2}}})),shared);
 await expect(dialog.getByRole('radio',{name:'纯文本',exact:true})).toHaveAttribute('aria-checked','true');
});

test('authored backpack goods store visible price and weight fields in the existing item units',async({page})=>{
 await mockSource(page);await page.goto('/');await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'自定义',exact:true}).click();await page.getByLabel('自定义条目名称').fill('计价测试物品');await page.getByLabel('自定义条目类型').selectOption('tool');await page.getByLabel('物品价格（金币）').fill('2.5');await page.getByLabel('物品重量（磅）').fill('3.25');await page.getByRole('button',{name:'保存条目',exact:true}).click();
 await expect(page.locator('.catalog-row')).toContainText('计价测试物品');
 const fields=await page.evaluate(()=>new Promise<any>((resolve,reject)=>{const req=indexedDB.open('dnd-card-workspace');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>{resolve(r.result.customEntries[0].raw);db.close();};};}));expect(fields.value).toBe(250);expect(fields.weight).toBe(3.25);
 await page.reload();await page.locator('.catalog-row').filter({hasText:'计价测试物品'}).click();await expect(page.getByLabel('物品价格（金币）')).toHaveValue('2.5');await expect(page.getByLabel('物品重量（磅）')).toHaveValue('3.25');
});

test('third-party source index loads collections once with source names and their edition',async({page})=>{
 await mockSource(page);let requests=0;await page.route('**/_generated/index-sources.json',r=>r.fulfill({json:{Third:'collection/test-book.json',Alias:'collection/test-book.json'},headers:{'access-control-allow-origin':'*'}}));await page.route('**/collection/test-book.json',r=>{requests++;return r.fulfill({json:{_meta:{edition:'one',sources:[{json:'Third',full:'三方测试书',dateReleased:'2025-06-10'}]},class:[{name:'三方测试职业',source:'Third',entries:['来自独立三方数据渠道的正文。']}]},headers:{'access-control-allow-origin':'*'}});});
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true,includeHidden:true})).toBeEnabled();await page.locator('.catalog-row').filter({hasText:'三方测试职业'}).click();await expect(page.locator('.entry-detail')).toContainText('来自独立三方数据渠道的正文');await expect(page.locator('.detail-heading')).toContainText('三方测试书');await expect(page.locator('.detail-heading')).toContainText('2024');expect(requests).toBe(1);
});
