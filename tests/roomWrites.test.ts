import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {newCharacter} from '../src/core/model';
vi.mock('../src/platform/workspaceIdentity',()=>({workspaceIdentity:{editorLock:'isolated-room-write'}}));
let actor='A';
const character=newCharacter(),initial={id:'room',cardId:'original',revision:1,locked:false,owner:true,write:true,character};
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status});
const deferred=()=>{let resolve!:(value:Response)=>void,reject!:(error:Error)=>void;const promise=new Promise<Response>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
beforeEach(()=>{vi.resetModules();actor='A';vi.useFakeTimers();vi.setSystemTime(100000);vi.stubGlobal('location',{search:'?qqRoom=room',hash:'#cap=proof'});vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({token:actor,expiresAt:Date.now()+60000})});});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});

async function fixture(){
 let state={...initial},getCount=0,putCount=0,session=()=>Promise.resolve(response({authenticated:true,csrf:'synthetic-csrf'})),write=()=>Promise.resolve(response({...state,revision:2}));
 vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{if(url.endsWith('/session'))return session();if(options?.method==='PUT'){putCount++;return write();}getCount++;return response(state);}));
 const room=await import('../src/cloud/room');await room.readRoom();
 return {room,get getCount(){return getCount;},get putCount(){return putCount;},state:(value:Partial<typeof initial>)=>{state={...state,...value};},session:(value:typeof session)=>{session=value;},write:(value:typeof write)=>{write=value;}};
}
it('a delayed successful write from A cannot restore ownership or edit permission into B',async()=>{
 const f=await fixture(),pending=deferred();f.write(()=>pending.promise);const save=f.room.saveRoom(character,1),rejected=expect(save).rejects.toMatchObject({scopeChanged:true,confirmed:true});await vi.waitFor(()=>expect(f.putCount).toBe(1));
 actor='B';f.state({owner:false,write:false,locked:true});await f.room.readRoom();pending.resolve(response({...initial,revision:2}));await rejected;expect(f.room.roomState()).toMatchObject({owner:false,write:false,revision:1});
});
it('a successful write receipt never reverses a later same-revision relock',async()=>{
 const f=await fixture(),pending=deferred();f.state({owner:false});await f.room.readRoom();f.write(()=>pending.promise);const save=f.room.saveRoom(character,1);await vi.waitFor(()=>expect(f.putCount).toBe(1));
 f.state({owner:false,write:false,locked:true,revision:2});await f.room.readRoom();pending.resolve(response({...initial,owner:false,revision:2}));expect(await save).toMatchObject({write:false,locked:true});expect(f.room.roomState()).toMatchObject({owner:false,write:false,locked:true,revision:2});
});
it.each(['account','proof'])('scope changes during CSRF preflight prevent any PUT (%s)',async kind=>{
 const f=await fixture(),pending=deferred();f.session(()=>pending.promise);const save=f.room.saveRoom(character,1),rejected=expect(save).rejects.toMatchObject({notSent:true});await Promise.resolve();
 if(kind==='account')actor='B';else location.hash='#cap=rotated';pending.resolve(response({authenticated:true,csrf:'synthetic-csrf'}));await rejected;expect(f.putCount).toBe(0);
});
it('a delayed 403 for A cannot revoke a newly verified B permission',async()=>{
 const f=await fixture(),pending=deferred();f.write(()=>pending.promise);const save=f.room.saveRoom(character,1),rejected=expect(save).rejects.toMatchObject({status:403});await vi.waitFor(()=>expect(f.putCount).toBe(1));
 actor='B';await f.room.readRoom();pending.resolve(response({message:'Denied'},403));await rejected;expect(f.room.roomState()?.write).toBe(true);
});
it('a delayed denial cannot revoke a later same-account regrant',async()=>{
 const f=await fixture(),pending=deferred();f.write(()=>pending.promise);const save=f.room.saveRoom(character,1),rejected=expect(save).rejects.toMatchObject({status:403});await vi.waitFor(()=>expect(f.putCount).toBe(1));
 f.state({write:false});await f.room.readRoom();f.state({write:true});await f.room.readRoom();pending.resolve(response({message:'Denied'},403));await rejected;expect(f.room.roomState()?.write).toBe(true);
});
it('an unknown result after switching actors retains the original uncertain operation without reading B',async()=>{
 const f=await fixture(),pending=deferred(),operation=f.room.beginRoomWrite(1);f.write(()=>pending.promise);const save=f.room.saveRoom(character,1,operation),rejected=expect(save).rejects.toThrow('Connection lost');await vi.waitFor(()=>expect(f.putCount).toBe(1));actor='B';const reads=f.getCount;pending.reject(Error('Connection lost'));await rejected;
 expect(f.getCount).toBe(reads);expect(operation).toMatchObject({sent:true,phase:'uncertain'});const receipt=await f.room.roomWriteReceipt(operation);expect(receipt.scopeKey).not.toBe(await f.room.roomScopeKey());expect(JSON.stringify(receipt)).not.toContain('Bearer');
});
it('same-scope unknown writes are reconciled against the original payload and revision',async()=>{
 const f=await fixture(),next={...character,name:'Committed original operation'};f.write(async()=>{f.state({character:next,revision:2});throw Error('Lost receipt');});const operation=f.room.beginRoomWrite(1);await f.room.saveRoom(next,1,operation);expect(operation.phase).toBe('confirmed');expect(f.room.roomState()?.character.name).toBe(next.name);expect(f.putCount).toBe(1);
});
it('an authorization read held beyond six seconds does not postpone timer-based write protection',async()=>{
 const f=await fixture(),pending=deferred(),notified=vi.fn();f.room.subscribeRoom(notified);vi.stubGlobal('fetch',vi.fn(()=>pending.promise));const read=f.room.readRoom();await vi.advanceTimersByTimeAsync(6001);expect(notified).toHaveBeenCalled();expect(f.room.roomState()).toMatchObject({write:false,authorization:'expired'});await expect(f.room.saveRoom(character,1)).rejects.toMatchObject({notSent:true});
 pending.resolve(response(initial));expect((await read).write).toBe(false);expect(f.room.roomState()?.authorization).toBe('expired');
});
it('synchronous expiry checking rejects a write even when background timers did not run',async()=>{
 const f=await fixture();vi.setSystemTime(Date.now()+6001);await expect(f.room.saveRoom(character,1)).rejects.toMatchObject({notSent:true});expect(f.putCount).toBe(0);
});
it('a delayed successful write cannot extend the authorization lease',async()=>{
 const f=await fixture(),pending=deferred();f.write(()=>pending.promise);const save=f.room.saveRoom(character,1);await vi.waitFor(()=>expect(f.putCount).toBe(1));await vi.advanceTimersByTimeAsync(6001);pending.resolve(response({...initial,revision:2}));await save;expect(f.room.roomState()).toMatchObject({write:false,authorization:'expired'});
 await f.room.readRoom();expect(f.room.roomState()?.write).toBe(true);
});
it('slow snapshot preparation cannot send a write after the authorization deadline',async()=>{
 const f=await fixture(),slow={...character};Object.defineProperty(slow,'notes',{enumerable:true,get:()=>{vi.setSystemTime(Date.now()+6001);return 'Slow snapshot';}});
 await expect(f.room.saveRoom(slow,1)).rejects.toMatchObject({notSent:true});expect(f.putCount).toBe(0);
});
it('unknown-result reconciliation uses the original snapshot rather than subsequently mutated input',async()=>{
 const f=await fixture(),next={...character,name:'Original payload'},original=structuredClone(next),pending=deferred();f.session(()=>pending.promise);f.write(async()=>{f.state({character:original,revision:2});throw Error('Lost receipt');});
 const save=f.room.saveRoom(next,1);next.name='Changed during preflight';pending.resolve(response({authenticated:true,csrf:'synthetic'}));await save;
 const put=(fetch as ReturnType<typeof vi.fn>).mock.calls.find(([,init])=>init?.method==='PUT');expect(JSON.parse(put![1].body).character.name).toBe('Original payload');expect(f.room.roomState()?.character.name).toBe('Original payload');
});
