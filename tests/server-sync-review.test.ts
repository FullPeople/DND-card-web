import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {newCharacter,type Character} from '../src/core/model';
import {buildOperations,type EditIntent} from '../src/core/sync/diff';
import type {CharacterSnapshot} from '../src/core/sync/protocol';
import {localOnlyWorkspace} from '../src/platform/localWorkspace';
import type {Workspace} from '../src/platform/storage';
import {CharacterApi} from '../src/platform/server/characterApi';
import {CharacterSync,contextOf,rebaseNeverSentOutbox} from '../src/platform/server/characterSync';
import {ServerSession,tabClientId,type KeyValue} from '../src/platform/server/serverSession';
import {MemorySyncStore,type PendingEntry} from '../src/platform/server/syncStore';
import {bearerSocket,startBackend,type Backend,type TestUser} from './helpers/goBackend';

/**
 * Regression coverage for the independent review: legacy-workspace isolation,
 * ordered resync of never-sent intents, fail-closed logout, sender election
 * restart and per-tab clientId. Backend cases run the real Go server on a
 * temporary SQLite database (DND_RETENTION=3 so resync_required is reachable).
 */
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(check:()=>boolean,label:string,ms=8000){const end=Date.now()+ms;while(!check()){if(Date.now()>end)throw new Error('timeout: '+label);await sleep(20);}}
class MemoryKV implements KeyValue {
  readonly map=new Map<string,string>();failSet=false;failGet=false;
  getItem(key:string){if(this.failGet)throw new Error('storage blocked');return this.map.get(key)??null;}
  setItem(key:string,value:string){if(this.failSet)throw new Error('storage full');this.map.set(key,value);}
  removeItem(key:string){this.map.delete(key);}
}

describe('legacy workspace boundary',()=>{
  const card=(id:string,name=id):Character=>({...newCharacter('2024'),id,name});
  it('never stores server:* rows and re-points an active server card to a local one',()=>{
    const w:Workspace={schemaVersion:1,characters:[card('local-A'),card('server:11111111-1111-4111-8111-111111111111')],activeId:'server:11111111-1111-4111-8111-111111111111',packs:[]};
    const local=localOnlyWorkspace(w)!;
    expect(local.characters.map(c=>c.id)).toEqual(['local-A']);expect(local.activeId).toBe('local-A');
    expect(JSON.stringify(local)).not.toContain('server:');
    expect(w.characters).toHaveLength(2);
  });
  it('keeps a purely local workspace untouched and refuses a server-only one',()=>{
    const w:Workspace={schemaVersion:1,characters:[card('a'),card('b')],activeId:'b',packs:[]};
    expect(localOnlyWorkspace(w)).toBe(w);
    expect(localOnlyWorkspace({...w,characters:[card('server:x')],activeId:'server:x'})).toBeUndefined();
  });
});

