import {loopbackFetch as fetch,registerLoopbackServer} from './helpers/loopbackHttp';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {randomInt} from 'node:crypto';
import {CloudChanges} from '../server/cloud/changes';
import {CloudStore} from '../server/cloud/store';
import {createCloudServer} from '../server/cloud/server';
import {newCharacter} from '../src/core/model';

afterEach(()=>{vi.useRealTimers();});

describe('bounded scoped change waits',()=>{
 it('wakes only subscribed scopes, including changes arriving between requests',async()=>{
  const changes=new CloudChanges(25),a=changes.cursor(['account:a']),b=changes.cursor(['account:b']);
  const waitingA=changes.wait(['account:a'],a,'client-a','a'),waitingB=changes.wait(['account:b'],b,'client-b','b');
  changes.invalidate(['account:a']);expect((await waitingA.promise).changed).toBe(true);
  expect((await waitingB.promise).changed).toBe(false);
  changes.invalidate(['account:a']);expect((await changes.wait(['account:a'],a,'client-a','a').promise).changed).toBe(true);
  changes.close();
 });
 it('releases every key on cancellation and shutdown',async()=>{
  const changes=new CloudChanges(),keys=['account:a','room:x','room:y'];
  const a=changes.wait(keys,changes.cursor(keys),'client-a','a');expect(changes.stats().connections).toBe(1);
  a.cancel();expect((await a.promise).cancelled).toBe(true);expect(changes.stats().connections).toBe(0);
  const b=changes.wait(keys,changes.cursor(keys),'client-a','a');changes.close();
  expect((await b.promise).cancelled).toBe(true);expect(changes.stats()).toEqual({connections:0,scopes:0});
 });
 it('caps held requests and bounded inactive scope state',async()=>{
  const changes=new CloudChanges(20000,2,4),waits=[];
  for(const id of ['a','b']){const keys=['account:'+id];waits.push(changes.wait(keys,changes.cursor(keys),'client-'+id,id));}
  expect(()=>changes.wait(['account:c'],changes.cursor(['account:c']),'client-c','c')).toThrow('变更读取连接过多');
  for(let i=0;i<100;i++)changes.cursor(['account:idle-'+i]);expect(changes.stats().scopes).toBeLessThanOrEqual(4);
  changes.close();await Promise.all(waits.map(wait=>wait.promise));
 });
 it('a fresh server cursor forces reconciliation after restart',async()=>{
  const first=new CloudChanges(),cursor=first.cursor(['account:a']);first.close();
  const next=new CloudChanges();expect((await next.wait(['account:a'],cursor,'client-a','a').promise).changed).toBe(true);next.close();
 });
});

async function fixture(){
 const store=new CloudStore(':memory:'),owner=store.provisionVerifiedAccount('changes:owner'),editor=store.provisionVerifiedAccount('changes:editor'),stranger=store.provisionVerifiedAccount('changes:stranger');
 const sessions={owner:store.issueVerifiedSession(owner.id),editor:store.issueVerifiedSession(editor.id),stranger:store.issueVerifiedSession(stranger.id)};
 const card=store.create(owner,newCharacter()),origin='http://127.0.0.1:5014',server=createCloudServer(store,origin,{accountPrivate:true,changesWaitMs:50});
 for(let attempt=0;attempt<20;attempt++){
  try{await new Promise<void>((resolve,reject)=>{const failed=(error:Error)=>{server.off('listening',ready);reject(error);},ready=()=>{server.off('error',failed);resolve();};server.once('error',failed);server.once('listening',ready);server.listen(randomInt(49152,65536),'127.0.0.1');});break;}
  catch(error){if(!['EADDRINUSE','EACCES'].includes((error as NodeJS.ErrnoException).code||''))throw error;}
 }
 registerLoopbackServer(server);
 const address=server.address();if(!address||typeof address==='string')throw Error('No fixture listener');
 const base='http://127.0.0.1:'+address.port;
 const request=async(path:string,data:unknown,actor:keyof typeof sessions|'guest'='owner',method='POST')=>{
  const session=actor==='guest'?undefined:sessions[actor];
  const response=await fetch(base+'/api/'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...session?{Cookie:'dnd_cloud='+session.token,'X-CSRF-Token':session.csrf}:{}},...method==='GET'?{}:{body:JSON.stringify(data)}});
  return {status:response.status,body:await response.json() as any};
 };
 return {store,owner,editor,stranger,sessions,card,request,close:async()=>{server.closeChanges();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));store.close();}};
}

