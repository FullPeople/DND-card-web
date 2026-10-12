import 'fake-indexeddb/auto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {newCharacter} from '../src/core/model';
import {openDB} from 'idb';
vi.mock('../src/platform/buildMode',()=>({standalone:false}));
let database='';
vi.mock('../src/platform/workspaceIdentity',()=>({get workspaceIdentity(){return {database,cacheDatabase:database,editorLock:database};}}));
let actor='A';
const character=newCharacter(),state={id:'room',cardId:'original',revision:1,locked:false,owner:true,write:true,character};
const response=(value:unknown)=>new Response(JSON.stringify(value));
beforeEach(()=>{vi.resetModules();actor='A';database='room-draft-'+crypto.randomUUID();vi.stubGlobal('location',{search:'?qqRoom=room',hash:'#cap=proof'});vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({token:actor,expiresAt:Date.now()+60000})});});
afterEach(()=>vi.unstubAllGlobals());
async function fixture(){
 let getState={...state},put!:(value:Response)=>void;
 vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>url.endsWith('/session')?response({authenticated:true,csrf:'synthetic'}):options?.method==='PUT'?new Promise<Response>(resolve=>put=resolve):response(getState)));
 const room=await import('../src/cloud/room'),storage=await import('../src/platform/storage');await storage.loadWorkspace();const db=await openDB(database,1);
 return {room,storage,db,put:(value:unknown)=>put(response(value)),state:(value:Partial<typeof state>)=>{getState={...getState,...value};}};
}
it('a confirmed receipt after account change retains its original scoped draft and does not expose it as B draft',async()=>{
 const f=await fixture(),workspace={schemaVersion:1 as const,characters:[character],activeId:character.id,packs:[]};
 const saved=f.storage.saveWorkspace(workspace),rejected=expect(saved).rejects.toMatchObject({confirmed:true});await vi.waitFor(async()=>expect((await f.db.get('documents','room-pending'))?.operationId).toBeTruthy());
 await vi.waitFor(()=>expect((fetch as ReturnType<typeof vi.fn>).mock.calls.some(([,init])=>init?.method==='PUT')).toBe(true));actor='B';f.state({owner:false,write:false});await f.room.readRoom();f.put({...state,revision:2});await rejected;
 const draft=await f.db.get('documents','room-pending');expect(draft.workspace).toEqual(workspace);expect(draft.receipt.phase).toBe('confirmed');expect(draft.scopeKey).not.toBe(await f.room.roomScopeKey());expect(await f.storage.hasRoomDraft()).toBe(false);expect(JSON.stringify(draft)).not.toContain('Bearer');f.db.close();
});
it('foreign scoped drafts are archived before another actor writes, with both operation identities retained',async()=>{
 const f=await fixture(),original={workspace:{name:'original A draft'},revision:1,scopeKey:'A-scope',operationId:'A-operation'};await f.db.put('documents',original,'room-pending');actor='B';await f.room.readRoom();
 const workspace={schemaVersion:1 as const,characters:[character],activeId:character.id,packs:[]},saved=f.storage.saveWorkspace(workspace);await vi.waitFor(()=>expect((fetch as ReturnType<typeof vi.fn>).mock.calls.some(([,init])=>init?.method==='PUT')).toBe(true));f.put({...state,revision:2});await saved;
 const keys=await f.db.getAllKeys('documents'),recoveries=await Promise.all(keys.filter(key=>String(key).startsWith('room-recovery:')).map(key=>f.db.get('documents',key)));expect(recoveries).toContainEqual(original);expect(await f.db.get('documents','room-pending')).toBeUndefined();f.db.close();
});
