import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
vi.mock('@playwright/test',()=>({expect:()=>({toContainText:async()=>{},toHaveCount:async()=>{},toBeVisible:async()=>{}})}));
import {restoreAuthoredChoices} from './e2e/authoredChoicesFixture';
const database='authored-choice-navigation',layout=()=>({order:[],expanded:[],ignoredChoices:['retained'],ignoredClassGrants:['retained'],resumedChoices:['retained'],optionsVisible:{old:true}});
const original=()=>({activeId:'old-document-navigation',characters:[{id:'old-document-navigation',featureLayout:layout()},{id:'current-navigation',featureLayout:layout()}]});
let db:IDBDatabase;
beforeEach(async()=>{vi.stubGlobal('indexedDB',new IDBFactory());db=await new Promise((resolve,reject)=>{const r=indexedDB.open(database,1);r.onupgradeneeded=()=>r.result.createObjectStore('documents');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});});
afterEach(()=>{db.close();vi.unstubAllGlobals();});
async function seed(navigation?:unknown){const transaction=db.transaction('documents','readwrite'),store=transaction.objectStore('documents');store.put(original(),'workspace');if(navigation!==undefined)store.put(navigation,'workspace-active-id');await new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);});}
async function read(){return new Promise<ReturnType<typeof original>>((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function page(){return {url:()=> 'https://example.test/card/',locator:()=>({}),route:async()=>{},goto:async()=>{},unroute:async()=>{},evaluate:async(fn:Function,args:unknown)=>fn(args)} as any;}
it('shared authoring setup resumes only durable navigation, not stale workspace.activeId',async()=>{await seed('current-navigation');await restoreAuthoredChoices(page(),database,{'armor-fighter':true});const saved=await read();expect(saved.activeId).toBe('old-document-navigation');expect(saved.characters[0]).toEqual(original().characters[0]);expect(saved.characters[1].featureLayout).toEqual({order:[],expanded:[],optionsVisible:{'armor-fighter':true}});});
it.each([null,3,'missing-card'])('shared authoring setup rejects invalid present navigation %j without modifying either card',async navigation=>{await seed(navigation);await expect(restoreAuthoredChoices(page(),database,{'armor-fighter':true})).rejects.toThrow('Invalid durable active character');expect(await read()).toEqual(original());});
it('older workspaces without independent navigation retain the documented embedded-id fallback',async()=>{await seed();await restoreAuthoredChoices(page(),database);const saved=await read();expect(saved.characters[0].featureLayout).toEqual({order:[],expanded:[]});expect(saved.characters[1]).toEqual(original().characters[1]);});
