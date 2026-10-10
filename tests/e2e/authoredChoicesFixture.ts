import {expect,type Page} from '@playwright/test';

/** Authoring scenarios resume empty choices; import scenarios keep them ignored. */
export async function restoreAuthoredChoices(page:Page,database?:string){
 await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.evaluate(async database=>{
  const name=database||(await indexedDB.databases()).find(row=>['dnd-card-standalone','dnd-card-workspace'].includes(row.name||''))?.name;
  if(!name)throw Error('Expected an existing saved authoring workspace');
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  try{
   const transaction=db.transaction('documents','readwrite'),store=transaction.objectStore('documents');
   const workspace=await new Promise<any>((resolve,reject)=>{const request=store.get('workspace');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
   const card=workspace.characters.find((row:any)=>row.id===workspace.activeId);
   if(card.featureLayout){delete card.featureLayout.ignoredChoices;delete card.featureLayout.ignoredClassGrants;delete card.featureLayout.resumedChoices;delete card.featureLayout.optionsVisible;}
   store.put(workspace,'workspace');await new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);});
  }finally{db.close();}
 },database);
 await page.reload();await expect(page.locator('.paper')).toBeVisible();
}
