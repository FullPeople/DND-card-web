import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';

async function readingSource(page:Page){
 await mockSource(page);
 const classData={class:[{name:'纸页法师',ENG_name:'Paper Mage',source:'PHB',hd:{faces:6},translator:'机翻',hasFluff:true,hasFluffImages:true,multiclassing:{requirements:{int:13},proficienciesGained:{skills:[{choose:{from:['arcana','history'],count:1}}]}},classFeatures:[],entries:Array.from({length:30},(_,index)=>`原创长正文 ${index+1}，用于检查切换阅读内容后的原位置。`),additionalSources:[{source:'TCE',page:9}],reprintedAs:['Paper Mage|XPHB'],srd:true},{name:'纸页法师',ENG_name:'Paper Mage',source:'XPHB',hd:{faces:6},classFeatures:[]}],subclass:['甲','乙'].map((name,index)=>({name:'纸页学派'+name,ENG_name:'Paper School '+name,shortName:name,source:'PHB',className:'纸页法师',classSource:'PHB',subclassFeatures:[`纸页特性${name}|纸页法师|PHB|${name}|PHB|3`]})),subclassFeature:['甲','乙'].map(name=>({name:'纸页特性'+name,source:'PHB',className:'纸页法师',classSource:'PHB',subclassShortName:name,subclassSource:'PHB',level:3,entries:['原创比较正文'+name]}))};
 const files:Record<string,unknown>={
  'class/class-test.json':classData,'class/fluff-index.json':{'Paper Mage':'fluff-paper.json'},'class/fluff-paper.json':{classFluff:[{name:'纸页法师',ENG_name:'Paper Mage',source:'PHB',entries:['原创职业简介，供读取检查。'],images:[{href:{type:'internal',path:'authored-paper.svg'},title:'原创图示'}]}]},
  'deities.json':{deity:[{name:'纸页之神',ENG_name:'Paper Deity',source:'PHB',pantheon:'纸页神系',province:'档案与旅行',domains:['知识','旅行'],symbol:'折起的纸页',alignment:['N','G']}]},
  'feats.json':{feat:[{name:'阅读练习',source:'PHB',ability:[{choose:{weighted:{from:['int','wis','cha'],weights:[2,1]}}}],repeatable:true,skillProficiencies:[{choose:{from:['history','arcana'],count:1}}],entries:['原创专长正文。']}]},
  'books.json':{book:[{id:'PAPER',source:'PHB',name:'纸页手册',ENG_name:'Paper Handbook',translator:'机翻',contents:[{name:'开篇'},{name:'第二章'}]}]},
  'book/book-paper.json':{bookData:[{id:'PAPER',data:[{type:'section',name:'开篇',entries:['原创第一章。阅读 {@spell 微光术|XPHB}。',{type:'image',href:{type:'internal',path:'authored-paper.svg'}}]},{type:'section',name:'第二章',entries:['原创第二章。',{type:'table',colLabels:['行','内容'],rows:[['1','原创表格']]}]}]}]},
  'adventures.json':{adventure:[{id:'TRIP',name:'纸页旅行',contents:[{name:'启程'}]}]},'adventure/adventure-trip.json':{adventureData:[{id:'TRIP',data:[{type:'section',name:'启程',entries:['原创冒险章节。']}]}]}
 };
 await page.context().route('https://5e.kiwee.top/data/**',async route=>{const path=new URL(route.request().url()).pathname.replace('/data/','');if(Object.hasOwn(files,path))await route.fulfill({json:files[path],headers:{'access-control-allow-origin':'*'}});else await route.fallback();});
 await page.context().route('https://5e.kiwee.top/img/authored-paper.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#ccc"/></svg>'}));
}
test.beforeEach(async({page})=>readingSource(page));

test('structured facts, translation, reprints, subclass comparison and lazy pictures are readable',async({page})=>{
 let imageRequests=0;page.on('request',request=>{if(request.url().includes('/img/'))imageRequests++;});
 await page.goto('/?tab=class&edition=2014');await page.locator('.catalog-row').filter({hasText:'纸页法师'}).click();const detail=page.locator('.entry-detail');
 await expect(detail).toContainText('智力至少 13');await expect(detail).toContainText('1 级生命值');await expect(detail).toContainText('机器翻译');
 await detail.locator('.reading-sources summary').click();await expect(detail.locator('.reading-sources')).toContainText('第 9 页');await expect(detail.locator('.reading-sources')).toContainText('SRD 5.1');
 await detail.locator('.subclass-comparison summary').click();await detail.getByRole('checkbox',{name:'纸页学派甲（PHB）'}).check();await detail.getByRole('checkbox',{name:'纸页学派乙（PHB）'}).check();await expect(detail.locator('.comparison-table')).toContainText('原创比较正文甲');await expect(detail.locator('.comparison-table')).toContainText('原创比较正文乙');
 expect(imageRequests).toBe(0);await detail.getByRole('button',{name:'简介',exact:true}).click();await expect(detail.getByRole('region',{name:'资料简介'})).toContainText('原创职业简介');expect(imageRequests).toBe(0);await detail.getByRole('button',{name:'图片',exact:true}).click();await expect(detail.getByRole('region',{name:'资料图片'}).locator('img')).toBeVisible();expect(imageRequests).toBe(1);
 await detail.getByRole('region',{name:'资料图片'}).locator('img').evaluate(image=>(image as HTMLImageElement).decode());await page.evaluate(()=>document.fonts.ready);const position=await detail.evaluate(element=>{element.scrollTop=180;return element.scrollTop;});expect(position).toBeGreaterThan(100);await page.getByRole('navigation',{name:'阅读内容'}).getByRole('button',{name:'书籍',exact:true}).click();await page.getByRole('navigation',{name:'阅读内容'}).getByRole('button',{name:'规则条目'}).click();await expect.poll(()=>detail.evaluate(element=>element.scrollTop)).toBe(position);
 await detail.locator('.reading-sources').getByRole('button',{name:'纸页法师（XPHB）'}).click();await expect(detail.locator('h1')).toContainText('纸页法师');await expect(page).toHaveURL(/xphb/);
});

