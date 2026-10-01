import {test,expect,type Page} from '@playwright/test';
import {newCharacter,type Entry} from '../../src/core/model';
import {exportOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';
import {mockSource} from './fixtures';
const protocol='full-suite-workbench/v1',session='instant217';
const auth=(epoch=1,ids=['a','b'])=>({room:'room',scope:'room:scene',epoch,role:'GM',enabled:{characterCards:true},cards:ids.map(id=>({id,itemId:'token-'+id,write:true,locked:false})),monsters:[]});
function snapshot(id:string,revision=1,hp=id==='a'?11:22){
 const c=newCharacter();c.name='缓存验收 '+id;c.baseHp=40;c.runtime.hp=hp;
 for(let i=0;i<85;i++){const e:Entry={id:'fixture:'+id+':'+i,kind:'feature',name:`原创负载 ${i}`,english:`Fixture ${i}`,source:'IMPORTED',edition:'both',packId:'imported',revision:'1',raw:{},entries:['原创缓存验收正文。'.repeat(12)]};c.selections.push({id:e.id,entry:e,quantity:1,level:1,equipped:false});}
 return {state:{key:'room:card:'+id,cardId:id,itemId:'token-'+id,name:c.name,kind:'character',role:'GM',write:true,locked:false,pinned:false,documentRevision:revision,stats:{health:hp,'max health':40,'temporary health':0,'armor class':10},resources:[],conditions:[]},document:{...exportOwlbear(c,evaluate(c)),dnd_card_web:c,_suiteRevision:revision}};
}
async function send(host:Page,type:string,payload:any={}){await host.evaluate(({protocol,session,type,payload})=>(window as any).viewer.postMessage({protocol,session,type,hostStarted:217,...payload},location.origin),{protocol,session,type,payload});}
async function pair(host:Page){
 await mockSource(host);await host.route('**/instant-host217',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic delayed host</title>'}));await host.goto('/instant-host217');
 await host.evaluate(({protocol,session})=>{(window as any).requests=[];window.addEventListener('message',e=>{const m=e.data;if(m?.protocol!==protocol||m.session!==session)return;(window as any).requests.push({...m,at:performance.now()});if(m.type==='hello'||m.type==='ping')(e.source as Window).postMessage({protocol,session,type:m.type==='hello'?'ready':'pong',hostStarted:217},location.origin);});},{protocol,session});
 const waiting=host.context().waitForEvent('page');await host.evaluate(session=>{(window as any).viewer=window.open('/#suite='+session+'&bridge='+encodeURIComponent(location.origin)+'&measureSwitch=1','instant217');},session);const page=await waiting;await mockSource(page);await expect(page.locator('.app-shell')).toBeVisible();
 const a=snapshot('a'),b=snapshot('b');await send(host,'ready');await send(host,'catalog',{sequence:1,access:auth(),cards:[a,b].map(s=>({...s.state,id:s.state.cardId,inScene:true})),monsters:[],role:'GM',enabled:{characterCards:true},visibility:{wiki:true,monsters:true}});
 await send(host,'selection',{sequence:2,...a,access:auth()});await send(host,'cacheSnapshot',{sequence:3,...b,access:auth()});await send(host,'navigate');await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('11');return page;
}
test('full paper switches cached heavy cards before any select response, then applies push updates and access revocation',async({page:host},info)=>{
 const page=await pair(host);const profiler=await page.context().newCDPSession(page);await profiler.send('Profiler.enable');await profiler.send('Profiler.start');const samples:number[]=[];await page.evaluate(()=>{(window as any).switchStages=[];window.addEventListener('workbench-switch-metric',e=>(window as any).switchStages.push((e as CustomEvent).detail));});
 for(let i=0;i<10;i++){
  const id=i%2?'a':'b',name='缓存验收 '+id;
  await page.evaluate(name=>{const w=window as any;w.paperSample=undefined;let started=0;const read=()=>document.querySelector('.identity-name .assign-token-name')?.textContent===name;if(read())throw Error('Fixture must switch identities');const observer=new MutationObserver(()=>{if(started&&read()){observer.disconnect();requestAnimationFrame(()=>{w.paperSample=performance.now()-started;});}});observer.observe(document.body,{childList:true,subtree:true,characterData:true});document.addEventListener('click',()=>{started=performance.now();},{capture:true,once:true});},name);
  await page.getByRole('tab',{name,exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).paperSample),{timeout:900}).not.toBeUndefined();samples.push(await page.evaluate(()=>(window as any).paperSample));
  await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue(id==='a'?'11':'22');
 }
 const profile=await profiler.send('Profiler.stop');await info.attach('switch-cpu-profile',{body:JSON.stringify(profile.profile),contentType:'application/json'});
 // The host has deliberately provided zero select replies. A network-bound
 // implementation cannot satisfy even the first paper assertion above.
 const requests=await host.evaluate(()=>(window as any).requests);expect(requests.filter((m:any)=>m.type==='select')).toHaveLength(10);expect(requests.some((m:any)=>['save','stats','inventory'].includes(m.type))).toBe(false);
 expect(Math.max(...samples)).toBeLessThan(500);await info.attach('click-to-next-animation-frame-ms',{body:JSON.stringify({samples,hostSelectReplies:0,stages:await page.evaluate(()=>(window as any).switchStages)}),contentType:'application/json'});
 await send(host,'cacheSnapshot',{sequence:30,...snapshot('a',2,31),access:auth()});await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('31');
 // A background revision must also be ready before the user visits that card.
 const afterPush:number[]=[];
 await send(host,'cacheSnapshot',{sequence:31,...snapshot('b',2,42),access:auth()});
 await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('31');
 for(let i=0;i<6;i++){
  const id=i%2?'a':'b',name='缓存验收 '+id;
  await page.evaluate(name=>{const w=window as any;w.paperSample=undefined;let started=0;const observer=new MutationObserver(()=>{if(started&&document.querySelector('.identity-name .assign-token-name')?.textContent===name){observer.disconnect();requestAnimationFrame(()=>{w.paperSample=performance.now()-started;});}});observer.observe(document.body,{childList:true,subtree:true,characterData:true});document.addEventListener('click',()=>{started=performance.now();},{capture:true,once:true});},name);
  await page.getByRole('tab',{name,exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).paperSample),{timeout:900}).not.toBeUndefined();afterPush.push(await page.evaluate(()=>(window as any).paperSample));
  await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue(id==='a'?'31':'42');
 }
 expect(Math.max(...afterPush)).toBeLessThan(500);await info.attach('background-update-click-to-next-frame-ms',{body:JSON.stringify({samples:afterPush,hostSelectReplies:0,stages:await page.evaluate(()=>(window as any).switchStages)}),contentType:'application/json'});
 await send(host,'showWiki',{entry:snapshot('a').document.dnd_card_web.selections[0].entry});await expect(page.locator('.entry-detail')).toContainText('原创负载 0');
 await page.locator('.entry-detail .detail-title').click({button:'right'});await expect(page.getByRole('menu',{name:'词条操作'})).toBeVisible();
 await send(host,'access',{access:auth(2,['b'])});await expect(page.getByRole('menu',{name:'词条操作'})).toHaveCount(0);expect(await host.evaluate(()=>(window as any).requests.filter((m:any)=>m.type==='showEntry'))).toEqual([]);await expect(page.locator('.entry-detail')).toHaveCount(0);await expect(page.getByRole('tab',{name:'缓存验收 a',exact:true})).toHaveCount(0);await expect(page.locator('.paper')).toHaveCount(0);
 await send(host,'cacheSnapshot',{sequence:40,...snapshot('a',3,39),access:auth()});await expect(page.getByRole('tab',{name:'缓存验收 a',exact:true})).toHaveCount(0);
 await page.getByRole('tab',{name:'缓存验收 b',exact:true}).click();await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('42');
});
test('strict library drops revoked hover and history snapshots while preserving public entries',async({page})=>{
 await page.route('**/library-permission217',r=>r.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/tests/e2e/harness/cache-harness217.ts');</script>`}));await page.goto('/library-permission217');await page.waitForFunction(()=>!!(window as any).harness,undefined,{timeout:10000});
 await page.evaluate(()=>{const h=(window as any).harness;h.library.navigate(h.privateEntry);h.library.preview({entry:h.privateEntry});});await expect(page.locator('#detail')).toHaveText('Private');
 await page.evaluate(()=>(window as any).harness.revoke());await expect(page.locator('#detail')).toHaveText('empty');
 await page.evaluate(()=>{const h=(window as any).harness;h.library.navigate(h.shared);});await expect(page.locator('#detail')).toHaveText('Public');
 await page.evaluate(()=>(window as any).harness.library.back());await expect(page.locator('#detail')).toHaveText('empty');
 await page.evaluate(()=>{const h=(window as any).harness;h.library.preview({entry:h.shared});});await expect(page.locator('#detail')).toHaveText('Public');
});



test('inactive adaptive gravity performs no geometry work and editing restores only its own styles',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{const counters={observers:0,geometry:0};(window as any).gravityCounts=counters;const Native=window.ResizeObserver;window.ResizeObserver=class extends Native{constructor(callback:ResizeObserverCallback){super(callback);counters.observers++;}};for(const key of ['offsetWidth','offsetHeight','offsetTop','offsetLeft']){const descriptor=Object.getOwnPropertyDescriptor(HTMLElement.prototype,key)!;Object.defineProperty(HTMLElement.prototype,key,{...descriptor,get(){if((this as HTMLElement).closest('#gravity-root'))counters.geometry++;return descriptor.get!.call(this);}});}});
 await page.route('**/gravity-permission217?*',r=>r.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/tests/e2e/harness/cache-harness217.ts');</script>`}));await page.goto('/gravity-permission217?gravity=1');await page.waitForFunction(()=>!!(window as any).harness,undefined,{timeout:10000});
 await page.evaluate(()=>(window as any).harness.set({identity:'b',extra:1}));await expect(page.locator('[data-adaptive-physical]')).toHaveCount(4);expect(await page.evaluate(()=>(window as any).gravityCounts)).toEqual({observers:0,geometry:0});
 await page.evaluate(()=>(window as any).harness.set({enabled:true}));await expect(page.locator('[data-adaptive-fallen]')).toHaveCount(4);expect((await page.evaluate(()=>(window as any).gravityCounts)).geometry).toBeGreaterThan(0);
 await page.evaluate(()=>(window as any).harness.set({editing:true}));await expect(page.locator('[data-adaptive-fallen]')).toHaveCount(0);await expect.poll(()=>page.locator('[data-adaptive-physical]').first().evaluate((el:HTMLElement)=>el.style.transition)).toBe('opacity 1s');await expect(page.locator('[data-adaptive-physical]').first()).toHaveCSS('filter','blur(0px)');
 const before=await page.evaluate(()=>(window as any).gravityCounts.geometry);await page.evaluate(()=>(window as any).harness.set({identity:'c',extra:0}));await expect(page.locator('[data-adaptive-physical]')).toHaveCount(3);expect(await page.evaluate(()=>(window as any).gravityCounts.geometry)).toBe(before);
 await page.evaluate(()=>(window as any).harness.set({editing:false}));await expect(page.locator('[data-adaptive-fallen]')).toHaveCount(3);
 await page.evaluate(()=>(window as any).harness.set({enabled:false}));await expect(page.locator('[data-adaptive-fallen]')).toHaveCount(0);await expect.poll(()=>page.locator('[data-adaptive-physical]').first().evaluate((el:HTMLElement)=>el.style.translate)).toBe('');
});


