import {test,expect,type Page} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
import {mockSource} from './fixtures';
import {permissionPanelAssetRoute} from './permissionPanelAssetRoute';
const suite=resolve(process.env.SUITE_ROOT||'../suite-recovery-online-safe'),panels=join(suite,'dist-workbench-dev/workbench-panels');
const protocol='full-suite-workbench/v1',session='permission-local-window',seenKey='obr-suite/workbench/player-permissions-seen';
async function pair(host:Page,role='GM'){
 await mockSource(host);
 // Music content is outside this regression; keep its real toolbar navigation
 // and panel shell while serving an inert local page for the adjacent click.
 await host.context().route('**/workbench-panels/music.html?*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic music content</title>'}));
 await host.context().route(permissionPanelAssetRoute,async route=>{const file=join(panels,basename(new URL(route.request().url()).pathname));await route.fulfill({body:readFileSync(file),contentType:file.endsWith('.html')?'text/html':'text/javascript'});});
 await host.context().route('**/suite-dev/owner-step*.png',route=>route.fulfill({body:readFileSync(join(suite,'public',basename(new URL(route.request().url()).pathname))),contentType:'image/png'}));
 await host.route('**/permission-host',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic permission host</title>'}));await host.goto('/permission-host');
 await host.evaluate(({protocol,session,role,seenKey})=>{const fixture=(window as any).permissionHost={role,seen:false,requests:[] as any[]};window.addEventListener('message',event=>{const m=event.data;if(m?.protocol!==protocol||m.session!==session)return;fixture.requests.push(m);const send=(data:any)=>(event.source as Window).postMessage({protocol,session,hostStarted:1,...data},location.origin);if(m.type==='hello'||m.type==='ping'){send({type:m.type==='hello'?'ready':'pong'});return;}if(m.type==='console'&&m.statusOnly){send({type:'ack',requestId:m.requestId,ok:true,result:{seen:fixture.seen}});return;}if(m.type==='panelRpc'){if(m.method==='permissions.acknowledge')fixture.seen=true;const result=m.method==='init'?{roomId:'permission-room',playerId:'test-gm',preferences:{}}:m.method==='player.getRole'?fixture.role:{};send({type:'ack',requestId:m.requestId,ok:true,result});}});},{protocol,session,role,seenKey});
 const waiting=host.context().waitForEvent('page');await host.evaluate(session=>{(window as any).viewer=window.open('/#suite='+session+'&bridge='+encodeURIComponent(location.origin),'permission-window');},session);const page=await waiting;await mockSource(page);await expect(page.locator('.app-shell')).toBeVisible();
 await host.evaluate(({protocol,session,role})=>{const emit=(type:string,rest:any={})=>(window as any).viewer.postMessage({protocol,session,type,hostStarted:1,...rest},location.origin);emit('ready');emit('catalog',{sequence:1,cards:[],monsters:[],role,enabled:{characterCards:true,musicBoard:true},visibility:{wiki:true,monsters:true}});},{protocol,session,role});
 return page;
}
test.beforeAll(()=>{if(!existsSync(join(panels,'permissions.html')))throw Error('Missing paired permissions.html. Set SUITE_ROOT to the reviewed Suite source and build WORKBENCH_PANEL_ONLY=permissions; this regression must not silently skip.');});
for(const width of [1440,390,320])test(`GM permission guide stays inside ${width}px detached window and requires explicit read acknowledgment`,async({page:host},info)=>{
 const page=await pair(host),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize({width,height:844});
 const entry=page.getByRole('button',{name:'关于玩家分配卡和权限',exact:true}),dialog=page.getByRole('dialog',{name:'关于玩家分配卡和权限',exact:true}),frame=page.frameLocator('.player-permission-dialog iframe');
 await expect(entry).toBeVisible();
 const layout=await entry.evaluate(button=>{const bounds=(element:Element)=>{const r=element.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};return {entry:bounds(button),modes:[...button.closest('nav')!.querySelectorAll('button')].map(bounds),bar:bounds(document.querySelector('.workbench-bar')!)};});
 for(const rect of layout.modes){expect(rect.left).toBeGreaterThanOrEqual(0);expect(rect.right).toBeLessThanOrEqual(width);}
 expect(layout.entry.top).toBeGreaterThanOrEqual(layout.bar.bottom);
 await page.screenshot({path:info.outputPath(`permission-entry-${width}.png`)});
 const music=page.getByRole('button',{name:'音乐板',exact:true}),overview=page.getByRole('button',{name:'总览',exact:true});
 await music.click();await expect(music).toHaveClass(/active/);await expect(page.locator('.music-workspace')).toBeVisible();await expect(entry).toBeVisible();
 await overview.click();await expect(overview).toHaveClass(/active/);await expect(page.locator('.music-workspace')).toHaveCount(0);
 await entry.click();await expect(dialog).toBeVisible();await expect(frame.getByRole('button',{name:'我真的知道了',exact:true})).toBeDisabled();
 expect(await host.locator('dialog,iframe').count()).toBe(0);
 const bounds=await dialog.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(844);
 await frame.locator('#btn-close').dispatchEvent('click');expect(await page.evaluate(key=>localStorage.getItem(key),seenKey)).toBeNull();
 await page.getByRole('button',{name:'关闭权限说明'}).click();await expect(dialog).toHaveCount(0);await expect(entry).toBeVisible();
 await entry.click();await frame.locator('#body').focus();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(entry).toBeFocused();
 await entry.click();await frame.locator('.announcement-important img').last().waitFor();await frame.locator('.announcement-important img').evaluateAll(images=>Promise.all(images.map(image=>(image as HTMLImageElement).complete?Promise.resolve():new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});}))));
 await frame.locator('#body').evaluate(body=>{body.scrollTop=body.scrollHeight;body.dispatchEvent(new Event('scroll'));});await expect(frame.locator('#btn-close')).toBeEnabled();
 await page.screenshot({path:info.outputPath(`permission-local-${width}.png`)});await frame.locator('#btn-close').click();await expect(dialog).toHaveCount(0);await expect(entry).toHaveCount(0);expect(await page.evaluate(key=>localStorage.getItem(key),seenKey)).toBeNull();expect(await host.evaluate(()=>(window as any).permissionHost.seen)).toBe(true);
 const requests=await host.evaluate(()=>(window as any).permissionHost.requests);expect(requests.filter((request:any)=>request.type==='console'&&request.action==='playerPermissions'&&!request.statusOnly)).toHaveLength(0);expect(requests.filter((request:any)=>['save','createCard','delete','stats'].includes(request.type))).toHaveLength(0);expect(errors).toEqual([]);
});
test('players have no permission guide and role revocation dismisses an unread guide',async({page:host})=>{
 const page=await pair(host,'PLAYER'),entry=page.getByRole('button',{name:'关于玩家分配卡和权限',exact:true});await expect(entry).toHaveCount(0);
 const setRole=async(role:string,sequence:number)=>host.evaluate(({role,sequence,protocol,session})=>{(window as any).permissionHost.role=role;(window as any).viewer.postMessage({protocol,session,type:'catalog',sequence,hostStarted:1,cards:[],monsters:[],role,enabled:{characterCards:true,musicBoard:true},visibility:{wiki:true,monsters:true}},location.origin);},{role,sequence,protocol,session});
 await setRole('GM',2);await entry.click();await expect(page.locator('.player-permission-dialog')).toBeVisible();await setRole('PLAYER',3);await expect(page.locator('.player-permission-dialog')).toHaveCount(0);await expect(entry).toHaveCount(0);expect(await page.evaluate(key=>localStorage.getItem(key),seenKey)).toBeNull();
});

