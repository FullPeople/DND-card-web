import {it,expect,vi,afterEach} from 'vitest';
import {Relay} from '../src/platform/relay';

let relay:Relay|undefined;
afterEach(()=>{relay?.close();vi.useRealTimers();vi.unstubAllGlobals();});
const pending=(signal:AbortSignal)=>new Promise<Response>((_,reject)=>signal.addEventListener('abort',()=>reject(Error('closed')),{once:true}));

it.each([400,403,404,409,422])('isolates operation rejection %s so another command can reach the server immediately',async status=>{
 vi.useFakeTimers();const sent:any[]=[],changes:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_url:string,init:RequestInit)=>{
  if(init.method!=='POST')return pending(init.signal!);
  const body=JSON.parse(String(init.body));sent.push(body);
  return body.saveCard?new Response('{"error":"operation rejected"}',{status}):new Response('{"revision":8}');
 }));
 relay=new Relay('http://fixture/relay','session','client','key',()=>{},undefined,undefined,undefined,state=>changes.push(state));
 await expect(relay.send({saveCard:{expected:'stale'}})).rejects.toMatchObject({status,message:'operation rejected'});
 await expect(relay.send({sharedDocument:{key:'inventory',operation:'read'}})).resolves.toEqual({revision:8});
 expect(sent).toHaveLength(2);expect(changes).toHaveLength(0);
 await vi.advanceTimersByTimeAsync(5000);expect(sent.filter(m=>m.saveCard)).toHaveLength(1);
});

it('still backs off a rejected host registration before sending any durable command',async()=>{
 vi.useFakeTimers();const sent:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_url:string,init:RequestInit)=>{
  if(init.method!=='POST')return pending(init.signal!);
  const body=JSON.parse(String(init.body));sent.push(body);
  return new Response('{"error":"registration conflict"}',{status:409});
 }));
 relay=new Relay('http://fixture/relay','session','host','key',()=>{},'client-key');await vi.advanceTimersByTimeAsync(0);
 await expect(relay.send({saveCard:{test:true}})).rejects.toMatchObject({status:409});
 expect(sent).toHaveLength(1);expect(sent[0].register).toBe(true);
 await vi.advanceTimersByTimeAsync(1400);expect(sent).toHaveLength(2);expect(sent.some(m=>m.saveCard)).toBe(false);
});
