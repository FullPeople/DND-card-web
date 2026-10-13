import {describe,expect,it,vi} from 'vitest';
import {queuedRefresh} from '../src/cloud/queuedRefresh';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return {promise,resolve};};
describe('refresh invalidations are drained before a change cursor advances',()=>{
 it('coalesces overlapping requests and performs the final read',async()=>{
  const first=deferred(),second=deferred(),run=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),queue=queuedRefresh(run);
  const pending=queue.request();await Promise.resolve();const repeated=queue.request();queue.request();expect(run).toHaveBeenCalledTimes(1);
  first.resolve();await Promise.resolve();await Promise.resolve();expect(run).toHaveBeenCalledTimes(2);let done=false;void pending.then(()=>done=true);await Promise.resolve();expect(done).toBe(false);
  second.resolve();await Promise.all([pending,repeated]);expect(done).toBe(true);queue.stop();
 });
 it('retries after a failed read instead of treating it as reconciled',async()=>{
  const run=vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(undefined),queue=queuedRefresh(run);
  await expect(queue.request()).rejects.toThrow('offline');await queue.request();expect(run).toHaveBeenCalledTimes(2);queue.stop();
 });
 it('closing a scope prevents a queued follow-up',async()=>{
  const first=deferred(),run=vi.fn(()=>first.promise),queue=queuedRefresh(run),pending=queue.request();await Promise.resolve();queue.request();queue.stop();first.resolve();await pending;await queue.request();expect(run).toHaveBeenCalledTimes(1);
 });
 it('accepts reentrant invalidation without creating a second concurrent run',async()=>{
  let queue:ReturnType<typeof queuedRefresh>;let running=0,maximum=0,calls=0;
  queue=queuedRefresh(async()=>{running++;maximum=Math.max(maximum,running);if(++calls===1)void queue.request();await Promise.resolve();running--;});
  await queue.request();expect(calls).toBe(2);expect(maximum).toBe(1);queue.stop();
 });
});
