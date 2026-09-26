import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {mockSource} from './fixtures';

test('array equipment loads through the worker and the no-worker fallback',async({browser})=>{
  for(const workerAvailable of [true,false]){
    const context=await browser.newContext(),page=await context.newPage();
    if(!workerAvailable)await page.addInitScript(()=>{Object.defineProperty(window,'Worker',{value:undefined,configurable:true});});
    await mockSource(page);
    await page.route('**/data/bestiary/index.json',route=>route.fulfill({json:{fixture:'bestiary-test.json'}}));
    await page.route('**/data/backgrounds.json',route=>route.fulfill({json:{background:[{name:'装备格式验收背景',source:'XPHB',startingEquipment:[{_:[{item:'测试皮甲|XPHB',quantity:2}]}],entries:['自制格式验收。']}]}}));
    await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
    await expect(page.locator('.load-errors')).toHaveCount(0);
    await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'背景',exact:true}).click();
    await page.locator('.catalog-row').filter({hasText:'装备格式验收背景'}).click();
    await expect(page.locator('.entry-detail')).toContainText('起始装备');
    await expect(page.locator('.entry-detail')).toContainText('测试皮甲');
    await expect(page.locator('.entry-detail')).toContainText('×2');
    await context.close();
  }
});

test('reported real sources recover with retry and reuse valid cached JSON on reload',async({page})=>{
  test.skip(!process.env.EQUIPMENT_SOURCE_DIR,'Real source snapshots stay outside the public repository.');
  const directory=process.env.EQUIPMENT_SOURCE_DIR!;
  const manifest=JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8')) as {path:string;file:string;url:string}[];
  const sources=new Map(manifest.map(source=>[decodeURIComponent(new URL(source.url).pathname),{...source,body:JSON.parse(readFileSync(join(directory,source.file),'utf8'))}]));
  const calls:Record<string,number>={},errors:string[]=[];let workers=0,failBackground=true;
  page.on('pageerror',error=>errors.push(String(error)));page.on('worker',()=>workers++);
  await mockSource(page);
  await page.route('**/data/bestiary/index.json',route=>route.fulfill({json:{fixture:'bestiary-test.json'}}));
  await page.route('**/data/backgrounds.json',route=>{
    calls['data/backgrounds.json']=(calls['data/backgrounds.json']||0)+1;
    if(failBackground){failBackground=false;return route.fulfill({status:503,body:'temporary verification failure'});}
    return route.fulfill({json:sources.get('/data/backgrounds.json')!.body});
  });
  await page.route('https://homebrew.kiwee.top/**',route=>{
    const path=decodeURIComponent(new URL(route.request().url()).pathname);
    if(path==='/_generated/index-sources.json')return route.fulfill({json:Object.fromEntries(manifest.slice(1).map((source,i)=>[String(i),source.path]))});
    const source=sources.get(path);if(!source)return route.fulfill({json:{}});
    calls[source.path]=(calls[source.path]||0)+1;
    return route.fulfill({json:source.body});
  });
  await page.goto('/');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled({timeout:90000});
  await expect(page.locator('.load-errors summary')).toContainText('1 份资料读取异常');
  await page.locator('.load-errors summary').click();await expect(page.locator('.load-errors')).toContainText('HTTP 503');
  await page.getByRole('button',{name:'重试加载',exact:true}).click();
  await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled({timeout:90000});
  await expect(page.locator('.load-errors')).toHaveCount(0);
  for(const source of manifest)expect(calls[source.path]).toBe(2);
  const beforeReload={...calls};
  await page.reload();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled({timeout:90000});
  await expect(page.locator('.load-errors')).toHaveCount(0);expect(calls).toEqual(beforeReload);
  await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'背景',exact:true}).click();
  expect(Number(await page.locator('.catalog-list').getAttribute('data-total-rows'))).toBeGreaterThan(20);
  expect(workers).toBeGreaterThanOrEqual(3);expect(errors).toEqual([]);
  const receipt={sources:manifest.map(source=>source.path),retryPassed:true,warmCachePassed:true,calls,workers,pageErrors:errors};
  writeFileSync(test.info().outputPath('real-equipment-browser.json'),JSON.stringify(receipt,null,2));
  await page.screenshot({path:test.info().outputPath('equipment-loading-recovered.png')});
});
