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
 // Capture inside the page before releasing CSS: a remote evaluate arriving
 // after the 450 ms transition would sample a completed fade on a busy runner.
 await page.evaluate(()=>{const capture=(event:Event)=>{if((event as CustomEvent).detail!=='fading')return;window.removeEventListener('dnd-card-startup',capture);queueMicrotask(()=>{const el=document.getElementById('startup-intro')!,animation=el.getAnimations()[0];if(!animation){(window as any).fadeSample={error:'missing fade transition'};return;}animation.pause();animation.currentTime=225;(window as any).fadeSample={opacity:Number(getComputedStyle(el).opacity)};});};window.addEventListener('dnd-card-startup',capture);});
 release();await page.waitForFunction(()=>(window as any).fadeSample);const sample=await page.evaluate(()=>(window as any).fadeSample);expect(sample.error).toBeUndefined();
 expect(sample.opacity).toBeGreaterThan(0);expect(sample.opacity).toBeLessThan(1);await assertBeforeComplete(page,true);await page.screenshot({path:info.outputPath('transparent-card-reveal.png')});await page.locator('#startup-intro').evaluate(el=>el.getAnimations().forEach(animation=>animation.play()));await assertAfterComplete(page);
});
test('a failed card stylesheet preserves recovery and never exposes an unstyled card',async({page},info)=>{
 await prepare(page);await page.route('**/assets/card-core-*.css',route=>route.abort('failed'));
 await page.goto(url(info),{waitUntil:'commit'});await phase(page,'failed');await expect(page.locator('#startup-help')).toBeVisible();await expect(page.locator('dialog[open]')).toHaveCount(0);await expect(page.locator('#root')).toHaveCSS('display','none');
 expect(await page.evaluate(()=>(window as any).startupEvents.some((row:any)=>row.phase==='complete'))).toBe(false);
});
test('lossless layers retain alpha and opaque pixels with bounded compositor rounding',async({page},info)=>{
 await prepare(page);await page.goto(url(info),{waitUntil:'commit'});await phase(page,'playing');
 const animation=await page.locator('.startup-piece').evaluateAll(nodes=>nodes.map(node=>{const style=getComputedStyle(node);return {duration:style.animationDuration,delay:style.animationDelay,animation:style.animationName};}));
 expect(animation.map(row=>row.duration)).toEqual(['1.9s','1.9s','1.9s','1.9s']);expect(animation.map(row=>row.delay)).toEqual(['0s','0.14s','0.28s','0.42s']);
 const pixels=await page.evaluate(async()=>{
  async function load(url:string){const image=new Image();image.src=url;await image.decode();return image;}
  function rgba(image:HTMLImageElement|HTMLCanvasElement,background?:string){const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d')!;if(background){ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);}ctx.drawImage(image,0,0);return ctx.getImageData(0,0,image.width,image.height).data;}
  const layers=await Promise.all([1,2,3,4].map(async layer=>({layer,png:await load(`./startup-logo/${layer}.PNG`),webp:await load(`./startup-logo/${layer}.webp`)})));
  function compare(layer:number,png:HTMLImageElement|HTMLCanvasElement,webp:HTMLImageElement|HTMLCanvasElement){
   const a=rgba(png),b=rgba(webp);
   let alphaChanges=0,opaqueChanges=0,rawChangedPixels=0,maxRawDelta=0;const positions:{x:number;y:number;alpha:number;delta:number}[]=[];
   for(let i=0;i<a.length;i+=4){if(a[i+3]!==b[i+3])alphaChanges++;let delta=0;for(let k=0;k<3;k++)delta=Math.max(delta,Math.abs(a[i+k]-b[i+k]));if(delta){rawChangedPixels++;maxRawDelta=Math.max(maxRawDelta,delta);if(a[i+3]===255)opaqueChanges++;if(positions.length<12)positions.push({x:(i/4)%png.width,y:Math.floor(i/4/png.width),alpha:a[i+3],delta});}}
   const composite=['#ffff56','#50525b','#ffffff'].map(background=>{const x=rgba(png,background),y=rgba(webp,background);let changed=0,maxDelta=0;for(let i=0;i<x.length;i+=4){let delta=0;for(let k=0;k<4;k++)delta=Math.max(delta,Math.abs(x[i+k]-y[i+k]));if(delta)changed++;maxDelta=Math.max(maxDelta,delta);}return {background,changed,maxDelta};});
   return {layer,width:png.width,height:png.height,alphaChanges,opaqueChanges,rawChangedPixels,maxRawDelta,positions,composite};
  }
  function assembled(format:'png'|'webp'){const canvas=document.createElement('canvas');canvas.width=500;canvas.height=500;const ctx=canvas.getContext('2d')!;for(const id of [4,1,2,3])ctx.drawImage(layers.find(row=>row.layer===id)![format],0,0);return canvas;}
  return [...layers.map(row=>compare(row.layer,row.png,row.webp)),compare(0,assembled('png'),assembled('webp'))];
 });
 await info.attach('browser-logo-pixels.json',{body:JSON.stringify(pixels,null,2),contentType:'application/json'});
 // PNG and lossless WebP decoder paths can round translucent premultiplication
 // differently. Original/delivery raw RGBA hashes are independently pinned;
 // here verify identical alpha/opaque pixels and <=1/255 displayed-channel
 // error on the actual yellow, card gray and white compositing backgrounds.
 for(const layer of pixels){expect(layer.width).toBe(500);expect(layer.height).toBe(500);expect(layer.alphaChanges).toBe(0);if(layer.layer!==0)expect(layer.opaqueChanges).toBe(0);for(const row of layer.composite)expect(row.maxDelta,JSON.stringify(layer)).toBeLessThanOrEqual(1);}
});
