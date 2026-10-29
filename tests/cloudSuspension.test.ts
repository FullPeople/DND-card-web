import {loopbackFetch as fetch,registerLoopbackServer} from './helpers/loopbackHttp';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {installCloudSuspension} from '../src/cloud/suspension';
import {cloudFeaturesEnabled} from '../src/cloud/availability';
import {watchCloudChanges} from '../src/cloud/changeWatch';
import {subscribeAccountChanges} from '../src/cloud/accountChanges';
import {createCloudServer,CloudStore} from '../server/cloud/server';
import {newCharacter} from '../src/core/model';
import {randomInt} from 'node:crypto';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.resetModules();});
describe('temporary cloud suspension',()=>{
 it('is disabled regardless of old saved preferences',()=>{expect(cloudFeaturesEnabled).toBe(false);});
 it.each(['session','cards','cards/ABCDEF','room-cards/fixture','changes','auth/qq/start','auth/qq/callback','plugin/start','plugin/poll','plugin/approve','logout'])('blocks %s before reaching the network',async path=>{
  const original=vi.fn(),target={fetch:original as typeof fetch};installCloudSuspension(target,'https://dnd.center/card/');
  for(const method of ['GET','POST','PUT','DELETE'])await expect(target.fetch('/api/'+path,{method})).rejects.toMatchObject({code:'CLOUD_DISABLED',notSent:true,uncertain:false});
  expect(original).not.toHaveBeenCalled();
 });
 it('also blocks cloud requests from an Owlbear workbench origin, including Request objects',async()=>{
  const original=vi.fn(),target={fetch:original as typeof fetch};installCloudSuspension(target,'https://obr.dnd.center/suite-dev/card/');
  await expect(target.fetch(new Request('https://dnd.center/api/cards'))).rejects.toMatchObject({code:'CLOUD_DISABLED'});
  await expect(target.fetch(new URL('https://dnd.center/api/session'))).rejects.toMatchObject({code:'CLOUD_DISABLED'});expect(original).not.toHaveBeenCalled();
 });
 it('preserves assets, room relay and unrelated network requests',async()=>{
  const response=new Response('ok'),original=vi.fn().mockResolvedValue(response),target={fetch:original as typeof fetch},restore=installCloudSuspension(target,'https://obr.dnd.center/suite-dev/card/');
  for(const url of ['/suite-dev/relay?session=test','/characters/room/card/data.json','/card/assets/card.js','https://rules.test/api/catalog'])expect(await target.fetch(url)).toBe(response);
  expect(original).toHaveBeenCalledTimes(4);restore();expect(target.fetch).toBe(original);
 });
 it('stops change waits and account subscriptions without creating timers or requests',async()=>{
  vi.useFakeTimers();const request=vi.fn(),changed=vi.fn(),scope=vi.fn();
  const watch=watchCloudChanges({request,changed,scope});watch.wake();watch.stop();await watch.done;
  subscribeAccountChanges('old-saved-account',changed)();
  expect(request).not.toHaveBeenCalled();expect(changed).not.toHaveBeenCalled();expect(scope).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
 });
 it('contains calls through the real cloud API even with an existing account session',async()=>{
  const original=vi.fn();vi.stubGlobal('fetch',original);installCloudSuspension(globalThis,'https://dnd.center/card/');
  const api=await import('../src/cloud/api');
  for(const call of [()=>api.cloudSession(),()=>api.cloudCards(),()=>api.readCloudCard('ABCDEF'),()=>api.cloudMutation('saved-account','cards','POST',{confirmUpload:true})])await expect(call()).rejects.toMatchObject({code:'CLOUD_DISABLED',notSent:true});
  expect(original).not.toHaveBeenCalled();
 });
 it('rejects HTTP login, sharing and card mutations while retaining stored cards and sessions',async()=>{
  const store=new CloudStore(':memory:'),owner=store.provisionVerifiedAccount('synthetic:cloud-suspension','1234567'),card=store.create(owner,newCharacter()),session=store.issueVerifiedSession(owner.id);
  const before=store.db.prepare('SELECT * FROM cards').all(),server=createCloudServer(store,'http://fixture.test',{featuresEnabled:cloudFeaturesEnabled,accountPrivate:true});
  let port=0;
  try{
   for(let attempt=0;attempt<20;attempt++){
    const candidate=randomInt(49152,65536);try{await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(candidate,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});});port=candidate;break;}catch(error){if((error as NodeJS.ErrnoException).code!=='EADDRINUSE')throw error;}
   }
   expect(port).toBeGreaterThan(0);registerLoopbackServer(server);
   for(const [path,method] of [['session','GET'],['cards','GET'],['cards','POST'],['cards/'+card.id,'PUT'],['cards/'+card.id,'DELETE'],['cards/'+card.id+'/rooms','POST'],['auth/qq/start','GET'],['auth/qq/callback','GET'],['plugin/start','POST'],['changes','POST'],['logout','POST']]){
    const response=await fetch(`http://127.0.0.1:${port}/api/${path}`,{method,headers:{cookie:'dnd_cloud='+session.token}});
    expect(response.status).toBe(503);expect(await response.json()).toMatchObject({error:'cloud_disabled'});expect(response.headers.get('set-cookie')).toBeNull();
   }
   const health=await fetch(`http://127.0.0.1:${port}/api/health`);expect(health.status).toBe(200);expect(await health.json()).toMatchObject({cloudFeaturesEnabled:false});
   expect(store.db.prepare('SELECT * FROM cards').all()).toEqual(before);expect(store.session(session.token)?.account.id).toBe(owner.id);
  }finally{if(server.listening){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}else server.closeChanges();store.close();}
 });
});
