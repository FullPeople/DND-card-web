import {test,expect,type Page} from '@playwright/test';

const protocol='full-suite-workbench/v1',session='dice-frame230',channel='workbench-dice-frame/v1';
// This is a protocol probe, not a replacement implementation of Suite history
// or its token-result renderer. Replay actions are the existing 230 protocol.
const frameProbe=`<!doctype html><title>Dice frame protocol probe</title><output id="deliveries">[]</output><output id="snapshots">[]</output><output id="replies">[]</output><script>
const channel='workbench-dice-frame/v1',deliveries=[],snapshots=[],replies=[];
window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.channel!==channel)return;const m=e.data;if(m.event==='com.obr-suite/dice-roll'){deliveries.push(m.data.data);document.querySelector('#deliveries').textContent=JSON.stringify(deliveries);}if(m.event==='snapshot'){snapshots.push(m.data);document.querySelector('#snapshots').textContent=JSON.stringify(snapshots);}if(m.id){replies.push(m);document.querySelector('#replies').textContent=JSON.stringify(replies);}});
window.sendReplay=(cid,action,id)=>parent.postMessage({channel,id,method:'broadcast.sendMessage',args:['com.obr-suite/dice-replay',{cid,action},{destination:'LOCAL'}]},location.origin);
parent.postMessage({channel,ready:true},location.origin);
</script>`;

