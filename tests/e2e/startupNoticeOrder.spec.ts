import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {mockSource} from './fixtures';
import {ANNOUNCEMENT_KEY,announcementVersionFor} from '../../src/platform/announcement';
const phase=(page:Page,value:string)=>page.waitForFunction(value=>document.documentElement?.dataset.cardStartup===value,value);
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
 const value=await page.evaluate(()=>document.documentElement.dataset.cardStartup);
 expect(await page.locator('#root').evaluate(el=>getComputedStyle(el).visibility)).toBe(await page.locator('html').getAttribute('data-card-ready')==='true'?'visible':'hidden');
 expect(await page.locator('#root').evaluate(el=>(el as HTMLElement).inert)).toBe(true);
 await expect(page.locator('#root')).toHaveAttribute('aria-hidden','true');
 expect(await page.evaluate(()=>(window as any).modalStarts)).toEqual([]);
}
async function assertAfterComplete(page:Page){
 await phase(page,'complete');await expect(page.locator('.announcement[open]')).toBeVisible();
 expect(await page.locator('#startup-intro').evaluate(el=>(el as HTMLElement).hidden)).toBe(true);
 expect(await page.locator('#root').evaluate(el=>(el as HTMLElement).inert)).toBe(false);
 await expect(page.locator('#root')).not.toHaveAttribute('aria-hidden','true');
 expect(await page.evaluate(()=>(window as any).modalStarts.every((row:any)=>row.phase==='complete'))).toBe(true);
 const phases=await page.evaluate(()=>(window as any).startupEvents.map((row:any)=>row.phase));expect(phases.filter((value:string)=>value!=='waiting')).toEqual(['loading','playing','fading','complete']);if(phases.includes('waiting'))expect(phases.indexOf('waiting')).toBeGreaterThan(phases.indexOf('fading'));
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
test('slow app finishes the opening before waiting and never publishes early completion',async({page},info)=>{
 await prepare(page);let release!:()=>void;const blocked=new Promise<void>(resolve=>release=resolve);
 await page.route('**/assets/*.js',async route=>{await blocked;await route.continue();});
 await page.goto(url(info),{waitUntil:'commit'});await phase(page,'waiting');await assertBeforeComplete(page);await expect(page.locator('#startup-intro')).toBeHidden();await expect(page.locator('#startup')).toBeVisible();expect(await page.evaluate(key=>localStorage.getItem(key),key(info))).toBeNull();
 release();await assertAfterComplete(page);
});
test('embedded four layers do not wait for any external logo request',async({page},info)=>{
 await prepare(page);const requests:string[]=[];
 page.on('request',request=>{if(request.url().includes('/startup-logo/'))requests.push(request.url());});
 await page.route('**/startup-logo/*',route=>route.abort('failed'));
 await page.goto(url(info),{waitUntil:'commit'});await phase(page,'playing');await assertBeforeComplete(page);
 const sources=await page.locator('.startup-piece').evaluateAll(nodes=>nodes.map(node=>(node as HTMLImageElement).src));
 expect(sources.every(src=>src.startsWith('data:image/webp;base64,'))).toBe(true);
 await assertAfterComplete(page);expect(requests).toEqual([]);
});
test('slow card CSS cannot extend the opening or expose an unstyled card',async({page},info)=>{
 await prepare(page);let release!:()=>void;const blocked=new Promise<void>(resolve=>release=resolve);
 await page.route('**/assets/card-core-*.css',async route=>{await blocked;await route.continue();});
 await page.goto(url(info),{waitUntil:'commit'});await phase(page,'playing');await assertBeforeComplete(page);
 await phase(page,'waiting');await assertBeforeComplete(page);await expect(page.locator('#startup-intro')).toBeHidden();await expect(page.locator('#startup')).toBeVisible();
 expect(await page.locator('link[data-card-style]').evaluateAll(nodes=>nodes.every(node=>(node as HTMLLinkElement).media==='print'))).toBe(true);
 release();await assertAfterComplete(page);
 if(info.project.name==='suite')await expect(page.locator('.app-shell .workbench-modes')).toBeVisible();
 else await expect(page.locator('.paper').first()).toBeVisible();
 await page.screenshot({path:info.outputPath('styled-card-after-timely-exit.png')});
});
test('failed card CSS provides recovery instead of a permanent yellow wait',async({page},info)=>{
 await prepare(page);await page.route('**/assets/card-core-*.css',route=>route.abort('failed'));await page.goto(url(info),{waitUntil:'commit'});await phase(page,'failed');
 await expect(page.locator('#startup-help')).toBeVisible();await expect(page.locator('dialog[open]')).toHaveCount(0);expect(await page.evaluate(key=>localStorage.getItem(key),key(info))).toBeNull();
});

test('a stylesheet error before the streamed body arrives still offers recovery',async({page},info)=>{
 await prepare(page);
 const {createServer}=await import('node:http');
 const base=String(info.project.use.baseURL).replace(/\/$/,'')+'/';
 const html=(await (await fetch(base)).text()).replace('<head>',`<head><base href="${base}">`),cut=html.indexOf('</head>')+7;
 let failedBeforeBody=false,bodySent=false;
 page.on('requestfailed',request=>{if(/card-core-.*\.css/.test(request.url())&&!bodySent)failedBeforeBody=true;});
 const server=createServer((_request,response)=>{response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.write(html.slice(0,cut));setTimeout(()=>{bodySent=true;response.end(html.slice(cut));},750);});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  await page.route('**/assets/card-core-*.css',route=>route.abort('failed'));
  await page.goto(`http://127.0.0.1:${(server.address() as {port:number}).port}/`,{waitUntil:'commit'});
  await phase(page,'failed');expect(failedBeforeBody).toBe(true);
  await expect(page.locator('#startup-title')).toHaveText('程序文件加载失败');await expect(page.locator('#startup-help')).toBeVisible();await expect(page.locator('dialog[open]')).toHaveCount(0);
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
test('reduced motion still ends its shortened fade before opening the modal',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await prepare(page);await page.goto(url(info),{waitUntil:'commit'});await assertAfterComplete(page);
});
test('failed program shows recovery and keeps notice unread',async({page},info)=>{
 await prepare(page);await page.route('**/assets/*.js',route=>route.abort('failed'));await page.goto(url(info),{waitUntil:'commit'});await phase(page,'failed');
 await expect(page.locator('#startup-help')).toBeVisible();await expect(page.locator('dialog[open]')).toHaveCount(0);expect(await page.evaluate(key=>localStorage.getItem(key),key(info))).toBeNull();
 // Inline recovery can precede document load and the first compositor frame.
 // Keep the immediate failure assertions above; capture evidence after paint.
 await page.waitForLoadState('load');
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 await page.screenshot({path:info.outputPath('startup-failure-recovery.png')});
});
test('interrupted fade and fresh reentry cannot expose or acknowledge the cancelled notice',async({page},info)=>{
 await prepare(page);await page.goto(url(info),{waitUntil:'commit'});await phase(page,'fading');await assertBeforeComplete(page);await page.goto('about:blank');
 await page.goto(url(info),{waitUntil:'commit'});await phase(page,'playing');await assertBeforeComplete(page);expect(await page.evaluate(key=>localStorage.getItem(key),key(info))).toBeNull();await assertAfterComplete(page);
});