describe('real HTTP change notifications preserve cloud authority',()=>{
 it('returns only an opaque cursor and the current actor, with no cross-account notification',async()=>{
  const f=await fixture();try{
   const a=await f.request('changes',{}),b=await f.request('changes',{},'stranger');
   expect(a.status).toBe(200);expect(Object.keys(a.body).sort()).toEqual(['accountId','changed','cursor']);
   const mine=f.request('changes',{cursor:a.body.cursor}),other=f.request('changes',{cursor:b.body.cursor},'stranger');
   f.store.update(f.card.id,f.owner,1,{...f.card.character,notes:'Private fixture update'});
   expect((await mine).body.changed).toBe(true);expect((await other).body.changed).toBe(false);
  }finally{await f.close();}
 });
 it('notifies both sides of grants, revocation and deletion after the commit',async()=>{
  const f=await fixture();try{
   const before=await f.request('changes',{},'editor');f.store.grantAccount(f.card.id,f.owner,f.editor.id);
   expect((await f.request('changes',{cursor:before.body.cursor},'editor')).body.changed).toBe(true);
   const granted=await f.request('changes',{},'editor');f.store.grantAccount(f.card.id,f.owner,f.editor.id,true);
   expect((await f.request('changes',{cursor:granted.body.cursor},'editor')).body.changed).toBe(true);
   f.store.grantAccount(f.card.id,f.owner,f.editor.id);const live=await f.request('changes',{},'editor');
   f.store.delete(f.card.id,f.owner,1);expect((await f.request('changes',{cursor:live.body.cursor},'editor')).body.changed).toBe(true);
  }finally{await f.close();}
 });
 it('uses valid room capabilities for guests and rechecks rotated capabilities before replying',async()=>{
  const f=await fixture();try{
   const room=(await f.request('cards/'+f.card.id+'/rooms',{room:'fixture-room',confirmRoomSync:true})).body;
   const rooms=[{id:room.id,capability:room.capability}],initial=await f.request('changes',{rooms},'guest');
   expect(initial.status).toBe(200);expect(initial.body.accountId).toBeNull();
   f.store.update(f.card.id,f.owner,1,{...f.card.character,notes:'Room-authorized update'});
   expect((await f.request('changes',{rooms,cursor:initial.body.cursor},'guest')).body.changed).toBe(true);
   const current=await f.request('changes',{rooms},'guest'),waiting=f.request('changes',{rooms,cursor:current.body.cursor},'guest');
   await f.request('cards/'+f.card.id+'/rooms',{room:'fixture-room',confirmRoomSync:true});
   expect((await waiting).status).toBe(403);
   expect((await f.request('changes',{rooms:[{id:room.id,capability:'wrong'}]},'guest')).status).toBe(403);
  }finally{await f.close();}
 });
 it('expires a revoked login before returning another notification',async()=>{
  const f=await fixture();try{
   const initial=await f.request('changes',{});const waiting=f.request('changes',{cursor:initial.body.cursor});
   f.store.logout(f.sessions.owner.token);expect((await waiting).status).toBe(401);
   expect((await f.request('changes',{},'guest')).status).toBe(401);
  }finally{await f.close();}
 });
 it('observer failures do not turn a committed save into an apparent failed save',async()=>{
  const f=await fixture();try{
   const stop=f.store.observeChanges(()=>{throw Error('Broken fixture observer');});
   const changed=f.store.update(f.card.id,f.owner,1,{...f.card.character,name:'Committed fixture name'});
   expect(changed.revision).toBe(2);expect(f.store.read(f.card.id,f.owner).character.name).toBe('Committed fixture name');stop();
  }finally{await f.close();}
 });
 it('failed revision checks do not emit a successful change',async()=>{
  const f=await fixture();try{
   const initial=await f.request('changes',{});expect(()=>f.store.update(f.card.id,f.owner,2,f.card.character)).toThrow('云端卡已被其他人修改');
   expect((await f.request('changes',{cursor:initial.body.cursor})).body.changed).toBe(false);
  }finally{await f.close();}
 });
 it('rejects invalid cursors and oversized room scopes without exposing card content',async()=>{
  const f=await fixture();try{
   expect((await f.request('changes',{cursor:'not-a-server-cursor'})).status).toBe(400);
   const invalid=await f.request('changes',{rooms:Array.from({length:33},()=>({id:crypto.randomUUID(),capability:'invalid'}))});
   expect(invalid.status).toBe(400);expect(invalid.body.character).toBeUndefined();
  }finally{await f.close();}
 });
});
