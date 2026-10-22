import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';

async function saved(page:Page){return page.evaluate(async()=>{
 const p='/card/src/platform/workspaceIdentity.ts',name=(await import(p)).workspaceIdentity.database;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{return await new Promise<any>((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}
});}
async function start(page:Page){
 await mockSource(page,{displayMode:'screen'});await suppressAnnouncement(page);await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'isolated local test'}}));
 await page.goto('/card/?intro=0');await expect(page.locator('.paper[data-active-sheet="true"]')).toBeVisible();await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.evaluate(async()=>{
  const p='/card/src/platform/workspaceIdentity.ts',name=(await import(p)).workspaceIdentity.database;
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const tx=db.transaction('documents','readwrite'),store=tx.objectStore('documents'),get=store.get('workspace');get.onsuccess=()=>{const w=get.result,original=w.characters.find((c:any)=>c.id===w.activeId);w.characters=[0,1,2].map(i=>({...structuredClone(original),id:'retained-'+i,name:'保留卡面'+i,notes:'独立笔记'+i,runtime:{...structuredClone(original.runtime),hp:7+i}}));w.activeId='retained-0';store.put(w,'workspace');};await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
 });await page.reload();await expect(page.locator('.paper[data-active-sheet="true"]')).toHaveAttribute('data-character-id','retained-0');await expect(page.locator('.save-status')).toContainText('已保存到本机');
}
async function choose(page:Page,i:number){await page.locator('.character-tabs').getByRole('tab',{name:'保留卡面'+i,exact:true}).click();await expect(page.locator('.paper[data-active-sheet="true"]')).toHaveAttribute('data-character-id','retained-'+i);}

test('a warmed card keeps its actual DOM while another card is visible and returns without replacing its fields',async({page})=>{
 await start(page);const before=await saved(page);
 await page.evaluate(()=>{(window as any).retainedFirst={paper:document.querySelector('.paper[data-active-sheet="true"]'),field:document.querySelector('.paper[data-active-sheet="true"] input'),children:[...document.querySelector('.paper[data-active-sheet="true"]')!.querySelectorAll('*')]};});
 await choose(page,1);
 expect(await page.evaluate(()=>({identity:(window as any).retainedFirst.paper.dataset.characterId,connected:(window as any).retainedFirst.paper.isConnected,clipped:getComputedStyle((window as any).retainedFirst.paper.closest('.retained-card-root')).clipPath==='inset(50%)',hidden:(window as any).retainedFirst.paper.closest('.retained-card-root').getAttribute('aria-hidden'),width:(window as any).retainedFirst.paper.getBoundingClientRect().width>0}))).toEqual({identity:'retained-0',connected:true,clipped:true,hidden:'true',width:true});
 await choose(page,2);await choose(page,1);await choose(page,0);
 const missing=await page.evaluate(()=>{const p=(window as any).retainedFirst;return p.children.filter((node:Element)=>!p.paper.contains(node)).map((node:Element)=>({tag:node.tagName,class:node.getAttribute('class'),text:node.textContent?.slice(0,100)}));});
 expect(await page.evaluate(()=>{const p=(window as any).retainedFirst;return {samePaper:p.paper===document.querySelector('.paper[data-active-sheet="true"]'),sameField:p.field===document.querySelector('.paper[data-active-sheet="true"] input'),sameChildren:p.children.every((node:Element)=>p.paper.contains(node)),opacity:getComputedStyle(p.paper).opacity};}),JSON.stringify(missing)).toEqual({samePaper:true,sameField:true,sameChildren:true,opacity:'1'});
 await expect(page.locator('.paper[data-active-sheet="true"]')).toHaveCount(1);await expect(page.locator('.paper')).toHaveCount(3);expect((await saved(page)).characters).toEqual(before.characters);
 await page.screenshot({path:test.info().outputPath('retained-return-main.png')});
});

test('switching after a real field edit preserves the edited owner and refresh recovery',async({page})=>{
 await start(page);await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 const hp=page.locator('.paper[data-active-sheet="true"]').getByLabel('当前生命值',{exact:true});await expect(hp).toBeVisible();await hp.fill('4');await hp.press('Enter');
 await choose(page,1);await choose(page,2);await choose(page,0);await expect(hp).toHaveValue('4');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 const w=await saved(page);expect(w.characters.map((c:any)=>c.runtime.hp)).toEqual([4,8,9]);await page.reload();await expect(page.locator('.paper[data-active-sheet="true"]')).toHaveAttribute('data-character-id','retained-0');expect((await saved(page)).characters.map((c:any)=>c.runtime.hp)).toEqual([4,8,9]);
});