describe('resync of never-sent intents (pure)',()=>{
  let n=0;
  function base(){const c=newCharacter('2024');c.name='A';c.notes='X';c.baseHp=20;c.runtime.hp=20;return c;}
  /** One user edit made on `view` with the given earlier live intents, as propose() records it. */
  function intent(view:Character,mutate:(c:Character)=>void,prior:PendingEntry[],intent?:EditIntent):[PendingEntry,Character]{
    const next=structuredClone(view);mutate(next);const operations=buildOperations({server:view,next,intent});
    return [{operationId:'op-'+(++n),clientId:'tab',operations,status:'queued',everSent:false,authoredRevision:10,priorOperationIds:prior.map(e=>e.operationId),before:contextOf(view,operations),createdAt:'',attempts:0},next];
  }
  const snapshot=(document:Character,revision=20):CharacterSnapshot=>({id:'srv',ownerId:'u',system:'dnd5e',schemaVersion:1,revision,document,createdAt:'',updatedAt:''});
  it('A: consecutive same-field edits on an unchanged server never conflict with each other',()=>{
    const server=base();const [one,v1]=intent(server,c=>{c.name='AB';},[]);const [two,v2]=intent(v1,c=>{c.name='ABC';},[one]);
    expect(v2.name).toBe('ABC');
    const out=rebaseNeverSentOutbox([one,two],snapshot(server));
    expect(out.map(e=>e.status)).toEqual(['queued','queued']);expect(out.every(e=>!e.hold&&!e.conflicts)).toBe(true);
    expect(out.map(e=>e.operationId)).toEqual([one.operationId,two.operationId]);
    expect(out[1].priorOperationIds).toEqual([one.operationId]);expect(out.map(e=>e.authoredRevision)).toEqual([20,20]);
  });
  it('B: different fields including an increment all survive in order',()=>{
    const server=base();
    const [a,v1]=intent(server,c=>{c.name='B';},[]);const [b,v2]=intent(v1,c=>{c.runtime.hp=17;},[a],{inc:['/runtime/hp']});const [c3]=intent(v2,c=>{c.notes='Y';},[a,b]);
    expect(b.operations).toEqual([{op:'inc',path:'/runtime/hp',value:-3}]);
    const remote=base();remote.abilities.str=18;
    const out=rebaseNeverSentOutbox([a,b,c3],snapshot(remote));
    expect(out.map(e=>e.status)).toEqual(['queued','queued','queued']);expect(out[2].priorOperationIds).toEqual([a.operationId,b.operationId]);
  });
  it('C: an intent built on a conflicting one is held behind it, never sent past it',()=>{
    const server=base();const [one,v1]=intent(server,c=>{c.name='B';},[]);const [two]=intent(v1,c=>{c.name='C';},[one]);
    const remote=base();remote.name='REMOTE';
    const out=rebaseNeverSentOutbox([one,two],snapshot(remote));
    expect(out[0]).toMatchObject({status:'conflict',hold:{reason:'stale'}});expect(out[0].conflicts?.[0]).toMatchObject({path:'/name',serverValue:'REMOTE',clientValue:'B'});
    expect(out[1]).toMatchObject({status:'conflict',hold:{reason:'dependency',blockedBy:[one.operationId]}});
    expect(out.some(e=>e.error)).toBe(false);
  });
  it('D: a clean earlier intent is re-based while a later one still sees the real remote change',()=>{
    const server=base();const [one,v1]=intent(server,c=>{c.notes='Y';},[]);const [two]=intent(v1,c=>{c.name='B';},[one]);
    const remote=base();remote.name='R';
    const out=rebaseNeverSentOutbox([one,two],snapshot(remote));
    expect(out[0]).toMatchObject({status:'queued',authoredRevision:20});expect(out[0].hold).toBeUndefined();
    expect(out[1]).toMatchObject({status:'conflict',hold:{reason:'stale'}});expect(out[1].conflicts?.[0]).toMatchObject({path:'/name',serverValue:'R'});
  });
  it('keeps sent/unknown bodies frozen (sending → unknown), unprojected, and checks later intents against both outcomes',()=>{
    const server=base();const [sent,v1]=intent(server,c=>{c.name='AB';},[]);
    const frozen={...sent,status:'sending' as const,everSent:true,batch:{operationId:sent.operationId,clientId:'tab',baseRevision:10,operations:sent.operations}};
    const [later]=intent(v1,c=>{c.name='ABC';},[sent]);
    // Neither "not committed" (A) nor "already committed" (AB) makes the later intent stale.
    for(const name of ['A','AB']){
      const remote=base();remote.name=name;
      const out=rebaseNeverSentOutbox([frozen,later],snapshot(remote));
      expect(out[0]).toEqual({...frozen,status:'unknown',maybeInSnapshot:true});
      expect(out[1]).toMatchObject({status:'queued',priorOperationIds:[sent.operationId]});expect(out[1].hold).toBeUndefined();
    }
    // Unknown inc -5 on HP 20; the later set was made on 15. Only a real remote HP change makes it stale.
    const [hit,v2]=intent(server,c=>{c.runtime.hp=15;},[],{inc:['/runtime/hp']});
    const unknown={...hit,status:'unknown' as const,everSent:true,batch:{operationId:hit.operationId,clientId:'tab',baseRevision:10,operations:hit.operations}};
    const [heal]=intent(v2,c=>{c.runtime.hp=10;},[hit]);
    for(const hp of [20,15]){const remote=base();remote.runtime.hp=hp;expect(rebaseNeverSentOutbox([unknown,heal],snapshot(remote))[1]).toMatchObject({status:'queued'});}
    const remote=base();remote.runtime.hp=18;
    expect(rebaseNeverSentOutbox([unknown,heal],snapshot(remote))[1]).toMatchObject({status:'conflict',hold:{reason:'stale'}});
  });
});

