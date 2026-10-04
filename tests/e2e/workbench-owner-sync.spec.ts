import {test,expect,type Page} from '@playwright/test';
import {newCharacter} from '../../src/core/model';
import {evaluate} from '../../src/core/engine';
import {exportOwlbear} from '../../src/core/export';
import {mockSource} from './fixtures';
const protocol='full-suite-workbench/v1',session='owner-sync';
const access=(epoch=1,write=true,ids=['a','b'])=>({room:'room',scope:'room:scene',epoch,role:'PLAYER',cards:ids.map(id=>({id,itemId:'token-'+id,write,locked:false})),monsters:[],enabled:{characterCards:true}});
function snapshot(id='a',revision=1,name='Owner fixture '+id){const character=newCharacter();character.name=name;character.baseHp=20;character.runtime.hp=11;return {state:{key:'room:card:'+id,cardId:id,itemId:'token-'+id,name,kind:'character',role:'PLAYER',write:true,locked:false,pinned:false,documentRevision:revision,stats:{health:11,'max health':20,'temporary health':0,'armor class':10},resources:[],conditions:[]},document:{...exportOwlbear(character,evaluate(character)),dnd_card_web:character,_suiteRevision:revision}};}
async function send(host:Page,type:string,extra:any={}){await host.evaluate(({protocol,session,type,extra})=>(window as any).viewer.postMessage({protocol,session,type,hostStarted:1,...extra},location.origin),{protocol,session,type,extra});}
async function pair(host:Page){await mockSource(host);await host.route('**/owner-sync-host',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Authored owner-sync host</title>'}));await host.goto('/owner-sync-host');await host.evaluate(({protocol,session})=>{(window as any).requests=[];window.addEventListener('message',event=>{const m=event.data;if(m?.protocol!==protocol||m.session!==session)return;(window as any).requests.push(m);if(m.type==='hello'||m.type==='ping')(event.source as Window).postMessage({protocol,session,hostStarted:1,type:m.type==='hello'?'ready':'pong'},location.origin);});},{protocol,session});const opened=host.context().waitForEvent('page');await host.evaluate(session=>{(window as any).viewer=window.open('/#suite='+session+'&bridge='+encodeURIComponent(location.origin));},session);const page=await opened;await mockSource(page);await expect(page.locator('.app-shell')).toBeVisible();await send(host,'ready');await send(host,'catalog',{sequence:1,access:access(),cards:['a','b'].map(id=>({...snapshot(id).state,id,inScene:true})),monsters:[],role:'PLAYER',enabled:{characterCards:true},visibility:{wiki:true,monsters:false}});return page;}
const requests=(host:Page,type:string)=>host.evaluate(type=>(window as any).requests.filter((m:any)=>m.type===type),type);

test('cold player navigation renders its warm document without a selection reply or DM switch',async({page:host},info)=>{const page=await pair(host);await send(host,'navigate',{itemId:'card:a'});await expect(page.getByText('读取角色资料…',{exact:true})).toBeVisible();await send(host,'cacheSnapshot',{sequence:2,...snapshot(),access:access()});await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('11');await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();expect(await requests(host,'select')).toEqual([]);expect(await requests(host,'save')).toEqual([]);await info.attach('cold-player-warm-document',{body:await page.screenshot(),contentType:'image/png'});});

test('revocation disables the full paper immediately and a debounce cannot survive regrant or late ACK',async({page:host},info)=>{const page=await pair(host);await send(host,'navigate',{itemId:'card:a'});await send(host,'selection',{sequence:2,...snapshot(),access:access()});await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await expect(page.getByLabel('角色姓名',{exact:true})).toBeEditable();// Pause at the browser's existing time, with a guaranteed earlier install epoch.
 // The final time does not cross a heartbeat/disconnection deadline.
 const clockNow=await page.evaluate(()=>Date.now());await page.clock.install({time:clockNow-60_000});await page.clock.pauseAt(clockNow);await page.getByLabel('角色姓名',{exact:true}).fill('Discarded before revocation');await send(host,'access',{access:access(2,false)});await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeDisabled();// Read-only workbench names deliberately render as buttons, not disabled inputs.
 await expect(page.getByLabel('角色姓名',{exact:true})).toHaveCount(0);await expect(page.locator('.identity-name .assign-token-name')).toHaveText('Discarded before revocation');await expect(page.getByLabel('玩家姓名',{exact:true})).not.toBeEditable();await expect(page.getByLabel('力量基础值',{exact:true})).not.toBeEditable();await send(host,'access',{access:access(3,true)});await page.clock.runFor(150);expect(await requests(host,'save')).toEqual([]);await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeEnabled();await expect(page.getByLabel('角色姓名',{exact:true})).toBeEditable();
 await send(host,'access',{access:access(4,false)});await send(host,'ack',{requestId:'late-previous-owner',ok:true,result:{snapshot:{sequence:50,...snapshot('a',2,'Late owner view'),access:access()}}});await page.clock.runFor(100);await expect(page.getByRole('switch',{name:'编辑模式',exact:true})).toBeDisabled();const rejected=await page.evaluate(async()=>{const modulePath='/src/platform/workbench.ts',api=await import(/* @vite-ignore */ modulePath);try{await api.workbenchRequest('save',{native:{name:'Denied direct write'}});return false;}catch{return true;}});expect(rejected).toBe(true);expect(await requests(host,'save')).toEqual([]);await info.attach('revoked-player-read-only',{body:await page.screenshot(),contentType:'image/png'});
});

test('only the latest cold navigation can be fulfilled and revocation removes a waiting target',async({page:host})=>{const page=await pair(host);await send(host,'navigate',{itemId:'card:a'});await page.getByRole('tab',{name:'Owner fixture b',exact:true}).click();await send(host,'cacheSnapshot',{sequence:2,...snapshot(),access:access()});await expect(page.locator('.paper')).toHaveCount(0);await send(host,'cacheSnapshot',{sequence:3,...snapshot('b'),access:access()});await expect(page.locator('.identity-name .assign-token-name')).toHaveText('Owner fixture b');await send(host,'access',{access:access(2,true,['b'])});await send(host,'navigate',{itemId:'card:a'});await send(host,'access',{access:access(3,true,['b'])});await send(host,'cacheSnapshot',{sequence:4,...snapshot(),access:access()});await expect(page.locator('.paper')).toHaveCount(0);await expect(page.getByText('读取角色资料…',{exact:true})).toHaveCount(0);});

async function regrant(host:Page,epoch=3){
 await send(host,'catalog',{sequence:10,access:access(epoch),cards:['a','b'].map(id=>({...snapshot(id,5).state,id,inScene:true})),monsters:[],role:'PLAYER',enabled:{characterCards:true},visibility:{wiki:true,monsters:false}});
 await send(host,'navigate',{itemId:'card:a'});
}

// Real App + transport transitions. The unit tests inspect the released cache
// roots; these cases prove their absence does not regress the visible workflow.
test('read revocation removes the paper and regrant waits for a current body',async({page:host},info)=>{
 const page=await pair(host);
 await send(host,'navigate',{itemId:'card:a'});
 await send(host,'selection',{sequence:2,...snapshot('a',5,'Authorized body'),access:access()});
 await expect(page.locator('.identity-name .assign-token-name')).toHaveText('Authorized body');
 await send(host,'access',{access:access(2,true,['b'])});
 await expect(page.locator('.paper')).toHaveCount(0);
 await expect(page.getByText('Authorized body',{exact:true})).toHaveCount(0);
 await regrant(host);
 await send(host,'cacheSnapshot',{sequence:11,...snapshot('a',4,'Retired older body'),access:access(3)});
 await expect(page.getByText('读取角色资料…',{exact:true})).toBeVisible();
 await expect(page.locator('.paper')).toHaveCount(0);
 await expect.poll(()=>page.evaluate(async()=>{const modulePath='/src/platform/workbench.ts';return (await import(/* @vite-ignore */ modulePath)).getWorkbench().document===undefined;})).toBe(true);
 await send(host,'cacheSnapshot',{sequence:12,...snapshot('a',5,'Reauthorized current body'),access:access(3)});
 await expect(page.locator('.identity-name .assign-token-name')).toHaveText('Reauthorized current body');
 await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('11');
 expect(await requests(host,'save')).toEqual([]);
 await info.attach('read-regrant-current-body',{body:await page.screenshot(),contentType:'image/png'});
});

test('read revocation keeps an in-flight App draft recoverable without replay or stale ACK overwrite',async({page:host},info)=>{
 const page=await pair(host);
 await send(host,'navigate',{itemId:'card:a'});
 await send(host,'selection',{sequence:2,...snapshot('a',5),access:access()});
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 await expect(page.getByLabel('角色姓名',{exact:true})).toBeEditable();
 const clockNow=await page.evaluate(()=>Date.now());
 await page.clock.install({time:clockNow-60_000});await page.clock.pauseAt(clockNow);
 await page.getByLabel('角色姓名',{exact:true}).fill('Recoverable in-flight draft');
 await page.clock.runFor(100);
 await expect.poll(async()=>(await requests(host,'save')).length).toBe(1);
 const pending=(await requests(host,'save'))[0];
 await send(host,'access',{access:access(2,true,['b'])});
 await page.clock.runFor(20);
 await expect(page.locator('.paper')).toHaveCount(0);
 await expect(page.getByText('Recoverable in-flight draft',{exact:true})).toHaveCount(0);
 await regrant(host);
 await send(host,'cacheSnapshot',{sequence:11,...snapshot('a',5),access:access(3)});
 await expect(page.getByLabel('角色姓名',{exact:true})).toHaveValue('Recoverable in-flight draft');
 // Compact chrome deliberately hides the legacy save-status footer. Keep its
 // uncertainty assertion and exercise the current visible recovery entry.
 await expect(page.locator('.save-status')).toContainText('待核对 · 本地修改已保留');
 await expect(page.getByRole('button',{name:'同步核对',exact:true})).toBeVisible();
 await send(host,'ack',{requestId:pending.requestId,ok:true,result:{snapshot:{sequence:50,...snapshot('a',6,'Unrelated late owner body'),access:access()}}});
 await page.clock.runFor(150);
 await expect(page.getByLabel('角色姓名',{exact:true})).toHaveValue('Recoverable in-flight draft');
 expect((await requests(host,'save')).length).toBe(1);
 await expect.poll(()=>page.evaluate(async()=>{const modulePath='/src/platform/workbench.ts';return (await import(/* @vite-ignore */ modulePath)).workbenchDiagnostics().pending.length;})).toBe(0);
 await page.getByRole('button',{name:'同步核对',exact:true}).click();
 await expect(page.getByText('上一项修改尚未得到确认。本地修改已备份，核对期间不会重放未确认的操作。',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'导出本地修改',exact:true})).toBeVisible();
 await info.attach('read-regrant-quarantined-draft',{body:await page.screenshot(),contentType:'image/png'});
});

test('a retired retry body ends loading visibly and a later current retry succeeds',async({page:host},info)=>{
 const page=await pair(host);
 await send(host,'navigate',{itemId:'card:a'});
 await send(host,'selection',{sequence:2,...snapshot('a',5),access:access()});
 await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('11');
 await send(host,'access',{access:access(2,true,['b'])});
 await regrant(host);
 await send(host,'selectionError',{sequence:11,access:access(3),targetId:'card:a',status:404,message:'Synthetic current body unavailable'});
 const retry=page.getByRole('button',{name:'重试读取这张卡',exact:true});
 await retry.click();
 await expect.poll(async()=>(await requests(host,'refreshCard')).length).toBe(1);
 const first=(await requests(host,'refreshCard'))[0];
 await send(host,'ack',{requestId:first.requestId,ok:true,result:{snapshot:{sequence:12,...snapshot('a',4,'Stale retry body'),access:access(3)}}});
 await expect(retry).toBeEnabled();
 await expect(page.getByRole('heading',{name:'这张角色卡暂时无法读取'})).toBeVisible();
 await expect(page.locator('.paper')).toHaveCount(0);
 await retry.click();
 await expect.poll(async()=>(await requests(host,'refreshCard')).length).toBe(2);
 const second=(await requests(host,'refreshCard'))[1];
 await send(host,'ack',{requestId:second.requestId,ok:true,result:{snapshot:{sequence:13,...snapshot('a',5,'Recovered current body'),access:access(3)}}});
 await expect(page.locator('.identity-name .assign-token-name')).toHaveText('Recovered current body');
 await expect(page.getByRole('heading',{name:'这张角色卡暂时无法读取'})).toHaveCount(0);
 expect(await requests(host,'save')).toEqual([]);
 await info.attach('read-regrant-retry-restored',{body:await page.screenshot(),contentType:'image/png'});
});
