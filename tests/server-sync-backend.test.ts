import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {newCharacter,type Character,type Entry,type Selection} from '../src/core/model';
import {exportCharacter} from '../src/core/export';
import {validateCharacter} from '../src/core/validation';
import {buildOperations,type EditIntent} from '../src/core/sync/diff';
import type {OperationResult} from '../src/core/sync/protocol';
import {CharacterApi,ServerError} from '../src/platform/server/characterApi';
import {CharacterSync} from '../src/platform/server/characterSync';
import {ServerSession} from '../src/platform/server/serverSession';
import {MemorySyncStore} from '../src/platform/server/syncStore';
import {bearerSocket,startBackend,type Backend,type TestUser} from './helpers/goBackend';

/**
 * Multi-client acceptance against the real Go server with a temporary SQLite
 * database (DND_RETENTION=3 so history pruning is reachable). Persistence and
 * network are real; only failures are injected around the real fetch/socket.
 */
let backend:Backend;
beforeAll(async()=>{backend=await startBackend({DND_RETENTION:'3',DND_CHARACTER_RATE:'200'});},180000);
afterAll(async()=>{await backend?.stop();});

const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const entry=(id:string,kind:Entry['kind']='item'):Entry=>({id,kind,name:'原创'+id,english:'Synthetic '+id,source:'CUSTOM',edition:'2014',packId:'synthetic',revision:'1',entries:['原创测试正文'],raw:{_custom:true}});
const selection=(id:string):Selection=>({id,entry:entry('e-'+id),quantity:1,level:1,equipped:false});
function synthetic(name='合成测试角色'):Character{
  const c=newCharacter('2014');c.name=name;c.baseHp=30;c.runtime.hp=30;
  c.selections=[selection('A'),selection('B'),selection('C')];
  c.runtime.resources={'pool':{current:2,max:5,name:'合成次数'}};
  c.spellSettings={mode:'prepared',ability:'int',capacity:3,attackBonus:0,dcBonus:0,prepared:['','A',''],slots:{'1':{max:2,used:1}}};
  c.inventory={view:'grid',order:['A','B','C'],attunementLimit:3,coins:{cp:0,sp:0,ep:0,gp:5,pp:0}};
  c.profile={...c.profile,enabledSources:['PHB','CUSTOM']};
  c.portrait={data:PNG,x:0,y:0,zoom:1};
  return c;
}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(check:()=>boolean,label:string,ms=8000){const end=Date.now()+ms;while(!check()){if(Date.now()>end)throw new Error('timeout: '+label);await sleep(20);}}
const settled=(sync:CharacterSync)=>sync.pending.length===0;
async function edit(sync:CharacterSync,mutate:(c:Character)=>void,intent?:EditIntent){
  const before=sync.view!,next=structuredClone(before);mutate(next);
  return sync.propose(buildOperations({server:before,next,intent}));
}
async function session(user:TestUser,store=new MemorySyncStore(),fetcher?:typeof fetch,socket?:(url:string)=>any){
  const s=new ServerSession({baseUrl:backend.baseUrl,token:user.token,store,createSocket:socket||bearerSocket(user.token),fetch:fetcher});
  expect(await s.restore()).toBe(true);return s;
}
/** Engine without a socket, so HTTP-only paths are exercised deterministically. */
function engine(user:TestUser,characterId:string,store=new MemorySyncStore(),fetcher?:typeof fetch,extra:Partial<ConstructorParameters<typeof CharacterSync>[0]>={}){
  const api=new CharacterApi({baseUrl:backend.baseUrl,token:user.token,fetch:fetcher,timeoutMs:5000});
  return new CharacterSync({api,store,serverOrigin:api.origin,accountId:user.id,characterId,clientId:crypto.randomUUID(),random:()=>0,...extra});
}
async function shared(name:string){
  const owner=await session(backend.users.owner),snapshot=await owner.upload(synthetic(name));
  await owner.api.grant(snapshot.id,backend.users.player.id,'editor');
  const player=await session(backend.users.player);
  const a=owner.sync(snapshot.id)!,b=await player.open(snapshot.id);
  await until(()=>a.phase==='online'&&b.phase==='online','both subscribed');
  return {owner,player,a,b,id:snapshot.id,close(){owner.dispose();player.dispose();}};
}

