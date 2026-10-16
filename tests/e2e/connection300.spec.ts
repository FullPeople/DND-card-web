import {test,expect,type Page} from '@playwright/test';
const session='connection300';
async function host(page:Page,type:string,fields:Record<string,unknown>={}){await page.evaluate(({type,fields,session})=>window.dispatchEvent(new MessageEvent('message',{source:(window as any).fixtureHost,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session,hostStarted:100,type,...fields}})),{type,fields,session});}
test.beforeEach(async({page,baseURL})=>{
 await page.clock.install();
 await page.route('**/connection300.html',route=>route.fulfill({contentType:'text/html',body:`<script type="module">import {getWorkbench,workbenchDiagnostics,workbenchRequest} from '/src/platform/workbench.ts';window.getWorkbench=getWorkbench;window.diagnostics=workbenchDiagnostics;window.request=workbenchRequest;addEventListener('message',event=>{const m=event.data;if(m.type==='panelRpc'&&m.requestId)dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:m.protocol,session:m.session,hostStarted:100,type:'ack',requestId:m.requestId,ok:true,result:{fixture:true}}}));});</script>`}));
 await page.goto('/connection300.html#suite='+session+'&bridge='+encodeURIComponent(String(baseURL)));await page.waitForFunction(()=>!!(window as any).diagnostics);
 await page.evaluate(()=>{const f=document.createElement('iframe');document.body.append(f);(window as any).fixtureHost=f.contentWindow;f.contentWindow!.addEventListener('message',event=>{const m=event.data;if(m.type==='panelRpc'&&m.requestId)window.dispatchEvent(new MessageEvent('message',{source:f.contentWindow,origin:location.origin,data:{protocol:m.protocol,session:m.session,hostStarted:100,type:'ack',requestId:m.requestId,ok:true,result:{fixture:true}}}));});});
});
test('partial handshake and pongs do not fabricate a usable connection',async({page})=>{
 await host(page,'ready');await host(page,'pong');expect(await page.evaluate(()=>(window as any).getWorkbench().online)).toBe(false);
 await host(page,'catalog',{sequence:1,cards:[],monsters:[],role:'GM',enabled:{}});expect(await page.evaluate(()=>(window as any).getWorkbench().online)).toBe(true);
});
test('fresh matched control handshake works without waiting for a bulk catalog',async({page})=>{
 const clientInstance=await page.evaluate(()=>(window as any).diagnostics().clientInstance);
 await host(page,'ready',{clientInstance,controlReady:true,role:'GM',enabled:{}});
 expect(await page.evaluate(()=>(window as any).getWorkbench().online)).toBe(true);
 const result=await page.evaluate(()=>(window as any).request('panelRpc',{panel:'textEffects',instance:'test',method:'init',args:[]}));expect(result.fixture).toBe(true);
});
test('retired ready cannot establish a new document connection',async({page})=>{
 await host(page,'ready',{clientInstance:'retired-document',controlReady:true});await host(page,'catalog',{sequence:1,cards:[],monsters:[]});expect(await page.evaluate(()=>(window as any).getWorkbench().online)).toBe(false);
});
test('compact rehandshake preserves loaded dice history and stale transport expires',async({page})=>{
 const clientInstance=await page.evaluate(()=>(window as any).diagnostics().clientInstance);
 await host(page,'ready',{clientInstance,controlReady:true});await host(page,'rolls',{rolls:[{rollId:'original',dice:[],total:7,ts:1}]});await host(page,'ready',{clientInstance,controlReady:true});
 expect(await page.evaluate(()=>(window as any).getWorkbench().rolls.length)).toBe(1);
 await page.clock.runFor(47000);expect(await page.evaluate(()=>(window as any).getWorkbench().online)).toBe(false);
});
