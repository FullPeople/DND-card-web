import {test,expect,type Page} from '@playwright/test';

const session='order178';
const target=(revision=1,hp=20,id='hero')=>({key:`room:card:${id}`,itemId:id,cardId:id,name:id,kind:'character',role:'GM',write:true,locked:false,stats:{health:hp,'max health':30},resources:[{id:'r',current:hp,max:30}],conditions:[],documentRevision:revision});
const card=(revision=1,hp=20,id='hero')=>({...target(revision,hp,id),id,inScene:true});
const snapshot=(sequence:number,revision:number,hp:number,id='hero')=>({sequence,state:target(revision,hp,id),document:{_suiteRevision:revision,core_stats:{hp:{current:hp,max:30}}}});
async function host(page:Page,type:string,fields:Record<string,unknown>={}){await page.evaluate(({type,fields,session})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session,hostStarted:100,type,...fields}})),{type,fields,session});}
async function state(page:Page){return page.evaluate(()=>(window as any).getWorkbench());}
test.beforeEach(async({page,baseURL})=>{
 await page.route('**/sync-order-review.html',route=>route.fulfill({contentType:'text/html',body:`<script type="module">import {getWorkbench,patchWorkbenchStats} from '/src/platform/workbench.ts';import {newCharacter} from '/src/core/model.ts';import {evaluate} from '/src/core/engine.ts';window.getWorkbench=getWorkbench;window.patchWorkbenchStats=patchWorkbenchStats;window.newCharacter=newCharacter;window.evaluateCharacter=evaluate;</script>`}));
 await page.goto('/sync-order-review.html#suite='+session+'&bridge='+encodeURIComponent(String(baseURL)));await page.waitForFunction(()=>(window as any).getWorkbench);await host(page,'ready');
});

test('late higher-revision ACK updates both active card and overview without reviving old permissions',async({page})=>{
 await host(page,'selection',snapshot(10,1,20));
 await host(page,'catalog',{sequence:20,cards:[{...card(),write:false,locked:true}],monsters:[],role:'PLAYER',enabled:{}});
 // A newer selection report carries an unchanged document but new permissions.
 await host(page,'selection',{...snapshot(30,1,20),state:{...target(),role:'PLAYER',write:false,locked:true}});
 await host(page,'ack',{requestId:'late-save',ok:true,result:{snapshot:snapshot(19,2,17)}});
 const wb=await state(page);expect(wb.target.stats.health).toBe(17);expect(wb.cards[0].stats.health).toBe(17);expect(wb.cards[0].resources[0].current).toBe(17);expect(wb.cards[0].documentRevision).toBe(2);
 expect(wb.cards[0].write).toBe(false);expect(wb.cards[0].locked).toBe(true);expect(wb.target.write).toBe(false);expect(wb.target.locked).toBe(true);expect(wb.target.role).toBe('PLAYER');
 await host(page,'ack',{requestId:'old-save',ok:true,result:{snapshot:snapshot(31,1,20)}});const after=await state(page);expect(after.cards[0].stats.health).toBe(17);expect(after.cards[0].resources[0].current).toBe(17);expect(after.target.stats.health).toBe(17);
});

test('late acknowledgement of another card updates its resources without changing the selected card',async({page})=>{
 await host(page,'catalog',{sequence:10,cards:[card(),card(1,12,'second')],monsters:[],enabled:{}});await host(page,'selection',snapshot(30,1,12,'second'));
 await host(page,'ack',{requestId:'other-save',ok:true,result:{snapshot:snapshot(19,2,17)}});const wb=await state(page);expect(wb.target.cardId).toBe('second');expect(wb.target.stats.health).toBe(12);expect(wb.cards.find((c:any)=>c.id==='hero').stats.health).toBe(17);
});