describe('real backend: create / read / identity',()=>{
  it('upload keeps the legacy document identity apart from the server UUID, and backups round-trip',async()=>{
    const owner=await session(backend.users.owner),original=synthetic('备份往返');
    const snapshot=await owner.upload(original);
    expect(snapshot.id).not.toBe(original.id);expect(snapshot.document.id).toBe(original.id);expect(snapshot.revision).toBe(1);
    const read=await owner.api.get(snapshot.id);
    for(const key of ['edition','selections','spellSettings','portrait','profile','runtime','inventory'] as const)expect(read.document[key]).toEqual(original[key]);
    expect(read.document.spellSettings!.prepared).toEqual(['','A','']);
    const roundTrip=validateCharacter(JSON.parse(JSON.stringify(exportCharacter(owner.sync(snapshot.id)!.view!))));
    expect(roundTrip.id).toBe(original.id);expect(roundTrip.portrait).toEqual(original.portrait);expect(roundTrip.runtime.resources.pool).toEqual({current:2,max:5,name:'合成次数'});
    const rows=await owner.list();
    expect(rows.find(r=>r.meta.id===snapshot.id)?.name).toBe('备份往返');
    owner.dispose();
  });
});

describe('real backend: concurrent clients',()=>{
  it('different paths rebase automatically; both clients converge',async()=>{
    const t=await shared('自动rebase');
    await Promise.all([edit(t.a,c=>{c.name='甲改名';}),edit(t.b,c=>{c.abilities.str=16;})]);
    await until(()=>settled(t.a)&&settled(t.b)&&t.a.record!.confirmed.revision===3&&t.b.record!.confirmed.revision===3,'converge');
    for(const s of [t.a,t.b]){expect(s.view!.name).toBe('甲改名');expect(s.view!.abilities.str).toBe(16);expect(s.blocked).toEqual([]);}
    expect((await t.owner.api.get(t.id)).document).toEqual(t.b.record!.confirmed.document);
    t.close();
  });
  it('concurrent HP increments accumulate exactly',async()=>{
    const t=await shared('并发扣血');
    await Promise.all([edit(t.a,c=>{c.runtime.hp-=3;},{inc:['/runtime/hp']}),edit(t.b,c=>{c.runtime.hp-=2;},{inc:['/runtime/hp']})]);
    await until(()=>settled(t.a)&&settled(t.b)&&t.a.record!.confirmed.revision===3&&t.b.record!.confirmed.revision===3,'converge');
    expect(t.a.view!.runtime.hp).toBe(25);expect(t.b.view!.runtime.hp).toBe(25);
    expect((await t.owner.api.get(t.id)).document.runtime.hp).toBe(25);
    t.close();
  });
  it('same path set/set conflicts; the user chooses, never silent last-write-wins',async()=>{
    const t=await shared('同路径冲突');
    await Promise.all([edit(t.a,c=>{c.runtime.hp=10;}),edit(t.b,c=>{c.runtime.hp=99;})]);
    await until(()=>t.a.blocked.length+t.b.blocked.length===1&&t.a.pending.length+t.b.pending.length===0,'one conflict');
    const loser=t.a.blocked.length?t.a:t.b,winnerValue=loser===t.a?99:10,conflict=loser.blocked[0];
    expect(conflict.status).toBe('conflict');
    expect(conflict.conflicts?.[0]).toMatchObject({path:'/runtime/hp',serverExists:true,serverValue:winnerValue});
    await until(()=>loser.record!.confirmed.revision===2,'loser sees winner');
    expect(loser.view!.runtime.hp).toBe(winnerValue);
    // Explicitly submit my decision: re-read, new operationId, newest base.
    const oldId=conflict.operationId;await loser.resolve(oldId,'mine');
    await until(()=>settled(t.a)&&settled(t.b)&&t.a.record!.confirmed.revision===3&&t.b.record!.confirmed.revision===3,'decision committed');
    expect(t.a.view!.runtime.hp).toBe(winnerValue===99?10:99);expect(loser.blocked).toEqual([]);
    expect(t.a.record!.applied.some(r=>r.operationId===oldId)).toBe(false);
    // Keep-server discards an intent without writing anything.
    await Promise.all([edit(t.a,c=>{c.name='甲';}),edit(t.b,c=>{c.name='乙';})]);
    await until(()=>t.a.blocked.length+t.b.blocked.length===1&&t.a.pending.length+t.b.pending.length===0,'second conflict');
    const second=t.a.blocked.length?t.a:t.b;await second.resolve(second.blocked[0].operationId,'server');
    expect(second.blocked).toEqual([]);
    await until(()=>t.a.view!.name===t.b.view!.name&&t.a.record!.confirmed.revision===4&&t.b.record!.confirmed.revision===4,'agree');
    t.close();
  });
  it('different selection IDs edit in parallel; order.move and deletion with reference cleanup sync',async()=>{
    const t=await shared('条目并改');
    await Promise.all([edit(t.a,c=>{c.selections.find(s=>s.id==='B')!.quantity=4;}),edit(t.b,c=>{c.selections.find(s=>s.id==='C')!.quantity=7;})]);
    await until(()=>settled(t.a)&&settled(t.b)&&t.b.record!.confirmed.revision===3&&t.a.record!.confirmed.revision===3,'both');
    expect(t.b.view!.selections.map(s=>[s.id,s.quantity])).toEqual([['A',1],['B',4],['C',7]]);
    await edit(t.a,c=>{c.selections=[c.selections[2],c.selections[0],c.selections[1]];});
    await until(()=>t.b.view!.selections.map(s=>s.id).join()==='C,A,B','moved');
    expect(t.a.record!.applied.at(-1)).toBeDefined();
    await edit(t.b,c=>{c.selections=c.selections.filter(s=>s.id!=='A');c.spellSettings!.prepared=c.spellSettings!.prepared.map(id=>id==='A'?'':id);c.inventory!.order=c.inventory!.order.filter(id=>id!=='A');});
    await until(()=>t.a.view!.selections.length===2&&t.a.record!.confirmed.revision===5,'deleted');
    expect(t.a.view!.spellSettings!.prepared).toEqual(['','','']);expect(t.a.view!.inventory!.order).toEqual(['B','C']);
    const server=(await t.owner.api.get(t.id)).document;
    expect(server.selections.map(s=>s.id)).toEqual(['C','B']);expect(server.spellSettings!.prepared).toEqual(['','','']);
    t.close();
  });
});

