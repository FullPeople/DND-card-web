import {test,expect,type Page} from '@playwright/test';
const panel=(p:Page)=>p.locator('.console-transitions');
const button=(p:Page,name:string)=>panel(p).getByRole('button',{name,exact:true});
const requests=(p:Page)=>p.evaluate(()=>(window as any).requests);
test.beforeEach(async({page,baseURL})=>{await page.goto('/tests/fixtures/transition-rest/index.html#suite=transition-rest&bridge='+encodeURIComponent(baseURL!));await expect(panel(page)).toBeVisible();});
test('choices restore without a selected card; choosing or cancelling does not submit',async({page})=>{
 await expect(button(page,'短休')).toHaveAttribute('aria-pressed','true');
 for(const name of ['短休','长休','文字'])await expect(button(page,name)).toBeVisible();
 await button(page,'长休').click();await expect(button(page,'长休')).toHaveAttribute('aria-pressed','true');expect(await requests(page)).toEqual([]);await page.screenshot({path:test.info().outputPath('transition-long-desktop.png')});
 await page.evaluate(()=>(window as any).render(false));await expect(panel(page)).toHaveCount(0);await page.evaluate(()=>(window as any).render());await expect(panel(page)).toBeVisible();expect(await requests(page)).toEqual([]);
});
test('short and long preview/play only submit presentation requests',async({page})=>{
 for(const [kind,name] of [['short','短休'],['long','长休']])for(const preview of [true,false]){
  await button(page,name).click();await button(page,preview?'自己预览':'播放转场').click();
  await expect.poll(async()=>(await requests(page)).at(-1)).toMatchObject({type:'console',action:'transitions',kind,preview});await expect(button(page,'播放转场')).toBeEnabled();
 }
 const sent=await requests(page);expect(sent).toHaveLength(4);expect(sent.every((r:any)=>r.type==='console'&&r.action==='transitions'&&!r.operation&&!r.data&&!r.statPatch)).toBe(true);
});
test('same-turn duplicate clicks and pending actions submit once',async({page})=>{
 await page.evaluate(()=>(window as any).hold=true);
 await button(page,'播放转场').evaluate(b=>{b.dispatchEvent(new MouseEvent('click',{bubbles:true}));b.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
 await expect.poll(async()=>(await requests(page)).length).toBe(1);await expect(button(page,'自己预览')).toBeDisabled();
 await page.evaluate(()=>{const w=window as any;w.reply(w.requests[0]);});await expect(button(page,'播放转场')).toBeEnabled();expect(await requests(page)).toHaveLength(1);
});
test('failure releases the lock; only an explicit retry submits again',async({page})=>{
 await page.evaluate(()=>(window as any).hold=true);await button(page,'长休').click();await button(page,'播放转场').click();await expect.poll(async()=>(await requests(page)).length).toBe(1);
 await page.evaluate(()=>{const w=window as any;w.reply(w.requests[0],'转场未能启动');});await expect(page.getByRole('alert')).toContainText('转场未能启动');await expect(button(page,'播放转场')).toBeEnabled();expect(await requests(page)).toHaveLength(1);
 await button(page,'自己预览').click();await expect.poll(async()=>(await requests(page)).length).toBe(2);
});
test('custom text, fallback, player role and module gates are preserved',async({page})=>{
 await button(page,'文字').click();await panel(page).getByLabel('转场文字').fill('翌日清晨');await button(page,'自己预览').click();await expect.poll(async()=>(await requests(page)).at(-1)).toMatchObject({kind:'text',text:'翌日清晨',preview:true});
 await panel(page).getByLabel('转场文字').fill(' ');await button(page,'播放转场').click();await expect.poll(async()=>(await requests(page)).at(-1)).toMatchObject({kind:'text',text:'经过了一段时间...',preview:false});
 await page.evaluate(()=>(window as any).refresh('PLAYER'));await expect(panel(page)).toHaveCount(0);await page.evaluate(()=>(window as any).refresh('GM',false));await expect(panel(page)).toHaveCount(0);expect(await requests(page)).toHaveLength(2);
});
test('320/390px layouts keep choices and actions visible and clickable',async({page})=>{
 for(const width of [390,320]){await page.setViewportSize({width,height:844});for(const name of ['短休','长休','文字','自己预览','播放转场']){await expect(button(page,name)).toBeVisible();const r=(await button(page,name).boundingBox())!;expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(width);}await button(page,'长休').click();await expect(button(page,'长休')).toHaveAttribute('aria-pressed','true');await page.screenshot({path:test.info().outputPath(`transition-long-${width}.png`)});}
});