test('inventory acknowledgement does not suppress independent later-delivered catalog fields',async({page})=>{
 await host(page,'catalog',{sequence:10,cards:[card()],monsters:[],enabled:{dice:true}});
 await host(page,'ack',{requestId:'stock',ok:true,result:{sequence:40,inventory:{revision:3,publicId:'public',access:'same',containers:{}}}});
 await host(page,'catalog',{sequence:30,cards:[card(),card(1,12,'second')],monsters:[],enabled:{dice:false},inventory:{revision:2,publicId:'public',access:'same',containers:{}}});
 const wb=await state(page);expect(wb.cards.map((c:any)=>c.id)).toEqual(['hero','second']);expect(wb.enabled.dice).toBe(false);expect(wb.inventory.revision).toBe(3);
});

test('monster runtime acknowledgement ordering is independent for each item',async({page})=>{
 const monster=(id:string,hp:number)=>({id,kind:'monster',name:id,itemId:id,inScene:true,write:true,locked:false,stats:{health:hp},resources:[]});
 await host(page,'catalog',{sequence:20,cards:[],monsters:[monster('a',10),monster('b',12)],enabled:{}});
 const snap=(sequence:number,id:string,hp:number)=>({sequence,state:{...monster(id,hp),key:'room:token:'+id,kind:'monster',role:'GM'},document:{name:id}});
 await host(page,'ack',{requestId:'a-new',ok:true,result:{snapshot:snap(40,'a',5)}});await host(page,'ack',{requestId:'b-new',ok:true,result:{snapshot:snap(30,'b',8)}});await host(page,'ack',{requestId:'a-old',ok:true,result:{snapshot:snap(25,'a',9)}});
 const wb=await state(page);expect(wb.monsters.find((c:any)=>c.id==='a').stats.health).toBe(5);expect(wb.monsters.find((c:any)=>c.id==='b').stats.health).toBe(8);
});

test('80 ms batching serializes later character edits behind the previous acknowledgement',async({page})=>{
 await page.clock.install();await host(page,'selection',snapshot(1,1,20));await host(page,'catalog',{sequence:2,cards:[card()],monsters:[],enabled:{}});
 await page.evaluate(()=>{const w=window as any;w.sent=[];w.completed=0;w.failed=[];window.addEventListener('message',event=>{if(event.data?.type==='save')w.sent.push(event.data);});const c=w.newCharacter();c.id='suite:room:card:hero';c.runtime.hp=20;c.baseHp=30;w.native=c;w.editHp=(hp:number)=>{const before=w.native,after=structuredClone(before);after.runtime.hp=hp;after.revision++;w.native=after;void w.patchWorkbenchStats(before,after,w.evaluateCharacter(before),w.evaluateCharacter(after),w.getWorkbench().target).then(()=>w.completed++, (e:Error)=>w.failed.push(e.message));};w.editHp(19);});
 await page.clock.runFor(81);expect(await page.evaluate(()=>(window as any).sent.length)).toBe(1);
 await page.evaluate(()=>(window as any).editHp(18));await page.clock.runFor(81);expect(await page.evaluate(()=>(window as any).sent.length)).toBe(1);
 const first=await page.evaluate(()=>(window as any).sent[0]);await host(page,'ack',{requestId:first.requestId,ok:true,result:{snapshot:{...snapshot(3,2,19),document:{_suiteRevision:2,dnd_card_web:first.native}}}});
 await expect.poll(()=>page.evaluate(()=>(window as any).sent.length)).toBe(2);const second=await page.evaluate(()=>(window as any).sent[1]);expect(second.expected.health).toBe(19);expect(second.native?.runtime.hp??second.delta?.native.find((c:any)=>c.path.join('.')==='runtime.hp')?.after).toBe(18);
 await host(page,'ack',{requestId:second.requestId,ok:true,result:{snapshot:snapshot(4,3,18)}});await expect.poll(()=>page.evaluate(()=>(window as any).completed)).toBe(2);expect(await page.evaluate(()=>(window as any).failed)).toEqual([]);
});