describe('real backend: idempotency and delivery order',()=>{
  it('the same operationId is applied once; reused with a different body is rejected',async()=>{
    const owner=await session(backend.users.owner),snapshot=await owner.upload(synthetic('幂等'));
    const api=owner.api,batch={operationId:crypto.randomUUID(),clientId:crypto.randomUUID(),baseRevision:1,operations:[{op:'inc' as const,path:'/runtime/hp',value:-5}]};
    const first=await api.submit(snapshot.id,batch),again=await api.submit(snapshot.id,batch);
    expect(again).toEqual(first);expect((await api.get(snapshot.id)).document.runtime.hp).toBe(25);
    const reused=await api.submit(snapshot.id,{...batch,operations:[{op:'inc',path:'/runtime/hp',value:-1}]}).catch(e=>e);
    expect(reused).toBeInstanceOf(ServerError);expect((reused as ServerError).code).toBe('duplicate_operation');
    owner.dispose();
  });
  it('WS before HTTP and HTTP before WS both apply the revision exactly once',async()=>{
    for(const order of ['ws-first','http-first'] as const){
      const user=backend.users.owner;let wsDelay=0,httpDelay=0;
      if(order==='ws-first')httpDelay=400;else wsDelay=400;
      const slowFetch:typeof fetch=async(input,init)=>{const r=await fetch(input,init);if(init?.method==='POST'&&String(input).endsWith('/operations'))await sleep(httpDelay);return r;};
      const slowSocket=(url:string)=>{const ws=bearerSocket(user.token)(url);const wrapped={get readyState(){return ws.readyState;},send:(d:string)=>ws.send(d),close:(c?:number,r?:string)=>ws.close(c,r),onopen:null as any,onclose:null as any,onerror:null as any,onmessage:null as any};
        ws.onopen=(e:any)=>wrapped.onopen?.(e);ws.onclose=(e:any)=>wrapped.onclose?.(e);ws.onerror=(e:any)=>wrapped.onerror?.(e);
        ws.onmessage=(e:any)=>{const deliver=()=>wrapped.onmessage?.(e);if(wsDelay&&String(e.data).includes('character.operations'))setTimeout(deliver,wsDelay);else deliver();};return wrapped;};
      const s=await session(user,new MemorySyncStore(),slowFetch,slowSocket),snapshot=await s.upload(synthetic('到达顺序'+order)),sync=s.sync(snapshot.id)!;
      await until(()=>sync.phase==='online','online');
      const seen:number[]=[];sync.listen(()=>{if(sync.record&&seen.at(-1)!==sync.record.confirmed.revision)seen.push(sync.record.confirmed.revision);});
      await edit(sync,c=>{c.runtime.hp-=4;},{inc:['/runtime/hp']});
      await until(()=>settled(sync),'settled');await sleep(600);
      expect(sync.record!.confirmed.revision).toBe(2);expect(sync.view!.runtime.hp).toBe(26);expect(sync.record!.confirmed.document.runtime.hp).toBe(26);
      expect(seen.filter(r=>r===2)).toHaveLength(1);
      s.dispose();
    }
  });
  it('a lost HTTP response is retried with the original operationId and body',async()=>{
    const owner=await session(backend.users.owner),snapshot=await owner.upload(synthetic('未知结果'));owner.dispose();
    const bodies:string[]=[];let drop=true;
    const lossy:typeof fetch=async(input,init)=>{const r=await fetch(input,init);if(init?.method==='POST'&&String(input).endsWith('/operations')){bodies.push(String(init.body));if(drop){drop=false;throw new TypeError('connection reset');}}return r;};
    const sync=engine(backend.users.owner,snapshot.id,new MemorySyncStore(),lossy);await sync.open();
    await edit(sync,c=>{c.runtime.hp-=5;},{inc:['/runtime/hp']});
    await until(()=>settled(sync),'retried',10000);
    expect(bodies).toHaveLength(2);expect(bodies[1]).toBe(bodies[0]);
    expect(sync.record!.confirmed.revision).toBe(2);
    const server=await new CharacterApi({baseUrl:backend.baseUrl,token:backend.users.owner.token}).get(snapshot.id);
    expect(server.revision).toBe(2);expect(server.document.runtime.hp).toBe(25);
    sync.close();
  });
  it('fills a revision gap with a single HTTP delta',async()=>{
    const owner=await session(backend.users.owner),snapshot=await owner.upload(synthetic('补齐')),a=owner.sync(snapshot.id)!;
    const b=engine(backend.users.owner,snapshot.id);await b.open();
    await edit(a,c=>{c.name='第一次';});await until(()=>settled(a),'1');
    await edit(a,c=>{c.notes='第二次';});await until(()=>settled(a),'2');
    const delta=await owner.api.delta(snapshot.id,2);
    await b.receive(delta.operations.at(-1)! as OperationResult);
    await until(()=>b.record!.confirmed.revision===3&&b.phase!=='catching-up','caught up');
    expect(b.view!.name).toBe('第一次');expect(b.view!.notes).toBe('第二次');
    owner.dispose();b.close();
  });
});

