import {describe,it,expect} from 'vitest';
import {mutationQueue} from '../src/platform/mutationQueue';
describe('mutation queue receipts',()=>{
 it('a verified readback or explicit reconciliation unlocks only future intents',async()=>{
  const events=new EventTarget(),q=mutationQueue(events),error=Object.assign(Error('unknown'),{uncertain:true,requestId:'readback-one'});let sent=0;
  await expect(q.run('hero',async()=>{throw error;})).rejects.toMatchObject({uncertain:true,requestId:error.requestId});
  await expect(q.run('hero',async()=>++sent)).rejects.toMatchObject({uncertain:true,requestId:error.requestId});
  const unrelated=new Event('workbench-operation-reconciled');Object.assign(unrelated,{detail:{requestId:'other'}});events.dispatchEvent(unrelated);
  await expect(q.run('hero',async()=>++sent)).rejects.toMatchObject({uncertain:true,requestId:error.requestId});
  const confirmed=new Event('workbench-operation-reconciled');Object.assign(confirmed,{detail:{requestId:'readback-one'}});events.dispatchEvent(confirmed);
  expect(sent).toBe(0);await expect(q.run('hero',async()=>++sent)).resolves.toBe(1);
 });
 it('serializes normal edits while another card runs immediately',async()=>{
  const q=mutationQueue(),calls:string[]=[];let release!:()=>void;
  const first=q.run('hero',async()=>{calls.push('one');await new Promise<void>(r=>release=r);return 2;});
  const second=q.run('hero',async before=>{calls.push('two:'+before);return 3;});
  const other=q.run('other',async()=>{calls.push('other');return 4;});await other;expect(calls).toEqual(['one','other']);release();await Promise.all([first,second]);expect(calls).toEqual(['one','other','two:2']);
 });
 it('does not drop subsequent intents after a known failure',async()=>{
  const q=mutationQueue();const bad=q.run('hero',async()=>{throw Error('known conflict');}),next=q.run('hero',async()=>7);await expect(bad).rejects.toThrow('known conflict');await expect(next).resolves.toBe(7);
 });
 it('stops waiting and future intents after unknown outcome until terminal receipt',async()=>{
  const events=new EventTarget(),q=mutationQueue(events),error=Object.assign(Error('unknown'),{uncertain:true,requestId:'request-one'});let sent=0;
  const first=q.run('hero',async()=>{throw error;}),waiting=q.run('hero',async()=>++sent);await expect(first).rejects.toMatchObject({uncertain:true,requestId:error.requestId});await expect(waiting).rejects.toMatchObject({uncertain:true,requestId:error.requestId,queueBlocked:true});await expect(q.run('hero',async()=>++sent)).rejects.toMatchObject({uncertain:true,requestId:error.requestId});expect(sent).toBe(0);
  const receipt=(uncertain:boolean)=>{const e=new Event('workbench-operation-result');Object.assign(e,{detail:{requestId:'request-one',ok:!uncertain,uncertain}});events.dispatchEvent(e);};receipt(true);await expect(q.run('hero',async()=>++sent)).rejects.toMatchObject({uncertain:true,requestId:error.requestId});receipt(false);await expect(q.run('hero',async()=>++sent)).resolves.toBe(1);expect(sent).toBe(1);
 });
});