describe('per-tab clientId',()=>{
  it('is stable across reloads of one tab and fresh for a new tab',()=>{
    const tab=new MemoryKV(),first=tabClientId(tab);
    expect(tabClientId(tab)).toBe(first);
    expect(new ServerSession({baseUrl:'http://127.0.0.1:1/api/v1',store:new MemorySyncStore(),tabStore:tab,prefs:null}).clientId).toBe(first);
    expect(tabClientId(new MemoryKV())).not.toBe(first);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
  });
});

let backend:Backend;
beforeAll(async()=>{backend=await startBackend({DND_RETENTION:'3',DND_CHARACTER_RATE:'200'});},180000);
afterAll(async()=>{await backend?.stop();});
function synthetic(name:string){const c=newCharacter('2014');c.name=name;c.notes='X';c.baseHp=30;c.runtime.hp=30;return c;}
const api=(user:TestUser,fetcher?:typeof fetch)=>new CharacterApi({baseUrl:backend.baseUrl,token:user.token,fetch:fetcher,timeoutMs:5000});
async function create(name:string){return api(backend.users.owner).create(synthetic(name));}
async function edit(sync:CharacterSync,mutate:(c:Character)=>void,intent?:EditIntent){const before=sync.view!,next=structuredClone(before);mutate(next);return sync.propose(buildOperations({server:before,next,intent}));}
/** Remote commits by another client; enough of them push the tab past the 3-operation history window. */
async function remoteChurn(id:string,count=5,path='/abilities/str',value:(i:number)=>unknown=i=>10+i){
  const owner=api(backend.users.owner);
  for(let i=0;i<count;i++){const s=await owner.get(id);await owner.submit(id,{operationId:crypto.randomUUID(),clientId:crypto.randomUUID(),baseRevision:s.revision,operations:[{op:'set',path,value:value(i)}]});}
}
/** A tab whose intents stay never-sent while it is not the sender. */
function offlineTab(id:string){
  let online=false,sender=false;const gated:typeof fetch=async(input,init)=>{if(!online)throw new TypeError('offline');return fetch(input,init);};
  const a=api(backend.users.owner,gated);
  const sync=new CharacterSync({api:a,store:new MemorySyncStore(),serverOrigin:a.origin,accountId:backend.users.owner.id,characterId:id,clientId:crypto.randomUUID(),random:()=>0,canSend:()=>sender});
  return {sync,goOnline(){online=true;},becomeSender(){sender=true;sync.retryNow();}};
}

