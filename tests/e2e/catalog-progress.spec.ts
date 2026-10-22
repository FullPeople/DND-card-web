import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/tests/fixtures/catalog-progress/');await expect(page.locator('#first .catalog-status')).toContainText('0/229 份资料');});

test('file progress updates only its status leaf and leaves both rendered cards intact',async({page})=>{
 const before=await page.evaluate(()=>({renders:{...(window as any).renders},card:document.querySelector('#first .paper')!.outerHTML}));
 for(const done of [177,188,189,193,209,212,223,229]){
  await page.evaluate(done=>(window as any).progress.first.store.publish({done,total:229,label:'file '+done,failed:[],cached:done}),done);
  await expect(page.locator('#first .catalog-status')).toContainText(`${done}/229 份资料 · ${done} 份缓存`);
 }
 expect(await page.evaluate(()=>(window as any).renders)).toEqual(before.renders);
 expect(await page.locator('#first .paper').evaluate(el=>el.outerHTML)).toBe(before.card);
 await expect(page.locator('#second .catalog-status')).toContainText('0/229 份资料');
 await page.evaluate(()=>(window as any).progress.first.setLoading(false));
 await expect(page.locator('#first .catalog-status')).toContainText('12 条资料 · 229 份缓存');
 await expect(page.locator('#first .catalog-status')).toContainText('3 条符合筛选');
 await page.evaluate(()=>(window as any).progress.first.setSearchStatus('正在索引'));
 await expect(page.locator('#first .catalog-status [role="status"]')).toHaveText('正在索引');
});

test('pause, failure and retry use the latest snapshot and recovery clears only the old errors',async({page})=>{
 await page.evaluate(()=>{const app=(window as any).progress.first;app.store.publish({done:188,total:229,label:'paused',failed:['Authored failure'],cached:188,paused:'线路暂不可用。',retry:['first-key']});app.setLoading(false);});
 const first=page.locator('#first');await expect(first.locator('.catalog-status')).toContainText('188/229 份资料 · 已暂停');await expect(first.locator('.load-paused')).toHaveText('线路暂不可用。尚有资料未读。');
 await first.locator('.load-errors summary').click();await expect(first.locator('.load-errors')).toContainText('Authored failure');
 await page.evaluate(()=>{const app=(window as any).progress.first;app.store.publish({...app.store.getSnapshot(),retry:['newest-key','other-key']});(document.querySelector('#first .load-errors button') as HTMLButtonElement).click();});
 expect(await page.evaluate(()=>(window as any).retries.first)).toEqual(['newest-key','other-key']);
 await page.evaluate(()=>(window as any).progress.first.setLoading(true));await expect(first.getByRole('button',{name:'重试加载',exact:true})).toBeDisabled();
 await page.evaluate(()=>{const app=(window as any).progress.first;app.store.publish({done:229,total:229,label:'recovered',failed:[],cached:229,retry:[],recovered:['newest-key','other-key']});app.setLoading(false);});
 await expect(first.locator('.load-errors,.load-paused')).toHaveCount(0);await expect(first.locator('.catalog-status')).toContainText('12 条资料 · 229 份缓存');
 expect(await page.evaluate(()=>(window as any).progress.first.store.getSnapshot().recovered)).toEqual(['newest-key','other-key']);
 await expect(page.locator('#second .catalog-status')).toContainText('0/229 份资料');
 await page.screenshot({path:test.info().outputPath('catalog-recovered.png')});
});

test('source context stays stable for ineffective merges and parent renders',async({page})=>{
 await page.evaluate(()=>(window as any).sources.merge({TEST_PROGRESS_SOURCE:{name:'Authored source',date:'2026-01-01',category:'第三方'}}));
 await expect(page.locator('#source-label')).toHaveText('Authored source（TEST_PROGRESS_SOURCE）');
 await page.evaluate(()=>{const w=window as any;w.sourceBefore={context:w.sources,format:w.sources.format,renders:w.sourceRenders};w.sources.merge({});w.sources.merge({TEST_PROGRESS_SOURCE:{name:'Authored source',date:'2026-01-01',category:'第三方'}});});
 await page.getByRole('button',{name:'Parent render 0',exact:true}).click();await expect(page.getByRole('button',{name:'Parent render 1',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>{const w=window as any;return {context:w.sources===w.sourceBefore.context,format:w.sources.format===w.sourceBefore.format,renders:w.sourceRenders===w.sourceBefore.renders};})).toEqual({context:true,format:true,renders:true});
});

test('real source metadata and mode changes remain visible and keep their distinct IDs',async({page})=>{
 await page.evaluate(()=>(window as any).sources.merge({TEST_PROGRESS_SOURCE:{name:'Authored source',date:'2026-01-01',category:'第三方'},TEST_PROGRESS_OTHER:{name:'Authored source'}}));
 await expect(page.locator('#source-label')).toHaveText('Authored source（TEST_PROGRESS_SOURCE）');
 for(const change of [{date:'2026-02-01'},{category:'核心规则'},{name:'Updated source'}]){
  const before=await page.evaluate(()=>(window as any).sourceRenders);
  await page.evaluate(change=>{const w=window as any;w.sources.merge({TEST_PROGRESS_SOURCE:{...w.sources.registry.TEST_PROGRESS_SOURCE,...change}});},change);
  await expect.poll(()=>page.evaluate(()=>(window as any).sourceRenders)).toBeGreaterThan(before);
  expect(await page.evaluate(change=>Object.entries(change).every(([key,value])=>(window as any).sources.registry.TEST_PROGRESS_SOURCE[key]===value),change)).toBe(true);
 }
 await expect(page.locator('#source-label')).toHaveText('Updated source（TEST_PROGRESS_SOURCE）');
 expect(await page.evaluate(()=>(window as any).sources.registry.TEST_PROGRESS_OTHER.name)).toBe('Authored source');
 for(const [mode,label] of [['short','TEST_PROGRESS_SOURCE'],['full','Updated source'],['both','Updated source（TEST_PROGRESS_SOURCE）']] as const){
  await page.evaluate(mode=>(window as any).sources.setMode(mode),mode);await expect(page.locator('#source-label')).toHaveText(label);await expect.poll(()=>page.evaluate(()=>localStorage.getItem('dnd-source-display'))).toBe(mode);
 }
});
