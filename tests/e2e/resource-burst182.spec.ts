import {test,expect,type Page} from '@playwright/test';
import {mockSource} from './fixtures';
import {writeFileSync} from 'node:fs';

async function open(page:Page,mode='overview',rage=5,extra=''){
 await mockSource(page);
 await page.route('**/resource-burst182?*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><div id="test-root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/tests/e2e/resourceBurst182.harness.jsx"></script>`}));
 await page.goto('/resource-burst182?mode='+mode+'&rage='+rage+extra+'#suite=resource-burst182&bridge='+encodeURIComponent(String(test.info().project.use.baseURL)));
 await page.waitForFunction(()=>(window as any).resource182?.ready);
 if(mode==='card'){await expect(page.locator('.app-shell')).toBeVisible();await page.evaluate(()=>(window as any).resource182.showCard());}
 if(mode==='monster')await page.getByRole('button',{name:'怪物',exact:true}).click();
 await expect(row(page,'怒气',mode).locator('.resource-pips button[aria-pressed=true]')).toHaveCount(rage);
}
function row(page:Page,name:string,mode='overview'){return page.locator(mode==='card'?'.paper .quickbar-resources .resource179-row,.spell-slot-popover .resource179-row':mode==='public'?'.public-resources .resource179-row':'.resource-overview .resource179-row').filter({has:page.locator('.resource-title strong',{hasText:name})});}
async function pips(page:Page,name:string,value:number,mode='overview'){await expect(row(page,name,mode).locator('.resource-pips button[aria-pressed=true]')).toHaveCount(value);}
async function requests(page:Page,n:number){await expect.poll(()=>page.evaluate(()=>(window as any).resource182.requests.length)).toBe(n);}
async function frames(page:Page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function noRebound(page:Page,name:string,value:number){await frames(page);const values=await page.evaluate(name=>(window as any).resource182.samples.flatMap((sample:any)=>sample.rows.filter((r:any)=>r.name===name).map((r:any)=>r.value)),name);expect(values.length).toBeGreaterThan(0);expect(values.every((n:number)=>n===value),'frame samples: '+JSON.stringify(values)).toBe(true);}
test.afterEach(async({page},info)=>{const evidence=await page.evaluate(()=>{const f=(window as any).resource182;return f?{requests:f.requests,pending:f.pending,notices:f.notices,errors:f.errors,samples:f.samples,wireEvents:f.wireEvents,authority:f.authority(),stockAuthority:f.stockAuthority(),workbench:f.workbench()}:null;}).catch(()=>null);const path=info.outputPath('resource-burst-evidence.json');writeFileSync(path,JSON.stringify(evidence,null,2));await info.attach('resource-burst-evidence',{path,contentType:'application/json'});});

test('overview rapid spend then restore preserves the second intent even when it equals the old confirmed value',async({page})=>{
 await open(page);const last=row(page,'怒气').getByRole('button',{name:'伊芙怒气 5',exact:true});
 await last.click();await pips(page,'怒气',4);await requests(page,1);
 await last.click();await pips(page,'怒气',5);await page.evaluate(()=>(window as any).resource182.samples=[]);expect(await page.evaluate(()=>(window as any).resource182.requests.length)).toBe(1);
 await page.evaluate(()=>(window as any).resource182.confirmNext());await requests(page,2);
 const second=await page.evaluate(()=>(window as any).resource182.requests[1]);
 expect(second.resource.current,'second actual wire payload must retain the user restore-to-5, not become a no-op at 4').toBe(5);
 await page.evaluate(()=>(window as any).resource182.confirmNext());await pips(page,'怒气',5);
 await page.evaluate(()=>{const f=(window as any).resource182;f.stale(1);f.refresh();});await pips(page,'怒气',5);
 expect(await page.evaluate(()=>(window as any).resource182.notices.map((n:any)=>[n.from,n.to]))).toEqual([[5,4],[4,5]]);
 expect(await page.evaluate(()=>(window as any).resource182.authority().rage.current)).toBe(5);
 await noRebound(page,'怒气',5);expect(await page.evaluate(()=>(window as any).resource182.errors)).toEqual([]);
});

test('overview 2→1→2→0 sends all three intents and keeps zero visible while earlier ACKs arrive',async({page})=>{
 await open(page,'overview',2);const r=row(page,'怒气');await r.getByRole('button',{name:'伊芙怒气 2',exact:true}).click();await requests(page,1);await r.getByRole('button',{name:'伊芙怒气 2',exact:true}).click();await r.getByRole('button',{name:'伊芙怒气 1',exact:true}).click();await pips(page,'怒气',0);await page.evaluate(()=>(window as any).resource182.samples=[]);
 for(let n=1;n<=3;n++){await page.evaluate(()=>(window as any).resource182.confirmNext());if(n<3)await requests(page,n+1);await pips(page,'怒气',0);await frames(page);}
 const wire=await page.evaluate(()=>(window as any).resource182.requests.map((r:any)=>r.resource.current));expect(wire).toEqual([1,2,0]);
 await page.evaluate(()=>{const f=(window as any).resource182;f.stale(1,'catalog');f.stale(2,'selection');});await noRebound(page,'怒气',0);
 expect(await page.evaluate(()=>(window as any).resource182.notices.map((n:any)=>[n.from,n.to]))).toEqual([[2,1],[1,2],[2,0]]);expect(await page.evaluate(()=>(window as any).resource182.errors)).toEqual([]);
});

test('independent overview resources remain responsive and an older receipt never rolls either value back',async({page})=>{
 await open(page);const rage=row(page,'怒气').getByRole('button',{name:'伊芙怒气 5',exact:true});await rage.click();await requests(page,1);
 await row(page,'战术点').getByRole('button',{name:'伊芙战术点 3',exact:true}).click();await requests(page,2);await rage.click();await pips(page,'怒气',5);await pips(page,'战术点',2);await page.evaluate(()=>(window as any).resource182.samples=[]);
 await page.evaluate(()=>(window as any).resource182.confirmNext());await requests(page,3);await page.evaluate(()=>(window as any).resource182.confirmNext());await page.evaluate(()=>(window as any).resource182.confirmNext());
 await page.evaluate(()=>{const f=(window as any).resource182;f.stale(1);f.stale(2);});await pips(page,'怒气',5);await pips(page,'战术点',2);await noRebound(page,'怒气',5);await noRebound(page,'战术点',2);
 expect(await page.evaluate(()=>(window as any).resource182.authority())).toMatchObject({rage:{current:5},focus:{current:2}});expect(await page.evaluate(()=>(window as any).resource182.notices.map((n:any)=>[n.id,n.to]))).toEqual([['rage',4],['focus',2],['rage',5]]);expect(await page.evaluate(()=>(window as any).resource182.errors)).toEqual([]);
});

test('queued current-value intent preserves a concurrent remote maximum change across the older first ACK',async({page})=>{
 await open(page);const last=row(page,'怒气').getByRole('button',{name:'伊芙怒气 5',exact:true});await last.click();await requests(page,1);await last.click();await pips(page,'怒气',5);
 await page.evaluate(()=>{const f=(window as any).resource182;f.confirmNext(true);f.remote('rage',{max:7});});await pips(page,'怒气',5);
 await page.evaluate(()=>(window as any).resource182.deliverAck());await requests(page,2);const wire=await page.evaluate(()=>(window as any).resource182.requests[1]);expect(wire.resource).toMatchObject({current:5,max:7});expect(wire.expected).toMatchObject({current:4,max:7});
 await page.evaluate(()=>(window as any).resource182.confirmNext());await expect(row(page,'怒气').locator('.resource-pips button')).toHaveCount(7);await pips(page,'怒气',5);expect(await page.evaluate(()=>(window as any).resource182.authority().rage)).toMatchObject({current:5,max:7});expect(await page.evaluate(()=>(window as any).resource182.errors)).toEqual([]);
});

test('actual App quickbar spend/restore survives ACK boundaries, stale selections and subsequent remote changes',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page,'card');const last=row(page,'怒气','card').getByRole('button',{name:'怒气 5',exact:true});await last.click();await pips(page,'怒气',4,'card');await requests(page,1);
 await last.click();await pips(page,'怒气',5,'card');await page.evaluate(()=>(window as any).resource182.samples=[]);await page.waitForTimeout(100);await page.evaluate(()=>(window as any).resource182.confirmNext());await requests(page,2);await pips(page,'怒气',5,'card');await frames(page);
 await page.evaluate(()=>(window as any).resource182.confirmNext());await pips(page,'怒气',5,'card');await page.evaluate(()=>{const f=(window as any).resource182;f.stale(1);});await noRebound(page,'怒气',5);
 expect(await page.evaluate(()=>(window as any).resource182.notices.map((n:any)=>[n.from,n.to]))).toEqual([[5,4],[4,5]]);
 await page.evaluate(()=>(window as any).resource182.remote('focus',{current:1}));await pips(page,'战术点',1,'card');await pips(page,'怒气',5,'card');expect(errors).toEqual([]);expect(await page.evaluate(()=>(window as any).resource182.errors)).toEqual([]);
});

