import {test,expect,type Page} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
import {mockSource} from './fixtures';
const suite=resolve(process.env.SUITE_ROOT||'../suite-recovery-online-safe'),panels=join(suite,'dist-workbench-dev/workbench-panels');
const protocol='full-suite-workbench/v1',session='permission-local-window',seenKey='obr-suite/workbench/player-permissions-seen';
async function pair(host:Page,role='GM'){
 await mockSource(host);
 await host.context().route('**/workbench-panels/*',async route=>{const file=join(panels,basename(new URL(route.request().url()).pathname));await route.fulfill({body:readFileSync(file),contentType:file.endsWith('.html')?'text/html':'text/javascript'});});
 await host.context().route('**/suite-dev/owner-step*.png',route=>route.fulfill({body:readFileSync(join(suite,'public',basename(new URL(route.request().url()).pathname))),contentType:'image/png'}));
 await host.route('**/permission-host',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic permission host</title>'}));await host.goto('/permission-host');
 await host.evaluate(({protocol,session,role,seenKey})=>{const fixture=(window as any).permissionHost={role,seen:false,requests:[] as any[]};window.addEventListener('message',event=>{const m=event.data;if(m?.protocol!==protocol||m.session!==session)return;fixture.requests.push(m);const send=(data:any)=>(event.source as Window).postMessage({protocol,session,hostStarted:1,...data},location.origin);if(m.type==='hello'||m.type==='ping'){send({type:m.type==='hello'?'ready':'pong'});return;}if(m.type==='console'&&m.statusOnly){send({type:'ack',requestId:m.requestId,ok:true,result:{seen:fixture.seen}});return;}if(m.type==='panelRpc'){if(m.method==='permissions.acknowledge')fixture.seen=true;const result=m.method==='init'?{roomId:'permission-room',playerId:'test-gm',preferences:{}}:m.method==='player.getRole'?fixture.role:{};send({type:'ack',requestId:m.requestId,ok:true,result});}});},{protocol,session,role,seenKey});
 const waiting=host.context().waitForEvent('page');await host.evaluate(session=>{(window as any).viewer=window.open('/#suite='+session+'&bridge='+encodeURIComponent(location.origin),'permission-window');},session);const page=await waiting;await mockSource(page);await expect(page.locator('.app-shell')).toBeVisible();
 await host.evaluate(({protocol,session,role})=>{const emit=(type:string,rest:any={})=>(window as any).viewer.postMessage({protocol,session,type,hostStarted:1,...rest},location.origin);emit('ready');emit('catalog',{sequence:1,cards:[],monsters:[],role,enabled:{characterCards:true,musicBoard:true},visibility:{wiki:true,monsters:true}});},{protocol,session,role});
 return page;
}
test.beforeAll(()=>{if(!existsSync(join(panels,'permissions.html')))throw Error('Missing paired permissions.html. Set SUITE_ROOT to the reviewed Suite source and build WORKBENCH_PANEL_ONLY=permissions; this regression must not silently skip.');});
for(const width of [1440,390])test(`GM permission guide stays inside ${width}px detached window and requires explicit read acknowledgment`,async({page:host},info)=>{
 const page=await pair(host),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize({width,height:844});
 const entry=page.getByRole('button',{name:'关于玩家分配卡和权限',exact:true}),dialog=page.getByRole('dialog',{name:'关于玩家分配卡和权限',exact:true}),frame=page.frameLocator('.player-permission-dialog iframe');
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
