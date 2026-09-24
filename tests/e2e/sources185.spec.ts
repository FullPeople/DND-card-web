import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter} from '../../src/core/model';

async function source(page:Page,on:boolean,disableEntry?:string){
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();
 const book=page.locator('.source-book').filter({has:page.getByRole('button',{name:'设置来源 XGE',exact:true})});
 await book.locator('input[type=checkbox]').first().setChecked(on);
 if(disableEntry){await book.getByRole('button',{name:'设置来源 XGE',exact:true}).click();await page.getByRole('checkbox',{name:`启用条目 ${disableEntry}`,exact:true}).uncheck();await page.getByRole('button',{name:'关闭来源设置'}).click();}
 await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
}
async function loaded(page:Page){await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();}

test('disabled expansions disappear from browsing, facets, search and retained documents; exclusions remain struck through',async({page})=>{
 await mockSource(page);
 await page.route('**/data/spells/spells-test.json',r=>r.fulfill({json:{spell:[{name:'扩展法术',source:'XGE',level:1,entries:['扩展正文。']}]}}));
 await loaded(page);await source(page,false);await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'法术',exact:true}).click();
 await expect(page.locator('.catalog-row')).toHaveCount(0);await expect(page.locator('.wiki-filters').getByRole('checkbox')).toHaveCount(0);
 await page.getByRole('textbox',{name:'搜索规则资料'}).fill('扩展法术');await expect(page.locator('.global-results')).toContainText('没有匹配结果');await page.getByRole('button',{name:'关闭搜索结果'}).click();
 await source(page,true,'扩展法术');await expect(page.locator('.catalog-row')).toHaveClass(/entry-disabled/);await page.locator('.catalog-row').click();await expect(page.locator('.entry-detail')).toHaveClass(/entry-disabled/);
 await expect(page.locator('.detail-title')).toHaveCSS('text-decoration-line','line-through');await expect(page.locator('.document-prose p').first()).toHaveCSS('text-decoration-line','line-through');
 await expect(page.locator('.detail-actions')).toContainText('此条目已在规则与扩展中单独禁用');await expect(page.locator('.detail-actions')).not.toContainText('此来源或规则版本未启用');
 await page.getByRole('textbox',{name:'搜索规则资料'}).click();await expect(page.locator('.global-result')).toHaveClass(/entry-disabled/);await page.getByRole('button',{name:'关闭搜索结果'}).click();
 await source(page,false);await expect(page.locator('.catalog-row')).toHaveCount(0);await expect(page.locator('.entry-detail')).toHaveCount(0);
 await page.getByRole('textbox',{name:'搜索规则资料'}).click();await expect(page.locator('.global-result')).toHaveCount(0);await page.getByRole('button',{name:'关闭搜索结果'}).click();
 await page.getByRole('button',{name:'筛选',exact:true}).click();await expect(page.getByRole('dialog',{name:'筛选规则资料'})).not.toContainText('珊娜萨');await page.getByRole('button',{name:'关闭筛选'}).click();
 await page.reload();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await expect(page.locator('.catalog-row')).toHaveCount(0);await expect(page.locator('.entry-detail')).toHaveCount(0);
 await source(page,true);await expect(page.locator('.catalog-row')).toHaveClass(/entry-disabled/);await page.locator('.catalog-row').click();await expect(page.locator('.entry-detail')).toHaveClass(/entry-disabled/);
 await page.screenshot({path:'test-results/sources185-exclusion.png'});
});