test('actual App quickbar 2→1→2→0 and another resource preserve final local values during delayed saves',async({page})=>{
 await open(page,'card',2);const r=row(page,'怒气','card');await r.getByRole('button',{name:'怒气 2',exact:true}).click();await requests(page,1);await r.getByRole('button',{name:'怒气 2',exact:true}).click();await r.getByRole('button',{name:'怒气 1',exact:true}).click();await row(page,'战术点','card').getByRole('button',{name:'战术点 3',exact:true}).click();await pips(page,'怒气',0,'card');await pips(page,'战术点',2,'card');await page.evaluate(()=>(window as any).resource182.samples=[]);await page.waitForTimeout(100);
 await page.evaluate(()=>(window as any).resource182.confirmNext());await requests(page,2);await pips(page,'怒气',0,'card');await pips(page,'战术点',2,'card');await frames(page);
 // Real pointer clicks can straddle the 80ms batch boundary. A third batch is
 // valid; flush what the App actually emitted and inspect every intermediate frame.
 for(let i=0;i<8;i++){await page.waitForTimeout(120);if(!await page.evaluate(()=>(window as any).resource182.pending.length))break;await page.evaluate(()=>(window as any).resource182.confirmNext());await pips(page,'怒气',0,'card');await pips(page,'战术点',2,'card');await frames(page);}
 await page.evaluate(()=>(window as any).resource182.stale(1));await noRebound(page,'怒气',0);await noRebound(page,'战术点',2);expect(await page.evaluate(()=>(window as any).resource182.authority())).toMatchObject({rage:{current:0},focus:{current:2}});expect(await page.evaluate(()=>(window as any).resource182.errors)).toEqual([]);
});

