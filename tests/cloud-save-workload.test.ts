import {describe,expect,it,vi} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {newCharacter,type Character} from '../src/core/model';
import {characterHash,createCloudSync,type SyncReceipt,type SyncDependencies} from '../src/cloud/sync';
import {cloudSaveScheduler,snapshotHasher} from '../src/cloud/saveScheduler';

describe('cloud-only workload comparison',()=>{
 it('keeps the final persisted card while avoiding whole-book hashes on each edit',async()=>{
  async function measure(optimized:boolean){
   let cards=Array.from({length:40},(_,i)=>({...newCharacter(),name:'原创测试 '+i,notes:'x'.repeat(250000)})),hashes=0,reads=0,writes=0;
   const receipts=new Map<string,SyncReceipt>();
   for(const card of cards)receipts.set(card.id,{binding:{accountId:'fixture',cloudId:card.id,revision:1},hash:await characterHash(card),sourceId:card.id});
   const rawHash=async(card:Character)=>{hashes++;return characterHash(card);},hash=optimized?snapshotHasher(rawHash):rawHash;
   const deps:SyncDependencies={readCharacter:async id=>{reads++;return cards.find(card=>card.id===id)!;},readReceipt:async id=>receipts.get(id)!,writeReceipt:async(id,row)=>{receipts.set(id,row);},session:async()=>({authenticated:true,qqLogin:'ready',account:{id:'fixture',qq:null}}),read:async()=>{throw Error('No unchanged body should be fetched');},directory:async()=>{throw Error('No directory reconciliation required');},mutation:async<T>(account:string,path:string,method:string,value?:unknown)=>{writes++;const data=value as {character:Character;revision:number};return {id:data.character.id,character:data.character,revision:data.revision+1,updatedAt:'now',role:'owner'} as T;},hash,lock:async(_,fn)=>fn(),changed:()=>{}};
   const engine=createCloudSync(deps);let lastFlight:Promise<void>|undefined;
   const queue=cloudSaveScheduler(id=>lastFlight=engine.run(id),1);
   if(optimized){queue.enable(true);queue.observe(cards,cards[0].id);await vi.advanceTimersByTimeAsync(1);expect(lastFlight).toBeDefined();await lastFlight;}
   const started=performance.now();
   for(let i=1;i<=8;i++){
    cards=[{...cards[0],runtime:{...cards[0].runtime,hp:i}},...cards.slice(1)];
    if(optimized){lastFlight=undefined;queue.observe(cards,cards[0].id);await vi.advanceTimersByTimeAsync(1);expect(lastFlight).toBeDefined();await lastFlight;}
    else for(const card of cards)await engine.run(card.id);
   }
   queue.enable(false);
   return {characters:cards.length,edits:8,hashes,reads,writes,finalHp:cards[0].runtime.hp,computeMs:Math.round((performance.now()-started)*100)/100};
  }
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
  try{
   const before=await measure(false),after=await measure(true);
   expect(before.hashes).toBe(328);expect(after.hashes).toBe(9);expect(after.writes).toBe(8);expect(before.writes).toBe(after.writes);expect(after.finalHp).toBe(8);
   mkdirSync('.local-evidence/cloud-stage1',{recursive:true});writeFileSync('.local-evidence/cloud-stage1/workload.json',JSON.stringify({syntheticData:true,realQQ:false,networkMeasured:false,before,after},null,2));
  }finally{vi.useRealTimers();}
 });
});