describe('real backend: resync with several never-sent intents',()=>{
  it('A: A→AB→ABC offline, history pruned, server still A → no conflict, ABC committed in order',async()=>{
    const snap=await create('A'),tab=offlineTab(snap.id);await tab.sync.open(snap);
    await edit(tab.sync,c=>{c.name='AB';});await edit(tab.sync,c=>{c.name='ABC';});
    const ids=tab.sync.outbox.map(e=>e.operationId);
    await remoteChurn(snap.id);
    tab.goOnline();expect(await tab.sync.catchUp()).toBe(true);
    expect(tab.sync.blocked).toEqual([]);expect(tab.sync.record!.confirmed.revision).toBe(6);expect(tab.sync.view!.name).toBe('ABC');
    expect(tab.sync.outbox.map(e=>e.operationId)).toEqual(ids);
    tab.becomeSender();await until(()=>tab.sync.pending.length===0,'sent');
    const server=await api(backend.users.owner).get(snap.id);
    expect(server.document.name).toBe('ABC');expect(server.revision).toBe(8);
    expect(tab.sync.record!.applied.map(r=>r.operationId)).toEqual(ids);
    tab.sync.close();
  });
  it('A2: a second edit made before the first one finished persisting is still built on top of it',async()=>{
    const snap=await create('A'),tab=offlineTab(snap.id);await tab.sync.open(snap);
    const rendered=tab.sync.view!,set=(hp:number)=>{const next=structuredClone(rendered);next.runtime.hp=hp;return tab.sync.propose(buildOperations({server:rendered,next}));};
    await Promise.all([set(25),set(20)]);// both diffs come from the same, not yet updated view
    expect(tab.sync.outbox.map(e=>e.before['/runtime/hp'])).toEqual([{exists:true,value:30},{exists:true,value:25}]);
    await remoteChurn(snap.id);tab.goOnline();await tab.sync.catchUp();
    expect(tab.sync.blocked).toEqual([]);
    tab.becomeSender();await until(()=>tab.sync.pending.length===0,'sent');
    expect((await api(backend.users.owner).get(snap.id)).document.runtime.hp).toBe(20);
    tab.sync.close();
  });
  it('B: name, HP increment and notes all survive resync and are sent in order',async()=>{
    const snap=await create('A'),tab=offlineTab(snap.id);await tab.sync.open(snap);
    await edit(tab.sync,c=>{c.name='B';});await edit(tab.sync,c=>{c.runtime.hp-=3;},{inc:['/runtime/hp']});await edit(tab.sync,c=>{c.notes='Y';});
    const ids=tab.sync.outbox.map(e=>e.operationId);
    await remoteChurn(snap.id);tab.goOnline();await tab.sync.catchUp();
    expect(tab.sync.blocked).toEqual([]);
    tab.becomeSender();await until(()=>tab.sync.pending.length===0,'sent');
    const server=await api(backend.users.owner).get(snap.id);
    expect(server.document).toMatchObject({name:'B',notes:'Y'});expect(server.document.runtime.hp).toBe(27);
    expect(tab.sync.record!.applied.map(r=>r.operationId)).toEqual(ids);
    tab.sync.close();
  });
  it('C: a remote change conflicts with intent 1; dependent intent 2 waits for the user',async()=>{
    const snap=await create('A'),tab=offlineTab(snap.id);await tab.sync.open(snap);
    await edit(tab.sync,c=>{c.name='B';});await edit(tab.sync,c=>{c.name='C';});
    const [one,two]=tab.sync.outbox.map(e=>e.operationId);
    await remoteChurn(snap.id,4);await remoteChurn(snap.id,1,'/name',()=>'REMOTE');
    tab.goOnline();await tab.sync.catchUp();tab.becomeSender();await sleep(400);
    expect(tab.sync.blocked.map(e=>[e.operationId,e.hold?.reason])).toEqual([[one,'stale'],[two,'dependency']]);
    expect(tab.sync.view!.name).toBe('REMOTE');
    // Keeping the server value for intent 1 does not release intent 2 by itself.
    await tab.sync.resolve(one,'server');await sleep(300);
    expect(tab.sync.blocked.map(e=>e.operationId)).toEqual([two]);
    const server=await api(backend.users.owner).get(snap.id);expect(server.document.name).toBe('REMOTE');expect(server.revision).toBe(6);
    tab.sync.close();
  });
  it('D: a clean intent is sent while a later one with a real remote change waits',async()=>{
    const snap=await create('A'),tab=offlineTab(snap.id);await tab.sync.open(snap);
    await edit(tab.sync,c=>{c.notes='Y';});await edit(tab.sync,c=>{c.name='B';});
    await remoteChurn(snap.id,4);await remoteChurn(snap.id,1,'/name',()=>'R');
    tab.goOnline();await tab.sync.catchUp();tab.becomeSender();
    await until(()=>tab.sync.pending.length===0,'clean intent sent');
    expect(tab.sync.blocked).toHaveLength(1);expect(tab.sync.blocked[0].hold?.reason).toBe('stale');
    const server=await api(backend.users.owner).get(snap.id);expect(server.document).toMatchObject({notes:'Y',name:'R'});expect(server.revision).toBe(7);
    tab.sync.close();
  });
});