describe('real backend: websocket reconnect',()=>{
  it('a dropped socket reconnects and replays missed revisions before subscribed',async()=>{
    const owner=await session(backend.users.owner),snapshot=await owner.upload(synthetic('断线重连')),a=owner.sync(snapshot.id)!;
    const sockets:any[]=[],order:string[]=[];
    const tracking=(url:string)=>{const ws=bearerSocket(backend.users.player.token)(url);sockets.push(ws);const wrapped={get readyState(){return ws.readyState;},send:(d:string)=>ws.send(d),close:(c?:number,r?:string)=>ws.close(c,r),onopen:null as any,onclose:null as any,onerror:null as any,onmessage:null as any};
      ws.onopen=(e:any)=>wrapped.onopen?.(e);ws.onclose=(e:any)=>wrapped.onclose?.(e);ws.onerror=(e:any)=>wrapped.onerror?.(e);ws.onmessage=(e:any)=>{try{const m=JSON.parse(String(e.data));order.push(m.type+(m.revision?':'+m.revision:''));}catch{/* ignore */}wrapped.onmessage?.(e);};return wrapped;};
    await owner.api.grant(snapshot.id,backend.users.player.id,'editor');
    const player=await session(backend.users.player,new MemorySyncStore(),undefined,tracking),b=await player.open(snapshot.id);
    await until(()=>b.phase==='online','online');
    sockets[0].close();await until(()=>b.phase==='offline','dropped');
    await edit(a,c=>{c.name='断线期间一';});await until(()=>settled(a),'1');
    await edit(a,c=>{c.notes='断线期间二';});await until(()=>settled(a),'2');
    order.length=0;
    await until(()=>b.phase==='online'&&b.record!.confirmed.revision===3,'replayed',15000);
    expect(sockets.length).toBeGreaterThanOrEqual(2);
    expect(order.filter(t=>t!=='pong')).toEqual(['character.operations:2','character.operations:3','subscribed:3']);
    expect(b.view!.name).toBe('断线期间一');expect(b.view!.notes).toBe('断线期间二');
    owner.dispose();player.dispose();
  });
});

