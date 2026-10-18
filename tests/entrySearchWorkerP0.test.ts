import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>vi.unstubAllGlobals());
it('a late cancellation for an older query cannot cancel the newest worker result',async()=>{
 const post=vi.fn();vi.stubGlobal('postMessage',post);vi.stubGlobal('onmessage',undefined);
 await import('../src/data/entrySearch.worker');
 const receive=globalThis.onmessage as unknown as (event:{data:unknown})=>Promise<void>;
 await receive({data:{id:0,rows:[{name:'火球术',english:'Fireball',source:'XPHB',sourceName:'玩家手册'}]}});
 const old=receive({data:{id:1,query:'hqs'}}),latest=receive({data:{id:2,query:'火球'}});
 await receive({data:{id:1,cancel:true}});await Promise.all([old,latest]);
 expect(post.mock.calls.map(call=>call[0])).toEqual([{id:2,indices:[0]}]);
});