describe('real backend: unknown head after history pruning',()=>{
  it('E: the unknown head is reviewed once; an explicit submit lets later same-field intents follow without self-conflict',async()=>{
    const snap=await create('A');let online=false;
    const a=api(backend.users.owner,async(input,init)=>{if(!online)throw new TypeError('offline');return fetch(input,init);});
    const sync=new CharacterSync({api:a,store:new MemorySyncStore(),serverOrigin:a.origin,accountId:backend.users.owner.id,characterId:snap.id,clientId:crypto.randomUUID(),random:()=>0});
    await sync.open(snap);
    await edit(sync,c=>{c.runtime.hp=25;});await until(()=>sync.outbox[0]?.status==='unknown','head unknown');
    await edit(sync,c=>{c.runtime.hp=20;});await edit(sync,c=>{c.runtime.hp=15;});
    await remoteChurn(snap.id);
    online=true;sync.retryNow();
    await until(()=>sync.blocked.length===1&&sync.phase!=='resyncing','head needs review',10000);
    const head=sync.blocked[0];expect(head.error?.code).toBe('resync_required');expect(head.operationId).toBe(sync.outbox[0].operationId);
    expect(sync.outbox.slice(1).map(e=>[e.status,e.hold])).toEqual([['queued',undefined],['queued',undefined]]);
    expect(sync.view!.runtime.hp).toBe(15);
    await sync.resolve(head.operationId,'mine');
    await until(()=>sync.outbox.length===0,'all sent',10000);
    const server=await api(backend.users.owner).get(snap.id);expect(server.document.runtime.hp).toBe(15);expect(server.revision).toBe(9);
    sync.close();
  },20000);
});

describe('real backend: unknown outcome across a resync',()=>{
  /** The first POST is committed or not as asked, then its response is lost; later POSTs wait for allow(). */
  function lossyTab(id:string,firstReachesServer:boolean){
    const posted:string[]=[];let allowed=false;
    const fetcher:typeof fetch=async(input,init)=>{
      if(init?.method==='POST'&&String(input).endsWith('/operations')){
        posted.push(String(init.body));
        if(posted.length===1){if(firstReachesServer)await fetch(input,init);throw new TypeError('response lost');}
        if(!allowed)throw new TypeError('offline');
      }
      return fetch(input,init);
    };
    const a=api(backend.users.owner,fetcher);
    const sync=new CharacterSync({api:a,store:new MemorySyncStore(),serverOrigin:a.origin,accountId:backend.users.owner.id,characterId:id,clientId:crypto.randomUUID(),random:()=>0});
    return {sync,posted,allow(){allowed=true;sync.retryNow();}};
  }
  async function run(committed:boolean){
    const snap=await create(committed?'已提交':'未到达');expect(snap.document.runtime.hp).toBe(30);
    const tab=lossyTab(snap.id,committed);await tab.sync.open(snap);
    const [id]=await edit(tab.sync,c=>{c.runtime.hp-=5;},{inc:['/runtime/hp']});
    await until(()=>tab.sync.outbox[0]?.status==='unknown','outcome unknown');
    expect((await api(backend.users.owner).get(snap.id)).revision).toBe(committed?2:1);
    await tab.sync.resync();
    // The fresh snapshot is shown as it is; the unknown inc is not stacked on top of it.
    expect(tab.sync.record!.confirmed.document.runtime.hp).toBe(committed?25:30);
    expect(tab.sync.view!.runtime.hp).toBe(committed?25:30);
    expect(tab.sync.outbox).toHaveLength(1);expect(tab.sync.outbox[0]).toMatchObject({operationId:id,status:'unknown',maybeInSnapshot:true});
    tab.allow();await until(()=>tab.sync.outbox.length===0,'settled by the original-ID retry');
    const server=await api(backend.users.owner).get(snap.id);
    expect(server.document.runtime.hp).toBe(25);expect(server.revision).toBe(2);
    expect(tab.sync.view!.runtime.hp).toBe(25);expect(tab.sync.record!.confirmed.revision).toBe(2);
    // Every attempt reused the frozen body: same operationId, clientId and baseRevision.
    expect(new Set(tab.posted).size).toBe(1);expect(JSON.parse(tab.posted[0])).toMatchObject({operationId:id,baseRevision:1});
    const delta=await api(backend.users.owner).delta(snap.id,1);expect(delta.operations.map(r=>r.operationId)).toEqual([id]);
    tab.sync.close();
  }
  it('A: the server committed but the response was lost → snapshot value shown, retry returns the same receipt',()=>run(true),15000);
  it('B: the request never reached the server → the original-ID retry executes it once',()=>run(false),15000);
});