describe('real backend: offline, refresh, resync, permissions, storage',()=>{
  it('offline intents survive a refresh and are sent once afterwards',async()=>{
    const owner=await session(backend.users.owner),snapshot=await owner.upload(synthetic('离线刷新'));owner.dispose();
    const store=new MemorySyncStore(),offline:typeof fetch=async()=>{throw new TypeError('offline');};
    const first=engine(backend.users.owner,snapshot.id,store,undefined);await first.open();first.close();
    const tab=engine(backend.users.owner,snapshot.id,store,offline);await tab.open();
    await edit(tab,c=>{c.runtime.hp-=6;},{inc:['/runtime/hp']});
    await until(()=>tab.outbox[0]?.status==='unknown','unknown while offline');
    await edit(tab,c=>{c.name='离线改名';});
    expect(tab.view!.runtime.hp).toBe(24);expect(tab.view!.name).toBe('离线改名');
    tab.close();
    // Reload: the stored outbox is the only evidence; sending → unknown, original IDs reused.
    const ids=(await store.get(tab.key))!.outbox.map(e=>e.operationId);
    const reloaded=engine(backend.users.owner,snapshot.id,store);await reloaded.open();
    await until(()=>settled(reloaded),'delivered',10000);
    expect(reloaded.record!.applied.map(r=>r.operationId)).toEqual(ids);
    const server=await new CharacterApi({baseUrl:backend.baseUrl,token:backend.users.owner.token}).get(snapshot.id);
    expect(server.document.runtime.hp).toBe(24);expect(server.document.name).toBe('离线改名');expect(server.revision).toBe(3);
    reloaded.close();
  });
  it('retention resync keeps intents: unknown request needs review, stale offline edit asks the user',async()=>{
    const owner=await session(backend.users.owner),snapshot=await owner.upload(synthetic('保留窗口')),a=owner.sync(snapshot.id)!;
    let online=false;const gated:typeof fetch=async(input,init)=>{if(!online)throw new TypeError('offline');return fetch(input,init);};
    const b=engine(backend.users.owner,snapshot.id,new MemorySyncStore(),gated);
    await b.open(await owner.api.get(snapshot.id));
    await edit(b,c=>{c.runtime.hp-=1;},{inc:['/runtime/hp']});
    await until(()=>b.outbox[0]?.status==='unknown','unknown');
    for(let i=0;i<5;i++){await edit(a,c=>{c.name='远端'+i;});await until(()=>settled(a),'remote '+i);}
    online=true;b.retryNow();
    await until(()=>b.blocked.length===1,'needs review',10000);
    expect(b.blocked[0].error?.code).toBe('resync_required');
    expect(b.record!.confirmed.revision).toBe(6);expect(b.view!.name).toBe('远端4');
    const server=await owner.api.get(snapshot.id);expect(server.document.runtime.hp).toBe(30);
    await b.resolve(b.blocked[0].operationId,'mine');
    await until(()=>settled(b)&&b.record!.confirmed.revision===7,'decision');
    expect((await owner.api.get(snapshot.id)).document.runtime.hp).toBe(29);
    // Never-sent offline intent on a value the server changed → explicit user confirmation.
    online=false;b.close();
    const c2=engine(backend.users.owner,snapshot.id,new MemorySyncStore(),gated,{canSend:()=>false});
    await c2.open(await owner.api.get(snapshot.id));
    await edit(c2,c=>{c.name='离线名字';});
    for(let i=0;i<5;i++){await edit(a,c=>{c.name='再改'+i;});await until(()=>settled(a),'again '+i);}
    online=true;await c2.catchUp();
    expect(c2.blocked[0]?.status).toBe('conflict');
    expect(c2.blocked[0].conflicts?.[0]).toMatchObject({path:'/name',serverValue:'再改4',clientValue:'离线名字'});
    expect((await owner.api.get(snapshot.id)).document.name).toBe('再改4');
    owner.dispose();c2.close();
  });
  it('viewer writes are refused and revoked editors stop receiving; drafts are kept',async()=>{
    const t=await shared('权限');
    await t.owner.api.grant(t.id,backend.users.viewer.id,'viewer');
    const viewer=await session(backend.users.viewer),v=await viewer.open(t.id);
    await until(()=>v.phase==='online','viewer online');
    await edit(v,c=>{c.name='观众不能改';});
    await until(()=>v.phase==='forbidden','viewer forbidden');
    expect(v.outbox).toHaveLength(1);expect((await t.owner.api.get(t.id)).document.name).toBe('权限');
    await t.owner.api.revoke(t.id,backend.users.player.id);
    await edit(t.a,c=>{c.notes='撤权后';});await until(()=>settled(t.a),'owner write');
    await sleep(400);
    expect(t.b.view!.notes).not.toBe('撤权后');
    await edit(t.b,c=>{c.name='撤权后编辑';});
    await until(()=>t.b.phase==='forbidden','player forbidden');
    expect(t.b.outbox[0].operations[0]).toMatchObject({path:'/name'});
    const stale=await t.player.api.get(t.id).catch(e=>e);expect((stale as ServerError).code).toBe('forbidden');
    viewer.dispose();t.close();
  });
  it('a failing local store refuses the intent instead of pretending it was saved',async()=>{
    const owner=await session(backend.users.owner),snapshot=await owner.upload(synthetic('存储失败'));owner.dispose();
    const store=new MemorySyncStore(),sync=engine(backend.users.owner,snapshot.id,store);await sync.open();
    store.failWrites=1;
    await expect(edit(sync,c=>{c.runtime.hp=1;})).rejects.toThrow('模拟的本机存储写入失败');
    expect(sync.view!.runtime.hp).toBe(30);expect(sync.outbox).toEqual([]);
    await sleep(200);expect((await new CharacterApi({baseUrl:backend.baseUrl,token:backend.users.owner.token}).get(snapshot.id)).revision).toBe(1);
    sync.close();
  });
  it('two tabs sharing one outbox never apply an intent twice',async()=>{
    const owner=await session(backend.users.owner),snapshot=await owner.upload(synthetic('多标签'));owner.dispose();
    const store=new MemorySyncStore(),one=engine(backend.users.owner,snapshot.id,store),two=engine(backend.users.owner,snapshot.id,store);
    await one.open();await two.open();
    await edit(one,c=>{c.runtime.hp-=2;},{inc:['/runtime/hp']});
    await two.reload();
    await until(()=>settled(one),'one');await two.catchUp();await until(()=>settled(two),'two');
    const server=await new CharacterApi({baseUrl:backend.baseUrl,token:backend.users.owner.token}).get(snapshot.id);
    expect(server.revision).toBe(2);expect(server.document.runtime.hp).toBe(28);
    expect(two.view!.runtime.hp).toBe(28);
    one.close();two.close();
  });
});
