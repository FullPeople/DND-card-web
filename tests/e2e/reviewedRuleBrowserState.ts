import {expect,type Page} from '@playwright/test';
import type {Character} from '../../src/core/model';
import type {Workspace} from '../../src/platform/storage';
import {expandSourceBook} from './fixtures';

// Read the durable document and its independent navigation metadata, never
// the optimistic App draft. A present invalid navigation key is a test failure.
export async function storedWorkspace(page:Page):Promise<Workspace>{return page.evaluate(async()=>{
 const path='/card/src/platform/workspaceIdentity.ts',database=(await import(path)).workspaceIdentity.database;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(database);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{const store=db.transaction('documents','readonly').objectStore('documents'),read=(key:string)=>new Promise<any>((resolve,reject)=>{const request=store.get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const [workspace,navigation]=await Promise.all([read('workspace'),read('workspace-active-id')]),activeId=navigation===undefined?workspace.activeId:navigation;
  if(typeof activeId!=='string'||!workspace.characters.some((row:any)=>row.id===activeId))throw Error('Invalid durable active character');
  return {...workspace,activeId};
 }finally{db.close();}
});}
export async function savedCharacter(page:Page):Promise<Character>{const workspace=await storedWorkspace(page);return workspace.characters.find(row=>row.id===workspace.activeId)!;}

export async function setSiteSource(page:Page,bookId:'PHB'|'TCE',enabled:boolean){await page.getByRole('button',{name:'规则与扩展',exact:true}).click();await expandSourceBook(page,bookId);const book=page.locator('.source-book').filter({has:page.locator(`button[aria-label="设置来源 ${bookId}"]`)});await book.locator('input[type=checkbox]').first().setChecked(enabled);await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();await expect.poll(async()=>(await storedWorkspace(page)).siteSources?.enabledSources.includes(bookId)).toBe(enabled);}