test('an inactive old field cannot write its delayed blur into the newly active card',async({page})=>{
 await start(page);await page.getByRole('switch',{name:'编辑模式',exact:true}).click();
 await page.evaluate(()=>{(window as any).oldHp=document.querySelector('[aria-label="当前生命值"]');});
 await choose(page,1);
 await page.evaluate(()=>{const input=(window as any).oldHp;input.value='2';input.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));});
 await expect(page.locator('.save-status')).toContainText('已保存到本机');expect((await saved(page)).characters.map((c:any)=>c.runtime.hp)).toEqual([7,8,9]);
});

test('catalog refresh updates the active view without discarding its retained paper',async({page})=>{
 await start(page);await choose(page,1);await page.evaluate(()=>{(window as any).refreshPaper=document.querySelector('.paper[data-active-sheet="true"]');});
 const refresh=page.getByRole('button',{name:'更新资料',exact:true});await expect(refresh).toBeEnabled();await refresh.click();await expect(refresh).toBeEnabled();
 expect(await page.evaluate(()=>(window as any).refreshPaper===document.querySelector('.paper[data-active-sheet="true"]'))).toBe(true);await choose(page,0);await choose(page,1);await expect(page.locator('.paper[data-active-sheet="true"]')).toHaveAttribute('data-character-id','retained-1');
});

test('temporary A4 capture changes the active card only and keeps another warmed card intact',async({page})=>{
 await start(page);await page.evaluate(()=>{const paper=document.querySelector('.paper[data-active-sheet="true"]')!;(window as any).captureOriginal={paper,children:[...paper.querySelectorAll('*')]};});await choose(page,1);
 await page.evaluate(async()=>{const path='/card/src/ui/sheetDisplay.ts';(window as any).releaseCapture=(await import(path)).beginSheetCapture();});
 await expect(page.locator('.sheet-viewport:has(.paper[data-active-sheet="true"])')).toHaveAttribute('data-sheet-display','a4');
 expect(await page.evaluate(()=>(window as any).captureOriginal.paper.closest('.sheet-viewport').dataset.sheetDisplay)).toBe('screen');
 await page.evaluate(()=>(window as any).releaseCapture());await expect(page.locator('.sheet-viewport:has(.paper[data-active-sheet="true"])')).toHaveAttribute('data-sheet-display','screen');await choose(page,0);
 expect(await page.evaluate(()=>{const old=(window as any).captureOriginal;return old.paper===document.querySelector('.paper[data-active-sheet="true"]')&&old.children.every((node:Element)=>old.paper.contains(node));})).toBe(true);
});

test('switching closes the old card trace panel and preserves both base scores',async({page})=>{
 await start(page);await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await page.locator('.paper[data-active-sheet="true"]').getByLabel('力量基础值',{exact:true}).click();
 await expect(page.getByRole('dialog',{name:'力量数据追溯',exact:true})).toBeVisible();await choose(page,1);await expect(page.getByRole('dialog',{name:'力量数据追溯',exact:true})).toHaveCount(0);await choose(page,0);
 expect((await saved(page)).characters.map((c:any)=>c.abilities.str)).toEqual([10,10,10]);
});

test('inactive connected fields reject focus and synthetic input while normal Tab navigation reaches the current card',async({page})=>{
 await start(page);await page.getByRole('switch',{name:'编辑模式',exact:true}).click();await choose(page,1);await choose(page,2);await choose(page,1);
 expect(await page.evaluate(()=>{const old=document.querySelector<HTMLInputElement>('.paper[data-character-id="retained-0"] [aria-label="当前生命值"]')!;old.focus();old.value='1';old.dispatchEvent(new Event('input',{bubbles:true}));old.dispatchEvent(new Event('change',{bubbles:true}));return !!document.activeElement?.closest('[data-retained-card-active="false"]');})).toBe(false);
 await expect(page.locator('.save-status')).toContainText('已保存到本机');expect((await saved(page)).characters.map((c:any)=>c.runtime.hp)).toEqual([7,8,9]);
 await page.locator('.character-tabs [aria-selected="true"]').focus();let reached=false;
 for(let i=0;i<45;i++){await page.keyboard.press('Tab');const state=await page.evaluate(()=>({hidden:!!document.activeElement?.closest('[data-retained-card-active="false"]'),current:!!document.activeElement?.closest('.paper[data-character-id="retained-1"]')}));expect(state.hidden).toBe(false);reached||=state.current;}
 expect(reached).toBe(true);
 for(let i=0;i<20;i++){await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('[data-retained-card-active="false"]'))).toBe(false);}
});

