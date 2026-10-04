import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter} from '../../src/core/model';
import {exportOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';
import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const protocol='full-suite-workbench/v1',session='dragon-website-link';
async function pair(host:Page){
 await mockSource(host);
 const settings=process.env.TDA_SUITE_SETTINGS_DIST?resolve(process.env.TDA_SUITE_SETTINGS_DIST):undefined;
 if(settings&&!existsSync(join(settings,'settings.html')))throw Error('TDA_SUITE_SETTINGS_DIST must contain the reviewed production settings bundle.');
 await host.context().route('**/workbench-panels/settings*',route=>{const url=new URL(route.request().url()),name=url.pathname.split('/').pop()!;
  if(settings){const file=join(settings,name);if(!existsSync(file))return route.abort();return route.fulfill({contentType:name.endsWith('.html')?'text/html':'text/javascript',body:readFileSync(file)});}
  // Standalone Web CI does not contain the Suite repository. Its narrow parent
  // contract uses an authored panel; the release config supplies actual bundles.
  const features=url.searchParams.get('section')==='features';return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><body data-bridge-ready="true"><h1>${features?'功能开关':'设置'}</h1><main id="content" aria-busy="false">${features?'<div class="feature-toggle-grid">原创功能面板夹具</div>':'原创设置面板夹具'}</main></body>`});
 });
 await host.route('**/dragon-host',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Three Dragon workspace host</title>'}));await host.goto('/dragon-host');
 await host.evaluate(({protocol,session})=>{const reads:Record<string,any>={'player.getRole':'GM','player.getId':'fixture-gm','player.getName':'Fixture host','player.getConnectionId':'fixture-connection','room.getMetadata':{},'scene.isReady':true,'scene.getMetadata':{},'party.getPlayers':[],'scene.items.getItems':[]};(window as any).requests=[];window.addEventListener('message',event=>{const m=event.data;if(m?.protocol!==protocol||m.session!==session)return;(window as any).requests.push(m);if(m.type==='hello'||m.type==='ping')(event.source as Window).postMessage({protocol,session,type:m.type==='hello'?'ready':'pong',hostStarted:1},location.origin);if(m.type==='panelRpc'){const result=m.method==='init'?{roomId:'fixture-room',playerId:'fixture-gm',role:'GM',preferences:{'obr-suite/lang':'zh'},reads}:reads[m.method]??{};(event.source as Window).postMessage({protocol,session,type:'ack',requestId:m.requestId,ok:true,result},location.origin);}});},{protocol,session});
 const waiting=host.context().waitForEvent('page');await host.evaluate(session=>{(window as any).viewer=window.open('/#suite='+session+'&bridge='+encodeURIComponent(location.origin),'dragon-website-link');},session);const page=await waiting;await mockSource(page);await expect(page.locator('.app-shell')).toBeVisible();
 const c=newCharacter();c.name='三龙网站链接验收';c.baseHp=20;c.runtime.hp=17;
 const state={key:'room:card:hero',cardId:'hero',itemId:'token-hero',name:c.name,kind:'character',role:'GM',write:true,locked:false,pinned:false,documentRevision:1,stats:{health:17,'max health':20,'armor class':10},resources:[],conditions:[]};
 await host.evaluate(({protocol,session,state,document})=>{const emit=(type:string,rest:any={})=>(window as any).viewer.postMessage({protocol,session,type,hostStarted:1,...rest},location.origin);emit('ready');const catalog={cards:[{...state,id:'hero',inScene:true}],monsters:[],role:'GM',enabled:{characterCards:true,threeDragonAnte:true},visibility:{wiki:true,monsters:true}};(window as any).dragonCatalog=catalog;emit('catalog',{sequence:1,...catalog});emit('selection',{sequence:2,state,document});emit('navigate');},{protocol,session,state,document:{...exportOwlbear(c,evaluate(c)),dnd_card_web:c,_suiteRevision:1}});
 await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('17');return page;
}
for(const width of [1440,390])test(`Three Dragon opens the website and preserves ${width}px Suite toolbar and workspace`,async({page:host},info)=>{
 const page=await pair(host),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 info.annotations.push({type:'settingsSource',description:process.env.TDA_SUITE_SETTINGS_DIST?'Reviewed real production Suite settings bundles':'Authored panel fixture for the isolated Web parent contract'});
 await page.locator('.category-search-control input').fill('保留的查询');await page.setViewportSize({width,height:width===390?844:960});
 await page.getByRole('tab',{name:'法术',exact:true}).click();const before=page.url();
 await page.context().route('https://obr.dnd.center/three-dragon-ante/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Website destination fixture</h1>'}));
 const launcher=page.locator('.header-tools').getByRole('link',{name:'三龙牌',exact:true});await expect(launcher).toHaveAttribute('target','_blank');
 const opened=page.context().waitForEvent('page');await launcher.click();const website=await opened;await website.waitForLoadState('domcontentloaded');expect(website.url()).toBe('https://obr.dnd.center/three-dragon-ante/');
 expect(page.url()).toBe(before);expect(await page.locator('.app-shell').evaluate((el:HTMLElement)=>el.inert)).toBe(false);
 await expect(page.locator('.three-dragon-fullscreen')).toHaveCount(0);await expect(page.locator('iframe[src*="table.html"]')).toHaveCount(0);
 await expect(page.getByRole('tab',{name:'法术',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.locator('.category-search-control input')).toHaveValue('保留的查询');
 const toolbar=page.locator('.header-tools');await expect(toolbar.getByRole('button',{name:'功能开关',exact:true})).toBeVisible();await expect(toolbar.getByRole('button',{name:'设置',exact:true})).toBeVisible();
 await website.close();await expect.poll(()=>website.isClosed()).toBe(true);
 const keyboardOpened=page.context().waitForEvent('page');await launcher.focus();await page.keyboard.press('Enter');const keyboardWebsite=await keyboardOpened;await keyboardWebsite.waitForLoadState('domcontentloaded');expect(keyboardWebsite.url()).toBe('https://obr.dnd.center/three-dragon-ante/');await keyboardWebsite.close();await expect.poll(()=>keyboardWebsite.isClosed()).toBe(true);
 expect(page.url()).toBe(before);await expect(page.getByRole('tab',{name:'法术',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.locator('.category-search-control input')).toHaveValue('保留的查询');await expect(toolbar.getByRole('button',{name:'功能开关',exact:true})).toBeEnabled();await expect(toolbar.getByRole('button',{name:'设置',exact:true})).toBeEnabled();await expect(page.locator('.three-dragon-fullscreen,iframe[src*="table.html"]')).toHaveCount(0);
 await toolbar.getByRole('button',{name:'功能开关',exact:true}).click();await expect(toolbar.getByRole('button',{name:'功能开关',exact:true})).toHaveAttribute('aria-pressed','true');
 let settings=page.frameLocator('iframe[title="Full Suite 功能开关"]');await expect(settings.locator('.feature-toggle-grid')).toBeVisible();await expect(settings.locator('body')).toHaveAttribute('data-bridge-ready','true');
 await toolbar.getByRole('button',{name:'设置',exact:true}).click();await expect(toolbar.getByRole('button',{name:'设置',exact:true})).toHaveAttribute('aria-pressed','true');
 settings=page.frameLocator('iframe[title="Full Suite 设置"]');await expect(settings.locator('body')).toHaveAttribute('data-bridge-ready','true');await expect(settings.locator('#content')).not.toHaveAttribute('aria-busy','true');
 await expect(page.getByText('程序文件加载失败',{exact:true})).toHaveCount(0);
 const setEnabled=async(enabled:boolean,sequence:number)=>host.evaluate(({enabled,sequence,protocol,session})=>{const catalog=(window as any).dragonCatalog;catalog.enabled.threeDragonAnte=enabled;(window as any).viewer.postMessage({protocol,session,type:'catalog',sequence,hostStarted:1,...catalog},location.origin);},{enabled,sequence,protocol,session});
 await setEnabled(false,10);await expect(launcher).toHaveCount(0);await expect(page.locator('.three-dragon-fullscreen,iframe[src*="table.html"]')).toHaveCount(0);await expect(toolbar.getByRole('button',{name:'设置',exact:true})).toBeEnabled();await expect(page.locator('.category-search-control input')).toHaveValue('保留的查询');expect(page.context().pages()).toHaveLength(2);
 await setEnabled(true,11);await expect(launcher).toBeVisible();await page.screenshot({path:info.outputPath(`three-dragon-website-link-${width}.png`)});
 const requests=await host.evaluate(()=>(window as any).requests);expect(requests.filter((r:any)=>r.type==='panelRpc'&&r.panel==='table')).toHaveLength(0);expect(requests.filter((r:any)=>['stats','createCard','delete','save'].includes(r.type))).toHaveLength(0);expect(errors).toEqual([]);
 await info.attach('website-link-scope',{body:JSON.stringify({website:website.url(),parentUnchanged:page.url()===before,tableRequests:0,scope:'Production App and real browser interaction; room and card identity use authored fixtures; destination URL interception validates navigation only.'},null,2),contentType:'application/json'});
});