test('public resource spend/restore retains both values through its actual inventory queue and stale refresh',async({page})=>{
 await open(page,'public');const last=row(page,'怒气','public').getByRole('button',{name:'怒气 5',exact:true});await last.click();await requests(page,1);await pips(page,'怒气',4,'public');await last.click();await pips(page,'怒气',5,'public');await page.evaluate(()=>(window as any).resource182.samples=[]);
 await page.evaluate(()=>(window as any).resource182.confirmNext());await requests(page,2);expect(await page.evaluate(()=>(window as any).resource182.requests.map((r:any)=>r.operation.patch.quantity))).toEqual([4,5]);await page.evaluate(()=>(window as any).resource182.confirmNext());await pips(page,'怒气',5,'public');
 await page.evaluate(()=>(window as any).resource182.stale(1,'catalog'));await noRebound(page,'怒气',5);expect(await page.evaluate(()=>(window as any).resource182.notices.map((n:any)=>[n.from,n.to]))).toEqual([[5,4],[4,5]]);expect(await page.evaluate(()=>(window as any).resource182.errors)).toEqual([]);
});

test('public resources 2→1→2→0 and a second counter keep independent latest intents while draining',async({page})=>{
 await open(page,'public',2);const r=row(page,'怒气','public');await r.getByRole('button',{name:'怒气 2',exact:true}).click();await requests(page,1);await r.getByRole('button',{name:'怒气 2',exact:true}).click();await r.getByRole('button',{name:'怒气 1',exact:true}).click();await row(page,'战术点','public').getByRole('button',{name:'战术点 3',exact:true}).click();await pips(page,'怒气',0,'public');await pips(page,'战术点',2,'public');await page.evaluate(()=>(window as any).resource182.samples=[]);
 for(let n=1;n<=4;n++){await page.evaluate(()=>(window as any).resource182.confirmNext());if(n<4)await requests(page,n+1);await pips(page,'怒气',0,'public');await pips(page,'战术点',2,'public');await frames(page);}
 await page.evaluate(()=>{const f=(window as any).resource182;f.stale(1,'catalog');f.stale(2,'catalog');});await noRebound(page,'怒气',0);await noRebound(page,'战术点',2);expect(await page.evaluate(()=>(window as any).resource182.notices.map((n:any)=>[n.id,n.to]))).toEqual([['rage',1],['rage',2],['rage',0],['focus',2]]);expect(await page.evaluate(()=>(window as any).resource182.errors)).toEqual([]);
});

