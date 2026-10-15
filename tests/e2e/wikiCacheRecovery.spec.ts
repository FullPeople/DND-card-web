import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter} from '../../src/core/model';

const sourceHeaders={'access-control-allow-origin':'*',etag:'authored-cache-fixture'};
const classRow=(name:string)=>({name,ENG_name:name,source:'XPHB',hd:{faces:6},classFeatures:[],entries:['为缓存恢复检查创作的资料。']});
async function ready(page:Page){await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();}

test('a complete Wiki update removes withdrawn catalog rows and warm reopen preserves saved choices and spent resources',async({page,context})=>{
 await mockSource(page);let withdrawn=false,requests=0;
 await page.route('https://5e.kiwee.top/data/class/class-test.json',route=>route.fulfill({json:{class:[classRow('保留职业'),...withdrawn?[]:[classRow('撤回职业')]]},headers:sourceHeaders}));
 const character=newCharacter('2024');character.runtime.hp=3;character.runtime.resources['spent-fixture']={current:1,max:5};character.answers['saved-choice']=['authored-original'];
 const protectedWorkspace={schemaVersion:1,characters:[character],activeId:character.id,packs:[]};
 await context.addInitScript(workspace=>{const request=indexedDB.open('dnd-card-standalone',1);request.onupgradeneeded=()=>{request.result.createObjectStore('documents');request.result.createObjectStore('cache');};request.onsuccess=()=>{const db=request.result,tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents'),read=store.get('workspace');read.onsuccess=()=>{if(!read.result)store.put(workspace,'workspace');};tx.oncomplete=()=>db.close();};},protectedWorkspace);
 await page.goto('/?tab=class&edition=2024');await ready(page);await expect(page.locator('.catalog-row')).toHaveCount(2);
 withdrawn=true;await page.getByRole('button',{name:'更新资料',exact:true}).click();await ready(page);
 await expect(page.locator('.catalog-row')).toHaveCount(1);await expect(page.locator('.catalog-row')).toContainText('保留职业');
 page.on('request',request=>{if(/https:\/\/(5e|homebrew)\.kiwee\.top\//.test(request.url()))requests++;});
 await page.reload();await ready(page);await expect(page.locator('.catalog-row')).toHaveCount(1);expect(requests).toBe(0);
 const saved=await page.evaluate(async()=>{const request=indexedDB.open('dnd-card-standalone',1),db=await new Promise<IDBDatabase>(resolve=>{request.onsuccess=()=>resolve(request.result);});const value=await new Promise(resolve=>{const read=db.transaction('documents').objectStore('documents').get('workspace');read.onsuccess=()=>resolve(read.result);});db.close();return value;});
 expect(saved).toEqual(protectedWorkspace);
});

test('a failed refresh keeps the usable old catalog and successful retry reconciles withdrawn entries',async({page})=>{
 await mockSource(page);let phase:'initial'|'failed'|'recovered'='initial';
 await page.route('https://5e.kiwee.top/data/class/class-test.json',route=>phase==='failed'?route.fulfill({status:404,body:'missing'}):route.fulfill({json:{class:[classRow('保留职业'),...phase==='initial'?[classRow('撤回职业')]:[]]},headers:sourceHeaders}));
 await page.goto('/?tab=class&edition=2024');await ready(page);await expect(page.locator('.catalog-row')).toHaveCount(2);
 phase='failed';await page.getByRole('button',{name:'更新资料',exact:true}).click();await ready(page);
 await expect(page.locator('.catalog-row')).toHaveCount(2);await expect(page.locator('.load-errors')).toContainText('旧缓存');
 phase='recovered';await page.locator('.load-errors summary').click();await page.getByRole('button',{name:'重试加载',exact:true}).click();await ready(page);
 await expect(page.locator('.load-errors')).toHaveCount(0);await expect(page.locator('.catalog-row')).toHaveCount(1);
});

test('an explicit supplementary-data update does not disable cache reuse on later introduction and image switches',async({page})=>{
 await mockSource(page);let reads=0,version=1;const errors:string[]=[];page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.route('https://5e.kiwee.top/data/class/fluff-index.json',route=>{reads++;return route.fulfill({json:{'Test Mage':'fluff-cache.json'},headers:sourceHeaders});});
 await page.route('https://5e.kiwee.top/data/class/fluff-cache.json',route=>{reads++;return route.fulfill({json:{classFluff:[{name:'测试法师',ENG_name:'Test Mage',source:'XPHB',entries:['原创简介 '+version],images:[]}]},headers:sourceHeaders});});
 await page.goto('/?tab=class&edition=2024');await ready(page);await page.locator('.catalog-row').filter({hasText:'测试法师'}).click();const detail=page.locator('.entry-detail');
 await detail.getByRole('button',{name:'简介',exact:true}).click();await expect(detail.getByRole('region',{name:'资料简介'})).toContainText('原创简介 1');expect(reads).toBe(2);
 version=2;await detail.getByRole('button',{name:'重新读取补充资料'}).click();await expect(detail.getByRole('region',{name:'资料简介'})).toContainText('原创简介 2');expect(reads).toBe(4);
 await detail.getByRole('button',{name:'图片',exact:true}).click();await expect(detail.getByRole('region',{name:'资料图片'})).toContainText('没有提供独立图片');
 await detail.getByRole('button',{name:'简介',exact:true}).click();await expect(detail.getByRole('region',{name:'资料简介'})).toContainText('原创简介 2');expect(reads).toBe(4);expect(errors).toEqual([]);
});

test('updating one book does not make subsequent cached book navigation refetch chapters',async({page})=>{
 await mockSource(page);const reads:Record<string,number>={};let version=1;
 await page.route('https://5e.kiwee.top/data/books.json',route=>route.fulfill({json:{book:[{id:'ONE',name:'原创书一'},{id:'TWO',name:'原创书二'}]},headers:sourceHeaders}));
 await page.route('https://5e.kiwee.top/data/book/*.json',route=>{const id=route.request().url().includes('book-one')?'ONE':'TWO';reads[id]=(reads[id]||0)+1;return route.fulfill({json:{bookData:[{id,data:[{name:id,entries:['原创章节 '+id+' '+version]}]}]},headers:sourceHeaders});});
 await page.goto('/?reading=book&book=ONE&chapter=0');const body=page.getByRole('region',{name:'章节正文'}),books=page.getByRole('navigation',{name:'出版资料目录'});
 await expect(body).toContainText('原创章节 ONE 1');await books.getByRole('button',{name:/原创书二/}).click();await expect(body).toContainText('原创章节 TWO 1');
 await books.getByRole('button',{name:/原创书一/}).click();await expect(body).toContainText('原创章节 ONE 1');expect(reads).toEqual({ONE:1,TWO:1});
 version=2;await page.getByRole('button',{name:'更新阅读资料',exact:true}).click();await expect(body).toContainText('原创章节 ONE 2');
 await books.getByRole('button',{name:/原创书二/}).click();await expect(body).toContainText('原创章节 TWO 1');
 await books.getByRole('button',{name:/原创书一/}).click();await expect(body).toContainText('原创章节 ONE 2');expect(reads).toEqual({ONE:2,TWO:1});
});
