import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';

async function ready(page:Page){
 await mockSource(page);await suppressAnnouncement(page);
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local test'}}));
 await page.goto('/card/?intro=0');
 await expect(page.locator('html')).toHaveAttribute('data-card-startup','complete');
 await expect(page.locator('.workspace-splitter')).toBeVisible();
}

test('workspace divider coalesces a burst, ignores other pointers and saves final release coordinates',async({page},info)=>{
 await ready(page);
 const handle=page.locator('.workspace-splitter');
 await handle.evaluate(node=>node.addEventListener('pointerdown',event=>{(window as any).sprintPointer=(event as PointerEvent).pointerId;},{once:true}));
 const box=(await handle.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+30);await page.mouse.down();
 const result=await page.evaluate(async()=>{
  const divider=document.querySelector<HTMLElement>('.workspace-splitter')!,workspace=divider.parentElement!,box=workspace.getBoundingClientRect(),original=workspace.getBoundingClientRect.bind(workspace);
  let reads=0;workspace.getBoundingClientRect=()=>{reads++;return original();};
  const pointerId=(window as any).sprintPointer;
  divider.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:pointerId+1,clientX:box.left+box.width*.8}));
  divider.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:pointerId+1}));
  for(let i=0;i<100;i++)divider.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId,clientX:box.left+box.width*(.4+i*.002)}));
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  const dragReads=reads;
  divider.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId,clientX:box.left+box.width*.62}));
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  workspace.getBoundingClientRect=original;
  return {dragReads,stored:localStorage.getItem('dnd-card:workspace-split'),hidden:workspace.dataset.hiddenSide};
 });
 await page.mouse.up();
 expect(result.dragReads).toBeLessThanOrEqual(2);expect(Number(result.stored)).toBeCloseTo(.62,4);expect(result.hidden).toBeUndefined();
 await expect(handle).toHaveAttribute('aria-valuenow','62');
 await info.attach('workspace-pointer-burst.json',{body:JSON.stringify({events:100,...result},null,2),contentType:'application/json'});
 await page.reload();await expect(handle).toHaveAttribute('aria-valuenow','62');
});

test('Escape cancels an unpainted divider movement without hiding or saving it',async({page})=>{
 await ready(page);const handle=page.locator('.workspace-splitter'),initial=await handle.getAttribute('aria-valuenow');
 await handle.evaluate(node=>node.addEventListener('pointerdown',event=>{(window as any).sprintPointer=(event as PointerEvent).pointerId;},{once:true}));
 const box=(await handle.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+30);await page.mouse.down();
 await handle.evaluate(node=>{
  node.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:(window as any).sprintPointer,clientX:0}));
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 });
 await page.mouse.up();await expect(handle).toHaveAttribute('aria-valuenow',initial!);
 await expect(page.locator('.workspace-hide-preview')).toHaveCount(0);await expect(page.locator('.workspace')).not.toHaveAttribute('data-hidden-side');
 await page.reload();await expect(handle).toHaveAttribute('aria-valuenow',initial!);
});

test('cancelling a character-strip drag preserves subsequent keyboard activation',async({page})=>{
 await ready(page);await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.evaluate(async()=>{
  const path='/card/src/platform/workspaceIdentity.ts',name=(await import(path)).workspaceIdentity.database;
  const db=await new Promise<IDBDatabase>(resolve=>{const request=indexedDB.open(name);request.onsuccess=()=>resolve(request.result);});
  const tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents'),request=store.get('workspace');
  request.onsuccess=()=>{const workspace=request.result,source=workspace.characters[0];workspace.characters=[0,1,2].map(i=>({...structuredClone(source),id:'sprint-'+i,name:'操作检查 '+i}));workspace.activeId='sprint-0';store.put(workspace,'workspace');};
  await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
 });
 await page.reload();const strip=page.locator('.character-tabs');
 await expect(strip.getByRole('tab',{name:'操作检查 0',exact:true})).toBeVisible();
 await strip.evaluate(node=>node.addEventListener('pointerdown',event=>{(window as any).sprintPointer=(event as PointerEvent).pointerId;},{once:true}));
 const box=(await strip.boundingBox())!;await page.mouse.move(box.x+30,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+60,box.y+box.height/2);
 await strip.dispatchEvent('pointercancel',{pointerId:await page.evaluate(()=>(window as any).sprintPointer)});
 await page.mouse.move(20,20);await page.mouse.up();
 const target=strip.getByRole('tab',{name:'操作检查 1',exact:true});await target.focus();await page.keyboard.press('Enter');
 await expect(target).toHaveAttribute('aria-selected','true');await expect(strip).not.toHaveClass(/is-dragging/);
 await expect(page.locator('.paper[data-active-sheet="true"]')).toHaveAttribute('data-character-id','sprint-1');
});
