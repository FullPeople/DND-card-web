import {afterEach,expect,test,vi} from 'vitest';
import {withRequestTimeout} from '../src/platform/requestTimeout';
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});

test('requests work without the newer AbortSignal factories and release successful request listeners',async()=>{
 vi.spyOn(AbortSignal,'any').mockImplementation(()=>{throw Error('unavailable');});
 vi.spyOn(AbortSignal,'timeout').mockImplementation(()=>{throw Error('unavailable');});
 const parent=new AbortController(),add=vi.spyOn(parent.signal,'addEventListener'),remove=vi.spyOn(parent.signal,'removeEventListener');
 expect(await withRequestTimeout(100,parent.signal,async()=>42)).toBe(42);
 expect(remove).toHaveBeenCalledWith('abort',add.mock.calls[0][1]);expect(parent.signal.aborted).toBe(false);
});
test('already cancelled work never starts',async()=>{const parent=new AbortController(),request=vi.fn();parent.abort(new Error('closed'));await expect(withRequestTimeout(10,parent.signal,request)).rejects.toThrow('closed');expect(request).not.toHaveBeenCalled();});
test('closing a parent cancels a pending response body and removes its listener',async()=>{
 const parent=new AbortController(),remove=vi.spyOn(parent.signal,'removeEventListener');
 const request=withRequestTimeout(1000,parent.signal,signal=>new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason));}));
 parent.abort(new Error('closed'));await expect(request).rejects.toThrow('closed');expect(remove).toHaveBeenCalledTimes(1);
});
test('deadline includes response body consumption and does not cancel the parent',async()=>{
 vi.useFakeTimers();const parent=new AbortController();
 const request=withRequestTimeout(20,parent.signal,async signal=>{await Promise.resolve('headers received');return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason)));});
 const result=expect(request).rejects.toMatchObject({name:'TimeoutError'});await vi.advanceTimersByTimeAsync(21);await result;expect(parent.signal.aborted).toBe(false);expect(vi.getTimerCount()).toBe(0);
});
test('failed work preserves its error and releases timeout and cancellation listener',async()=>{
 vi.useFakeTimers();const parent=new AbortController(),remove=vi.spyOn(parent.signal,'removeEventListener');
 await expect(withRequestTimeout(20,parent.signal,async()=>{throw Error('HTTP 503');})).rejects.toThrow('HTTP 503');expect(remove).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
