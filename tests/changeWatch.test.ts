import {afterEach,describe,expect,it,vi} from 'vitest';
import {watchCloudChanges} from '../src/cloud/changeWatch';
// Exercise the retained lifecycle engine explicitly; paused entry points have
// their own zero-request/zero-timer regression in cloudSuspension.test.ts.
vi.mock('../src/cloud/availability',()=>({cloudFeaturesEnabled:true}));

const notice=(accountId:string|null='a',changed=true)=>({accountId,cursor:'a'.repeat(64),changed});
afterEach(()=>{vi.useRealTimers();});
describe('cloud change transport lifecycle',()=>{
 it('does not deliver a reply after its account scope changed',async()=>{
  let scope='a',release!:(value:unknown)=>void;
  const pending=new Promise(resolve=>release=resolve),changed=vi.fn();
  const watcher=watchCloudChanges({scope:()=>scope,account:()=>scope,request:()=>pending,changed});
  scope='b';watcher.stop();release(notice());await watcher.done;expect(changed).not.toHaveBeenCalled();
 });
 it('rejects a response tagged with the wrong authenticated account',async()=>{
  vi.useFakeTimers();const changed=vi.fn(),failed=vi.fn();
  const watcher=watchCloudChanges({scope:()=> 'a',account:()=> 'a',request:async()=>notice('b'),changed,failed});
  await vi.advanceTimersByTimeAsync(1);expect(changed).not.toHaveBeenCalled();expect(failed).toHaveBeenCalledTimes(1);
  watcher.stop();await watcher.done;expect(vi.getTimerCount()).toBe(0);
 });
 it('waits for a refresh to finish before advancing the cursor',async()=>{
  vi.useFakeTimers();let release!:()=>void;const refresh=new Promise<void>(resolve=>release=resolve);
  const request=vi.fn(async(_cursor:string|undefined,_signal:AbortSignal)=>notice()),changed=vi.fn(()=>refresh);
  const watcher=watchCloudChanges({scope:()=> 'a',request,changed});
  await vi.advanceTimersByTimeAsync(1);expect(request).toHaveBeenCalledTimes(1);
  release();await vi.advanceTimersByTimeAsync(51);expect(request.mock.calls.length).toBe(2);expect(request.mock.calls[1][0]).toBe('a'.repeat(64));
  watcher.stop();await watcher.done;expect(vi.getTimerCount()).toBe(0);
 });
 it('keeps the old cursor when a refresh fails so the next request reconciles again',async()=>{
  vi.useFakeTimers();const request=vi.fn(async(_cursor:string|undefined,_signal:AbortSignal)=>notice()),changed=vi.fn().mockRejectedValueOnce(Error('Read failed')).mockResolvedValue(undefined);
  const watcher=watchCloudChanges({scope:()=> 'a',request,changed});
  await vi.advanceTimersByTimeAsync(1001);expect(request.mock.calls[1][0]).toBeUndefined();
  watcher.stop();await watcher.done;
 });
 it('stops unsupported transports while retaining the callers existing fallback',async()=>{
  const request=vi.fn(async()=>{throw Object.assign(Error('Unsupported'),{status:404});}),changed=vi.fn();
  const watcher=watchCloudChanges({scope:()=> 'a',request,changed});await watcher.done;
  expect(request).toHaveBeenCalledTimes(1);expect(changed).not.toHaveBeenCalled();watcher.stop();
 });
 it('aborts a held request and clears every timer when closed',async()=>{
  vi.useFakeTimers();let signal:AbortSignal|undefined;
  const watcher=watchCloudChanges({scope:()=> 'a',changed:()=>{},request:async(_,abort)=>new Promise((_resolve,reject)=>{signal=abort;abort.addEventListener('abort',()=>reject(Error('Aborted')),{once:true});})});
  watcher.stop();await watcher.done;expect(signal?.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);
 });
});