test('special data and weighted choices retain their actual options',async({page})=>{
 await page.goto('/?tab=reference');await page.locator('.catalog-row').filter({hasText:'纸页之神'}).click();await expect(page.locator('.entry-facts')).toContainText('纸页神系');await expect(page.locator('.entry-facts')).toContainText('折起的纸页');
 await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'专长',exact:true}).click();await page.locator('.catalog-row').filter({hasText:'阅读练习'}).click();await expect(page.locator('.entry-facts')).toContainText('智力、感知、魅力');await expect(page.locator('.entry-facts')).toContainText('分别增加 2、1');await expect(page.locator('.entry-facts')).toContainText('可以重复选择');
 await page.getByRole('button',{name:'筛选',exact:true}).click();await page.getByRole('navigation',{name:'筛选维度'}).getByRole('button',{name:/翻译状态/}).click();await expect(page.getByRole('dialog',{name:'筛选规则资料'})).toContainText('未标注译者');
});

test('books load on demand, share chapters, restore navigation and keep pictures optional',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);let chapterRequests=0,imageRequests=0,accountRequests=0;
 page.on('request',request=>{if(request.url().includes('/data/book/'))chapterRequests++;if(request.url().includes('/img/'))imageRequests++;if(new URL(request.url()).pathname.startsWith('/api/'))accountRequests++;});
 await page.goto('/');expect(chapterRequests).toBe(0);await page.getByRole('navigation',{name:'阅读内容'}).getByRole('button',{name:'书籍',exact:true}).click();await page.getByRole('navigation',{name:'出版资料目录'}).getByRole('button',{name:/纸页手册/}).click();await expect(page.getByRole('region',{name:'章节正文'})).toContainText('原创第一章');expect(imageRequests).toBe(0);
 await page.getByRole('button',{name:'下一章',exact:true}).click();await expect(page.getByRole('region',{name:'章节正文'})).toContainText('原创表格');await expect(page).toHaveURL(/chapter=1/);await page.getByRole('button',{name:'复制章节链接'}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('https://dnd.center/wiki/?reading=book&book=PAPER&chapter=1');
 await page.reload();await expect(page.getByRole('region',{name:'章节正文'})).toContainText('原创第二章');await page.getByRole('button',{name:'上一章',exact:true}).click();await page.getByRole('button',{name:'显示插图'}).click();await expect(page.locator('.reading-volume-content img')).toBeVisible();expect(imageRequests).toBe(1);
 await page.goBack();await expect(page.getByRole('region',{name:'章节正文'})).toContainText('原创第二章');await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:test.info().outputPath('book-narrow.png')});
 await page.getByRole('navigation',{name:'阅读内容'}).getByRole('button',{name:'冒险',exact:true}).click();await page.getByRole('navigation',{name:'出版资料目录'}).getByRole('button',{name:/纸页旅行/}).click();await expect(page.getByRole('region',{name:'章节正文'})).toContainText('原创冒险章节');expect(accountRequests).toBe(0);
});

test('failed chapters can be retried without clearing the reading selection',async({page})=>{
 let failed=true;
 await page.context().route('https://5e.kiwee.top/data/book/book-paper.json',async route=>{if(failed)await route.fulfill({status:404,body:'missing'});else await route.fallback();});
 await page.goto('/?reading=book&book=PAPER&chapter=0');await expect(page.getByRole('alert')).toContainText('HTTP 404');failed=false;await page.getByRole('button',{name:'重试读取'}).click();await expect(page.getByRole('region',{name:'章节正文'})).toContainText('原创第一章');
 await page.getByRole('navigation',{name:'阅读内容'}).getByRole('button',{name:'规则条目'}).click();await expect(page.locator('.catalog-row').first()).toBeVisible();await page.getByRole('navigation',{name:'阅读内容'}).getByRole('button',{name:'书籍'}).click();await expect(page.getByRole('region',{name:'章节正文'})).toContainText('原创第一章');
});

test('public rule references resolve and corrupted reading preferences do not block chapters',async({page})=>{
 await page.context().addInitScript(()=>localStorage.setItem('dnd-wiki-reading-progress-v1:book','null'));
 await page.goto('/?reading=book&book=PAPER&chapter=1.5');await expect(page.getByRole('region',{name:'章节正文'})).toContainText('原创第二章');await expect(page.getByRole('combobox',{name:'选择章节'})).toHaveValue('1');
 await page.goto('/?reference='+encodeURIComponent('微光术|XPHB')+'&referenceKind=spell');await expect(page.locator('.entry-detail h1')).toContainText('微光术');await expect(page.locator('.entry-detail')).toContainText('为测试而创作的一点微光');
});