test('export targeting follows the current card rather than the first connected paper',async({page})=>{
 await start(page);await choose(page,1);await choose(page,2);
 expect(await page.evaluate(async()=>{const p='/card/src/platform/activeSheet.ts';return (await import(p)).activeSheet()?.dataset.characterId;})).toBe('retained-2');
 await choose(page,1);expect(await page.evaluate(async()=>{const p='/card/src/platform/activeSheet.ts';return (await import(p)).activeSheet()?.dataset.characterId;})).toBe('retained-1');
});

test('shared App context updates do not render warmed card subscribers; own edits and receipts remain live',async({page})=>{
 await page.goto('/card/tests/fixtures/retained-contexts/index.html');
 const choose=async(id:string)=>{await page.getByRole('button',{name:id,exact:true}).click();await expect(page.locator('[data-retained-card-active="true"] [data-context-owner]')).toHaveAttribute('data-context-owner',id);};
 await choose('b');await choose('c');await choose('a');
 await expect(page.locator('[data-shared-nested] [data-nested-choice]')).toHaveText('nested choice');await expect(page.locator('[data-retained-card-active="true"] [data-nested-choice]')).toHaveText('nested choice');
 const counts=()=>page.evaluate(()=>({...((window as any).contextRegressionCounts)}));const before=await counts();
 for(const id of ['b','c','b','a','b','c','b','a'])await choose(id);
 const after=await counts();for(const id of ['a','b','c'])expect(after[id],id).toBe(before[id]);expect(after.shared).toBeGreaterThan(before.shared);
 await page.evaluate(()=>window.dispatchEvent(new Event('retained-fixture-read')));
 expect(await page.evaluate(()=>[...document.querySelectorAll('.retained-card-root')].map(host=>({owner:host.querySelector('[data-context-owner]')?.getAttribute('data-context-owner'),read:host.querySelector('[data-retained-read]')?.textContent})).every(row=>row.owner===row.read))).toBe(true);
 await page.getByRole('button',{name:'receipt',exact:true}).click();const receipt=await counts();expect(receipt['feedback:a']).toBeGreaterThan(after['feedback:a']);expect(receipt['feedback:b']).toBe(after['feedback:b']);expect(receipt['feedback:c']).toBe(after['feedback:c']);
 await page.getByRole('button',{name:'edit',exact:true}).click();await expect(page.locator('[data-retained-card-active="true"] [data-context-owner]')).toContainText('a original changed');const edited=await counts();expect(edited.a).toBeGreaterThan(after.a);expect(edited.b).toBe(after.b);expect(edited.c).toBe(after.c);
});

test('the real background catalog reader completes, reuses its cache and performs no cache writes on the page thread',async({page})=>{
 await page.addInitScript(()=>{
  const meter={started:0,completed:0,batches:0,cacheWrites:0};(window as any).catalogWorkerMeter=meter;
  const Native=Worker;(window as any).Worker=new Proxy(Native,{construct(target,args){const worker=new target(...args as [string|URL,WorkerOptions?]);if(String(args[0]).includes('catalogReader.worker')){meter.started++;worker.addEventListener('message',event=>{if(event.data?.type==='done')meter.completed++;if(event.data?.type==='batch')meter.batches++;});}return worker;}});
  const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){if(this.name==='cache')meter.cacheWrites++;return put.apply(this,args);};
 });
 await start(page);await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await expect.poll(()=>page.evaluate(()=>(window as any).catalogWorkerMeter.completed)).toBe(1);
 const first=await page.evaluate(()=>(window as any).catalogWorkerMeter);expect(first.started).toBe(1);expect(first.batches).toBeGreaterThan(0);expect(first.cacheWrites).toBe(0);
 const before=await saved(page);await page.reload();await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();await expect.poll(()=>page.evaluate(()=>(window as any).catalogWorkerMeter.completed)).toBe(1);
 expect((await saved(page)).characters).toEqual(before.characters);expect(await page.evaluate(()=>(window as any).catalogWorkerMeter.cacheWrites)).toBe(0);
});

test('hidden card animations pause and resume without scanning every warmed sheet again',async({page})=>{
 await page.addInitScript(()=>{(window as any).retainedAnimationScans=0;const original=Element.prototype.getAnimations;Element.prototype.getAnimations=function(options?:GetAnimationsOptions){if(options?.subtree&&this.classList.contains('retained-card-root'))(window as any).retainedAnimationScans++;return original.call(this,options);};});
 await page.goto('/card/tests/fixtures/retained-contexts/index.html');
 for(const id of ['b','c','a'])await page.getByRole('button',{name:id,exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).retainedAnimationScans)).toBe(3);
 await page.getByRole('button',{name:'b',exact:true}).click();
 const animation=()=>page.evaluate(()=>{const animation=document.querySelector('[data-owned-animation="a"]')!.getAnimations()[0];return {state:animation.playState,time:Number(animation.currentTime)};});
 await expect.poll(async()=>(await animation()).state).toBe('paused');const paused=await animation();await page.waitForTimeout(100);expect((await animation()).time).toBe(paused.time);
 await page.getByRole('button',{name:'a',exact:true}).click();await expect.poll(async()=>(await animation()).state).toBe('running');expect((await animation()).time).toBeGreaterThanOrEqual(paused.time);
 for(const id of ['c','b','a'])await page.getByRole('button',{name:id,exact:true}).click();expect(await page.evaluate(()=>(window as any).retainedAnimationScans)).toBe(3);
});

