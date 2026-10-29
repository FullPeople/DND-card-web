import {loopbackFetch as fetch,registerLoopbackServer} from './helpers/loopbackHttp';
import {afterEach,describe,expect,it} from 'vitest';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import {createCloudServer,CloudStore} from '../server/cloud/server';
import {newCharacter} from '../src/core/model';
import {enableStandaloneCloud} from '../tools/standaloneCloudProfile';

const origin='https://dnd.center';
const cleanup:Array<()=>Promise<void>>=[];
afterEach(async()=>{for(const close of cleanup.splice(0))await close();});
async function setup(){
 const store=new CloudStore(':memory:'),owner=store.provisionVerifiedAccount('production-test-owner'),other=store.provisionVerifiedAccount('production-test-other');
 const ownerSession=store.issueVerifiedSession(owner.id),otherSession=store.issueVerifiedSession(other.id);
 const one=store.create(owner,{...newCharacter(),name:'owner'}),two=store.create(other,{...newCharacter(),name:'other'});
 const server=createCloudServer(store,origin,{featuresEnabled:true,standaloneOnly:true,accountPrivate:true,buildVersion:'1.0.303',changesWaitMs:10,qq:{appId:'123456789',appKey:'test-only-key',callback:origin+'/api/auth/qq/callback'}});
 server.listen(0,'127.0.0.1');await once(server,'listening');registerLoopbackServer(server);
 cleanup.push(async()=>{server.closeChanges();server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));store.close();});
 const base='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/';
 const headers={Origin:origin,Cookie:'dnd_cloud='+ownerSession.token,'X-CSRF-Token':ownerSession.csrf,'Content-Type':'application/json'};
 const request=(path:string,method='GET',value?:unknown,extra:Record<string,string>={})=>fetch(base+path,{method,headers:{...headers,...extra},...(value!==undefined?{body:JSON.stringify(value)}:{}),redirect:'manual'});
 return {store,owner,other,ownerSession,otherSession,one,two,request,base};
}
describe('formal standalone cloud promotion',()=>{
 it('enables only the explicit profile and preserves every storage and API name',()=>{
  const source=readFileSync('src/cloud/availability.ts','utf8');expect(source).toContain('cloudFeaturesEnabled:boolean=false');
  expect(enableStandaloneCloud(source)).toBe(source.replace('cloudFeaturesEnabled:boolean=false','cloudFeaturesEnabled:boolean=true'));
  expect(()=>enableStandaloneCloud('changed')).toThrow();
  const profile=readFileSync('tools/standaloneCloudProfile.ts','utf8');expect(profile).not.toContain('isolateCloudSource');expect(profile).not.toContain('cloud-lab2:');
 });
 it('uses original production cookies and private account directory, never the test copy',async()=>{
  const s=await setup(),session=await(await s.request('session')).json();expect(session).toMatchObject({authenticated:true,account:{id:s.owner.id},qqLogin:'ready',libraryMode:'account'});
  const directory=await(await s.request('cards')).json();expect(directory.cards.map((c:{id:string})=>c.id)).toEqual([s.one.id]);expect(directory.cards[0].character).toBeUndefined();
  expect((await fetch(s.base+'cards')).status).toBe(401);
  const labOnly=await(await s.request('session','GET',undefined,{Cookie:'dnd_cloud_lab2='+s.ownerSession.token})).json();expect(labOnly.authenticated).toBe(false);
 });
 it('keeps card reads and writes isolated by account and honors durable revisions',async()=>{
  const s=await setup(),before=s.store.read(s.two.id,s.other);
  expect((await s.request('cards/'+s.two.id)).status).toBe(404);
  expect((await s.request('cards/'+s.two.id,'PUT',{revision:1,character:s.one.character,confirmUpload:true})).status).toBe(404);
  const changed=structuredClone(s.one.character);changed.runtime.hp=7;
  expect((await s.request('cards/'+s.one.id,'PUT',{revision:1,character:changed,confirmUpload:true})).status).toBe(200);
  expect(s.store.read(s.one.id,s.owner)).toMatchObject({revision:2,character:{runtime:{hp:7}}});
  expect((await s.request('cards/'+s.one.id,'PUT',{revision:1,character:s.one.character,confirmUpload:true})).status).toBe(409);
  expect(s.store.read(s.two.id,s.other)).toEqual(before);
 });
 it.each(['plugin/start','plugin/poll','plugin/approve','room-cards/room','cards/ABCDEF/rooms','cards/ABCDEF/editors','cards/ABCDEF/claim'])('keeps %s paused without changing data',async path=>{
  const s=await setup(),before=s.store.db.prepare('SELECT count(*) count FROM cards').get();
  const response=await s.request(path,'POST',{});expect(response.status).toBe(503);expect((await response.json()).error).toBe('cloud_disabled');
  expect(s.store.db.prepare('SELECT count(*) count FROM cards').get()).toEqual(before);
 });
 it('rejects Owlbear origin, bearer credentials, and room subscriptions while allowing account notices',async()=>{
  const s=await setup();
  expect((await s.request('session','GET',undefined,{Origin:'https://obr.dnd.center'})).status).toBe(503);
  expect((await s.request('session','GET',undefined,{Authorization:'Bearer test'})).status).toBe(503);
  expect((await s.request('changes','POST',{rooms:[{id:'room',capability:'test'}]})).status).toBe(503);
  expect((await s.request('changes','POST',{})).status).toBe(200);
  const health=await(await s.request('health')).json();expect(health).toMatchObject({version:'1.0.303',cloudFeaturesEnabled:true,standaloneOnly:true,accountLibrariesPrivate:true,temporaryUpload:false,publicDirectory:false,pluginConnections:false});
 });
 it('redirects QQ to the registered production callback and original cookie',async()=>{
  const s=await setup(),response=await s.request('auth/qq/login?returnTo=%2Fcard%2F%3Fintro%3D0');
  expect(response.status).toBe(302);const target=new URL(response.headers.get('location')!);expect(target.origin).toBe('https://graph.qq.com');expect(target.searchParams.get('redirect_uri')).toBe(origin+'/api/auth/qq/callback');
  expect(response.headers.get('set-cookie')).toContain('dnd_qq_state=');expect(response.headers.get('set-cookie')).not.toContain('lab2');
 });
 it('refuses unsafe anonymous or test-isolated deployment options',()=>{
  const store=new CloudStore(':memory:');try{
   expect(()=>createCloudServer(store,origin,{standaloneOnly:true})).toThrow();
   expect(()=>createCloudServer(store,origin,{standaloneOnly:true,accountPrivate:true,qq:{appId:'123456789',appKey:'test-only-key',callback:origin+'/api/auth/qq/callback?cloud_lab=stage2',isolation:'stage2'}})).toThrow();
  }finally{store.close();}
 });
});
