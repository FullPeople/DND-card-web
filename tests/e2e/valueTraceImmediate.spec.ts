import {test,expect,type Page} from '@playwright/test';
async function ready(page:Page){await page.goto('/tests/fixtures/value-trace/');await expect(page.getByLabel('力量基础值',{exact:true})).toHaveValue('12');}
async function evidence(page:Page){await page.evaluate(()=>{
 const w=window as any;w.traceFrames=[];w.traceEvents=[];w.traceSelecting=[];
 const snapshot=()=>{const panel=document.querySelector<HTMLElement>('.value-trace-panel'),input=document.activeElement as HTMLInputElement;return {label:input?.getAttribute('aria-label'),value:input?.value,panel:!!panel,opacity:panel?getComputedStyle(panel).opacity:null,clip:panel?getComputedStyle(panel).clipPath:null};};
 document.addEventListener('pointerdown',event=>{if((event.target as HTMLElement).getAttribute('aria-label')?.endsWith('基础值')){w.traceEvents.push(snapshot());let frames=0;const record=()=>{w.traceFrames.push(snapshot());if(++frames<4)requestAnimationFrame(record);};requestAnimationFrame(record);}});
 document.addEventListener('select',event=>{const input=event.target as HTMLInputElement;if(input.getAttribute('aria-label')?.includes('追溯输入'))w.traceSelecting.push({label:input.getAttribute('aria-label'),value:input.value});});
});}
async function data(page:Page){return JSON.parse((await page.locator('#data').textContent())!);}

test('pointer-down first observable frame contains selected stored base and opaque trace, without selecting total',async({page},info)=>{
 await ready(page);await evidence(page);const input=page.getByLabel('力量基础值',{exact:true}),box=(await input.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 const trace=page.getByLabel('力量追溯输入',{exact:true});await expect(trace).toBeFocused();await expect(trace).toHaveValue('10');
 await expect.poll(()=>page.evaluate(()=>(window as any).traceFrames.length)).toBe(4);
 const result=await page.evaluate(()=>({events:(window as any).traceEvents,frames:(window as any).traceFrames,selections:(window as any).traceSelecting}));
 expect(result.events[0]).toMatchObject({label:'力量追溯输入',value:'10',panel:true,opacity:'1',clip:'none'});
 for(const frame of result.frames)expect(frame).toMatchObject({label:'力量追溯输入',value:'10',panel:true,opacity:'1',clip:'none'});
 expect(result.selections.length).toBeGreaterThan(0);expect(result.selections.every((row:any)=>row.value==='10')).toBe(true);
 await info.attach('first-frame-evidence',{body:JSON.stringify(result,null,2),contentType:'application/json'});await page.screenshot({path:info.outputPath('first-pointer-down-base.png')});await page.mouse.up();await page.keyboard.press('Escape');expect((await data(page)).abilities.str).toBe(10);expect((await data(page)).edits).toBe(0);
});

test('keyboard focus and Tab follow the original field order and never commit a displayed total',async({page})=>{
 await ready(page);await page.getByRole('button',{name:'之前',exact:true}).focus();await page.keyboard.press('Tab');
 const str=page.getByLabel('力量追溯输入',{exact:true});await expect(str).toBeFocused();await expect(str).toHaveValue('10');await str.fill('13');await page.keyboard.press('Tab');
 const dex=page.getByLabel('敏捷追溯输入',{exact:true});await expect(dex).toBeFocused();await expect(dex).toHaveValue('7');await expect(page.getByLabel('力量基础值',{exact:true})).toHaveValue('15');expect((await data(page)).abilities).toMatchObject({str:13,dex:7});expect((await data(page)).edits).toBe(1);
 await page.keyboard.press('Shift+Tab');await expect(str).toBeFocused();await expect(str).toHaveValue('13');await page.keyboard.press('Escape');await expect(page.getByLabel('力量基础值',{exact:true})).toHaveValue('15');expect((await data(page)).edits).toBe(1);
});

test('rapid switching remounts the correct base and blur/Enter commit once; Escape and readonly do not write',async({page})=>{
 await ready(page);await page.getByLabel('力量基础值',{exact:true}).click();await page.getByLabel('力量追溯输入',{exact:true}).fill('14');
 await page.getByLabel('敏捷基础值',{exact:true}).click();const dex=page.getByLabel('敏捷追溯输入',{exact:true});await expect(dex).toBeFocused();await expect(dex).toHaveValue('7');expect((await data(page)).edits).toBe(1);await dex.fill('9');await dex.press('Enter');expect((await data(page)).abilities).toMatchObject({str:14,dex:9});expect((await data(page)).edits).toBe(2);
 await page.getByLabel('力量基础值',{exact:true}).click();await page.getByLabel('力量追溯输入',{exact:true}).fill('20');await page.keyboard.press('Escape');expect((await data(page)).edits).toBe(2);await expect(page.getByLabel('力量基础值',{exact:true})).toHaveValue('16');
 await page.getByRole('button',{name:'切换编辑',exact:true}).click();await page.getByLabel('力量基础值',{exact:true}).click();await expect(page.locator('.value-trace-panel')).toHaveCount(0);await expect(page.getByLabel('力量基础值',{exact:true})).toHaveValue('16');
 await page.getByRole('button',{name:'切换编辑',exact:true}).click();await page.getByRole('button',{name:'切换角色',exact:true}).click();await page.getByLabel('力量基础值',{exact:true}).click();await expect(page.getByLabel('力量追溯输入',{exact:true})).toHaveValue('6');
});

test('readonly fields retain calculation inspection in an enabled provider without granting editing',async({page})=>{
 await ready(page);const field=page.getByLabel('体质基础值',{exact:true});await expect(field).toHaveValue('9');await field.click();const trace=page.getByLabel('体质追溯输入',{exact:true});await expect(trace).toBeFocused();await expect(trace).toHaveValue('8');await expect(trace).not.toBeEditable();await expect(page.locator('.trace-result strong')).toHaveText('9');await trace.press('ArrowUp');await trace.press('Enter');expect((await data(page)).abilities.con).toBe(8);expect((await data(page)).edits).toBe(0);await expect(field).toHaveValue('9');
});

test('refocusing the covered base preserves the trace draft and commits once instead of restoring a stale base',async({page})=>{
 await ready(page);const base=page.getByLabel('力量基础值',{exact:true}),trace=page.getByLabel('力量追溯输入',{exact:true});
 // Existing integrations can focus the original field for both fill and Enter.
 await base.fill('13');await expect(trace).toHaveValue('13');await base.press('Enter');
 await expect(page.locator('.value-trace-panel')).toHaveCount(0);await expect(base).toHaveValue('15');expect((await data(page)).abilities.str).toBe(13);expect((await data(page)).edits).toBe(1);
 await base.click();await trace.fill('14');await base.focus();await expect(trace).toBeFocused();await expect(trace).toHaveValue('14');
 await page.keyboard.press('Enter');await expect(page.locator('.value-trace-panel')).toHaveCount(0);await expect(base).toHaveValue('16');expect((await data(page)).abilities.str).toBe(14);expect((await data(page)).edits).toBe(2);
});