describe('real backend: cross-tab logout',()=>{
  it('a logout in tab A immediately signs tab B out: syncs and socket closed, nothing more sent, cache kept',async()=>{
    expect(navigator.locks).toBeDefined();
    const snap=await create('跨标签'),prefs=new MemoryKV(),store=new MemorySyncStore();
    const sockets:{readyState:number}[]=[],postsB:string[]=[];
    const socket=(url:string)=>{const ws=bearerSocket(backend.users.owner.token)(url);sockets.push(ws);return ws;};
    // A (the sender) cannot reach POST, so B's intent stays in the shared outbox.
    const offlinePost:typeof fetch=async(input,init)=>{if(init?.method==='POST'&&String(input).endsWith('/operations'))throw new TypeError('offline');return fetch(input,init);};
    const trackB:typeof fetch=async(input,init)=>{if(init?.method==='POST'&&String(input).endsWith('/operations'))postsB.push(String(init.body));return fetch(input,init);};
    const tab=(fetcher:typeof fetch)=>new ServerSession({baseUrl:backend.baseUrl,token:backend.users.owner.token,store,prefs,tabStore:new MemoryKV(),coordinateTabs:true,fetch:fetcher,createSocket:socket});
    const a=tab(offlinePost),b=tab(trackB);await a.restore();await b.restore();
    const syncA=await a.open(snap.id),syncB=await b.open(snap.id);
    await until(()=>syncA.phase==='online'&&syncB.phase==='online','both online');
    const socketB=sockets[1];
    const heard:unknown[]=[],listener=new BroadcastChannel('dnd-card-server-sync');listener.onmessage=e=>{if(e.data?.type)heard.push(e.data);};
    await edit(syncB,c=>{c.runtime.hp-=4;},{inc:['/runtime/hp']});
    await until(()=>syncA.pending.length===1,'A sees the shared intent');
    await a.logout();
    await until(()=>b.state==='signed-out','B signed out');
    expect(b.account).toBeUndefined();expect(b.signedOutElsewhere).toBe(true);
    expect(syncB.phase).toBe('closed');expect(b.sync(snap.id)).toBeUndefined();
    await until(()=>socketB.readyState===3,'B socket closed');
    await sleep(800);// B would have taken the released sender lock and retried by now
    expect(postsB).toEqual([]);
    expect((await api(backend.users.owner).get(snap.id)).revision).toBe(1);
    expect((await store.get(syncB.key))!.outbox).toHaveLength(1);// cache/outbox kept
    expect(heard).toEqual([{type:'signed-out',origin:a.origin}]);// B did not re-broadcast
    listener.close();b.dispose();
  },20000);
  it('sender fails closed when the shared logout barrier becomes unreadable',async()=>{
    const snap=await create('退出屏障不可读'),prefs=new MemoryKV(),store=new MemorySyncStore(),posts:string[]=[];
    const tracked:typeof fetch=async(input,init)=>{if(init?.method==='POST'&&String(input).endsWith('/operations'))posts.push(String(init.body));return fetch(input,init);};
    const tab=new ServerSession({baseUrl:backend.baseUrl,token:backend.users.owner.token,store,prefs,tabStore:new MemoryKV(),coordinateTabs:true,locks:null,fetch:tracked,createSocket:bearerSocket(backend.users.owner.token)});
    expect(await tab.restore()).toBe(true);const sync=await tab.open(snap.id);
    // Once coordination storage cannot be read, canSend must revoke before the queued intent reaches HTTP.
    prefs.failGet=true;await edit(sync,c=>{c.runtime.hp-=3;},{inc:['/runtime/hp']});await sleep(100);
    expect(tab.state).toBe('signed-out');expect(tab.signedOutElsewhere).toBe(true);expect(sync.phase).toBe('closed');expect(posts).toEqual([]);
    prefs.failGet=false;expect((await store.get(sync.key))!.outbox).toHaveLength(1);expect((await api(backend.users.owner).get(snap.id)).revision).toBe(1);
    tab.dispose();
  });
});

