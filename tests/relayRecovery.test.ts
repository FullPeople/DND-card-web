import {it,expect,vi,afterEach} from 'vitest';
import {Relay} from '../src/platform/relay';
let relay:Relay|undefined;
afterEach(()=>{relay?.close();vi.useRealTimers();vi.unstubAllGlobals();});
const pending=(signal:AbortSignal)=>new Promise<Response>((_,reject)=>signal.addEventListener('abort',()=>reject(Error('closed')),{once:true}));
it('backs off unauthorized polling, reports recovery instructions, and throttles repeated hello sends',async()=>{
 vi.useFakeTimers();const changes:any[]=[];const fetch=vi.fn(async()=>new Response(JSON.stringify({error:'宿主未注册'}),{status:401}));vi.stubGlobal('fetch',fetch);
 relay=new Relay('http://fixture/relay','session','client','key',()=>{},undefined,undefined,undefined,s=>changes.push(s));await vi.advanceTimersByTimeAsync(0);
 expect(fetch).toHaveBeenCalledTimes(1);for(let i=0;i<5;i++)await expect(relay.send({type:'hello'})).rejects.toMatchObject({status:401});expect(fetch).toHaveBeenCalledTimes(1);expect(changes[0].message).toBe('宿主未注册');
 await vi.advanceTimersByTimeAsync(1400);expect(fetch).toHaveBeenCalledTimes(2);await vi.advanceTimersByTimeAsync(1400);expect(fetch).toHaveBeenCalledTimes(2);await vi.advanceTimersByTimeAsync(1400);expect(fetch).toHaveBeenCalledTimes(3);
});
it('honors Retry-After and serializes host registration before durable requests without replaying writes',async()=>{
 vi.useFakeTimers();let registrations=0;const sent:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_url:string,init:RequestInit)=>{
  if(init.method!=='POST')return pending(init.signal!);
  const body=JSON.parse(String(init.body));sent.push(body);
  if(body.register){registrations++;return registrations===1?new Response('{}',{status:503,headers:{'Retry-After':'2'}}):new Response('{"ok":true}');}
  return new Response('{}',{status:401});
 }));
 relay=new Relay('http://fixture/relay','session','host','key',()=>{},'client-key');await vi.advanceTimersByTimeAsync(0);
 await expect(relay.send({saveCard:{test:true}})).rejects.toMatchObject({status:503});expect(sent).toHaveLength(1);await vi.advanceTimersByTimeAsync(1999);expect(registrations).toBe(1);await vi.advanceTimersByTimeAsync(1);expect(registrations).toBe(2);
 await expect(relay.send({saveCard:{test:true}})).rejects.toMatchObject({status:401});expect(sent.filter(m=>m.saveCard)).toHaveLength(1);
 await vi.advanceTimersByTimeAsync(10000);expect(sent.filter(m=>m.saveCard)).toHaveLength(1);
});