test('fixed private tooltips disappear on revocation while public tooltips remain readable',async({page})=>{
 await page.route('**/preview-permission217?*',r=>r.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/tests/e2e/harness/cache-harness217.ts');</script>`}));await page.goto('/preview-permission217?preview=1');
 for(const name of ['Private','Public']){await page.getByRole('button',{name,exact:true}).hover();await expect(page.getByRole('tooltip').filter({hasText:'Body '+name})).toBeVisible();await page.getByRole('button',{name,exact:true}).click({button:'right'});}
 await expect(page.locator('.keyword-preview.is-pinned')).toHaveCount(2);
 await page.evaluate(()=>(window as any).harness.revoke());await expect(page.getByRole('tooltip').filter({hasText:'Body Private'})).toHaveCount(0);await expect(page.locator('.keyword-preview.is-pinned')).toHaveCount(1);await expect(page.getByRole('tooltip')).toContainText('Body Public');
});


test('entry menus invalidate revoked or changed scopes and share only the current readable identity',async({page:host})=>{
 await host.route('**/menu-host217',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Menu test host</title>'}));await host.goto('/menu-host217');
 await host.evaluate(()=>{(window as any).requests=[];window.addEventListener('message',e=>{const m=e.data;if(m?.protocol!=='full-suite-workbench/v1'||m.session!=='menu217')return;(window as any).requests.push(m);if(m.type==='hello'||m.type==='ping')(e.source as Window).postMessage({protocol:m.protocol,session:m.session,type:m.type==='hello'?'ready':'pong',hostStarted:217},location.origin);});});
 await host.context().route('**/menu-permission217',r=>r.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/tests/e2e/harness/entry-menu217.tsx');</script>`}));
 const waiting=host.context().waitForEvent('page');await host.evaluate(()=>{(window as any).viewer=window.open('/menu-permission217#suite=menu217&bridge='+encodeURIComponent(location.origin),'menu217');});const page=await waiting;await page.waitForFunction(()=>!!(window as any).harness);
 await page.getByRole('button',{name:'Private anchor',exact:true}).click({button:'right'});await expect(page.getByRole('menu')).toBeVisible();
 await page.evaluate(()=>(window as any).harness.revoke());await expect(page.getByRole('menu')).toHaveCount(0);
 await page.getByRole('menuitem',{name:'向全员展示',exact:true}).click();expect(await host.evaluate(()=>(window as any).requests.filter((m:any)=>m.type==='showEntry'))).toEqual([]);
 await page.evaluate(()=>(window as any).harness.restore());await page.getByRole('button',{name:'Private anchor',exact:true}).click({button:'right'});await page.evaluate(()=>(window as any).harness.update());
 await page.getByRole('menu').getByRole('menuitem',{name:'向全员展示',exact:true}).click();await expect.poll(()=>host.evaluate(()=>(window as any).requests.filter((m:any)=>m.type==='showEntry').length)).toBe(1);expect(await host.evaluate(()=>(window as any).requests.find((m:any)=>m.type==='showEntry').entry.entries)).toEqual(['new private body']);
 for(const action of ['scope','readonly','editing','character']){await page.getByRole('button',{name:'Public anchor',exact:true}).click({button:'right'});await expect(page.getByRole('menu')).toBeVisible();await page.evaluate(action=>(window as any).harness[action](),action);await expect(page.getByRole('menu')).toHaveCount(0);}
 await page.getByRole('button',{name:'Public anchor',exact:true}).click({button:'right'});await page.getByRole('menu').getByRole('menuitem',{name:'移除自定义条目',exact:true}).click();expect(await page.evaluate(()=>(window as any).actions.at(-1))).toMatchObject({kind:'removeCustom',entry:{id:'Public',entries:['public body']}});
});


test('current owned unresolved training is removable but its menu vanishes with card access',async({page:host})=>{
 const page=await pair(host),a=snapshot('a',2);a.document.dnd_card_web.training={weapons:'未入库训练217'};
 await send(host,'selection',{sequence:5,...a,access:auth()});await expect(page.locator('.training-row').filter({hasText:'武器'})).toContainText('未入库训练217');
 if(await page.getByRole('switch',{name:'编辑模式'}).getAttribute('aria-checked')!=='true')await page.getByRole('switch',{name:'编辑模式'}).click();
 await page.getByRole('button',{name:'未入库训练217',exact:true}).click({button:'right'});await expect(page.getByRole('menuitem',{name:'移除',exact:true})).toBeEnabled();
 await send(host,'access',{access:auth(2,['b'])});await expect(page.getByRole('menu',{name:'词条操作'})).toHaveCount(0);await expect(page.getByRole('button',{name:'未入库训练217',exact:true})).toHaveCount(0);
 expect(await host.evaluate(()=>(window as any).requests.filter((m:any)=>['showEntry','save'].includes(m.type)))).toEqual([]);
});
