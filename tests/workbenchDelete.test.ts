import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {deleteBatchGuard} from '../src/platform/deleteBatchGuard';

// Run the actual App batch handler; React state and transport are synthetic
// boundaries. Keep the audited editor source and its existing delete loop intact.
const appSource=readFileSync(new URL('../src/ui/App.tsx',import.meta.url),'utf8');
const batchSource=appSource.match(/async function removeCards\(ids:string\[\]\)\{return deleteFlight[\s\S]*?\n  \}\);\}/)?.[0];
if(!batchSource)throw Error('App.removeCards fixture entry missing');
const compiledBatch=stripTypeScriptTypes(batchSource);
function batch(api:Awaited<ReturnType<typeof ready>>,uncertain=new Map<string,string>()){
 return new Function('deleteFlight','writable','setPendingDeleteIds','inWorkbench','workbenchRequest','deleteUncertain','setBlockedDeleteIds',compiledBatch+'\nreturn removeCards;')({current:deleteBatchGuard()},{current:true},vi.fn(),true,api.workbenchRequest,{current:uncertain},vi.fn()) as (ids:string[])=>Promise<void>;
}

const wire=vi.hoisted(()=>({sent:[] as any[],receive:undefined as undefined|((m:any)=>void)}));
vi.mock('../src/platform/relay',()=>({Relay:class{
 constructor(_url:string,_session:string,_role:string,_secret:string,receive:(m:any)=>void){wire.receive=receive;}
 send(message:any){wire.sent.push(message);return Promise.resolve();}
}}));
vi.mock('../src/platform/workbenchSound',()=>({startWorkbenchSound:vi.fn(),playWorkbenchSound:vi.fn()}));
beforeEach(()=>{
 vi.resetModules();vi.useFakeTimers();vi.setSystemTime(100000);wire.sent=[];
 vi.stubGlobal('window',Object.assign(new EventTarget(),{opener:null}));
 vi.stubGlobal('location',new URL('https://fixture.test/#suite=delete&bridge=https%3A%2F%2Ffixture.test&relay=fixture'));
});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});
const card=(id:string)=>({id,name:id,itemId:'token-'+id,write:true,locked:false,inScene:true,resources:[],stats:{},grantVersion:'0:0'});
const access=(epoch:number,ids:string[])=>({room:'room',scope:'room:scene',epoch,role:'GM',cards:ids.map(card),monsters:[],enabled:{characterCards:true}});
const receive=(type:string,extra:any={})=>wire.receive!({protocol:'full-suite-workbench/v1',session:'delete',hostStarted:1,type,...extra});
const deletes=()=>wire.sent.filter(m=>m.type==='delete');
async function ready(ids=['a'],legacy=false){
 const api=await import('../src/platform/workbench');
 receive('ready');receive('catalog',{sequence:1,...(!legacy?{access:access(1,ids)}:{}),cards:ids.map(card),monsters:[],role:'GM',enabled:{characterCards:true}});
 return api;
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

describe('delete receipts and selection batches',()=>{
 it('waits for a terminal receipt when access removes the deleted card first',async()=>{
  const api=await ready();let settled=false;
  const result=api.workbenchRequest('delete',{key:undefined,itemId:'card:a'}).finally(()=>{settled=true;});
  const outcome=result.catch(e=>e),request=deletes()[0];
  receive('access',{access:access(2,[])});await flush();
  expect(settled).toBe(false);expect(api.getWorkbench().cards).toEqual([]);
  expect(wire.sent.some(m=>m.type==='cancel'&&m.requestId===request.requestId)).toBe(false);
  receive('ack',{requestId:request.requestId,ok:true,result:{deleted:true}});
  expect(await outcome).toEqual({deleted:true});
  await expect(api.workbenchRequest('delete',{key:undefined,itemId:'card:a'})).rejects.toThrow(/权限/);
  expect(deletes()).toHaveLength(1);
 });
 it('deletes all selected cards once despite each removal preceding its receipt',async()=>{
  const api=await ready(['a','b','c']),removeCards=batch(api);
  const result=removeCards(['a','b','c']).catch(e=>e);
  for(const [index,id] of ['a','b','c'].entries()){
   await flush();expect(deletes()).toHaveLength(index+1);const request=deletes()[index];
   expect(request.itemId).toBe('card:'+id);receive('access',{access:access(index+2,['a','b','c'].slice(index+1))});
   receive('ack',{requestId:request.requestId,ok:true,result:{deleted:true,cleanupPending:false}});
   receive('ack',{requestId:request.requestId,ok:true,result:{deleted:true}});
  }
  expect(await result).toBeUndefined();expect(deletes()).toHaveLength(3);expect(wire.sent.filter(m=>m.type==='cancel')).toEqual([]);
 });
 it('supports a legacy host directory that removes a card before its ACK',async()=>{
  const api=await ready(['a'],true),result=api.workbenchRequest('delete',{key:undefined,itemId:'card:a'}).catch(e=>e),request=deletes()[0];
  receive('catalog',{sequence:2,cards:[],monsters:[],role:'GM',enabled:{characterCards:true}});
  receive('ack',{requestId:request.requestId,ok:true,result:{deleted:'a'}});
  expect(await result).toEqual({deleted:'a'});
 });
 it('also accepts an ACK arriving before the directory removal',async()=>{
  const api=await ready(),result=api.workbenchRequest('delete',{key:undefined,itemId:'card:a'}),request=deletes()[0];
  receive('ack',{requestId:request.requestId,ok:true,result:{deleted:true}});expect(await result).toMatchObject({deleted:true});
  receive('access',{access:access(2,[])});expect(api.getWorkbench().cards).toEqual([]);
  expect(wire.sent.some(m=>m.type==='cancel'&&m.requestId===request.requestId)).toBe(false);
 });
 it('recovers a lost receipt by querying status without replaying deletion',async()=>{
  const api=await ready(),result=api.workbenchRequest('delete',{key:undefined,itemId:'card:a'}).catch(e=>e),request=deletes()[0];
  receive('access',{access:access(2,[])});await vi.advanceTimersByTimeAsync(15000);
  expect(wire.sent.some(m=>m.type==='requestStatus'&&m.requestId===request.requestId)).toBe(true);
  receive('ack',{requestId:request.requestId,ok:true,result:{deleted:true,cleanupPending:true}});
  expect(await result).toMatchObject({deleted:true,cleanupPending:true});expect(deletes()).toHaveLength(1);
 });
 it('does not treat a missing card as proof of deletion when the host denies it',async()=>{
  const api=await ready();let settled=false;const result=api.workbenchRequest('delete',{key:undefined,itemId:'card:a'}).catch(e=>{settled=true;return e;}),request=deletes()[0];
  receive('access',{access:access(2,[])});await flush();expect(settled).toBe(false);
  receive('ack',{requestId:request.requestId,ok:false,message:'角色修改权限已改变',uncertain:false});
  expect(await result).toMatchObject({message:'角色修改权限已改变',uncertain:false});
 });
 it('still cancels a delete on a write revocation that retains the card',async()=>{
  const api=await ready(),result=api.workbenchRequest('delete',{key:undefined,itemId:'card:a'}).catch(e=>e),request=deletes()[0];
  receive('access',{access:{...access(2,['a']),cards:[{...card('a'),write:false}]}});
  expect(await result).toMatchObject({permissionChanged:true,uncertain:true});
  expect(wire.sent.some(m=>m.type==='cancel'&&m.requestId===request.requestId)).toBe(true);
 });
 it('still cancels deletion when the card module is disabled',async()=>{
  const api=await ready(),result=api.workbenchRequest('delete',{key:undefined,itemId:'card:a'}).catch(e=>e);
  receive('access',{access:{...access(2,[]),enabled:{characterCards:false}}});
  expect(await result).toMatchObject({permissionChanged:true,uncertain:true});
 });
 it('keeps the original App single-flight guard on repeated clicks',async()=>{
  const api=await ready(),removeCards=batch(api),first=removeCards(['a']),second=removeCards(['a']).catch(e=>e);
  expect(await second).toBeInstanceOf(Error);expect(deletes()).toHaveLength(1);
  receive('ack',{requestId:deletes()[0].requestId,ok:true,result:{deleted:true}});await first;
 });
 it.each(['scene','room','role','host'])('still cancels a delete on a %s change',async kind=>{
  const api=await ready(),result=api.workbenchRequest('delete',{key:undefined,itemId:'card:a'}).catch(e=>e);
  receive('access',{access:access(2,[])});
  if(kind==='host')receive('ready',{hostStarted:2});
  else receive('access',{access:{...access(3,[]),...(kind==='scene'?{scope:'room:next'}:kind==='room'?{room:'other',scope:'other:scene'}:{role:'PLAYER'})}});
  expect(await result).toMatchObject({permissionChanged:true,uncertain:true});
 });
 it('cancels other writes to the removed card while keeping its delete receipt pending',async()=>{
  const api=await ready(),save=api.workbenchRequest('save',{key:undefined,itemId:'card:a',native:{name:'draft'}}).catch(e=>e);
  const result=api.workbenchRequest('delete',{key:undefined,itemId:'card:a'}).catch(e=>e),request=deletes()[0];
  receive('access',{access:access(2,[])});expect(await save).toMatchObject({permissionChanged:true,uncertain:true});
  receive('ack',{requestId:request.requestId,ok:true,result:{deleted:true}});expect(await result).toMatchObject({deleted:true});
 });
 it('stops a batch on a real failure and reports only receipt-confirmed cards',async()=>{
  const api=await ready(['a','b','c']),removeCards=batch(api);
  const result=removeCards(['a','b','c']).catch(e=>e),first=deletes()[0];
  receive('access',{access:access(2,['b','c'])});receive('ack',{requestId:first.requestId,ok:true,result:{deleted:true}});await flush();
  expect(deletes()).toHaveLength(2);receive('ack',{requestId:deletes()[1].requestId,ok:false,message:'删除失败'});
  expect(await result).toMatchObject({completedIds:['a'],uncertainIds:[],uncertain:false});expect(deletes()).toHaveLength(2);
 });
 it('blocks an uncertain card from being submitted again',async()=>{
  const api=await ready(),removeCards=batch(api,new Map([['old-request','a']]));
  const result=await removeCards(['a']).catch(e=>e);
  expect(result).toMatchObject({completedIds:[],uncertainIds:[]});expect(result.message).toContain('不会重复提交');expect(deletes()).toEqual([]);
 });
 it('keeps a lost delete uncertain and stops the remainder instead of inventing success',async()=>{
  const api=await ready(['a','b']),removeCards=batch(api);
  const result=removeCards(['a','b']).catch(e=>e),request=deletes()[0];
  receive('access',{access:access(2,['b'])});
  for(let i=0;i<19;i++){receive('pong');await vi.advanceTimersByTimeAsync(10000);}
  expect(await result).toMatchObject({completedIds:[],uncertainIds:['a'],uncertain:true,requestId:request.requestId});expect(deletes()).toHaveLength(1);
 });
});
