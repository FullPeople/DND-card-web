import {test,expect,type Page} from '@playwright/test';

async function fixture(page:Page){
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/control-settlement182',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><style>body{font:16px sans-serif}main{width:420px;padding:24px}.console-resource-controls{display:flex;gap:8px}.resource-title{display:flex;gap:12px}button,input{font:inherit;padding:8px}label{display:block;margin:16px 0}</style><div id="test-root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/tests/e2e/controlSettlement182.harness.jsx"></script>`}));
 await page.goto('/control-settlement182');await expect(page.locator('.resource-numeric')).toHaveText('6 / 20');return errors;
}
const publish=(page:Page,values:Record<string,number>)=>page.evaluate(values=>(window as any).controls182.publish(values),values);
const finish=(page:Page,index:number,result?:number)=>page.evaluate(({index,result})=>(window as any).controls182.finish(index,result),{index,result});
async function enterStat(page:Page,value:string){await page.getByRole('textbox',{name:'生命值',exact:true}).fill(value);await page.keyboard.press('Enter');}

test('resource adopts a newer confirmed value received while its successful request is still settling',async({page})=>{
 await fixture(page);await page.getByRole('button',{name:'消耗法术点',exact:true}).click();await expect(page.locator('.resource-numeric')).toHaveText('5 / 20');
 await publish(page,{current:5,confirmed:5});await publish(page,{current:4,confirmed:4});await expect(page.locator('.resource-numeric')).toHaveText('5 / 20');
 await finish(page,0);await expect(page.locator('.resource-numeric')).toHaveText('4 / 20');
});

test('stat settlement cannot hide a newer authoritative value behind an older numeric receipt',async({page})=>{
 await fixture(page);await enterStat(page,'12');await publish(page,{hp:12});await publish(page,{hp:11});await expect(page.getByRole('textbox',{name:'生命值',exact:true})).toHaveValue('12');
 await finish(page,0,12);await expect(page.getByRole('textbox',{name:'生命值',exact:true})).toHaveValue('11');
});

test('receipt arriving before props does not roll back either optimistic control',async({page})=>{
 await fixture(page);await page.getByRole('button',{name:'消耗法术点',exact:true}).click();await finish(page,0);await expect(page.locator('.resource-numeric')).toHaveText('5 / 20');
 await enterStat(page,'12');await finish(page,1,12);await expect(page.getByRole('textbox',{name:'生命值',exact:true})).toHaveValue('12');
 await publish(page,{current:5,confirmed:5,hp:12});await expect(page.locator('.resource-numeric')).toHaveText('5 / 20');await expect(page.getByRole('textbox',{name:'生命值',exact:true})).toHaveValue('12');
});

test('an earlier resource receipt cannot replace the next queued intent',async({page})=>{
 await fixture(page);await page.getByRole('button',{name:'消耗法术点',exact:true}).click();await page.getByRole('button',{name:'恢复法术点',exact:true}).click();
 await publish(page,{current:5,confirmed:5});await finish(page,0);await expect(page.locator('.resource-numeric')).toHaveText('6 / 20');
 await publish(page,{current:6,confirmed:6});await publish(page,{current:3,confirmed:3});await finish(page,1);await expect(page.locator('.resource-numeric')).toHaveText('3 / 20');
 expect(await page.evaluate(()=>(window as any).controls182.requests.map((row:any)=>row.value))).toEqual([5,6]);
});

test('an ABA optimistic row must not mistake the unchanged original confirmed value for a new acknowledgement',async({page})=>{
 await fixture(page);await page.getByRole('button',{name:'消耗法术点',exact:true}).click();await publish(page,{current:5,confirmed:6});
 await page.getByRole('button',{name:'恢复法术点',exact:true}).click();await publish(page,{current:6,confirmed:6});
 await publish(page,{current:6,confirmed:5});await finish(page,0);await expect(page.locator('.resource-numeric')).toHaveText('6 / 20');
 // The pending overlay disappears before the final receipt's props arrive.
 await publish(page,{current:5,confirmed:5});await finish(page,1);await expect(page.locator('.resource-numeric')).toHaveText('6 / 20');
 await publish(page,{current:6,confirmed:6});await expect(page.locator('.resource-numeric')).toHaveText('6 / 20');
 await publish(page,{current:4,confirmed:4});await expect(page.locator('.resource-numeric')).toHaveText('4 / 20');
});

test('stat ABA receipts arriving before props keep the latest local intent',async({page})=>{
 await fixture(page);await enterStat(page,'12');await enterStat(page,'10');
 await publish(page,{hp:12});await finish(page,0,12);await expect(page.getByRole('textbox',{name:'生命值',exact:true})).toHaveValue('10');
 await finish(page,1,10);await expect(page.getByRole('textbox',{name:'生命值',exact:true})).toHaveValue('10');
 await publish(page,{hp:10});await publish(page,{hp:9});await expect(page.getByRole('textbox',{name:'生命值',exact:true})).toHaveValue('9');
});

test('a numeric receipt never writes an intermediate stale value when newer props were proven',async({page})=>{
 await fixture(page);await enterStat(page,'12');await publish(page,{hp:12});await publish(page,{hp:11});await page.evaluate(()=>(window as any).controls182.watchStat());
 await finish(page,0,13);await expect(page.getByRole('textbox',{name:'生命值',exact:true})).toHaveValue('11');
 expect(await page.evaluate(()=>(window as any).controls182.statWrites)).not.toContain('13');
});

test('settlement preserves a newly focused expression instead of overwriting active typing',async({page})=>{
 await fixture(page);await enterStat(page,'12');await page.getByRole('textbox',{name:'生命值',exact:true}).fill('+3');await publish(page,{hp:12});await publish(page,{hp:11});await finish(page,0,12);
 await expect(page.getByRole('textbox',{name:'生命值',exact:true})).toHaveValue('+3');
});

test('uncertain outcomes keep local values until a late terminal receipt and then resume live updates',async({page})=>{
 const errors=await fixture(page);await page.getByRole('button',{name:'消耗法术点',exact:true}).click();await page.evaluate(()=>(window as any).controls182.fail(0));await enterStat(page,'12');await page.evaluate(()=>(window as any).controls182.fail(1));
 await publish(page,{current:3,confirmed:3,hp:9});await expect(page.locator('.resource-numeric')).toHaveText('5 / 20');await expect(page.getByRole('textbox',{name:'生命值',exact:true})).toHaveValue('12');
 await publish(page,{current:4,confirmed:4,hp:11});await page.evaluate(()=>{const f=(window as any).controls182;f.receipt(0,'resource',4);f.receipt(1,'stat',11);});
 await expect(page.locator('.resource-numeric')).toHaveText('4 / 20');await expect(page.getByRole('textbox',{name:'生命值',exact:true})).toHaveValue('11');
 await publish(page,{current:2,confirmed:2,hp:8});await expect(page.locator('.resource-numeric')).toHaveText('2 / 20');await expect(page.getByRole('textbox',{name:'生命值',exact:true})).toHaveValue('8');expect(errors).toEqual([]);
});
