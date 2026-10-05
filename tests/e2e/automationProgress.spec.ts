import {test,expect,type Page} from '@playwright/test';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mockSource} from './fixtures';
import type {ProgressManifest} from '../../src/platform/automationProgress';
const asset='dist-standalone/assets/'+readdirSync('dist-standalone/assets').find(n=>/^automation-progress-.*\.json$/.test(n))!;
const content=readFileSync(asset),manifest:ProgressManifest=JSON.parse(content.toString());
const manifestHash=createHash('sha256').update(content).digest('hex');
const version='standalone-1.0.999';
const release={version,sourceCommit:manifest.build.sourceCommit,automationProgress:{schemaVersion:1,channel:'standalone',version,sourceCommit:manifest.build.sourceCommit,fingerprint:manifest.build.fingerprint,manifestSha256:manifestHash,loadedAndVerified:true,verifiedAt:'2026-10-05T12:00:00Z',capabilityIds:manifest.capabilities.filter(c=>c.playerAvailable&&c.verified).map(c=>c.id),ruleAuditVerified:false}};
const tab=(page:Page)=>page.getByRole('tab',{name:'自动化进度',exact:true});
const panel=(page:Page)=>page.getByRole('tabpanel',{name:'自动化进度',exact:true});
async function open(page:Page){await mockSource(page);await page.goto('/');await expect(page.locator('.announcement')).toBeVisible();await expect(page.locator('.paper')).toBeVisible();}
async function readWorkspace(page:Page){return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('dnd-card-standalone');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});try{return await new Promise<string>((resolve,reject)=>{const tx=db.transaction('documents','readonly'),r=tx.objectStore('documents').get('workspace');r.onsuccess=()=>resolve(JSON.stringify(r.result));r.onerror=()=>reject(r.error);});}finally{db.close();}});}

test('progress tabs, filtering, caching and character preservation',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await open(page);await expect(tab(page)).toBeVisible();await expect(tab(page)).toHaveAttribute('aria-selected','false');
 expect(requests.filter(u=>/automation-progress-.*\.json/.test(u))).toHaveLength(0);
 // Seed explicit manual notes and spent resource into the actual saved fixture card.
 await page.getByRole('button',{name:'我知道了',exact:true}).click();
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('dnd-card-standalone');r.onsuccess=()=>resolve(r.result);});const tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents'),request=store.get('workspace');request.onsuccess=()=>{const workspace=request.result,c=workspace.characters[0];c.story='原创验收手工记录';c.runtime.resources.manualProbe={name:'原创已消耗资源',max:4,current:1};c.automation={protocol:2,rulesVersion:'equipment.1',defaultsVersion:1,enabled:false};store.put(workspace,'workspace');};await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();});
 await page.reload();await expect(page.locator('.announcement')).toBeVisible();await expect(page.locator('.save-status')).toContainText('已保存到本机');
 // Measure after the existing Wiki queue has completed its warm-cache load.
 // A visible card / announcement can precede background catalog readiness.
 await expect(page.locator('.catalog-status > span').first()).toHaveText(/[\d,]+ 条资料 · \d+ 份缓存/);
 await expect(page.locator('.wiki-header button')).toBeEnabled();
 const before=await readWorkspace(page);requests.length=0;
 await tab(page).click();await expect(panel(page).getByText('现在自动到哪一步？',{exact:true})).toBeVisible();
 await expect(panel(page)).toContainText('当前发布可用仍待核实');await expect(panel(page).locator('.automation-progress-item')).toHaveCount(11);
 await expect(panel(page).locator('[data-current-available="true"]')).toHaveCount(0);
 await expect(panel(page).locator('.automation-progress-totals')).toContainText(`${manifest.audit.counts!.reviewed} / ${manifest.audit.counts!.total}`);
 await expect(panel(page).locator('.automation-progress-snapshot')).toContainText(`本地快照标记整条完成 ${manifest.audit.snapshot!.localMarkedComplete} 条`);
 await expect(panel(page).locator('.automation-progress-totals')).toContainText('整条已实现并验证待核实（当前版本逐条证据 0 条）');
 await expect(panel(page).locator('[data-capability="rest"]')).toContainText('入口未开放');
 await expect(panel(page).locator('[data-capability="rest"] button,[data-capability="rest"] a,[data-capability="combat"] button,[data-capability="combat"] a')).toHaveCount(0);
 await panel(page).getByRole('combobox',{name:'自动化功能分类'}).selectOption('equipment');await expect(panel(page).locator('.automation-progress-item')).toHaveCount(3);
 await panel(page).locator('.automation-progress-item').first().scrollIntoViewIfNeeded();await page.screenshot({path:test.info().outputPath('progress-equipment-desktop.png')});
 await panel(page).getByRole('combobox',{name:'自动化来源书'}).selectOption('COS');await expect(panel(page).locator('.automation-progress-item')).toHaveCount(0);
 const cosEquipment=manifest.sources.find(s=>s.id==='COS')!.counts!.equipment!;
 await expect(panel(page)).toContainText(`取得 ${cosEquipment.total} 条状态，已核对 ${cosEquipment.reviewed} 条`);
 await panel(page).getByRole('combobox',{name:'自动化功能分类'}).selectOption('spells');await expect(panel(page)).toContainText('所选分类未取得证据时也不按 0 条计算');
 await panel(page).getByRole('combobox',{name:'自动化功能分类'}).selectOption('equipment');
 const unknownBook=manifest.sources.find(s=>!s.counts&&!manifest.capabilities.some(c=>c.sampleSources.includes(s.id)))!;
 await panel(page).getByRole('combobox',{name:'自动化来源书'}).selectOption(unknownBook.id);await expect(panel(page)).toContainText('本书逐条核对');
 await panel(page).getByRole('combobox',{name:'自动化资料类型'}).selectOption('third-party');await expect(panel(page)).toContainText('第三方本地逐条状态已接入');
 await panel(page).getByRole('combobox',{name:'自动化来源书'}).selectOption('CROOKEDMOON24');await expect(panel(page)).toContainText('整条实现并验证待核实（当前版本逐条证据 0 条）');await expect(panel(page).locator('[data-current-available="true"]')).toHaveCount(0);
 await panel(page).getByRole('combobox',{name:'自动化资料类型'}).selectOption('all');await panel(page).getByRole('combobox',{name:'自动化功能分类'}).selectOption('all');
 await page.locator('.announcement-body').evaluate(node=>{node.scrollTop=0;});await page.screenshot({path:test.info().outputPath('progress-desktop.png')});
 await page.getByRole('tab',{name:'公告内容',exact:true}).click();await expect(panel(page)).toBeHidden();await expect(page.locator('.announcement-faq')).toBeVisible();await tab(page).click();
 await tab(page).focus();await page.keyboard.press('ArrowLeft');await expect(page.getByRole('tab',{name:'公告内容',exact:true})).toBeFocused();await page.keyboard.press('End');await expect(tab(page)).toBeFocused();
 await page.getByRole('button',{name:'我知道了',exact:true}).click();await page.getByRole('button',{name:'公告',exact:true}).click();await tab(page).click();await expect(panel(page).locator('.automation-progress-item')).toHaveCount(11);
 expect(requests.filter(u=>/automation-progress-.*\.json/.test(u))).toHaveLength(1);
 // The completed baseline queue must stay idle throughout tab switching and reopening.
 expect(requests.filter(u=>/5e\.kiwee|homebrew\.kiwee|cardRuntime|sourceSpells|catalog|libraryData/i.test(u))).toEqual([]);
 expect(requests.filter(u=>/automation-rule-status|automation-4561/i.test(u))).toEqual([]);
 expect(await readWorkspace(page)).toBe(before);expect(errors).toEqual([]);
});

