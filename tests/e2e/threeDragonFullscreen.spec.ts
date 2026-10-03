import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter} from '../../src/core/model';
import {exportOwlbear} from '../../src/core/export';
import {evaluate} from '../../src/core/engine';
const protocol='full-suite-workbench/v1',session='dragon-fullscreen';
async function pair(host:Page){
 await mockSource(host);
 await host.context().route('**/workbench-panels/table.html?*',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#281b14;color:white}button{padding:10px}</style><button id="close">返回工作区</button><button id="cancel-first">先取消牌面操作</button><div>原创五人牌桌夹具，仅用于宿主窗口布局测试</div><script>
 const channel='workbench-panel-frame/v1';document.querySelector('#close').onclick=()=>parent.postMessage({channel,id:'close-table',method:'broadcast.sendMessage',args:['com.fullpeople/three-dragon-ante/server-window-v1',{command:{type:'close'}},{destination:'LOCAL'}]},location.origin);document.querySelector('#cancel-first').onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();document.querySelector('#cancel-first').textContent='牌面操作已取消';}};
 </script>`}));
 await host.route('**/dragon-host',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Three Dragon workspace host</title>'}));await host.goto('/dragon-host');
 await host.evaluate(({protocol,session})=>{(window as any).requests=[];window.addEventListener('message',event=>{const m=event.data;if(m?.protocol!==protocol||m.session!==session)return;(window as any).requests.push(m);if(m.type==='hello'||m.type==='ping')(event.source as Window).postMessage({protocol,session,type:m.type==='hello'?'ready':'pong',hostStarted:1},location.origin);if(m.type==='panelRpc')(event.source as Window).postMessage({protocol,session,type:'ack',requestId:m.requestId,ok:true,result:{}},location.origin);});},{protocol,session});
 const waiting=host.context().waitForEvent('page');await host.evaluate(session=>{(window as any).viewer=window.open('/#suite='+session+'&bridge='+encodeURIComponent(location.origin),'dragon-fullscreen');},session);const page=await waiting;await mockSource(page);await expect(page.locator('.app-shell')).toBeVisible();
 const c=newCharacter();c.name='三龙全屏恢复验收';c.baseHp=20;c.runtime.hp=17;
 const state={key:'room:card:hero',cardId:'hero',itemId:'token-hero',name:c.name,kind:'character',role:'GM',write:true,locked:false,pinned:false,documentRevision:1,stats:{health:17,'max health':20,'armor class':10},resources:[],conditions:[]};
 await host.evaluate(({protocol,session,state,document})=>{const emit=(type:string,rest:any={})=>(window as any).viewer.postMessage({protocol,session,type,hostStarted:1,...rest},location.origin);emit('ready');emit('catalog',{sequence:1,cards:[{...state,id:'hero',inScene:true}],monsters:[],role:'GM',enabled:{characterCards:true,threeDragonAnte:true},visibility:{wiki:true,monsters:true}});emit('selection',{sequence:2,state,document});emit('navigate');},{protocol,session,state,document:{...exportOwlbear(c,evaluate(c)),dnd_card_web:c,_suiteRevision:1}});
 await expect(page.getByLabel('当前生命值',{exact:true})).toHaveValue('17');return page;
}
for(const width of [1440,390])test(`Three Dragon covers ${width}px Suite viewport and restores workspace on close/Escape`,async({page:host},info)=>{
 const page=await pair(host),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.locator('.category-search-control input').fill('保留的查询');
 await page.setViewportSize({width,height:width===390?844:960});
 // Preserve the card tab and an existing Wiki query; opening never selects Wiki.
 await page.getByRole('tab',{name:'法术',exact:true}).click();
 const launcher=page.locator('.header-tools').getByRole('button',{name:'三龙牌',exact:true}),openedInstances:string[]=[];
 const rememberInstance=async()=>{const src=await page.locator('.three-dragon-fullscreen iframe').getAttribute('src');expect(src).toBeTruthy();const instance=new URL(src!).searchParams.get('instance');expect(instance).toBeTruthy();openedInstances.push(instance!);};
 for(const how of ['button','escape','repeat']){
  await launcher.click();const fullscreen=page.getByRole('region',{name:'三龙牌全屏工作区'});await expect(fullscreen).toBeVisible();await rememberInstance();
  const dimensions=await fullscreen.evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,parent:el.parentElement?.tagName,fullscreen:!!document.fullscreenElement};});
  expect(dimensions).toEqual({x:0,y:0,width,height:width===390?844:960,parent:'BODY',fullscreen:false});
  expect(await page.locator('.app-shell').evaluate((el:HTMLElement)=>el.inert)).toBe(true);
  await expect(page.locator('.wiki-pane iframe')).toHaveCount(0);
  const frame=page.frameLocator('.three-dragon-fullscreen iframe');await expect(frame.locator('#close')).toBeVisible();
  if(how==='button')await frame.locator('#close').click();
  else if(how==='escape'){
   await frame.locator('#cancel-first').focus();await page.keyboard.press('Escape');await expect(fullscreen).toBeVisible();await expect(frame.locator('#cancel-first')).toHaveText('牌面操作已取消');
   await frame.locator('#close').focus();await page.keyboard.press('Escape');
  }else await frame.locator('#close').evaluate((button:HTMLButtonElement)=>{button.click();button.click();});
  await expect(fullscreen).toHaveCount(0);await expect(launcher).toBeFocused();expect(await page.locator('.app-shell').evaluate((el:HTMLElement)=>el.inert)).toBe(false);
  await expect(page.getByRole('tab',{name:'法术',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.locator('.app-shell')).toHaveAttribute('data-workbench-page','sheet');
  await expect(page.locator('.category-search-control input')).toHaveValue('保留的查询');
 }
 await launcher.click();await rememberInstance();await page.screenshot({path:info.outputPath(`three-dragon-fullscreen-${width}.png`)});await page.frameLocator('.three-dragon-fullscreen iframe').locator('#close').click();
 // The iframe click posts to the parent; React then unmounts the panel and its
 // cleanup posts Dispose to the host. Wait for both real boundaries rather than
 // sampling the host in the interval between those asynchronous messages.
 await expect(page.getByRole('region',{name:'三龙牌全屏工作区'})).toHaveCount(0);
 await expect(launcher).toBeFocused();expect(await page.locator('.app-shell').evaluate((el:HTMLElement)=>el.inert)).toBe(false);
 await expect.poll(()=>host.evaluate(()=>(window as any).requests.filter((r:any)=>r.type==='panelRpc'&&r.panel==='table'&&r.method==='dispose').map((r:any)=>r.instance))).toHaveLength(4);
 const requests=await host.evaluate(()=>(window as any).requests),disposes=requests.filter((r:any)=>r.type==='panelRpc'&&r.panel==='table'&&r.method==='dispose');
 expect(openedInstances).toHaveLength(4);expect(new Set(openedInstances).size).toBe(4);
 expect(disposes).toHaveLength(4);expect(disposes.map((r:any)=>r.instance).sort()).toEqual([...openedInstances].sort());
 await info.attach('fullscreen-instance-disposals',{body:JSON.stringify({openedInstances,disposes},null,2),contentType:'application/json'});
 expect(requests.filter((r:any)=>['stats','createCard','delete','save'].includes(r.type))).toHaveLength(0);expect(errors).toEqual([]);
});
