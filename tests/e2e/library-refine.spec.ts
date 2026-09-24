import { test, expect } from '@playwright/test';
import { mockSource, fillFromDetail } from './fixtures';

test.beforeEach(async({page})=>{
 await mockSource(page);
 await page.route('**/data/optionalfeatures.json',r=>r.fulfill({json:{optionalfeature:[{name:'测试祈唤',ENG_name:'Test Invocation',source:'XPHB',featureType:['TEST'],entries:['祈唤正文。']}]}}));
 await page.route('**/data/class/class-test.json',r=>r.fulfill({json:{class:[{name:'测试法师',ENG_name:'Test Mage',source:'XPHB',hd:{faces:6},proficiency:['int','wis'],classFeatures:['施法|测试法师|XPHB|1'],optionalfeatureProgression:[{name:'祈唤选项',featureType:['TEST']}],classTableGroups:[{colLabels:['使用次数','等级能力'],rows:Array.from({length:20},(_,i)=>[i<4?2:3,`能力${i+1}`])}]}],classFeature:[{name:'施法',source:'XPHB',className:'测试法师',classSource:'XPHB',level:1,entries:['可以查阅 {@spell 微光术|XPHB}。',...Array.from({length:30},(_,i)=>`长段落${i}。`)]}],subclass:[{name:'测试学派',source:'XPHB',className:'测试法师',classSource:'XPHB',entries:['子职正文']}]}}));
 await page.route('**/data/spells/spells-test.json',r=>r.fulfill({json:{spell:[{name:'微光术',ENG_name:'Test Glow',source:'XPHB',meta:{ritual:true},level:0,entries:['微光正文。']}]}}));
 await page.route('**/data/bestiary/index.json',r=>r.fulfill({json:{XMM:'bestiary-test.json'}}));
 await page.route('**/data/bestiary/bestiary-test.json',r=>r.fulfill({json:{monster:[{name:'测试魔像',source:'XMM',cr:'1/2',ac:[13],hp:{average:20,formula:'3d8+6'},speed:{walk:30},str:14,action:[{name:'重击',entries:['测试动作。']}],spellcasting:[{name:'魔法',headerEntries:['无需材料。'],will:['{@spell 微光术|XPHB}']}]}]}}));
 await page.route('**/data/items-base.json',r=>r.fulfill({json:{itemProperty:[{name:'轻型',abbreviation:'L',source:'XPHB',entries:['轻型词条。']}],itemMastery:[{name:'推离',source:'XPHB',entries:['推离词条。']}],baseitem:[{name:'测试刀',source:'XPHB',type:'M',entries:['装备正文。']}]}}));
 await page.route('**/data/languages.json',r=>r.fulfill({json:{language:[{name:'测试语',source:'XPHB',entries:['语言正文。']}]}}));
 await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
});

test('source radio display, per-entry exclusion and opaque configuration survive import and refresh',async({page})=>{
 await page.getByRole('button',{name:'规则与扩展',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'规则与扩展',exact:true});await dialog.getByRole('radio',{name:'纯文本',exact:true}).click();
 await dialog.getByRole('button',{name:'设置来源 XPHB'}).click();
 await dialog.getByLabel('搜索来源内条目').fill('微光术');await dialog.getByRole('checkbox',{name:'启用条目 微光术',exact:true}).uncheck();
 await page.getByRole('button',{name:'关闭来源设置'}).click();await dialog.getByRole('button',{name:'导出配置',exact:true}).click();await expect(dialog.getByLabel('规则配置码')).toHaveValue(/^DND1\.[\w-]+$/);
 const code=await dialog.getByLabel('规则配置码').inputValue();await dialog.getByRole('button',{name:'设置来源 XPHB'}).click();await page.getByRole('dialog',{name:/来源设置/}).getByRole('checkbox',{name:'启用条目 微光术',exact:true}).check();await page.getByRole('button',{name:'关闭来源设置'}).click();await dialog.getByRole('radio',{name:'简写',exact:true}).click();
 await dialog.getByLabel('规则配置码').fill(code);await dialog.getByRole('button',{name:'导入配置',exact:true}).click();await expect(dialog.getByRole('radio',{name:'纯文本',exact:true})).toHaveAttribute('aria-checked','true');await dialog.getByRole('button',{name:'设置来源 XPHB'}).click();await expect(page.getByRole('dialog',{name:/来源设置/}).getByRole('checkbox',{name:'启用条目 微光术',exact:true})).not.toBeChecked();await page.getByRole('button',{name:'关闭来源设置'}).click();
 await dialog.getByRole('button',{name:'关闭弹窗'}).click();await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'法术',exact:true}).click();
 await expect(page.locator('.catalog-row')).toHaveClass(/entry-disabled/);await expect(page.locator('.catalog-row')).toContainText('玩家手册');await expect(page.locator('.catalog-row')).not.toContainText('XPHB');await expect(page.locator('.catalog-row')).toHaveClass(/ritual-row/);
 await page.reload();await expect(page.locator('.catalog-row')).toHaveClass(/entry-disabled/);
});

