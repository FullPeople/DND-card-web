import {afterEach,describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {CloudStore,createCloudServer} from '../server/cloud/server';
import {newCharacter} from '../src/core/model';
const cleanups:Array<()=>Promise<void>>=[];
afterEach(async()=>{for(const stop of cleanups.splice(0))await stop();});
async function setup(options:{accountPrivate?:boolean;temporaryUpload?:boolean}={}){
  const store=new CloudStore(':memory:'),owner=store.provisionVerifiedAccount('verified:owner'),other=store.provisionVerifiedAccount('verified:other'),issued=store.issueVerifiedSession(owner.id),second=store.issueVerifiedSession(other.id);
  const origin='https://dnd.center',pluginOrigin='https://obr.dnd.center',server=createCloudServer(store,origin,{temporaryUpload:true,...options});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));cleanups.push(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));store.close();});
  const base='http://127.0.0.1:'+(server.address() as {port:number}).port;
  const headers=(s=issued)=>({Cookie:'dnd_cloud='+s.token,Origin:origin,'X-CSRF-Token':s.csrf,'Content-Type':'application/json'});
  const request=(path:string,method='GET',data?:unknown,h:Record<string,string>=headers())=>fetch(base+'/api/'+path,{method,headers:h,...data===undefined?{}:{body:JSON.stringify(data)}});
  async function connect(s=issued){
    const verifier='v'.repeat(43),challenge=createHash('sha256').update(verifier).digest('base64url');
    const source={Origin:pluginOrigin,'Content-Type':'application/json'};
    const start=await request('plugin/start','POST',{challenge},source);expect(start.status).toBe(201);const {connection}=await start.json();
    expect((await request('plugin/poll','POST',{connection,verifier},source)).status).toBe(202);
    const auth=await request('plugin/authorize','POST',{origin:pluginOrigin,challenge,connection},headers(s));expect(auth.status).toBe(200);
    const poll=await request('plugin/poll','POST',{connection,verifier},source);expect(poll.status).toBe(200);const {token}=await poll.json();
    return {connection,verifier,token,h:{...source,Authorization:'Bearer '+token,'X-CSRF-Token':s.csrf}};
  }
  return {store,server,base,owner,other,issued,second,origin,pluginOrigin,headers,request,connect};
}
describe('QQ accounts, plugin access and room writes over real HTTP',()=>{
  it('isolates signed-in directories and denies guessed private IDs in temporary mode',async()=>{
    const s=await setup(),a=s.store.create(s.owner,newCharacter()),b=s.store.create(s.other,newCharacter()),tmp=s.store.issueTemporarySession();s.store.createTemporary(tmp.owner,'127.0.0.1',newCharacter());
    const mine=await(await s.request('cards')).json();expect(mine.cards.map((row:any)=>row.id)).toEqual([a.id]);
    expect((await s.request('cards/'+b.id)).status).toBe(404);expect((await s.request('cards/'+a.id,'GET',undefined,{})).status).toBe(404);
    const guests=await(await s.request('cards','GET',undefined,{})).json();expect(guests.cards).toHaveLength(1);expect(JSON.stringify(guests)).not.toContain(a.id);expect(JSON.stringify(guests)).not.toContain(b.id);
  });
  it('grants actual account identities with no QQ-number assumption, no quota transfer and immediate revocation',async()=>{
    const s=await setup(),a=s.store.create(s.owner,newCharacter());expect((await s.request('cards/'+a.id+'/editors','POST',{accountId:s.other.id})).status).toBe(200);
    expect((await s.request('cards/'+a.id,'GET',undefined,s.headers(s.second))).status).toBe(200);expect(s.store.slots(s.other).used).toBe(0);
    expect((await s.request('cards/'+a.id+'/editors','POST',{accountId:s.owner.id},s.headers(s.second))).status).toBe(403);
    expect((await s.request('cards/'+a.id,'DELETE',{revision:1},s.headers(s.second))).status).toBe(403);
    expect((await s.request('cards/'+a.id+'/editors/'+s.other.id,'DELETE')).status).toBe(200);expect((await s.request('cards/'+a.id,'GET',undefined,s.headers(s.second))).status).toBe(404);
  });
  it('binds one-use polling connections to PKCE, the approved origin and the website session',async()=>{
    const s=await setup(),p=await s.connect();expect((await s.request('plugin/poll','POST',{connection:p.connection,verifier:p.verifier},{Origin:s.pluginOrigin,'Content-Type':'application/json'})).status).toBe(403);
    expect((await s.request('session','GET',undefined,{...p.h,Origin:'https://evil.example'})).status).toBe(403);
    expect((await(await s.request('session','GET',undefined,p.h)).json()).account.id).toBe(s.owner.id);
    await s.request('logout','POST');expect((await(await s.request('session','GET',undefined,p.h)).json()).authenticated).toBe(false);
  });
  it('requires owner unlock, automatically writes the original card, rejects stale edits and revokes on relock',async()=>{
    const s=await setup(),card=s.store.create(s.owner,newCharacter()),p=await s.connect(),stranger=await s.connect(s.second);
    const load=await s.request('cards/'+card.id+'/rooms','POST',{room:'room-a',confirmRoomSync:true},p.h);expect(load.status).toBe(201);const room=await load.json(),path='room-cards/'+room.id;
    const member={Origin:s.pluginOrigin,'Content-Type':'application/json','X-Room-Capability':room.capability};
    expect((await s.request(path,'PUT',{character:card.character,revision:1},member)).status).toBe(403);
    expect((await s.request(path+'/lock','PUT',{locked:false},{...stranger.h,...member})).status).toBe(403);
    expect((await s.request(path+'/lock','PUT',{locked:false},p.h)).status).toBe(200);
    const character={...card.character,name:'房间自动写回',runtime:{...card.character.runtime,hp:2}};
    expect((await s.request(path,'PUT',{character,revision:1},member)).status).toBe(200);expect(s.store.read(card.id,s.owner).character).toEqual(character);
    expect((await s.request(path,'PUT',{character:{...character,name:'冲突草稿'},revision:1},member)).status).toBe(409);expect(s.store.read(card.id,s.owner).character.name).toBe('房间自动写回');
    expect((await s.request(path+'/lock','PUT',{locked:true},p.h)).status).toBe(200);expect((await s.request(path,'PUT',{character,revision:2},member)).status).toBe(403);
    expect((await s.request(path,'GET',undefined,{Origin:s.pluginOrigin})).status).toBe(403);
    const foreign=s.store.create(s.other,newCharacter());expect((await s.request(path,'PUT',{character:foreign.character,revision:2},p.h)).status).toBe(422);
    expect((await s.request(path,'DELETE',{},p.h)).status).toBe(200);expect((await s.request(path,'GET',undefined,member)).status).toBe(404);expect(s.store.slots(s.owner).used).toBe(1);
  });
  it('rejects wrong PKCE/origin before authorization and rotates existing room capabilities',async()=>{
    const s=await setup(),verifier='a'.repeat(43),challenge=createHash('sha256').update(verifier).digest('base64url'),source={Origin:s.pluginOrigin,'Content-Type':'application/json'};
    const {connection}=await(await s.request('plugin/start','POST',{challenge},source)).json();
    expect((await s.request('plugin/poll','POST',{connection,verifier:'b'.repeat(43)},source)).status).toBe(403);
    expect((await s.request('plugin/poll','POST',{connection,verifier},{...source,Origin:s.origin})).status).toBe(403);
    expect((await s.request('plugin/authorize','POST',{origin:s.pluginOrigin,challenge:'b'.repeat(43),connection})).status).toBe(403);
    expect((await s.request('plugin/authorize','POST',{origin:s.pluginOrigin,challenge,connection})).status).toBe(200);
    const token=(await(await s.request('plugin/poll','POST',{connection,verifier},source)).json()).token;
    const card=s.store.create(s.owner,newCharacter()),owner={...source,Authorization:'Bearer '+token,'X-CSRF-Token':s.issued.csrf};
    const load=()=>s.request('cards/'+card.id+'/rooms','POST',{room:'rotation',confirmRoomSync:true},owner);
    const first=await(await load()).json(),path='room-cards/'+first.id;await s.request(path+'/lock','PUT',{locked:false},owner);
    const next=await(await load()).json();expect(next.id).toBe(first.id);expect(next.locked).toBe(true);
    expect((await s.request(path,'GET',undefined,{...source,'X-Room-Capability':first.capability})).status).toBe(403);
    expect((await s.request(path,'GET',undefined,{...source,'X-Room-Capability':next.capability})).status).toBe(200);
  });
  it('revokes a member write already receiving its body when the owner locks or replaces the grant',async()=>{
    const s=await setup(),card=s.store.create(s.owner,newCharacter()),p=await s.connect();
    const load=()=>s.request('cards/'+card.id+'/rooms','POST',{room:'inflight',confirmRoomSync:true},p.h);
    let room=await(await load()).json();
    for(const rotate of [false,true]){
      const path='room-cards/'+room.id;await s.request(path+'/lock','PUT',{locked:false},p.h);
      const started=new Promise(resolve=>s.server.once('request',resolve));
      let stream:ReturnType<typeof httpRequest>;
      const response=new Promise<number>((resolve,reject)=>{stream=httpRequest(s.base+'/api/'+path,{method:'PUT',headers:{Origin:s.pluginOrigin,'Content-Type':'application/json','X-Room-Capability':room.capability}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode!));});stream.on('error',reject);stream.write('{');});
      await started;
      if(rotate)room=await(await load()).json();else await s.request(path+'/lock','PUT',{locked:true},p.h);
      stream!.end(JSON.stringify({character:{...card.character,name:'不可写入'},revision:1}).slice(1));
      expect(await response).toBe(403);expect(s.store.read(card.id,s.owner).character.name).toBe(card.character.name);
    }
  });
  it('private mode closes guest directory and new anonymous uploads while retaining original-browser migration access',async()=>{
    const s=await setup({temporaryUpload:false,accountPrivate:true}),temp=s.store.issueTemporarySession(),card=s.store.createTemporary(temp.owner,'127.0.0.1',newCharacter()),guest={'Content-Type':'application/json',Origin:s.origin,Cookie:'dnd_temporary='+temp.token,'X-CSRF-Token':temp.owner.csrf};
    expect((await(await s.request('session','GET',undefined,{})).json()).libraryMode).toBe('account');
    expect((await s.request('cards','GET',undefined,{})).status).toBe(401);
    expect((await s.request('cards/'+card.id,'GET',undefined,{})).status).toBe(404);
    expect((await s.request('cards','POST',{character:newCharacter(),confirmUpload:true,confirmPublicTemporary:true},guest)).status).toBe(401);
    expect((await s.request('cards/'+card.id,'GET',undefined,guest)).status).toBe(200);
  });
  it('keeps a temporary card untouched when the target account quota is full',async()=>{
    const s=await setup(),temp=s.store.issueTemporarySession(),card=s.store.createTemporary(temp.owner,'127.0.0.1',newCharacter());
    for(let i=0;i<10;i++)s.store.create(s.owner,newCharacter());
    const own={...s.headers(),Cookie:s.headers().Cookie+'; dnd_temporary='+temp.token};
    expect((await s.request('cards/'+card.id+'/claim','POST',{revision:1,confirmClaim:true},own)).status).toBe(409);
    expect(s.store.isTemporaryCard(card.id)).toBe(true);expect(s.store.read(card.id,undefined,temp.owner).character).toEqual(card.character);expect(s.store.slots(s.owner).used).toBe(10);
  });
  it('only migrates original-browser temporary cards, retaining ID, content and atomic account quota',async()=>{
    const s=await setup(),temp=s.store.issueTemporarySession(),card=s.store.createTemporary(temp.owner,'127.0.0.1',newCharacter());
    expect((await s.request('cards/'+card.id+'/claim','POST',{revision:1,confirmClaim:true})).status).toBe(403);
    const own={...s.headers(),Cookie:s.headers().Cookie+'; dnd_temporary='+temp.token};expect((await s.request('cards/'+card.id+'/claim','POST',{revision:2,confirmClaim:true},own)).status).toBe(409);
    expect((await s.request('cards/'+card.id+'/claim','POST',{revision:1,confirmClaim:true},own)).status).toBe(200);expect(s.store.read(card.id,s.owner).character).toEqual(card.character);expect(s.store.isTemporaryCard(card.id)).toBe(false);expect(s.store.slots(s.owner).used).toBe(1);
  });
});
