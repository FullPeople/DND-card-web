import {test,expect,type Page} from '@playwright/test';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mockSource} from './fixtures';
import {sourceRuleCounts,type ProgressManifest} from '../../src/platform/automationProgress';
import {mergeSourceDirectoryBooks,type SourceDirectory} from '../../src/platform/sourceDirectory';
const asset='dist-standalone/assets/'+readdirSync('dist-standalone/assets').find(n=>/^automation-progress-.*\.json$/.test(n))!;
const content=readFileSync(asset),manifest:ProgressManifest=JSON.parse(content.toString());
const manifestHash=createHash('sha256').update(content).digest('hex');
const tab=(page:Page)=>page.getByRole('tab',{name:'自动化进度',exact:true});
const panel=(page:Page)=>page.getByRole('tabpanel',{name:'自动化进度',exact:true});
async function noticeReady(page:Page){await expect(page.locator('html')).toHaveAttribute('data-card-startup','complete',{timeout:12000});await expect(page.locator('.announcement')).toBeVisible();}
async function open(page:Page){await mockSource(page);await page.goto('/');await noticeReady(page);await expect(page.locator('.paper')).toBeVisible();}
async function readWorkspace(page:Page){return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('dnd-card-standalone');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});try{return await new Promise<string>((resolve,reject)=>{const tx=db.transaction('documents','readonly'),r=tx.objectStore('documents').get('workspace');r.onsuccess=()=>resolve(JSON.stringify(r.result));r.onerror=()=>reject(r.error);});}finally{db.close();}});}
const directoryAsset='dist-standalone/assets/'+readdirSync('dist-standalone/assets').find(n=>/^automation-source-directory-.*\.json$/.test(n))!;
const directoryContent=readFileSync(directoryAsset),directory:SourceDirectory=JSON.parse(directoryContent.toString()),books=mergeSourceDirectoryBooks(manifest,directory);

test('whole-catalog progress retains unknown sources and separates partial execution from complete acceptance',async({page})=>{
 await open(page);await tab(page).click();
 await expect(panel(page).locator('.automation-progress-books li')).toHaveCount(books.length);
 const unknown=books.filter(source=>sourceRuleCounts(manifest,source.id,'all')===null);
 expect(unknown.length).toBeGreaterThan(0);
 for(const source of unknown){const row=panel(page).locator(`[data-source="${source.id}"]`);await expect(row).toContainText(source.name);await expect(row).toContainText('目录待建立');await expect(row).not.toContainText('0%');}
 await expect(panel(page)).toContainText(`已登记：${manifest.audit.counts!.total}`);
 await expect(panel(page)).toContainText(`来源已核验：${manifest.audit.counts!.reviewed}`);
 for(const stage of ['完整建模','完整执行','已验收'])await expect(panel(page)).toContainText(`${stage}：待核实`);
 await expect(panel(page)).toContainText(`至少一项机制已执行：${manifest.runtimeAudit!.implemented}/${manifest.audit.counts!.total}`);
 await expect(panel(page)).not.toContainText('已实装');
});

test('player progress, lazy caching and character preservation',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await open(page);await expect(tab(page)).toHaveAttribute('aria-selected','false');expect(requests.filter(u=>/automation-progress-.*\.json/.test(u))).toHaveLength(0);expect(requests.filter(u=>/automation-source-directory-.*\.json/.test(u))).toHaveLength(0);
 await page.getByRole('button',{name:'我知道了',exact:true}).click();await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('dnd-card-standalone');r.onsuccess=()=>resolve(r.result);});const tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents'),request=store.get('workspace');request.onsuccess=()=>{const workspace=request.result,c=workspace.characters[0];c.story='原创验收手工记录';c.runtime.resources.manualProbe={name:'原创已消耗资源',max:4,current:1};c.automation={protocol:2,rulesVersion:'equipment.1',defaultsVersion:1,enabled:false};store.put(workspace,'workspace');};await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();});
 await page.reload();await noticeReady(page);await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await expect(page.locator('.catalog-status > span').first()).toHaveText(/[\d,]+ 条资料 · \d+ 份缓存/);await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();
 const before=await readWorkspace(page);requests.length=0;await tab(page).click();
 await expect(panel(page)).toContainText('局部机制可用不等于整条规则完成。');
 await expect(panel(page)).toContainText(`来源已核验：${manifest.audit.counts!.reviewed}`);await expect(panel(page)).toContainText(`至少一项机制已执行：${manifest.runtimeAudit!.implemented}/${manifest.audit.counts!.total}`);
 await expect(panel(page)).toContainText('最近更新时间：');await expect(panel(page).locator('.automation-progress-books li')).toHaveCount(books.length);
 await expect(panel(page)).toContainText(`${directory.summary.newCandidateIdentities.toLocaleString('zh-CN')} 个新发现身份待登记`);const search=panel(page).getByRole('searchbox',{name:'查找来源书',exact:true});await search.fill('S5E');await expect(panel(page).locator('[data-source="S5E"]')).toBeVisible();await expect(panel(page)).toContainText(`已知目录：${books.length} 个来源`);await expect(panel(page)).toContainText(`已登记：${manifest.audit.counts!.total}`);await search.fill('');await expect(panel(page).locator('.automation-progress-books li')).toHaveCount(books.length);
 await expect(panel(page).locator('select,details,button,a,[data-capability]')).toHaveCount(0);await expect(panel(page)).not.toContainText('逐条证据');await expect(panel(page)).not.toContainText('本地快照标记');
 await page.screenshot({path:test.info().outputPath('progress-desktop.png')});
 await page.getByRole('tab',{name:'公告内容',exact:true}).click();await expect(panel(page)).toBeHidden();await expect(page.locator('.announcement-faq')).toBeVisible();await tab(page).click();
 await tab(page).focus();await page.keyboard.press('ArrowLeft');await expect(page.getByRole('tab',{name:'公告内容',exact:true})).toBeFocused();await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'更新日志',exact:true})).toBeFocused();await expect(panel(page)).toBeHidden();await page.keyboard.press('ArrowLeft');await expect(tab(page)).toBeFocused();
 await page.getByRole('button',{name:'我知道了',exact:true}).click();await page.getByRole('button',{name:'公告',exact:true}).click();await tab(page).click();await expect(panel(page).locator('.automation-progress-books li')).toHaveCount(books.length);
 expect(requests.filter(u=>/automation-progress-.*\.json/.test(u))).toHaveLength(1);expect(requests.filter(u=>/automation-source-directory-.*\.json/.test(u))).toHaveLength(1);expect(requests.filter(u=>/5e\.kiwee|homebrew\.kiwee|cardRuntime|sourceSpells|catalog|libraryData|automation-rule-status|automation-runtime-coverage/i.test(u))).toEqual([]);
 expect(await readWorkspace(page)).toBe(before);expect(errors).toEqual([]);
});

