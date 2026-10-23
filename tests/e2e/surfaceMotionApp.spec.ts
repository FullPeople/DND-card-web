import {test,expect,type Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {mockSource,suppressAnnouncement} from './fixtures';

const first='surface-app-a',second='surface-app-b';
async function stored(page:Page){return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('dnd-card-standalone');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{return await new Promise<any>((resolve,reject)=>{const transaction=db.transaction('documents'),store=transaction.objectStore('documents'),workspace=store.get('workspace'),active=store.get('workspace-active-id'),keys=store.getAllKeys();transaction.oncomplete=()=>resolve({workspace:workspace.result,active:active.result,keys:keys.result});transaction.onerror=()=>reject(transaction.error);});}finally{db.close();}
});}
async function start(page:Page,displayMode:'screen'|'a4'){
 await page.context().route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin==='http://127.0.0.1:5490'||['5e.kiwee.top','homebrew.kiwee.top'].includes(url.hostname))return route.continue();
  return route.abort('blockedbyclient');
 });
 await mockSource(page,{displayMode});await suppressAnnouncement(page);
 await page.addInitScript(()=>{
  const state:any={records:[],switchTo:undefined,cross:undefined,errors:[]};(window as any).__surfaceApp=state;
  const frame=(node:HTMLElement,animation?:Animation)=>({at:performance.now(),id:node.dataset.characterId,page:[...node.classList].find(value=>/^page-\d+$/.test(value)),opacity:Number(getComputedStyle(node).opacity),surfaceMotion:node.dataset.surfaceMotion||null,oldPlayState:animation?.playState,
    ownAnimations:node.getAnimations().map(item=>({playState:item.playState,keyframes:(item.effect as KeyframeEffect)?.getKeyframes().map(value=>({opacity:value.opacity}))}))});
  const original=Element.prototype.animate;
  Element.prototype.animate=function(keyframes,options){
   const animation=original.call(this,keyframes,options);if(!(this instanceof HTMLElement)||!this.matches('.paper'))return animation;
   const node=this,record:any={id:node.dataset.characterId,page:[...node.classList].find(value=>/^page-\d+$/.test(value)),keyframes:(animation.effect as KeyframeEffect).getKeyframes().map(value=>({opacity:value.opacity})),duration:(animation.effect as KeyframeEffect).getTiming().duration,synchronous:frame(node),finished:false,cancelled:false};
   state.records.push(record);animation.addEventListener('finish',()=>{record.finished=true;});animation.addEventListener('cancel',()=>{record.cancelled=true;});
   requestAnimationFrame(()=>{
    record.firstFrame=frame(node);
    if(!state.switchTo)return;
    const target=state.switchTo;state.switchTo=undefined;state.cross={beforeSwitch:frame(node,animation),target};
    const observer=new MutationObserver(()=>{
     const active=document.querySelector<HTMLElement>('.paper[data-active-sheet="true"]');
     if(!active||active.dataset.characterId!==target)return;observer.disconnect();
     state.cross.oldPaperRetained=node.isConnected&&node.dataset.characterId===record.id;
     state.cross.distinctActivePaper=active!==node;
     requestAnimationFrame(()=>{state.cross.firstNewFrame=frame(active,animation);requestAnimationFrame(()=>{state.cross.secondNewFrame=frame(active,animation);});});
    });observer.observe(node.closest('.retained-card-stack')!,{subtree:true,childList:true,attributes:true,attributeFilter:['data-active-sheet','data-retained-card-active','data-character-id']});
    const tab=[...document.querySelectorAll<HTMLButtonElement>('.character-tabs [role="tab"]')].find(button=>button.textContent==='卡面动效乙');
    if(!tab||tab.disabled){state.errors.push('Target authored card tab unavailable');observer.disconnect();return;}
    // Use the real App tab handler in the first live animation frame, without pausing or extending the animation.
    tab.click();
   });
   return animation;
  };
 });
 const status=await(await page.request.get('/__motion/status')).json();expect(status.profile.cloudFeaturesEnabled).toBe(true);expect(status.cloudForwarding).toBe(false);
 await page.goto('/card/?intro=0');await expect(page.locator('.paper')).toBeVisible();await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.goto('/__motion/blank');await page.evaluate(async({first,second})=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('dnd-card-standalone');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const transaction=db.transaction('documents','readwrite'),store=transaction.objectStore('documents'),read=store.get('workspace');read.onsuccess=()=>{
   const workspace=read.result,original=workspace.characters.find((card:any)=>card.id===workspace.activeId),alpha=structuredClone(original),beta=structuredClone(original);
   alpha.id=first;alpha.name='卡面动效甲';alpha.runtime.hp=3;alpha.runtime.resources.surfaceSpent={name:'动效验收已消耗资源',current:1,max:5};
   beta.id=second;beta.name='卡面动效乙';beta.runtime.hp=7;beta.runtime.resources.surfaceSpent={name:'动效验收已消耗资源',current:2,max:5};
   workspace.characters=[alpha,beta];workspace.activeId=first;store.delete('workspace-active-id');store.put(workspace,'workspace');
  };await new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);});db.close();
 },{first,second});
 await page.goto('/card/?intro=0');await expect(page.locator('.paper')).toHaveAttribute('data-character-id',first);await expect(page.locator('.sheet-viewport')).toHaveAttribute('data-sheet-display',displayMode);await expect(page.locator('.save-status')).toContainText('已保存到本机');
 // Warm the actual lazy page, then finish the return fade before arming the observed transition.
 await page.locator('[data-sheet-tab="特性"]').click();await expect(page.locator('.features-page-grid')).toBeVisible();await expect(page.locator('.paper')).not.toHaveAttribute('data-surface-motion','entering');
 await page.locator('[data-sheet-tab="主要"]').click();await expect(page.locator('.overview-sheet')).toBeVisible();await expect(page.locator('.paper')).not.toHaveAttribute('data-surface-motion','entering');
 await page.evaluate(()=>{const state=(window as any).__surfaceApp;state.records=[];});
 return {before:(await stored(page)).workspace.characters,status};
}
async function evidence(page:Page,name:string){
 const value=await page.evaluate(()=>({records:(window as any).__surfaceApp.records,cross:(window as any).__surfaceApp.cross,errors:(window as any).__surfaceApp.errors}));
 writeFileSync(test.info().outputPath(name+'.json'),JSON.stringify(value,null,2));await test.info().attach(name,{body:JSON.stringify(value,null,2),contentType:'application/json'});return value;
}
async function unchanged(page:Page,before:unknown){
 await expect(page.locator('.save-status')).toContainText('已保存到本机');const after=await stored(page);expect(after.workspace.characters).toEqual(before);expect(after.keys.some((key:any)=>typeof key==='string'&&key.startsWith('cloud-binding:'))).toBe(false);
 const status=await(await page.request.get('/__motion/status')).json();expect(status.cloudForwarding).toBe(false);expect(status.counters.write).toBe(0);
}