test('frozen title, immediate class jumps, optional choices, bestiary and independent browsing',async({page})=>{
 await page.locator('.catalog-row').first().click();await expect(page.locator('.document-prose')).toContainText('测试祈唤');
 const before=await page.locator('.detail-frozen').boundingBox();await page.locator('.document-nav').getByRole('button',{name:'测试祈唤',exact:true}).click();
 const after=await page.locator('.detail-frozen').boundingBox();expect(Math.abs(before!.y-after!.y)).toBeLessThan(2);
 const heading=await page.locator('.document-section').filter({has:page.locator('h4',{hasText:'测试祈唤'})}).boundingBox();expect(heading!.y).toBeGreaterThanOrEqual(after!.y+after!.height-2);
 await page.getByRole('button',{name:'主体',exact:true}).click();await page.getByRole('button',{name:'子职',exact:true}).click();await expect(page.locator('.class-subclasses')).toBeInViewport();
 const tabs=page.getByRole('navigation',{name:'资料分类'});await expect(tabs.getByRole('button',{name:'特性',exact:true})).toHaveCount(0);
 await tabs.getByRole('button',{name:'怪物图鉴',exact:true}).click();await page.locator('.catalog-row').first().click();await expect(page.locator('.entry-detail')).toContainText('测试动作');await expect(page.locator('.document-prose')).toContainText('无需材料');await expect(page.locator('.monster-basics')).toContainText('20');
 await tabs.getByRole('button',{name:'职业',exact:true}).click();await expect(page.locator('.detail-heading')).toContainText('测试法师');
});

test('global search pinning, tooltip wheel ownership and temporary left card reading',async({page})=>{
 await page.locator('.catalog-row').first().click();await fillFromDetail(page);
 const tabs=page.getByRole('navigation',{name:'资料分类'});await tabs.getByRole('button',{name:'法术',exact:true}).click();await page.locator('.catalog-row').first().click();
 await page.locator('.identity-title').filter({hasText:'测试法师'}).hover();await expect(page.locator('.detail-heading')).toContainText('测试法师');await expect(page.getByRole('tooltip')).toHaveCount(0);
 await page.mouse.move(40,40);await expect(page.locator('.detail-heading')).toContainText('微光术');
 await page.locator('.paper .feature-caption').filter({hasText:'施法'}).hover();await expect(page.locator('.detail-heading')).toContainText('测试法师');await expect(page.locator('.document-section[data-entry-id]').filter({has:page.locator('h4',{hasText:'施法'})})).toBeInViewport();
 await page.locator('.paper .feature-caption').filter({hasText:'施法'}).click();await page.mouse.move(40,40);await expect(page.locator('.detail-heading')).toContainText('测试法师');
 const search=page.getByRole('textbox',{name:'搜索规则资料'});await search.fill('微光术');const result=page.locator('.global-result');await expect(result).toHaveCount(1);await result.hover();await expect(page.getByRole('tooltip')).toBeVisible();const scroll=await page.locator('.entry-detail').evaluate(e=>e.scrollTop);await page.mouse.wheel(0,600);await expect(page.getByRole('tooltip')).toBeVisible();expect(await page.locator('.entry-detail').evaluate(e=>e.scrollTop)).toBe(scroll);
 await result.click({button:'right'});await expect(page.getByRole('tooltip')).toContainText('已固定');await page.locator('.tooltip-backdrop').click({position:{x:30,y:30}});await expect(page.getByRole('tooltip')).toHaveCount(0);
 await search.click();await result.click();await expect(page.locator('.detail-heading')).toContainText('微光术');
 await search.fill('测试');await page.locator('.global-results>header').click({button:'middle'});await expect(page.locator('.global-results')).toHaveClass(/is-fixed/);await page.locator('.global-search-backdrop').click({position:{x:1300,y:30}});await expect(page.locator('.global-results')).toHaveCount(0);await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('training targets accept properties, mastery, equipment and language',async({page})=>{
 const tabs=page.getByRole('navigation',{name:'资料分类'});
 for(const [tab,name,row] of [['武器词条','轻型','护甲'],['武器精通','推离','工具'],['装备','测试刀','武器'],['语言','测试语','语言']]){
  await tabs.getByRole('button',{name:tab,exact:true}).click();await page.locator('.catalog-row').filter({hasText:name}).click();await page.locator('.detail-title').dragTo(page.locator('.training-row').filter({has:page.locator('dt',{hasText:row})}));
  await expect(page.locator('.training-row').filter({has:page.locator('dt',{hasText:row})})).toContainText(name);
 }
});


test('monster stat block only previews actual rule links, never headings, attributes or ordinary text',async({page})=>{
 await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'怪物图鉴',exact:true}).click();await page.locator('.catalog-row').first().click();
 await expect(page.locator('.monster-ability-group')).toHaveCount(3);await expect(page.locator('.monster-trait strong em').first()).toHaveText('重击。');
 for(const selector of ['.monster-basics','.monster-abilities','.monster-section>h3','.monster-trait>p','.monster-footnotes']){await page.locator(selector).first().hover();await expect(page.getByRole('tooltip')).toHaveCount(0);}
 await page.locator('.monster-document').getByRole('button',{name:'微光术',exact:true}).hover();await expect(page.getByRole('tooltip')).toContainText('微光正文');
 await page.mouse.click(20,20);await page.mouse.move(20,20);await expect(page.getByRole('tooltip')).toHaveCount(0);
});
