import {afterEach,expect,it,vi} from 'vitest';
import {snapshotSaveQueue} from '../src/platform/snapshotSaveQueue';
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
afterEach(()=>vi.useRealTimers());
it('coalesces a burst while every promise waits for the durable latest snapshot',async()=>{
 vi.useFakeTimers();const write=vi.fn(async(_value:number)=>{}),q=snapshotSaveQueue(write),done=vi.fn();
 const saves=Array.from({length:100},(_,i)=>q.enqueue(i).then(done));expect(write).not.toHaveBeenCalled();expect(done).not.toHaveBeenCalled();
 await vi.advanceTimersByTimeAsync(40);await Promise.all(saves);expect(write.mock.calls).toEqual([[99]]);expect(done).toHaveBeenCalledTimes(100);
});
it('preserves an in-flight save and only replaces the pending local snapshot',async()=>{
 let finish!:()=>void;const values:number[]=[],q=snapshotSaveQueue<number>(async n=>{values.push(n);if(n===1)await new Promise<void>(r=>finish=r);});
 const a=q.enqueue(1);q.flush();await tick();const b=q.enqueue(2),c=q.enqueue(3);expect(values).toEqual([1]);finish();await Promise.all([a,b,c]);expect(values).toEqual([1,3]);
});
it('barriers cannot be replaced or overtaken, including snapshots on either side',async()=>{
 const write=vi.fn(async(_value:number)=>{}),q=snapshotSaveQueue(write);
 const saves=[q.enqueue(1),q.enqueue(2),q.enqueue(3,true),q.enqueue(4),q.enqueue(5)];await Promise.all(saves);expect(write.mock.calls).toEqual([[2],[3],[5]]);
});
it('ordered remote mode retains A → B → A with no coalescing',async()=>{
 const write=vi.fn(async(_value:string)=>{}),q=snapshotSaveQueue(write,{coalesce:false});await Promise.all(['A','B','A'].map(value=>q.enqueue(value)));expect(write.mock.calls.flat()).toEqual(['A','B','A']);
});
it('rejects every affected caller on failure and permits an explicit later retry',async()=>{
 const write=vi.fn().mockRejectedValueOnce(Error('quota')).mockResolvedValue(undefined),q=snapshotSaveQueue<number>(write);
 const a=expect(q.enqueue(1)).rejects.toThrow('quota'),b=expect(q.enqueue(2)).rejects.toThrow('quota');q.flush();await Promise.all([a,b]);await tick();const retry=q.enqueue(3);q.flush();await retry;expect(write.mock.calls).toEqual([[2],[3]]);
});
it('flushes immediately for page hiding rather than waiting for the debounce timer',async()=>{
 vi.useFakeTimers();const write=vi.fn(async()=>{}),q=snapshotSaveQueue(write);const save=q.enqueue(1);q.flush();await save;expect(write).toHaveBeenCalledOnce();await vi.runAllTimersAsync();expect(write).toHaveBeenCalledOnce();
});