test('monster overview metadata resources preserve a rapid restore without character document revisions',async({page})=>{
 await open(page,'monster');const last=row(page,'怒气','monster').getByRole('button',{name:'哥布林怒气 5',exact:true});await last.click();await requests(page,1);await last.click();await pips(page,'怒气',5,'monster');await page.evaluate(()=>(window as any).resource182.samples=[]);
 await page.evaluate(()=>(window as any).resource182.confirmNext());await requests(page,2);const wire=await page.evaluate(()=>(window as any).resource182.requests[1]);expect(wire.itemId).toBe('goblin');expect(wire.resource.current).toBe(5);expect(await page.evaluate(()=>Object.hasOwn((window as any).resource182.history[0].state,'documentRevision'))).toBe(false);
 await page.evaluate(()=>(window as any).resource182.confirmNext());await page.evaluate(()=>(window as any).resource182.stale(1));await pips(page,'怒气',5,'monster');await noRebound(page,'怒气',5);
 await page.evaluate(()=>(window as any).resource182.remote('focus',{current:1}));await pips(page,'战术点',1,'monster');expect(await page.evaluate(()=>(window as any).resource182.notices.map((n:any)=>[n.from,n.to]))).toEqual([[5,4],[4,5]]);expect(await page.evaluate(()=>(window as any).resource182.errors)).toEqual([]);
});

test('resource undo/redo reverses the actual confirmed rapid restore and resists late old snapshots',async({page})=>{
 await open(page);const last=row(page,'怒气').getByRole('button',{name:'伊芙怒气 5',exact:true});await last.click();await requests(page,1);await last.click();await page.evaluate(()=>(window as any).resource182.confirmNext());await requests(page,2);await page.evaluate(()=>(window as any).resource182.confirmNext());await pips(page,'怒气',5);
 await page.getByRole('button',{name:'撤销',exact:true}).click();await requests(page,3);expect(await page.evaluate(()=>(window as any).resource182.requests[2].resource.current)).toBe(4);await page.evaluate(()=>(window as any).resource182.confirmNext());await pips(page,'怒气',4);await page.evaluate(()=>(window as any).resource182.stale(2));await pips(page,'怒气',4);
 await page.getByRole('button',{name:'重做',exact:true}).click();await requests(page,4);expect(await page.evaluate(()=>(window as any).resource182.requests[3].resource.current)).toBe(5);await page.evaluate(()=>(window as any).resource182.confirmNext());await pips(page,'怒气',5);await page.evaluate(()=>(window as any).resource182.stale(3));await pips(page,'怒气',5);
 expect(await page.evaluate(()=>(window as any).resource182.notices.map((n:any)=>[n.from,n.to]))).toEqual([[5,4],[4,5],[5,4],[4,5]]);expect(await page.evaluate(()=>(window as any).resource182.errors)).toEqual([]);
});

test('actual App automatic caster slots keep resource current, native used and legacy slots consistent through a burst',async({page})=>{
 await open(page,'card',5,'&caster=1');await page.locator('.spell-slot-summary').click();const spell=row(page,'1环法术位','card'),last=spell.getByRole('button',{name:'1环法术位 4',exact:true});await pips(page,'1环法术位',4,'card');
 const consistent=async(current:number)=>expect(await page.evaluate(()=>(window as any).resource182.slotState())).toMatchObject({resource:{current,max:4,automatic:true},settings:{max:4,used:4-current},legacy:{max:4,current}});
 await consistent(4);await last.click();await pips(page,'1环法术位',3,'card');await requests(page,1);await last.click();await pips(page,'1环法术位',4,'card');await page.evaluate(()=>(window as any).resource182.samples=[]);await page.waitForTimeout(100);
 await page.evaluate(()=>(window as any).resource182.confirmNext());await consistent(3);await requests(page,2);await pips(page,'1环法术位',4,'card');await page.evaluate(()=>(window as any).resource182.confirmNext());await consistent(4);await page.evaluate(()=>(window as any).resource182.stale(1));await noRebound(page,'1环法术位',4);
 await last.click();await pips(page,'1环法术位',3,'card');await requests(page,3);await page.evaluate(()=>(window as any).resource182.confirmNext());await consistent(3);
 // A fresh unrelated remote document forces the App hydration/auto-resource
 // path again. Used slots must remain spent instead of being filled by derivation.
 await page.evaluate(()=>(window as any).resource182.remote('focus',{current:1}));await pips(page,'战术点',1,'card');await pips(page,'1环法术位',3,'card');await consistent(3);await page.evaluate(()=>(window as any).resource182.stale(2));await pips(page,'1环法术位',3,'card');
 expect(await page.evaluate(()=>(window as any).resource182.notices.filter((n:any)=>n.id==='spell-slot:1').map((n:any)=>[n.from,n.to]))).toEqual([[4,3],[3,4],[4,3]]);expect(await page.evaluate(()=>(window as any).resource182.errors)).toEqual([]);
});
