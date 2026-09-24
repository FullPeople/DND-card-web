import {test,expect} from '@playwright/test';

test('rapid stock moves keep the latest gesture while remote quantities and late receipts remain live',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/inventory-queue181',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><div id="root"></div><script type="module" src="/tests/e2e/inventoryQueue181.harness.jsx"></script>`}));
 await page.goto('/inventory-queue181#suite=inventory-queue181&bridge='+encodeURIComponent(String(test.info().project.use.baseURL)));await expect.poll(()=>page.evaluate(()=>(window as any).ready||false),{timeout:8000,message:'harness must load'}).toBe(true).catch(e=>{throw Error(errors.join('\n')||String(e));});
 const result=await page.evaluate(()=>(window as any).run());
 expect(result.containers['card:one'].items.find((r:any)=>r.id==='rope')).toMatchObject({slot:9,quantity:37});
 await expect(page.locator('output')).toContainText('rope:9:37');
 const calls=await page.evaluate(()=>(window as any).calls);
 expect(calls).toHaveLength(2);expect(calls[0]).toMatchObject({observedSlots:{rope:0},expected:{'card:one':1}});expect(calls[1]).toMatchObject({observedSlots:{rope:5},expected:{'card:one':3}});
 const samples=await page.evaluate(()=>(window as any).moveSamples);const latest=samples.findIndex((r:any)=>r.slot===9);expect(latest).toBeGreaterThanOrEqual(0);expect(samples.slice(latest).every((r:any)=>r.slot===9)).toBe(true);
 await page.evaluate(()=>(window as any).replay());await expect(page.locator('output')).toContainText('rope:9:37');
 // A pending old-scene draft and its late success receipt cannot return the
 // user to the previous scene or restore a previously visible inventory scope.
 await page.evaluate(()=>{(window as any).pauseAck=true;(window as any).flight=(window as any).move(13);});await page.waitForFunction(()=>typeof (window as any).releaseAck==='function');
 await page.evaluate(()=>(window as any).switchScope());await expect(page.locator('output')).toContainText('rope:2:37');
 await page.evaluate(async()=>{(window as any).releaseAck();await (window as any).flight;});
 expect((await page.evaluate(()=>(window as any).value())).publicId).toBe('public:another-scene');await expect(page.locator('output')).toContainText('rope:2:37');
});