describe('real backend: fail-closed logout',()=>{
  /** A browser profile: durable flags + account cache survive a "reload" (new session object). */
  function profile(){
    const prefs=new MemoryKV(),store=new MemorySyncStore(),calls:string[]=[];let dropLogout=false,offline=false;
    const fetcher:typeof fetch=async(input,init)=>{const url=String(input);calls.push(`${init?.method||'GET'} ${url.slice(url.indexOf('/api/v1')+7)}`);if(offline)throw new TypeError('offline');if(dropLogout&&init?.method==='DELETE'&&url.endsWith('/session'))throw new TypeError('connection reset');return fetch(input,init);};
    const open=(user:TestUser)=>new ServerSession({baseUrl:backend.baseUrl,token:user.token,store,prefs,tabStore:null,fetch:fetcher,createSocket:bearerSocket(user.token)});
    return {prefs,store,calls,open,dropLogout(){dropLogout=true;},offline(value:boolean){offline=value;}};
  }
  it('A: after a confirmed logout a reload does not restore the account',async()=>{
    const p=profile(),tab=p.open(backend.users.owner);expect(await tab.restore()).toBe(true);
    const result=await tab.logout();expect(result).toMatchObject({serverConfirmed:true,accountCleared:true,barrier:true,warnings:[]});
    p.calls.length=0;const reloaded=p.open(backend.users.owner);
    expect(await reloaded.restore()).toBe(false);expect(reloaded.account).toBeUndefined();
    expect(p.calls).toEqual([]);// no /me although the credential would still be accepted
    reloaded.dispose();
  });
  it('B: an uncertain DELETE /session still leaves this browser signed out',async()=>{
    const p=profile(),tab=p.open(backend.users.owner);await tab.restore();p.dropLogout();
    const result=await tab.logout();
    expect(result.serverConfirmed).toBe(false);expect(result.warnings.join()).toContain('服务器会话注销结果无法确认');
    expect(tab.state).toBe('signed-out');expect(tab.account).toBeUndefined();
    p.calls.length=0;const reloaded=p.open(backend.users.owner);
    expect(await reloaded.restore()).toBe(false);expect(p.calls.some(c=>c.endsWith('/me'))).toBe(false);
    reloaded.dispose();
  });
  it('C: a stale cached account left by a failed removal is never used after logout',async()=>{
    const p=profile(),tab=p.open(backend.users.owner);await tab.restore();
    p.store.removeAccount=async()=>{throw new Error('IndexedDB blocked');};
    const result=await tab.logout();expect(result.accountCleared).toBe(false);expect(result.barrier).toBe(true);
    expect(await p.store.getAccount(tab.origin)).toBeDefined();
    p.offline(true);const reloaded=p.open(backend.users.owner);
    expect(await reloaded.restore()).toBe(false);expect(reloaded.account).toBeUndefined();expect(reloaded.state).toBe('signed-out');
    reloaded.dispose();
  });
  it('D: an explicit login clears the barrier and later reloads restore again',async()=>{
    const p=profile(),tab=p.open(backend.users.owner);await tab.restore();await tab.logout();
    const again=p.open(backend.users.owner);expect(await again.restore()).toBe(false);
    await again.login(backend.users.owner.token);again.dispose();
    const reloaded=p.open(backend.users.owner);expect(await reloaded.restore()).toBe(true);expect(reloaded.account?.id).toBe(backend.users.owner.id);
    reloaded.dispose();
  });
  it('reports an error when no local barrier can be written and the outcome is not confirmed',async()=>{
    const p=profile(),tab=p.open(backend.users.owner);await tab.restore();
    p.prefs.failSet=true;p.store.removeAccount=async()=>{throw new Error('IndexedDB blocked');};p.dropLogout();
    await expect(tab.logout()).rejects.toThrow('本机无法记录退出状态');
    expect(tab.state).toBe('signed-out');
    p.prefs.failSet=false;p.prefs.failGet=true;// an unreadable flag store fails closed
    expect(await p.open(backend.users.owner).restore()).toBe(false);
  });
});