for(const mode of ['screen','a4'] as const){
 test(`formal cloud App ${mode}: same-card page navigation retains its real fade`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));const {before,status}=await start(page,mode);
  await test.info().attach('formal-cloud-build',{body:JSON.stringify(status,null,2),contentType:'application/json'});
  await page.locator('[data-sheet-tab="特性"]').click();await expect.poll(()=>page.evaluate(()=>(window as any).__surfaceApp.records[0]?.firstFrame)).toBeTruthy();
  let result=await evidence(page,'same-card-first-frame');expect(result.records).toHaveLength(1);const motion=result.records[0];
  expect(motion.id).toBe(first);expect(motion.page).toBe('page-1');expect(motion.keyframes.map((value:any)=>Number(value.opacity))).toEqual([.78,1]);expect(motion.duration).toBe(180);expect(motion.firstFrame.opacity).toBeGreaterThanOrEqual(.78);expect(motion.firstFrame.opacity).toBeLessThan(1);
  await expect.poll(()=>page.evaluate(()=>(window as any).__surfaceApp.records[0]?.finished)).toBe(true);await expect(page.locator('.paper')).toHaveCSS('opacity','1');await expect(page.locator('.paper')).not.toHaveAttribute('data-surface-motion','entering');
  result=await evidence(page,'same-card-complete');expect(result.records[0].cancelled).toBe(false);await unchanged(page,before);expect(errors).toEqual([]);
 });
 test(`formal cloud App ${mode}: switching cards cancels the live page fade before the new first frame`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));const {before,status}=await start(page,mode);
  await test.info().attach('formal-cloud-build',{body:JSON.stringify(status,null,2),contentType:'application/json'});
  await page.evaluate(target=>{(window as any).__surfaceApp.switchTo=target;},second);
  await page.locator('[data-retained-card-active="true"] [data-sheet-tab="特性"]').click();await expect(page.locator('.paper[data-active-sheet="true"]')).toHaveAttribute('data-character-id',second);
  await expect.poll(()=>page.evaluate(()=>(window as any).__surfaceApp.cross?.secondNewFrame)).toBeTruthy();
  await expect.poll(()=>page.evaluate(()=>(window as any).__surfaceApp.records[0]?.cancelled)).toBe(true);
  const result=await evidence(page,'cross-card-first-frames');expect(result.errors).toEqual([]);expect(result.records).toHaveLength(1);expect(result.records[0].id).toBe(first);expect(result.records[0].finished).toBe(false);expect(result.cross.oldPaperRetained).toBe(true);expect(result.cross.distinctActivePaper).toBe(true);
  expect(result.cross.beforeSwitch.oldPlayState).toBe('running');expect(result.cross.beforeSwitch.opacity).toBeLessThan(1);
  for(const frame of [result.cross.firstNewFrame,result.cross.secondNewFrame]){expect(frame.id).toBe(second);expect(frame.page).toBe('page-1');expect(frame.opacity).toBe(1);expect(frame.oldPlayState).toBe('idle');expect(frame.surfaceMotion).toBeNull();expect(frame.ownAnimations).toEqual([]);}
  await page.screenshot({path:test.info().outputPath('new-card-opaque.png')});await unchanged(page,before);
  // The new card still owns subsequent ordinary page transitions.
  await page.locator('[data-retained-card-active="true"] [data-sheet-tab="背景"]').click();await expect.poll(()=>page.evaluate(()=>(window as any).__surfaceApp.records.length)).toBe(2);
  expect(await page.evaluate(()=>(window as any).__surfaceApp.records[1].id)).toBe(second);await expect(page.locator('.paper[data-active-sheet="true"]')).not.toHaveAttribute('data-surface-motion','entering');await unchanged(page,before);expect(errors).toEqual([]);
  await page.locator('.character-tabs').getByRole('tab',{name:'卡面动效甲',exact:true}).click();await expect(page.locator('.paper[data-active-sheet="true"]')).toHaveAttribute('data-character-id',first);await expect(page.locator('.paper[data-active-sheet="true"]')).toHaveCSS('opacity','1');
  expect(await page.evaluate(()=>(window as any).__surfaceApp.records.length)).toBe(2);await unchanged(page,before);
 });
}
