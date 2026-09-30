import {expect,test,type Page,type Route} from '@playwright/test';

const session='handshake216';
const envelope=(type:string,fields:Record<string,unknown>={})=>({protocol:'full-suite-workbench/v1',session,hostStarted:1,type,...fields});
async function fixture(page:Page,baseURL:string,failMutation=false){
 const posts:any[]=[],polls:Route[]=[];
 await page.route('**/relay?*',async route=>{
  if(route.request().method()==='POST'){
   const message=route.request().postDataJSON();posts.push(message);
   await route.fulfill({status:failMutation&&message.type==='stats'?503:200,contentType:'application/json',body:'{}'});
  }else polls.push(route);
 });
 await page.route('**/handshake216.html',route=>route.fulfill({contentType:'text/html',body:`<script type="module">import {getWorkbench,workbenchRequest} from '/src/platform/workbench.ts';window.getWorkbench=getWorkbench;window.workbenchRequest=workbenchRequest;</script>`}));
 await page.clock.install();
 await page.goto('/handshake216.html#suite='+session+'&bridge='+encodeURIComponent(baseURL)+'&relay=fixture-key');
 await page.waitForFunction(()=>!!(window as any).getWorkbench);
 await expect.poll(()=>posts.filter(m=>m.type==='hello').length).toBeGreaterThan(0);
 const deliver=async(messages:any[])=>{await expect.poll(()=>polls.length).toBeGreaterThan(0);await polls.shift()!.fulfill({contentType:'application/json',body:JSON.stringify(messages)});await expect.poll(()=>polls.length).toBeGreaterThan(0);};
 const heartbeat=async(ms:number)=>{for(let i=0;i<ms;i+=500){await deliver([envelope('pong')]);await page.clock.runFor(Math.min(500,ms-i));}};
 const ready=()=>deliver([envelope('ready'),envelope('catalog',{sequence:1,cards:[{id:'synthetic-handshake',name:'Handshake fixture',itemId:'fixture',resources:[],stats:{},write:true,locked:false,inScene:false}],monsters:[],role:'GM',enabled:{}})]);
 return {posts,deliver,heartbeat,ready};
}

test('real relay recovers its initial catalog while heartbeat traffic continues, then stays quiet',async({page,baseURL})=>{
 const f=await fixture(page,String(baseURL));const initial=f.posts.filter(m=>m.type==='hello').length;
 // The fixture deliberately withholds the initial handshake response. This
 // proves the recovery contract; it does not assert why live startup was slow.
 await f.heartbeat(2000);await expect.poll(()=>f.posts.filter(m=>m.type==='hello').length).toBeGreaterThan(initial);
 await f.ready();await expect.poll(()=>page.evaluate(()=>(window as any).getWorkbench().cards[0]?.id)).toBe('synthetic-handshake');
 const complete=f.posts.filter(m=>m.type==='hello').length;await f.heartbeat(12000);
 expect(f.posts.filter(m=>m.type==='hello')).toHaveLength(complete);expect(f.posts.every(m=>m.type==='hello')).toBe(true);
});

test('ambiguous write transport failure recovers the handshake and queries the same receipt without replay',async({page,baseURL})=>{
 const f=await fixture(page,String(baseURL),true);await f.ready();
 await page.evaluate(()=>{(window as any).completion='pending';void (window as any).workbenchRequest('stats',{statPatch:{hp:4}}).then(()=>(window as any).completion='ack',()=>(window as any).completion='rejected');});
 await expect.poll(()=>f.posts.filter(m=>m.type==='stats').length).toBe(1);const mutation=f.posts.find(m=>m.type==='stats');
 await f.heartbeat(20000);expect(f.posts.filter(m=>m.type==='stats')).toHaveLength(1);
 expect(f.posts.some(m=>m.type==='requestStatus'&&m.requestId===mutation.requestId)).toBe(true);
 await f.deliver([envelope('ack',{requestId:mutation.requestId,ok:true,result:{}})]);
 await expect.poll(()=>page.evaluate(()=>(window as any).completion)).toBe('ack');expect(f.posts.filter(m=>m.type==='stats')).toHaveLength(1);
});