test('continuous attention moves the red surface while hover, focus and the click target stay stable',async({page:host})=>{
 const page=await pair(host);await page.emulateMedia({reducedMotion:'no-preference'});
 const entry=page.getByRole('button',{name:'关于玩家分配卡和权限',exact:true}),surface=entry.locator('.player-permission-entry-surface');await expect(entry).toBeVisible();
 const motion=await entry.evaluate(button=>{
  const surface=button.querySelector('.player-permission-entry-surface')!,animation=surface.getAnimations()[0];
  if(!animation)throw Error('Unread permission entry must continuously animate');
  const bounds=(element:Element)=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  animation.pause();animation.currentTime=0;const start={button:bounds(button),surface:bounds(surface)};
  animation.currentTime=400;const middle={button:bounds(button),surface:bounds(surface)};
  animation.currentTime=2000;const later={button:bounds(button),surface:bounds(surface)};
  const style=getComputedStyle(surface),rect=button.getBoundingClientRect(),hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)===button;
  const settings={iterations:style.animationIterationCount,duration:style.animationDuration,opacity:style.opacity};
  animation.currentTime=0;animation.play();return {start,middle,later,hit,...settings};
 });
 expect(motion.start.button).toEqual(motion.middle.button);expect(motion.start.button).toEqual(motion.later.button);
 expect(motion.middle.surface.x-motion.start.surface.x).toBeCloseTo(4,1);expect(motion.later.surface.x).toBeCloseTo(motion.middle.surface.x,1);
 for(const sample of [motion.start,motion.middle,motion.later]){expect(sample.surface.x).toBeGreaterThanOrEqual(sample.button.x);expect(sample.surface.right).toBeLessThanOrEqual(sample.button.right);}
 expect(motion.hit).toBe(true);expect(motion.iterations).toBe('infinite');expect(motion.duration).toBe('0.8s');expect(motion.opacity).toBe('1');
 await entry.hover();await entry.focus();await expect(entry).toBeFocused();
 await expect.poll(()=>surface.evaluate(element=>Number(element.getAnimations()[0]?.currentTime||0))).toBeGreaterThan(1600);
 expect(await surface.evaluate(element=>element.getAnimations()[0].playState)).toBe('running');
 await entry.press('Enter');await expect(page.locator('.player-permission-dialog')).toBeVisible();
 await page.getByRole('button',{name:'关闭权限说明'}).click();await expect(entry).toBeFocused();await expect(entry).toBeVisible();
 await entry.click();await expect(page.locator('.player-permission-dialog')).toBeVisible();
});