async function send(host:Page,type:string,payload:Record<string,unknown>={}){
 await host.evaluate(({protocol,session,type,payload})=>(window as any).viewer.postMessage({protocol,session,type,hostStarted:230,...payload},location.origin),{protocol,session,type,payload});
}
function target(key:string){return {key,itemId:'token-'+key,name:key,cardId:key,slug:'',kind:'character',stats:{},write:true,role:'GM',pinned:false};}
async function pair(host:Page){
 await host.context().route('**/workbench-dice/index.html?*',r=>r.fulfill({contentType:'text/html',body:frameProbe}));
 await host.context().route('**/dice-frame230',r=>r.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/tests/e2e/harness/dice-frame230.tsx');</script>`}));
 await host.route('**/dice-host230',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Read-only synthetic dice host</title>'}));await host.goto('/dice-host230');
 await host.evaluate(({protocol,session})=>{
  const w=window as any;w.requests=[];w.held=[];w.pause=false;w.holdInit=false;
  window.addEventListener('message',e=>{const m=e.data;if(m?.protocol!==protocol||m.session!==session)return;w.requests.push(m);const reply=(type:string,payload:any={})=>(e.source as Window).postMessage({protocol,session,type,hostStarted:230,...payload},location.origin);
   if(m.type==='hello'||m.type==='ping'){if(!w.pause)reply(m.type==='hello'?'ready':'pong');return;}
   if(m.type==='diceRpc'){const answer=()=>reply('ack',{requestId:m.requestId,ok:true,result:m.method==='init'?{roomId:'synthetic',reads:{'player.getRole':'GM','player.getSelection':[m.itemId]},target:m.key}:{forwarded:m.args}});if(w.holdInit&&m.method==='init')w.held.push({key:m.key,answer});else answer();}
  });
 },{protocol,session});
 const waiting=host.context().waitForEvent('page');await host.evaluate(session=>{(window as any).viewer=window.open('/dice-frame230#suite='+session+'&bridge='+encodeURIComponent(location.origin),'dice-frame230');},session);const page=await waiting;
 await expect(page.getByLabel('桥接连接')).toHaveText('online');
 await send(host,'catalog',{sequence:1,cards:[],monsters:[],role:'GM',enabled:{dice:true}});
 const frame=page.frameLocator('iframe[title="原版投骰面板"]');await expect(frame.locator('#deliveries')).toBeVisible();
 return {page,frame};
}

test('dice history bridge forwards same-id reveals and keeps single/group replay open-close intents intact',async({page:host})=>{
 const {page,frame}=await pair(host);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const roll={rollId:'solo230',ts:10,total:17,dice:[{type:'d20',value:17}],hidden:true,itemId:'token-a'};
 await send(host,'rolls',{rolls:[roll]});await expect(frame.locator('#deliveries')).toContainText('solo230');
 await send(host,'rolls',{rolls:[{...roll,hidden:false}]});await expect.poll(()=>frame.locator('#deliveries').evaluate(e=>JSON.parse(e.textContent||'[]').filter((r:any)=>r.rollId==='solo230'&&!r.hidden).length)).toBe(1);
 await send(host,'rolls',{rolls:[{...roll,hidden:false}]});await expect.poll(()=>frame.locator('#deliveries').evaluate(e=>JSON.parse(e.textContent||'[]').length)).toBe(2);
 const actions=[['solo230','open'],['solo230','close'],['group230','open'],['group230','close'],['solo230','open'],['group230','open'],['group230','close']];
 await frame.locator('body').evaluate((_,actions)=>{actions.forEach(([cid,action],i)=>(window as any).sendReplay(cid,action,'intent-'+i));},actions);
 await expect.poll(()=>host.evaluate(()=>(window as any).requests.filter((m:any)=>m.type==='diceRpc'&&m.method==='broadcast.sendMessage').length)).toBe(actions.length);
 const requests=await host.evaluate(()=>(window as any).requests.filter((m:any)=>m.type==='diceRpc'&&m.method==='broadcast.sendMessage'));
 expect(requests.map((m:any)=>m.args)).toEqual(actions.map(([cid,action])=>['com.obr-suite/dice-replay',{cid,action},{destination:'LOCAL'}]));
 await expect.poll(()=>frame.locator('#replies').evaluate(e=>JSON.parse(e.textContent||'[]').filter((r:any)=>r.id.startsWith('intent-')).length)).toBe(actions.length);
 // An unrelated sibling is not authorized to send an iframe RPC.
 await page.evaluate(channel=>window.postMessage({channel,id:'forged',method:'broadcast.sendMessage',args:[]},location.origin),channel);
 expect(await host.evaluate(()=>(window as any).requests.some((m:any)=>m.type==='diceRpc'&&m.args?.length===0&&m.method==='broadcast.sendMessage'))).toBe(false);
 await page.screenshot({path:test.info().outputPath('dice-frame-protocol.png')});expect(errors).toEqual([]);
});

test('dice snapshot bridge discards a delayed old target and refreshes after an offline recovery',async({page:host})=>{
 const {page,frame}=await pair(host);await host.evaluate(()=>{(window as any).holdInit=true;});
 await send(host,'selection',{sequence:2,state:target('a')});await expect.poll(()=>host.evaluate(()=>(window as any).held.filter((m:any)=>m.key==='a').length)).toBe(1);
 await send(host,'selection',{sequence:3,state:target('b')});await expect.poll(()=>host.evaluate(()=>(window as any).held.filter((m:any)=>m.key==='b').length)).toBe(1);
 await host.evaluate(()=>{const w=window as any;w.held.find((m:any)=>m.key==='b').answer();w.held.find((m:any)=>m.key==='a').answer();w.holdInit=false;});
 await expect.poll(()=>frame.locator('#snapshots').evaluate(e=>JSON.parse(e.textContent||'[]').at(-1)?.target)).toBe('b');
 expect(await frame.locator('#snapshots').evaluate(e=>JSON.parse(e.textContent||'[]').some((s:any)=>s.target==='a'))).toBe(false);
 await page.clock.install();await host.evaluate(()=>{(window as any).pause=true;});await page.clock.runFor(47000);await expect(page.getByLabel('桥接连接')).toHaveText('offline');
 const before=await host.evaluate(()=>(window as any).requests.filter((m:any)=>m.type==='diceRpc'&&m.method==='init').length);
 await host.evaluate(()=>{(window as any).pause=false;});await send(host,'pong');await expect(page.getByLabel('桥接连接')).toHaveText('online');
 await expect.poll(()=>host.evaluate(()=>(window as any).requests.filter((m:any)=>m.type==='diceRpc'&&m.method==='init').length)).toBe(before+1);
});