test('progress on a narrow touch viewport',async({browser,baseURL})=>{
 const context=await browser.newContext({viewport:{width:390,height:760},isMobile:true,hasTouch:true,baseURL});const page=await context.newPage();
 await open(page);const box=(await tab(page).boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(44);expect(box.y+box.height).toBeLessThan(760);
 await tab(page).tap();await expect(panel(page).locator('.automation-progress-filters')).toBeVisible();
 expect(await panel(page).evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
 await page.screenshot({path:test.info().outputPath('progress-phone.png')});
 await panel(page).locator('.automation-progress-item').first().scrollIntoViewIfNeeded();await page.screenshot({path:test.info().outputPath('progress-values-phone.png')});
 const body=page.locator('.announcement-body');await body.evaluate(node=>{node.scrollTop=node.scrollHeight;});await expect(panel(page).getByText('简短更新记录',{exact:true})).toBeVisible();
 await expect(tab(page)).toBeVisible();await page.getByRole('button',{name:'我知道了',exact:true}).tap();await expect(page.locator('.announcement')).toHaveCount(0);await context.close();
});

test('publication evidence is exact and fails closed',async({page})=>{
 expect(release.automationProgress.capabilityIds).toHaveLength(9);let served:unknown=release;
 await page.route('**/release.json',r=>r.fulfill({json:served}));await open(page);await tab(page).click();await expect(panel(page).locator('[data-current-available="true"]')).toHaveCount(9);await expect(panel(page)).toContainText('当前运行发布 standalone-1.0.999');
 await expect(panel(page).locator('[data-capability="rest"]')).toContainText('未开放');await expect(panel(page).locator('.automation-progress-totals')).toContainText('当前发布整条可用待核实');
 // Same browser keeps the manifest but re-reads the running release when reopened.
 for(const bad of [{...release,sourceCommit:'b'.repeat(40)},{...release,version:'standalone-1.0.998'},{...release,automationProgress:{...release.automationProgress,manifestSha256:'c'.repeat(64)}},{version:'standalone-1.0.246'}]){
  served=bad;await page.getByRole('button',{name:'我知道了',exact:true}).click();await page.getByRole('button',{name:'公告',exact:true}).click();await tab(page).click();await expect(panel(page).locator('[data-current-available="true"]')).toHaveCount(0);await expect(panel(page)).toContainText('当前发布可用仍待核实');
 }
});

test('corrupt manifest remains status-only and the card stays usable',async({page})=>{
 await page.route('**/automation-progress-*.json',r=>r.fulfill({json:{...manifest,capabilities:[{id:'fake',playerAvailable:true,raw:{entries:['untrusted rules']}}]}}));
 await open(page);await tab(page).click();await expect(panel(page)).toContainText('所有未取得证据的状态均待核实');await expect(panel(page).locator('.automation-progress-item')).toHaveCount(0);await expect(panel(page).getByRole('button')).toHaveCount(0);
 await page.getByRole('tab',{name:'公告内容',exact:true}).click();await expect(page.locator('.announcement-faq')).toBeVisible();await page.getByRole('button',{name:'我知道了',exact:true}).click();await expect(page.locator('.paper')).toBeVisible();
});
