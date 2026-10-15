import 'fake-indexeddb/auto';
import {forceCloseDatabase} from 'fake-indexeddb';
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
const settings=vi.hoisted(()=>({database:'',cacheDatabase:'',fail:new Set<string>(),opens:new Map<string,number>(),databases:[] as any[]}));
vi.mock('idb',async()=>{
 const actual=await vi.importActual<typeof import('idb')>('idb');
 return {...actual,openDB:vi.fn(async(name:string,...args:any[])=>{
  settings.opens.set(name,(settings.opens.get(name)||0)+1);
  if(settings.fail.delete(name))throw new DOMException('Temporarily unavailable','UnknownError');
  const db=await actual.openDB(name,...args);settings.databases.push(db);return db;
 })};
});
vi.mock('../src/platform/workspaceIdentity',()=>({workspaceIdentity:settings}));
vi.mock('../src/platform/buildMode',()=>({standalone:false}));
vi.mock('../src/cloud/room',()=>({qqRoom:null}));
vi.mock('../src/cloud/sync',()=>({characterHash:vi.fn()}));
beforeEach(()=>{vi.resetModules();settings.database='documents-'+crypto.randomUUID();settings.cacheDatabase=settings.database;settings.fail.clear();settings.opens.clear();settings.databases=[];});
afterEach(()=>{for(const database of settings.databases)database.close();});

test('a rejected shared open is retried and both cached rules and saved documents remain usable',async()=>{
 settings.fail.add(settings.database);const storage=await import('../src/platform/storage');
 const first=await Promise.allSettled([storage.readCache('rules'),storage.loadWorkspace()]);
 expect(first.map(row=>row.status)).toEqual(['rejected','rejected']);expect(settings.opens.get(settings.database)).toBe(1);
 const workspace:import('../src/platform/storage').Workspace={schemaVersion:1,characters:[],activeId:'',packs:[]};
 await storage.saveWorkspace(workspace);await storage.writeCache('rules',{body:{feat:[]},revision:'recovered'});
 expect(await storage.loadWorkspace()).toEqual(workspace);expect(await storage.readCache('rules')).toEqual({body:{feat:[]},revision:'recovered'});
 expect(settings.opens.get(settings.database)).toBe(2);
});

test('a separate Wiki cache failure does not discard or reopen the character connection',async()=>{
 settings.cacheDatabase='cache-'+crypto.randomUUID();settings.fail.add(settings.cacheDatabase);
 const storage=await import('../src/platform/storage');
 const workspace:import('../src/platform/storage').Workspace={schemaVersion:1,characters:[],activeId:'saved-character',packs:[]};
 await storage.saveWorkspace(workspace);await expect(storage.readCache('rules')).rejects.toThrow('Temporarily unavailable');
 await storage.writeCache('rules',{body:{feat:[]},revision:'recovered'});
 expect(await storage.loadWorkspace()).toEqual(workspace);expect(settings.opens.get(settings.database)).toBe(1);expect(settings.opens.get(settings.cacheDatabase)).toBe(2);
});

test('an unexpectedly terminated database reopens without dropping existing rule or document records',async()=>{
 const storage=await import('../src/platform/storage'),{unwrap}=await import('idb');
 const workspace:import('../src/platform/storage').Workspace={schemaVersion:1,characters:[],activeId:'preserved',packs:[]};
 await storage.saveWorkspace(workspace);await storage.writeCache('rules',{body:{feat:[]},revision:'retained'});
 // fake-indexeddb 6 declares a database constructor here but accepts its instance.
 forceCloseDatabase(unwrap(settings.databases[0]) as unknown as Parameters<typeof forceCloseDatabase>[0]);await new Promise(resolve=>setTimeout(resolve,0));
 expect(await storage.loadWorkspace()).toEqual(workspace);expect(await storage.readCache('rules')).toEqual({body:{feat:[]},revision:'retained'});
 expect(settings.opens.get(settings.database)).toBe(2);
});