describe('real backend: sender election restarts the restored outbox',()=>{
  async function queuedOffline(store:MemorySyncStore,id:string,mutate:(c:Character)=>void,intent?:EditIntent){
    const a=api(backend.users.owner,async()=>{throw new TypeError('offline');});
    const tab=new CharacterSync({api:a,store,serverOrigin:a.origin,accountId:backend.users.owner.id,characterId:id,clientId:crypto.randomUUID(),canSend:()=>false});
    await tab.open(await api(backend.users.owner).get(id));await edit(tab,mutate,intent);tab.close();
    return (await store.get(tab.key))!.outbox;
  }
  it('A: without Web Locks the session takes the sender role and sends the queued outbox by itself',async()=>{
    const snap=await create('无锁'),store=new MemorySyncStore();
    const queued=await queuedOffline(store,snap.id,c=>{c.runtime.hp-=4;},{inc:['/runtime/hp']});
    expect(queued.map(e=>e.status)).toEqual(['queued']);
    const tab=new ServerSession({baseUrl:backend.baseUrl,token:backend.users.owner.token,store,prefs:null,tabStore:null,coordinateTabs:true,locks:null,createSocket:bearerSocket(backend.users.owner.token)});
    expect(await tab.restore()).toBe(true);const sync=await tab.open(snap.id);
    await until(()=>sync.outbox.length===0,'sent without user action');
    const server=await api(backend.users.owner).get(snap.id);expect(server.revision).toBe(2);expect(server.document.runtime.hp).toBe(26);
    expect(sync.record!.applied.map(r=>r.operationId)).toEqual(queued.map(e=>e.operationId));
    tab.dispose();
  });
  it('B: with Web Locks, a second tab takes over after the sender closes mid-request, without a double increment',async()=>{
    expect(navigator.locks).toBeDefined();
    const snap=await create('接管'),store=new MemorySyncStore();
    // Tab A's request reaches the server, but its response never comes back.
    const posted:string[]=[];
    const hanging:typeof fetch=async(input,init)=>{if(init?.method==='POST'&&String(input).endsWith('/operations')){posted.push(String(init.body));await fetch(input,init);return new Promise<Response>(()=>{});}return fetch(input,init);};
    // Neither tab hears the commit over WS, so only the HTTP receipt could settle it.
    const deaf=(url:string)=>{const ws=bearerSocket(backend.users.owner.token)(url);const wrapped={get readyState(){return ws.readyState;},send:(d:string)=>ws.send(d),close:(c?:number,r?:string)=>ws.close(c,r),onopen:null as any,onclose:null as any,onerror:null as any,onmessage:null as any};
      ws.onopen=(e:any)=>wrapped.onopen?.(e);ws.onclose=(e:any)=>wrapped.onclose?.(e);ws.onerror=(e:any)=>wrapped.onerror?.(e);ws.onmessage=(e:any)=>{if(!String(e.data).includes('character.operations'))wrapped.onmessage?.(e);};return wrapped;};
    const tab=(fetcher?:typeof fetch)=>new ServerSession({baseUrl:backend.baseUrl,token:backend.users.owner.token,store,prefs:null,tabStore:new MemoryKV(),coordinateTabs:true,fetch:fetcher,createSocket:deaf});
    const a=tab(hanging),b=tab();await a.restore();await b.restore();
    const syncA=await a.open(snap.id),syncB=await b.open(snap.id);
    expect(a.clientId).not.toBe(b.clientId);
    await until(()=>syncA.phase==='online'&&syncB.phase==='online','both online');
    await edit(syncA,c=>{c.runtime.hp-=4;},{inc:['/runtime/hp']});
    await until(()=>posted.length===1&&syncA.outbox[0]?.status==='sending','A sent and is waiting');
    // B observes the shared outbox through BroadcastChannel but does not send.
    await until(()=>syncB.pending.length===1,'B reloaded the shared outbox');
    expect(syncB.view!.runtime.hp).toBe(26);
    expect((await api(backend.users.owner).get(snap.id)).document.runtime.hp).toBe(26);// already committed once
    a.dispose();// sender tab closes; its lock is released
    await until(()=>syncB.outbox.length===0,'B took over',10000);
    const server=await api(backend.users.owner).get(snap.id);
    expect(server.revision).toBe(2);expect(server.document.runtime.hp).toBe(26);
    // The retry kept A's frozen operationId and clientId.
    const delta=await api(backend.users.owner).delta(snap.id,1);
    expect(delta.operations).toHaveLength(1);expect(delta.operations[0].clientId).toBe(a.clientId);expect(JSON.parse(posted[0]).operationId).toBe(delta.operations[0].operationId);
    expect(syncB.view!.runtime.hp).toBe(26);
    b.dispose();
  },20000);
});
