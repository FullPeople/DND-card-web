import {afterEach,expect,test,vi} from 'vitest';
import {catalogTransport,CatalogPausedError} from '../src/data/catalogTransport';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
const ok=()=>new Response(JSON.stringify({loaded:true}),{headers:{etag:'test-revision'}});

test('a temporary connection failure recovers without turning into a failed file',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(ok());vi.stubGlobal('fetch',fetcher);
 const transport=catalogTransport(new AbortController().signal),result=expect(transport.json('https://rules.test/data.json')).resolves.toEqual({body:{loaded:true},etag:'test-revision'});
 await vi.runAllTimersAsync();await result;expect(fetcher).toHaveBeenCalledTimes(2);expect(transport.paused).toBeUndefined();expect(vi.getTimerCount()).toBe(0);
});

test('missing documents and malformed JSON remain visible and do not pause a reachable source',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response('',{status:404})).mockResolvedValueOnce(new Response('not JSON')).mockResolvedValueOnce(ok());vi.stubGlobal('fetch',fetcher);
 const transport=catalogTransport(new AbortController().signal);
 await expect(transport.json('https://rules.test/missing.json')).rejects.toThrow('HTTP 404');
 await expect(transport.json('https://rules.test/corrupt.json')).rejects.toBeInstanceOf(SyntaxError);
 await expect(transport.json('https://rules.test/good.json')).resolves.toHaveProperty('body.loaded',true);
 expect(fetcher).toHaveBeenCalledTimes(3);expect(transport.paused).toBeUndefined();
});

test('persistent connection failure pauses further files, and a new session can resume',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));vi.stubGlobal('fetch',fetcher);
 const transport=catalogTransport(new AbortController().signal);
 for(const path of ['one.json','two.json']){const result=expect(transport.json('https://rules.test/'+path)).rejects.toThrow('Failed to fetch');await vi.runAllTimersAsync();await result;}
 expect(transport.paused).toBeInstanceOf(CatalogPausedError);
 await expect(transport.json('https://rules.test/not-started.json')).rejects.toBeInstanceOf(CatalogPausedError);expect(fetcher).toHaveBeenCalledTimes(6);
 fetcher.mockImplementation(async()=>ok());
 await expect(transport.json('https://other.test/data.json')).resolves.toHaveProperty('body.loaded',true);
 await expect(catalogTransport(new AbortController().signal).json('https://rules.test/one.json')).resolves.toHaveProperty('body.loaded',true);
});

test('rate limiting shares Retry-After with the other readers of the same source',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockResolvedValueOnce(new Response('',{status:429,headers:{'Retry-After':'1'}})).mockImplementation(async()=>ok());vi.stubGlobal('fetch',fetcher);
 const transport=catalogTransport(new AbortController().signal),first=transport.json('https://rules.test/one.json');
 await vi.advanceTimersByTimeAsync(0);const second=transport.json('https://rules.test/two.json');
 await vi.advanceTimersByTimeAsync(999);expect(fetcher).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(1);await Promise.all([first,second]);expect(fetcher).toHaveBeenCalledTimes(3);expect(vi.getTimerCount()).toBe(0);
});

test('closing the load during retry cancels immediately without starting another request',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockRejectedValue(new TypeError('offline'));vi.stubGlobal('fetch',fetcher);
 const parent=new AbortController(),result=expect(catalogTransport(parent.signal).json('https://rules.test/data.json')).rejects.toThrow('closed');
 await vi.advanceTimersByTimeAsync(0);parent.abort(new Error('closed'));await result;
 expect(fetcher).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});

test('a stalled response body reaches its deadline and can recover on retry without cancelling the load',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockImplementationOnce(async(_url,init)=>({ok:true,headers:new Headers(),json:()=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}))})).mockResolvedValueOnce(ok());vi.stubGlobal('fetch',fetcher);
 const parent=new AbortController(),result=expect(catalogTransport(parent.signal).json('https://rules.test/data.json')).resolves.toHaveProperty('body.loaded',true);
 await vi.advanceTimersByTimeAsync(20401);await result;expect(fetcher).toHaveBeenCalledTimes(2);expect(parent.signal.aborted).toBe(false);expect(vi.getTimerCount()).toBe(0);
});
