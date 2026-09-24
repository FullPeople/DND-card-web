import {test,expect,type Page} from '@playwright/test';
async function linked(page:Page){
 await page.goto('/demo.html');const panel=page.frameLocator('#panel');await expect(panel.getByRole('button',{name:'打开联动角色卡'})).toBeEnabled();
 await panel.getByText('测试选项',{exact:true}).click();await panel.locator('#target').fill('http://localhost:5189/card.html');const popup=page.waitForEvent('popup');await panel.getByRole('button',{name:'打开联动角色卡'}).click();const card=await popup;
 await expect(card.locator('#status')).toContainText('已连接');await expect(card.getByLabel('当前生命值')).toHaveValue('20');return card;
}
test('cross-origin popup remains linked after the sandboxed launcher is destroyed and the card reloads',async({page})=>{
 const card=await linked(page);expect(new URL(card.url()).origin).toBe('http://localhost:5189');expect(new URL(page.frames().find(f=>f.url().includes('background.html'))!.url()).origin).toBe('http://127.0.0.1:5189');
 await card.getByRole('button',{name:'−1',exact:true}).click();await expect(page.locator('#scene-state')).toHaveText('生命 19 / 20');await page.locator('#scene-hp').fill('13');await page.locator('#scene-write').click();await expect(card.getByLabel('当前生命值')).toHaveValue('13');
 await page.getByRole('button',{name:'关闭入口面板'}).click();await card.getByRole('button',{name:'＋1',exact:true}).click();await expect(page.locator('#scene-state')).toHaveText('生命 14 / 20');
 await card.reload();await expect(card.locator('#status')).toContainText('已连接');await expect(card.getByLabel('当前生命值')).toHaveValue('14');await card.getByLabel('当前生命值').fill('9');await card.getByRole('button',{name:'应用数值'}).click();await expect(page.locator('#scene-state')).toHaveText('生命 9 / 20');await card.close();
});
test('host reload stops writes and a fresh link uses fresh state, never the stale child',async({page})=>{
 const card=await linked(page);await page.reload();await expect(card.locator('#status')).toContainText('连接已断开');await expect(card.getByLabel('当前生命值')).toBeDisabled();
 const panel=page.frameLocator('#panel');await expect(panel.getByRole('button',{name:'打开联动角色卡'})).toBeEnabled();const popup=page.waitForEvent('popup');await panel.getByRole('button',{name:'打开联动角色卡'}).click();const next=await popup;await expect(next.locator('#status')).toContainText('已连接');await next.getByRole('button',{name:'−1',exact:true}).click();await expect(page.locator('#scene-state')).toHaveText('生命 19 / 20');await expect(card.getByLabel('当前生命值')).toBeDisabled();await next.close();await card.close();
});
test('deleted scene and revoked permissions terminate an active link',async({page})=>{
 for(const button of ['模拟切换场景','撤销操作权限']){const card=await linked(page);await page.getByRole('button',{name:button}).click();await expect(card.locator('#status')).toContainText(button==='模拟切换场景'?'场景已切换':'权限已撤销');await expect(card.getByLabel('当前生命值')).toBeDisabled();await card.close();}
});
test('duplicate and stale edits cannot consume HP twice; wrong window, origin and token cannot write',async({page})=>{
 const card=await linked(page);await card.evaluate(()=>{window.addEventListener('message',e=>{if(e.origin==='http://127.0.0.1:5189'&&e.data?.type==='state')(window as any).testHost=e.source;});});await expect.poll(()=>card.evaluate(()=>!!(window as any).testHost)).toBe(true);
 const raw=async(extra:Record<string,unknown>)=>card.evaluate(extra=>{const session=new URLSearchParams(location.hash.slice(1)).get('session');(window as any).testHost.postMessage({protocol:'dnd-card-window-probe/v1',type:'change',session,operationId:'duplicate-test',baseRevision:0,mode:'delta',value:-3,...extra},'http://127.0.0.1:5189');},extra);
 await raw({});await expect(page.locator('#scene-state')).toHaveText('生命 17 / 20');await raw({});await card.waitForTimeout(180);await expect(page.locator('#scene-state')).toHaveText('生命 17 / 20');
 await raw({operationId:'stale-test'});await expect(card.locator('#status')).toContainText('生命值已变化');await expect(page.locator('#scene-state')).toHaveText('生命 17 / 20');
 await raw({session:'incorrect-session',operationId:'wrong-token',baseRevision:1,value:900});
 const hash=new URL(card.url()).hash;const impostor=await page.context().newPage();await impostor.goto('http://localhost:5189/card.html'+hash);await impostor.evaluate(()=>{(window as any).fakeMessages=0;window.addEventListener('message',()=>{(window as any).fakeMessages++;});});
 // Same child origin, different WindowProxy. An iframe cannot impersonate the linked popup.
 const session=new URLSearchParams(hash.slice(1)).get('session');await page.evaluate(session=>{const target=(document.getElementById('bridge') as HTMLIFrameElement).contentWindow!;target.postMessage({protocol:'dnd-card-window-probe/v1',type:'change',session,operationId:'wrong-source',baseRevision:1,mode:'set',value:900},'http://127.0.0.1:5189');},session);
 await page.frameLocator('#panel').locator('body').evaluate((_,session)=>{parent.frames[0].postMessage({protocol:'dnd-card-window-probe/v1',type:'change',session,operationId:'wrong-origin',baseRevision:1,mode:'set',value:900},'http://127.0.0.1:5189');},session);
 await page.waitForTimeout(250);await expect(page.locator('#scene-state')).toHaveText('生命 17 / 20');await card.getByRole('button',{name:'断开连接',exact:true}).click();await expect(card.getByLabel('当前生命值')).toBeDisabled();await raw({operationId:'after-disconnect',baseRevision:1});await page.waitForTimeout(150);await expect(page.locator('#scene-state')).toHaveText('生命 17 / 20');await card.close();await impostor.close();
});
test('copied link does not silently attach; blocked popups report the problem',async({page})=>{
 await page.goto('/card.html');await expect(page.locator('#status')).toContainText('请从枭熊');await expect(page.locator('#hp')).toBeDisabled();
 await page.goto('/demo.html');const panel=page.frameLocator('#panel');await expect(panel.locator('#open')).toBeEnabled();await panel.locator('body').evaluate(()=>{window.open=()=>null;});await panel.locator('#open').click();await expect(panel.locator('#status')).toContainText('拦截了窗口');
});