test('retained read actions use current committed reader state and ignore another card stale callback',async({page})=>{
 await page.goto('/card/tests/fixtures/retained-contexts/index.html');await page.getByRole('button',{name:'receipt',exact:true}).click();await page.locator('[data-retained-card-active="true"] [data-owner-action]').click();
 expect(await page.evaluate(()=>(window as any).fixtureOwnerActionCalls)).toEqual([{owner:'a',receipt:'saving',name:'a original'}]);
 await page.getByRole('button',{name:'b',exact:true}).click();await page.evaluate(()=>(window as any).fixtureOwnerActions.a());expect(await page.evaluate(()=>(window as any).fixtureOwnerActionCalls.length)).toBe(1);
 await page.getByRole('button',{name:'a',exact:true}).click();await page.getByRole('button',{name:'edit',exact:true}).click();await page.evaluate(()=>(window as any).fixtureOwnerActions.a());expect(await page.evaluate(()=>(window as any).fixtureOwnerActionCalls.at(-1))).toEqual({owner:'a',receipt:'saving',name:'a original changed'});
});

test('permission changes discard only the affected owner and removed or least recent cards release their hosts',async({page})=>{
 await page.goto('/card/tests/fixtures/retained-contexts/index.html');
 const choose=async(id:string)=>{await page.getByRole('button',{name:id,exact:true}).click();await expect(page.locator('[data-retained-card-active="true"] [data-context-owner]')).toHaveAttribute('data-context-owner',id);};
 for(const id of ['b','c','a'])await choose(id);
 await page.evaluate(()=>{(window as any).permissionHosts=Object.fromEntries([...document.querySelectorAll('.retained-card-root')].map(host=>[host.querySelector('[data-context-owner]')!.getAttribute('data-context-owner'),host]));});
 await page.getByRole('button',{name:'permission c',exact:true}).click();
 expect(await page.evaluate(()=>{const h=(window as any).permissionHosts;return {a:h.a.isConnected,b:h.b.isConnected,c:h.c.isConnected};})).toEqual({a:true,b:true,c:false});
 await choose('c');expect(await page.evaluate(()=>(window as any).permissionHosts.c===document.querySelector('[data-retained-card-active="true"]'))).toBe(false);
 await choose('a');await page.getByRole('button',{name:'more cards',exact:true}).click();for(const id of ['d','e'])await choose(id);
 await expect(page.locator('.retained-card-root')).toHaveCount(4);expect(await page.evaluate(()=>(window as any).permissionHosts.b.isConnected)).toBe(false);
 await choose('b');await choose('a');await page.getByRole('button',{name:'remove b',exact:true}).click();
 await expect(page.locator('.retained-card-root [data-context-owner="b"]')).toHaveCount(0);await expect(page.locator('[data-retained-card-active="true"] [data-context-owner]')).toHaveAttribute('data-context-owner','a');
});

test('background source invalidation eventually refreshes coherent retained contents while real edits and save receipts remain current',async({page})=>{
 await page.goto('/card/tests/fixtures/retained-contexts/index.html');
 for(const id of ['b','a'])await page.getByRole('button',{name:id,exact:true}).click();
 await page.evaluate(()=>{(window as any).sourceHost=document.querySelector('[data-retained-card-active="true"]');});
 await page.getByRole('button',{name:'source update',exact:true}).click();
 const active=page.locator('[data-retained-card-active="true"]');await expect(active.locator('[data-context-owner]')).toHaveText('a:a original source1');await expect(active.locator('[data-render-source]')).toHaveText('1');
 await page.getByRole('button',{name:'edit',exact:true}).click();await expect(active.locator('[data-context-owner]')).toHaveText('a:a original changed source1');
 await page.getByRole('button',{name:'receipt',exact:true}).click();await expect(active.locator('[data-feedback-owner]')).toHaveText('saving');
 for(const id of ['b','a'])await page.getByRole('button',{name:id,exact:true}).click();
 await expect(active.locator('[data-context-owner]')).toHaveText('a:a original changed source1');await expect(active.locator('[data-render-source]')).toHaveText('1');
 expect(await page.evaluate(()=>(window as any).sourceHost===document.querySelector('[data-retained-card-active="true"]'))).toBe(true);
});