test('compact source progress on a narrow touch viewport',async({browser,baseURL})=>{
 const context=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true,baseURL});const page=await context.newPage();await open(page);
 const box=(await tab(page).boundingBox())!;expect(box.height).toBe(22);expect(box.y+box.height).toBeLessThan(760);await tab(page).tap();
 await expect(panel(page).locator('.automation-progress-books')).toBeVisible();expect(await panel(page).evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
 expect((await panel(page).locator('.automation-progress-books li').first().boundingBox())!.height).toBeLessThanOrEqual(30);
 await page.screenshot({path:test.info().outputPath('progress-phone.png')});const body=page.locator('.announcement-body');await body.evaluate(node=>{node.scrollTop=node.scrollHeight;});
 await expect(panel(page).locator('.automation-progress-books li').last()).toBeVisible();await expect(tab(page)).toBeVisible();await page.getByRole('button',{name:'我知道了',exact:true}).tap();await expect(page.locator('.announcement')).toHaveCount(0);await context.close();
});

test('runtime counts and source percentages use the exact pinned artifact',async({page})=>{
 const lock=JSON.parse(readFileSync('docs/data/automation-runtime-coverage.lock.json','utf8')),ledger=JSON.parse(readFileSync('docs/data/automation-runtime-coverage.json','utf8'));
 expect(manifest.runtimeAudit).toMatchObject({revision:lock.revision,sha256:lock.sha256,total:ledger.total,implemented:ledger.implemented});
 expect(createHash('sha256').update(readFileSync('docs/data/automation-runtime-coverage.json')).digest('hex')).toBe(lock.sha256);
 expect(manifest.audit.snapshot!.localMarkedComplete).toBe(162);expect(manifest.audit.counts!.implementedVerified).toBe(0);
 const requests:string[]=[];page.on('response',r=>{if(/automation-progress-.*\.json/.test(r.url()))requests.push(r.url());});await open(page);await tab(page).click();
 for(const id of ['PHB','XPHB','CROOKEDMOON24']){const s=manifest.sources.find(s=>s.id===id)!,total=sourceRuleCounts(manifest,id,'all')!.total,n=s.runtimeImplemented!,percent=n/total*100,label=percent===0?'0%':percent===100?'100%':percent.toFixed(1)+'%';
  await expect(panel(page).locator(`[data-source="${id}"]`)).toContainText(s.name);await expect(panel(page).locator(`[data-source="${id}"] .automation-progress-percent`)).toHaveText(label);await expect(panel(page).locator(`[data-source="${id}"]`)).toHaveAttribute('title',`已登记 ${total} 项，来源已核验 ${sourceRuleCounts(manifest,id,'all')!.reviewed} 项；至少一项机制已执行 ${n} 项；完整建模、完整执行与验收待核实。`);
 }
 expect(requests).toHaveLength(1);expect(createHash('sha256').update(await (await page.request.get(requests[0])).body()).digest('hex')).toBe(manifestHash);
});

test('corrupt manifest leaves progress unavailable and the card usable',async({page})=>{
 await page.route('**/automation-progress-*.json',r=>r.fulfill({json:{...manifest,runtimeAudit:{...manifest.runtimeAudit,implemented:999999}}}));await open(page);await tab(page).click();
 await expect(panel(page)).toContainText('进度暂时无法读取，请稍后重试。');await expect(panel(page).locator('.automation-progress-books')).toHaveCount(0);await expect(panel(page).getByRole('button')).toHaveCount(0);
 await page.getByRole('tab',{name:'公告内容',exact:true}).click();await expect(page.locator('.announcement-faq')).toBeVisible();await page.getByRole('button',{name:'我知道了',exact:true}).click();await expect(page.locator('.paper')).toBeVisible();
});

test('unreadable discovery directory keeps the old card and labels the incomplete source scope',async({page})=>{
 await page.route('**/automation-source-directory-*.json',route=>route.fulfill({json:{...directory,creditAdded:{...directory.creditAdded,executed:1}}}));await open(page);await tab(page).click();await expect(panel(page)).toContainText('完整来源目录暂时无法读取');await expect(panel(page)).toContainText('完整目录范围待核实');await expect(panel(page).locator('.automation-progress-books li')).toHaveCount(manifest.sources.length);await expect(panel(page)).not.toContainText(`已知目录：${books.length} 个来源`);await page.getByRole('tab',{name:'公告内容',exact:true}).click();await page.getByRole('button',{name:'我知道了',exact:true}).click();await expect(page.locator('.paper')).toBeVisible();
});
