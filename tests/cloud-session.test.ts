import {afterEach,describe,expect,it,vi} from 'vitest';

const session=(id:string)=>({authenticated:true,qqLogin:'ready',account:{id,qq:null},csrf:'test-only-csrf'});
const deferred=<T,>()=>{let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const response=(id:string)=>new Response(JSON.stringify(session(id)),{headers:{'Content-Type':'application/json'}});
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});

describe('cloud session request ordering',()=>{
 it('shares concurrent display reads and rechecks after they finish',async()=>{
  const first=deferred<Response>(),fetcher=vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(response('next-account'));vi.stubGlobal('fetch',fetcher);
  const api=await import('../src/cloud/api'),one=api.cloudSession(),two=api.cloudSession();expect(fetcher).toHaveBeenCalledTimes(1);
  first.resolve(response('first-account'));expect((await one).account?.id).toBe('first-account');expect(await two).toEqual(await one);
  expect((await api.cloudSession()).account?.id).toBe('next-account');expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('does not let a display request provide authorization for a later write',async()=>{
  const old=deferred<Response>(),fetcher=vi.fn().mockReturnValueOnce(old.promise).mockImplementation(async()=>response('new-account'));vi.stubGlobal('fetch',fetcher);
  const api=await import('../src/cloud/api'),display=api.cloudSession();
  await expect(api.cloudMutation('old-account','cards/test-card','PUT',{})).rejects.toMatchObject({code:'account_changed'});
  expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls.every(([url])=>url==='/api/session')).toBe(true);
  old.resolve(response('old-account'));expect((await display).account?.id).toBe('new-account');expect(fetcher).toHaveBeenCalledTimes(3);
 });
 it('discards a delayed response after the account notification',async()=>{
  const old=deferred<Response>(),fetcher=vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(response('new-account'));vi.stubGlobal('fetch',fetcher);
  const api=await import('../src/cloud/api'),display=api.cloudSession(),changed=vi.fn(),stop=api.subscribeCloudSessionChanges(changed);
  api.announceCloudSessionChange();old.resolve(response('old-account'));
  expect((await display).account?.id).toBe('new-account');expect(changed).toHaveBeenCalledOnce();stop();
 });
 it('releases a failed display request instead of retaining the rejected flight',async()=>{
  const fetcher=vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(response('reconnected'));vi.stubGlobal('fetch',fetcher);
  const api=await import('../src/cloud/api');await expect(api.cloudSession()).rejects.toThrow('offline');expect((await api.cloudSession()).account?.id).toBe('reconnected');expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('invalidates display reads after successful logout and notifies without identity data',async()=>{
  const channels:Array<{postMessage:ReturnType<typeof vi.fn>;close:ReturnType<typeof vi.fn>;onmessage?:((event:MessageEvent)=>void)|null}>=[];
  class Channel{postMessage=vi.fn();close=vi.fn();onmessage?:((event:MessageEvent)=>void)|null;constructor(_name:string){channels.push(this);}}
  vi.stubGlobal('window',{});vi.stubGlobal('BroadcastChannel',Channel);
  const fetcher=vi.fn().mockResolvedValueOnce(response('account')).mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(JSON.stringify({authenticated:false,qqLogin:'ready'})));vi.stubGlobal('fetch',fetcher);
  const api=await import('../src/cloud/api'),changed=vi.fn(),stop=api.subscribeCloudSessionChanges(changed);
  await api.cloudMutation('account','logout','POST');expect(changed).toHaveBeenCalledOnce();expect((await api.cloudSession()).authenticated).toBe(false);
  expect(channels.flatMap(channel=>channel.postMessage.mock.calls.map(([value])=>value))).toEqual([{type:'session-changed'},{type:'session-changed'}]);
  stop();expect(channels[0].close).toHaveBeenCalledOnce();
 });
 it('responds to another tab and detaches subscribers after close',async()=>{
  let channel!:{onmessage?:((event:MessageEvent)=>void)|null;close:ReturnType<typeof vi.fn>};
  class Channel{postMessage=vi.fn();close=vi.fn();onmessage?:((event:MessageEvent)=>void)|null;constructor(_name:string){channel=this;}}
  vi.stubGlobal('window',{});vi.stubGlobal('BroadcastChannel',Channel);
  const api=await import('../src/cloud/api'),changed=vi.fn(),stop=api.subscribeCloudSessionChanges(changed);
  channel.onmessage?.({data:{type:'session-changed'}} as MessageEvent);expect(changed).toHaveBeenCalledOnce();
  channel.onmessage?.({data:{type:'unrelated'}} as MessageEvent);expect(changed).toHaveBeenCalledOnce();stop();
  channel.onmessage?.({data:{type:'session-changed'}} as MessageEvent);expect(changed).toHaveBeenCalledOnce();expect(channel.close).toHaveBeenCalledOnce();
 });
});
