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
async function assertBeforeComplete(page:Page,fading=false){
 await expect(page.locator('dialog[open]')).toHaveCount(0);
 expect(await page.locator('#root').evaluate(el=>getComputedStyle(el).visibility)).toBe(fading?'visible':'hidden');
 expect(await page.locator('#root').evaluate(el=>(el as HTMLElement).inert)).toBe(true);
 expect(await page.evaluate(()=>(window as any).modalStarts)).toEqual([]);
}
async function assertAfterComplete(page:Page){
 await phase(page,'complete');await expect(page.locator('.announcement[open]')).toBeVisible();
 expect(await page.locator('#startup-intro').evaluate(el=>(el as HTMLElement).hidden)).toBe(true);
 expect(await page.evaluate(()=>(window as any).modalStarts.every((row:any)=>row.phase==='complete'))).toBe(true);
 expect(await page.evaluate(()=>(window as any).startupEvents.map((row:any)=>row.phase))).toEqual(['loading','playing','waiting','fading','complete']);
}
test('first and cached visits reveal the ready card through fade-out before the modal',async({page},info)=>{
 await prepare(page);await page.goto(url(info),{waitUntil:'commit'});await phase(page,'playing');await assertBeforeComplete(page);
 await expect(page.locator('#startup-intro')).toHaveCSS('background-color','rgb(255, 255, 86)');await expect(page.locator('.startup-piece')).toHaveCount(4);
 await page.screenshot({path:info.outputPath('approved-four-png-intro.png')});
 await phase(page,'fading');await assertBeforeComplete(page,true);expect(await page.evaluate(key=>localStorage.getItem(key),key(info))).toBeNull();
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
test('slow lossless logo waits to start, then plays all four layers without an early modal',async({page},info)=>{
 await prepare(page);let release!:()=>void;const blocked=new Promise<void>(resolve=>release=resolve);
 await page.route('**/startup-logo/3.webp',async route=>{await blocked;await route.continue();});await page.goto(url(info),{waitUntil:'commit'});
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
 await prepare(page);await page.goto(url(info),{waitUntil:'commit'});await phase(page,'fading');await assertBeforeComplete(page,true);await page.goto('about:blank');
 await page.goto(url(info),{waitUntil:'commit'});await phase(page,'playing');await assertBeforeComplete(page);expect(await page.evaluate(key=>localStorage.getItem(key),key(info))).toBeNull();await assertAfterComplete(page);
});

test('a stalled card stylesheet does not hold the yellow shell or logo hostage',async({page},info)=>{
 await prepare(page);let release!:()=>void;const blocked=new Promise<void>(resolve=>release=resolve);
 await page.route('**/assets/card-core-*.css',async route=>{await blocked;await route.continue();});
 await page.goto(url(info),{waitUntil:'commit'});await phase(page,'playing');await expect(page.locator('#startup-intro')).toBeVisible();
 await phase(page,'waiting');await assertBeforeComplete(page);await page.screenshot({path:info.outputPath('logo-with-css-stalled.png')});
 release();await phase(page,'fading');await assertBeforeComplete(page,true);await page.screenshot({path:info.outputPath('transparent-card-reveal.png')});await assertAfterComplete(page);
});
test('a failed card stylesheet preserves recovery and never exposes an unstyled card',async({page},info)=>{
 await prepare(page);await page.route('**/assets/card-core-*.css',route=>route.abort('failed'));
 await page.goto(url(info),{waitUntil:'commit'});await phase(page,'failed');await expect(page.locator('#startup-help')).toBeVisible();await expect(page.locator('dialog[open]')).toHaveCount(0);await expect(page.locator('#root')).toHaveCSS('display','none');
 expect(await page.evaluate(()=>(window as any).startupEvents.some((row:any)=>row.phase==='complete'))).toBe(false);
});
test('delivery layers decode to every original RGBA pixel and preserve the approved choreography',async({page},info)=>{
 await prepare(page);await page.goto(url(info),{waitUntil:'commit'});await phase(page,'playing');
 const animation=await page.locator('.startup-piece').evaluateAll(nodes=>nodes.map(node=>{const style=getComputedStyle(node);return {duration:style.animationDuration,delay:style.animationDelay,animation:style.animationName};}));
 expect(animation.map(row=>row.duration)).toEqual(['1.9s','1.9s','1.9s','1.9s']);expect(animation.map(row=>row.delay)).toEqual(['0s','0.14s','0.28s','0.42s']);
 const pixels=await page.evaluate(async()=>{
  async function rgba(url:string){const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);return ctx.getImageData(0,0,image.width,image.height).data;}
  return Promise.all([1,2,3,4].map(async n=>{const [a,b]=await Promise.all([rgba(`./startup-logo/${n}.PNG`),rgba(`./startup-logo/${n}.webp`)]);return a.length===b.length&&a.every((value,i)=>value===b[i]);}));
 });expect(pixels).toEqual([true,true,true,true]);
});
