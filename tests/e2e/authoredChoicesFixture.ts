import {expect,type Page} from '@playwright/test';

/** Authoring scenarios resume empty choices; import scenarios keep them ignored. */
export async function restoreAuthoredChoices(page:Page,database?:string,visibility?:Record<string,boolean>){
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
 // Stop the imported page before changing this fixture: late catalog hydration
 // can otherwise save its old presentation state over the authored setup.
 // A production-preview service worker can serve the App shell for this blank
 // navigation before Playwright's route sees it. Unregister only this isolated
 // browser's registrations; retain every cache and saved document. The resumed
 // real App registers its worker normally again.
 await page.evaluate(async()=>{if('serviceWorker' in navigator)await Promise.all((await navigator.serviceWorker.getRegistrations()).filter(registration=>new URL(registration.scope).origin===location.origin).map(registration=>registration.unregister()));});
 const resume=page.url(),blank=new URL('/__authored-choice-fixture__',resume).href;
 await page.route(blank,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Authored choice setup</title>'}));
 await page.goto(blank);await expect(page).toHaveTitle('Authored choice setup');await expect(page.locator('.paper')).toHaveCount(0);
 await page.evaluate(async({database,visibility})=>{
  const name=database||(await indexedDB.databases()).find(row=>['dnd-card-standalone','dnd-card-workspace','dnd-card-automation-choices-20261001'].includes(row.name||''))?.name;
  if(!name)throw Error('Expected an existing saved authoring workspace');
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  try{
   const transaction=db.transaction('documents','readwrite'),store=transaction.objectStore('documents');
   const workspace=await new Promise<any>((resolve,reject)=>{const request=store.get('workspace');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
   // Navigation persists independently from the document. A stale embedded
   // activeId must not resume choices on a different card. Invalid present
   // navigation is an error, never permission to fall back to another card.
   const navigation=await new Promise<any>((resolve,reject)=>{const request=store.get('workspace-active-id');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
   const activeId=navigation===undefined?workspace.activeId:navigation;
   if(typeof activeId!=='string'||!workspace.characters.some((row:any)=>row.id===activeId))throw Error('Invalid durable active character');
   const card=workspace.characters.find((row:any)=>row.id===activeId);
   if(card.featureLayout){delete card.featureLayout.ignoredChoices;delete card.featureLayout.ignoredClassGrants;delete card.featureLayout.resumedChoices;if(visibility)card.featureLayout.optionsVisible=visibility;else delete card.featureLayout.optionsVisible;}
   store.put(workspace,'workspace');await new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);});
  }finally{db.close();}
 },{database,visibility});
 await page.unroute(blank);await page.goto(resume);await expect(page.locator('.paper')).toBeVisible();
}