test('reduced motion keeps the prominent unread entry static and music being disabled does not hide it',async({page:host})=>{
 const page=await pair(host);await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:240,height:844});
 await host.evaluate(({protocol,session})=>(window as any).viewer.postMessage({protocol,session,type:'catalog',sequence:2,hostStarted:1,cards:[],monsters:[],role:'GM',enabled:{characterCards:true,musicBoard:false},visibility:{wiki:true,monsters:true}},location.origin),{protocol,session});
 const entry=page.getByRole('button',{name:'关于玩家分配卡和权限',exact:true});await expect(entry).toBeVisible();await expect(page.getByRole('button',{name:'音乐板',exact:true})).toHaveCount(0);
 const style=await entry.locator('.player-permission-entry-surface').evaluate(element=>{const s=getComputedStyle(element),r=element.getBoundingClientRect();return {animation:s.animationName,border:s.borderTopColor,weight:s.fontWeight,left:r.left,right:r.right};});
 expect(style.animation).toBe('none');expect(style.border).toBe('rgb(189, 37, 37)');expect(Number(style.weight)).toBeGreaterThanOrEqual(700);expect(style.left).toBeGreaterThanOrEqual(0);expect(style.right).toBeLessThanOrEqual(240);
 await entry.click();await expect(page.locator('.player-permission-dialog')).toBeVisible();
});

test('a previously acknowledged host keeps the entry hidden without resetting its read status',async({page:host})=>{
 const page=await pair(host);await expect(page.locator('.player-permission-entry')).toBeVisible();
 await host.evaluate(()=>(window as any).permissionHost.seen=true);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.player-permission-entry')).toHaveCount(0);
 const requests=await host.evaluate(()=>(window as any).permissionHost.requests);
 expect(requests.filter((request:any)=>request.method==='permissions.acknowledge')).toHaveLength(0);
});