test('class composition hides unchecked expansion features and subclasses, including history snapshots',async({page})=>{
 await mockSource(page);
 await page.route('**/data/class/class-test.json',r=>r.fulfill({json:{class:[{name:'核心职业',source:'XPHB',classFeatures:['扩展能力|核心职业|XPHB|1|XGE'],entries:['主体正文。']}],classFeature:[{name:'扩展能力',source:'XGE',className:'核心职业',classSource:'XPHB',level:1,entries:['隐藏能力正文。']}],subclass:[{name:'扩展子职',source:'XGE',className:'核心职业',classSource:'XPHB',shortName:'扩展子职',entries:['隐藏子职正文。']}]}}));
 await loaded(page);await source(page,false);await page.locator('.catalog-row').click();await expect(page.locator('.document-prose')).not.toContainText('隐藏能力正文');
 await page.getByRole('button',{name:'子职',exact:true}).click();await expect(page.locator('.document-prose')).not.toContainText('扩展子职');
 await source(page,true,'扩展子职');await expect(page.locator('.document-prose')).toContainText('隐藏子职正文');await expect(page.locator('.document-section').filter({has:page.locator('h4',{hasText:'扩展子职'})})).toHaveClass(/entry-disabled/);
 await page.getByRole('textbox',{name:'搜索规则资料'}).fill('扩展子职');await page.locator('.global-result').click();await expect(page.locator('.detail-heading')).toContainText('扩展子职');
 await source(page,false);await expect(page.locator('.entry-detail')).toHaveCount(0);
 await page.locator('.catalog-row').click();await page.getByRole('button',{name:'← 上一条',exact:true}).click();await expect(page.locator('.entry-detail')).toHaveCount(0);
 await page.locator('.catalog-row').click();await page.getByRole('button',{name:'主体',exact:true}).click();await expect(page.locator('.document-prose')).not.toContainText('隐藏能力正文');
});

test('room rule updates hide expansions for a player even when the local card enables them',async({page})=>{
 await mockSource(page);await page.route('**/data/spells/spells-test.json',r=>r.fulfill({json:{spell:[{name:'房间扩展法术',source:'XGE',level:1,entries:['房间测试正文。']}]}}));
 const c=newCharacter();c.profile.enabledSources.push('XGE');
 await page.goto('/#suite=sources185&bridge='+encodeURIComponent(String(test.info().project.use.baseURL)));await expect(page.locator('.app-shell')).toBeVisible();
 const send=async(type:string,data:any={})=>page.evaluate(({type,data})=>window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window,data:{protocol:'full-suite-workbench/v1',session:'sources185',hostStarted:100,type,...data}})),{type,data});
 const target={key:'r:card:one',itemId:'card:one',cardId:'one',name:c.name,kind:'character',role:'PLAYER',write:true,documentRevision:1,stats:{},resources:[]};
 const disabled=await page.evaluate(async()=>{const path='/src/data/catalog.ts';const {normalizeData}=await import(path);return normalizeData({spell:[{name:'房间扩展法术',source:'XGE',level:1}]},'1')[0].id;});
 const shared={key:'room:sources185',scope:'room',revision:1,rules:{edition:c.edition,profile:{...c.profile,enabledSources:['XPHB'],disabledEntries:[disabled]},packs:[],customEntries:[]}};
 await send('ready');await send('catalog',{sequence:1,role:'PLAYER',cards:[{...target,id:'one',inScene:true}],monsters:[],enabled:{},visibility:{wiki:true,monsters:true},shared});await send('selection',{sequence:2,state:target,document:{dnd_card_web:c,_suiteRevision:1}});
 await expect(page.getByRole('button',{name:'更新资料',exact:true,includeHidden:true})).toBeEnabled();await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'法术',exact:true}).click();await expect(page.locator('.catalog-row')).toHaveCount(0);
 const update=(on:boolean,sequence:number)=>send('catalog',{sequence,role:'PLAYER',cards:[{...target,id:'one',inScene:true}],monsters:[],enabled:{},visibility:{wiki:true,monsters:true},shared:{...shared,revision:sequence,rules:{...shared.rules,profile:{...shared.rules.profile,enabledSources:on?['XPHB','XGE']:['XPHB']}}}});
 await update(true,3);await expect(page.locator('.catalog-row')).toHaveClass(/entry-disabled/);await page.locator('.catalog-row').click();await expect(page.locator('.entry-detail')).toHaveClass(/entry-disabled/);
 await update(false,4);await expect(page.locator('.catalog-row')).toHaveCount(0);await expect(page.locator('.entry-detail')).toHaveCount(0);
});
