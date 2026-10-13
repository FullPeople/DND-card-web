import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {newCharacter} from '../src/core/model';
vi.mock('../src/platform/workspaceIdentity',()=>({workspaceIdentity:{editorLock:'isolated-room-lock'}}));
let token='owner';
beforeEach(()=>{vi.resetModules();token='owner';vi.stubGlobal('location',{search:'?qqRoom=room',hash:'#cap=proof'});vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({token,expiresAt:Date.now()+60000})});});
afterEach(()=>vi.unstubAllGlobals());
const character=newCharacter();
const state={id:'room',cardId:'original',revision:1,locked:true,owner:true,write:true,character};
it('unchanged polling transfers permissions without requesting or replacing the original body',async()=>{
 let count=0;vi.stubGlobal('fetch',vi.fn(async(url:string)=>{count++;expect(url).toBe('https://dnd.center/api/room-cards/room'+(count===1?'':'?since=1'));return new Response(JSON.stringify(count===1?state:{...state,owner:false,write:false,unchanged:true,character:undefined}));}));
 const room=await import('../src/cloud/room'),first=await room.readRoom(),second=await room.readRoom();expect(second.character).toBe(first.character);expect(second.owner).toBe(false);expect(second.write).toBe(false);
});
it('a changed revision replaces the cloud snapshot and explicit full reads omit the condition',async()=>{
 const urls:string[]=[];vi.stubGlobal('fetch',async(url:string)=>{urls.push(url);return new Response(JSON.stringify(urls.length===1?state:{...state,revision:2,character:{...character,name:'Updated'}}));});
 const room=await import('../src/cloud/room');await room.readRoom();expect((await room.readRoom()).character.name).toBe('Updated');await room.readRoom(true);expect(urls[2]).not.toContain('?since=');
});
it('late reads for an old account cannot grant permission to the new account',async()=>{
 let release!:(response:Response)=>void,count=0;vi.stubGlobal('fetch',async()=>{count++;if(count===2)return new Promise<Response>(resolve=>release=resolve);return new Response(JSON.stringify(count===1?state:{...state,owner:false,write:false}));});
 const room=await import('../src/cloud/room');await room.readRoom();const late=room.readRoom(),rejected=expect(late).rejects.toThrow('忽略旧读取');token='other';await room.readRoom();release(new Response(JSON.stringify({...state,unchanged:true,character:undefined})));await rejected;expect(room.roomState()?.write).toBe(false);
});
it('an invalid condition or denied read never restores edit permission',async()=>{
 let count=0;vi.stubGlobal('fetch',async()=>{count++;return new Response(JSON.stringify(count===1?state:count===2?{...state,revision:9,character:undefined,unchanged:true}:{message:'Revoked'}),{status:count===3?403:200});});
 const room=await import('../src/cloud/room');await room.readRoom();await expect(room.readRoom()).rejects.toThrow('重新读取完整');await expect(room.readRoom()).rejects.toThrow('Revoked');expect(room.roomState()?.write).toBe(false);
});
it('an older same-revision response cannot undo a newer permission revocation',async()=>{
 let release!:(response:Response)=>void,count=0;vi.stubGlobal('fetch',async()=>{count++;if(count===2)return new Promise<Response>(resolve=>release=resolve);return new Response(JSON.stringify(count===1?state:{...state,owner:false,write:false,unchanged:true,character:undefined}));});
 const room=await import('../src/cloud/room');await room.readRoom();const late=room.readRoom();await room.readRoom();release(new Response(JSON.stringify({...state,unchanged:true,character:undefined})));expect((await late).write).toBe(false);expect(room.roomState()?.write).toBe(false);
});
it('overlapping initial reads wait for the latest snapshot instead of failing workspace startup',async()=>{
 const releases:Array<(response:Response)=>void>=[];vi.stubGlobal('fetch',()=>new Promise<Response>(resolve=>releases.push(resolve)));
 const room=await import('../src/cloud/room'),first=room.readRoom(),latest=room.readRoom();
 releases[0](new Response(JSON.stringify(state)));await Promise.resolve();
 releases[1](new Response(JSON.stringify({...state,owner:false,write:false})));
 expect((await latest).write).toBe(false);expect(await first).toEqual(room.roomState());expect(room.roomState()?.write).toBe(false);
});
it.each(['body','summary'])('foreground invalidation fences an already pending %s authorization read',async kind=>{
 let release!:(response:Response)=>void,count=0;vi.stubGlobal('fetch',async()=>{if(++count===2)return new Promise<Response>(resolve=>release=resolve);return new Response(JSON.stringify(state));});
 const room=await import('../src/cloud/room');await room.readRoom();const old=kind==='body'?room.readRoom():room.roomInfo();room.invalidateRoomAuthorization();
 expect(room.roomState()).toMatchObject({write:false,authorization:'checking'});release(new Response(JSON.stringify(state)));if(kind==='summary')await expect(old).rejects.toThrow('忽略旧响应');else await old;
 expect(room.roomState()).toMatchObject({write:false,authorization:'checking'});await room.readRoom();expect(room.roomState()).toMatchObject({write:true,authorization:'verified'});
});
it('an old denied GET after foreground invalidation cannot revoke a fresh grant',async()=>{
 let release!:(response:Response)=>void,count=0;vi.stubGlobal('fetch',async()=>{if(++count===2)return new Promise<Response>(resolve=>release=resolve);return new Response(JSON.stringify(state));});
 const room=await import('../src/cloud/room');await room.readRoom();const old=room.readRoom();room.invalidateRoomAuthorization();await room.readRoom();release(new Response(JSON.stringify({message:'Old denied read'}),{status:403}));await old;
 expect(room.roomState()).toMatchObject({write:true,authorization:'verified'});
});
