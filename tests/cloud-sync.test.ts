import {describe,it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {characterHash,createCloudSync,type SyncDependencies,type SyncReceipt,type SyncState} from '../src/cloud/sync';
import {CloudRequestError,type CloudCard} from '../src/cloud/api';

function setup(){
 let character=newCharacter('2024');character.name='本机草稿';
 let receipt:SyncReceipt={},remote:CloudCard|undefined;const states:SyncState[]=[],writes:any[]=[];
 const deps:SyncDependencies={readCharacter:async()=>structuredClone(character),readReceipt:async()=>structuredClone(receipt),writeReceipt:async(_,row)=>{receipt=structuredClone(row);},session:async()=>({authenticated:false,qqLogin:'pending',temporaryUpload:true,uploadOwner:{id:'owner'}}),read:async()=>structuredClone(remote!),directory:async()=>({cards:remote?[{...remote,name:remote.character.name,edition:'2024'}]:[],slots:{scope:'ip',used:1,total:10}}),mutation:async<T>(account:string,path:string,method:string,value?:unknown)=>{
  writes.push({account,path,method,value});const body=value as any;
  if(method==='PUT'&&body.revision!==remote!.revision)throw new CloudRequestError(409,'revision_conflict','本机草稿保留。');
  remote={id:'ABCDEF',revision:(remote?.revision||0)+1,character:structuredClone(body.character),updatedAt:'now',role:'owner'};return structuredClone(remote) as T;
 },hash:characterHash,lock:async(_,fn)=>fn(),changed:(_,row)=>states.push(row)};
 return {deps,engine:createCloudSync(deps),states,writes,get character(){return character;},get receipt(){return receipt;},get remote(){return remote!;},set receipt(row:SyncReceipt){receipt=row;}};
}
describe('cloud draft synchronization',()=>{
 it('does not upload without initial consent, then retains one independent ID',async()=>{
  const s=setup();await s.engine.run(s.character.id);expect(s.writes).toHaveLength(0);expect(s.states.at(-1)?.phase).toBe('local');
  await s.engine.run(s.character.id,'owner');expect(s.writes).toHaveLength(1);expect(s.remote.character.runtime).toEqual(s.character.runtime);expect(s.receipt.binding?.cloudId).toBe('ABCDEF');
  await s.engine.run(s.character.id);expect(s.writes).toHaveLength(1);s.character.name='修改后';await s.engine.run(s.character.id);expect(s.writes[1].method).toBe('PUT');expect(s.remote.revision).toBe(2);expect(s.remote.character.name).toBe('修改后');
 });
 it('coalesces overlapping saves and sends edits made during the first request next',async()=>{
  const s=setup(),original=s.deps.mutation;let release!:()=>void;const wait=new Promise<void>(resolve=>release=resolve);let started!:()=>void;const ready=new Promise<void>(resolve=>started=resolve);
  s.deps.mutation=async<T>(...args:Parameters<SyncDependencies['mutation']>)=>{started();await wait;return original<T>(...args);};
  const first=s.engine.run(s.character.id,'owner');await ready;s.character.notes='请求期间的新笔记';const second=s.engine.run(s.character.id,'owner');release();await Promise.all([first,second]);
  expect(s.writes.map(row=>row.method)).toEqual(['POST','PUT']);expect(s.remote.character.notes).toBe('请求期间的新笔记');expect(s.receipt.binding?.revision).toBe(2);
 });
 it('keeps the local card and original CAS revision on concurrent conflicts',async()=>{
  const s=setup();await s.engine.run(s.character.id,'owner');const revision=s.receipt.binding!.revision;
  s.deps.mutation=async()=>{throw new CloudRequestError(409,'revision_conflict','云端有其他修改，本机草稿保留。');};s.character.notes='不可丢失的草稿';await s.engine.run(s.character.id);
  expect(s.receipt.binding?.revision).toBe(revision);expect(s.receipt.lastError?.phase).toBe('conflict');expect(s.character.notes).toBe('不可丢失的草稿');expect(s.receipt.pending).toBeUndefined();
 });
 it('reconciles a committed POST whose reply was lost without creating a second card',async()=>{
  const s=setup(),original=s.deps.mutation;s.deps.mutation=async<T>(...args:Parameters<SyncDependencies['mutation']>)=>{await original<T>(...args);throw Error('connection lost');};
  await s.engine.run(s.character.id,'owner');expect(s.receipt.pending).toBeTruthy();expect(s.states.at(-1)?.phase).toBe('uncertain');
  s.deps.mutation=original;await s.engine.run(s.character.id,'owner');expect(s.writes).toHaveLength(1);expect(s.receipt.pending).toBeUndefined();expect(s.states.at(-1)?.phase).toBe('saved');
 });
 it('never retries an unknown upload when the public directory cannot confirm it',async()=>{
  const s=setup();s.deps.mutation=async()=>{s.writes.push('attempt');throw Error('connection lost');};await s.engine.run(s.character.id,'owner');await s.engine.run(s.character.id,'owner');
  expect(s.writes).toHaveLength(1);expect(s.receipt.pending).toBeTruthy();expect(s.states.at(-1)?.phase).toBe('uncertain');
 });
 it('rejects a stale preexisting binding instead of advancing its baseline',async()=>{
  const s=setup();await s.engine.run(s.character.id,'owner');s.receipt={binding:{...s.receipt.binding!,revision:0}};s.character.name='旧基线的新草稿';await s.engine.run(s.character.id);
  expect(s.writes).toHaveLength(1);expect(s.receipt.binding?.revision).toBe(0);expect(s.states.at(-1)?.phase).toBe('conflict');
 });
 it('ignores local bookkeeping while hashing every persisted character field',async()=>{
  const s=setup(),original=await characterHash(s.character),copy={...s.character,id:'staged-id',revision:100,updatedAt:'later'};expect(await characterHash(copy)).toBe(original);
  copy.runtime={...copy.runtime,hp:123};expect(await characterHash(copy)).not.toBe(original);
 });
});
