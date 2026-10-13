import {test,expect} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';

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
