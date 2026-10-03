import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {mockSource} from './fixtures';
import {ANNOUNCEMENT_KEY,announcementVersionFor} from '../../src/platform/announcement';
const phase=(page:Page,value:string)=>page.waitForFunction(value=>document.documentElement.dataset.cardStartup===value,value);
const key=(info:TestInfo)=>ANNOUNCEMENT_KEY+(info.project.name==='suite'?':suite':'');
function url(info:TestInfo){return info.project.name==='suite'?`/#suite=startup-test&bridge=${encodeURIComponent(info.project.use.baseURL!)}`:'/';}
async function prepare(page:Page){
 await mockSource(page,{suiteAnnouncement:true});
 await page.addInitScript(()=>{
  (window as any).startupEvents=[];(window as any).modalStarts=[];
  window.addEventListener('dnd-card-startup',event=>(window as any).startupEvents.push({phase:(event as CustomEvent).detail,at:performance.now()}));
  const show=HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal=function(){(window as any).modalStarts.push({phase:document.documentElement.dataset.cardStartup,at:performance.now(),className:this.className});return show.call(this);};
 });
}
async function assertBeforeComplete(page:Page){
 await expect(page.locator('dialog[open]')).toHaveCount(0);
 expect(await page.locator('#root').evaluate(el=>getComputedStyle(el).visibility)).toBe('hidden');
 expect(await page.evaluate(()=>(window as any).modalStarts)).toEqual([]);
}
async function assertAfterComplete(page:Page){
 await phase(page,'complete');await expect(page.locator('.announcement[open]')).toBeVisible();
 expect(await page.locator('#startup-intro').evaluate(el=>(el as HTMLElement).hidden)).toBe(true);
 expect(await page.evaluate(()=>(window as any).modalStarts.every((row:any)=>row.phase==='complete'))).toBe(true);
 expect(await page.evaluate(()=>(window as any).startupEvents.map((row:any)=>row.phase))).toEqual(['loading','playing','waiting','fading','complete']);
}
test('first and cached visits finish four PNGs and fade-out before the card and modal',async({page},info)=>{
 await prepare(page);await page.goto(url(info),{waitUntil:'commit'});await phase(page,'playing');await assertBeforeComplete(page);
 await expect(page.locator('#startup-intro')).toHaveCSS('background-color','rgb(255, 255, 86)');await expect(page.locator('.startup-piece')).toHaveCount(4);
 await page.screenshot({path:info.outputPath('approved-four-png-intro.png')});
 await phase(page,'fading');await assertBeforeComplete(page);expect(await page.evaluate(key=>localStorage.getItem(key),key(info))).toBeNull();
 await page.screenshot({path:info.outputPath('fade-before-any-modal.png')});await assertAfterComplete(page);await page.screenshot({path:info.outputPath('announcement-after-fade.png')});
 // Exposure alone does not acknowledge a Web notice.
 expect(await page.evaluate(key=>localStorage.getItem(key),key(info))).toBeNull();
 await page.locator('.announcement-foot input').check();await page.locator('.announcement-foot .primary').click();
 expect(await page.evaluate(key=>localStorage.getItem(key),key(info))).toBe(announcementVersionFor(info.project.name==='suite'?'suite':'standalone'));
 await page.getByRole('button',{name:'公告',exact:true}).click();await expect(page.locator('.announcement[open]')).toBeVisible();await page.locator('.announcement-foot .primary').click();
 expect(await page.evaluate(()=>(window as any).startupEvents.filter((row:any)=>row.phase==='complete').length)).toBe(1);
 await page.reload({waitUntil:'commit'});await phase(page,'playing');await assertBeforeComplete(page);await phase(page,'complete');await expect(page.locator('.announcement')).toHaveCount(0);await expect(page.locator('.app-shell')).toBeVisible();
});
test('slow app leaves final pose waiting and does not publish an early completion',async({page},info)=>{
 await prepare(page);let release!:()=>void;const blocked=new Promise<void>(resolve=>release=resolve);
 await page.route('**/assets/*.js',async route=>{await blocked;await route.continue();});
 await page.goto(url(info),{waitUntil:'commit'});await phase(page,'waiting');await assertBeforeComplete(page);expect(await page.evaluate(key=>localStorage.getItem(key),key(info))).toBeNull();
 release();await assertAfterComplete(page);
});
test('slow PNG waits to start, then plays all four layers without an early modal',async({page},info)=>{
 await prepare(page);let release!:()=>void;const blocked=new Promise<void>(resolve=>release=resolve);
 await page.route('**/startup-logo/3.PNG',async route=>{await blocked;await route.continue();});await page.goto(url(info),{waitUntil:'commit'});
 await page.waitForFunction(()=>!!document.querySelector('.app-shell'));expect(await page.evaluate(()=>document.documentElement.dataset.cardStartup)).toBe('loading');await assertBeforeComplete(page);
 release();await assertAfterComplete(page);
});
test('reduced motion still ends its shortened fade before opening the modal',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await prepare(page);await page.goto(url(info),{waitUntil:'commit'});await assertAfterComplete(page);
});
test('failed program shows recovery and keeps notice unread',async({page},info)=>{
 await prepare(page);await page.route('**/assets/*.js',route=>route.abort('failed'));await page.goto(url(info),{waitUntil:'commit'});await phase(page,'failed');
 await expect(page.locator('#startup-help')).toBeVisible();await expect(page.locator('dialog[open]')).toHaveCount(0);expect(await page.evaluate(key=>localStorage.getItem(key),key(info))).toBeNull();
 await page.screenshot({path:info.outputPath('startup-failure-recovery.png')});
});
test('interrupted fade and fresh reentry cannot expose or acknowledge the cancelled notice',async({page},info)=>{
 await prepare(page);await page.goto(url(info),{waitUntil:'commit'});await phase(page,'fading');await assertBeforeComplete(page);await page.goto('about:blank');
 await page.goto(url(info),{waitUntil:'commit'});await phase(page,'playing');await assertBeforeComplete(page);expect(await page.evaluate(key=>localStorage.getItem(key),key(info))).toBeNull();await assertAfterComplete(page);
});
