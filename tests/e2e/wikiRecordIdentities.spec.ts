import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';

// Authored software fixtures; no publisher prose or player documents.
const common={source:'XPHB',edition:'one'};
const body={feat:[
 {...common,name:'原创甲专长',ENG_name:'Shared Authored Feat',entries:['甲定义的原创正文。'],_versions:[{name:'原创甲变体',entries:['甲变体的原创正文。']}]},
 {...common,name:'原创乙专长',ENG_name:'Shared Authored Feat',entries:['乙定义的原创正文。']},
 ...['第一份冲突正文。','第二份冲突正文。'].map(text=>({...common,name:'原创冲突专长',ENG_name:'Authored Conflict',entries:[text]}))
]};
const legacy='kiwee:feat:xphb:shared%20authored%20feat::::::';
async function source(page:Page){
 await mockSource(page);
 await page.route('**/data/feats.json',route=>route.fulfill({json:body,headers:{'access-control-allow-origin':'*'}}));
 await page.route('**/data/spells/spells-test.json',route=>route.fulfill({json:{spell:[{...common,name:'原创引用索引',level:0,entries:['查阅 {@feat Shared Authored Feat|XPHB}。']} ]},headers:{'access-control-allow-origin':'*'}}));
}
for(const width of [1440,390]){
 test(`old ambiguous links require a choice and a selected definition reopens at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await source(page);
  await page.goto('/?tab=feat&edition=all&entry='+encodeURIComponent(legacy));
  const chooser=page.getByRole('region',{name:'引用条目选择'});
  await expect(chooser.getByRole('button')).toHaveCount(3);await expect(page.locator('.entry-detail')).toHaveCount(0);
  await expect(chooser.getByRole('button').first()).toBeVisible();await page.screenshot({path:test.info().outputPath(`definition-chooser-${width}.png`)});
  await chooser.getByRole('button',{name:/原创乙专长/}).click();await expect(page.locator('.entry-detail')).toContainText('乙定义的原创正文。');
  const url=page.url();expect(new URL(url).searchParams.get('definition')).toBeTruthy();
  await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
  await page.reload();await expect(page.locator('.entry-detail')).toContainText('乙定义的原创正文。');expect(page.url()).toBe(url);
  await expect(page.locator('.catalog-status')).toContainText('份缓存');
  if(width===390)await page.getByRole('button',{name:'返回资料列表',exact:true}).click();
  await page.getByRole('combobox',{name:'资料版本'}).selectOption('2014');await expect(page.locator('.entry-detail')).toHaveCount(0);
  await page.getByRole('combobox',{name:'资料版本'}).selectOption('2024');await expect(page.locator('.entry-detail')).toContainText('乙定义的原创正文。');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath(`chosen-definition-${width}.png`)});
 });
 test(`a clicked ambiguous UID opens the choice instead of taking its first match at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await source(page);await page.goto('/?tab=spell&edition=all');
  await page.locator('.catalog-row').filter({hasText:'原创引用索引'}).click();
  await page.locator('.entry-detail').getByRole('button',{name:'Shared Authored Feat',exact:true}).first().click();
  const chooser=page.getByRole('region',{name:'引用条目选择'});await expect(chooser.getByRole('button')).toHaveCount(2);
  await chooser.getByRole('button',{name:/原创甲专长/}).click();await expect(page.locator('.entry-detail')).toContainText('甲定义的原创正文。');
  await expect(page.locator('.entry-detail')).not.toContainText('乙定义的原创正文。');
 });
 test(`both conflicting source bodies remain individually readable after reload at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await source(page);await page.goto('/?tab=feat&edition=all');
  const rows=page.locator('.catalog-row').filter({hasText:'原创冲突专长'});await expect(rows).toHaveCount(2);
  const seen=new Set<string>();
  for(let index=0;index<2;index++){
   if(index)await page.goto('/?tab=feat&edition=all');
   await rows.nth(index).click();const detail=page.locator('.entry-detail');await expect(detail).toContainText('同源定义待核对');
   const text=(await detail.textContent())!;seen.add(text.includes('第一份冲突正文。')?'first':'second');
   const url=page.url();await page.reload();await expect(detail).toContainText(text.includes('第一份冲突正文。')?'第一份冲突正文。':'第二份冲突正文。');expect(page.url()).toBe(url);
  }
  expect([...seen].sort()).toEqual(['first','second']);
 });
}
