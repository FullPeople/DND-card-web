import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {Relay} from '../src/platform/relay';
let relay:Relay|undefined;
const protocol='full-suite-workbench/v1';
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('WebSocket',undefined);vi.stubGlobal('CompressionStream',undefined);});
afterEach(()=>{relay?.close();relay=undefined;vi.useRealTimers();vi.unstubAllGlobals();});
const pending=(signal:AbortSignal)=>new Promise<Response>((_,reject)=>signal.addEventListener('abort',()=>reject(Error('closed')),{once:true}));
function fixture(post:(body:any)=>Response|Promise<Response>){
 const sent:any[]=[],changed=vi.fn();
 vi.stubGlobal('fetch',vi.fn(async(_url:string,options:RequestInit)=>{if(options.method!=='POST')return pending(options.signal!);const body=JSON.parse(String(options.body));sent.push(body);return post(body);}));
 relay=new Relay('https://fixture.test/relay','fixture','client','fixture-key',()=>{},undefined,undefined,undefined,changed);
 return {sent,changed};
}
const capacity=(code='REQUEST_CAPACITY')=>new Response(JSON.stringify({code,error:'capacity'}),{status:503,headers:{'Retry-After':'1'}});
it('a rejected view cannot pause an otherwise available receipt lane',async()=>{
 const f=fixture(body=>body.type==='cacheSnapshot'?capacity():new Response('{}'));
 await expect(relay!.send({protocol,type:'cacheSnapshot'})).rejects.toMatchObject({code:'REQUEST_CAPACITY',notSent:true});
 await expect(relay!.send({protocol,type:'ack',requestId:'saved',ok:true})).resolves.toEqual({});
 expect(f.changed).not.toHaveBeenCalled();expect(f.sent.map(row=>row.type)).toEqual(['cacheSnapshot','ack']);
});
it.each(['REQUEST_CAPACITY','QUEUE_CAPACITY'])('retries the same receipt after %s while allowing other traffic',async code=>{
 let attempts=0;const f=fixture(body=>body.type==='ack'&&attempts++===0?capacity(code):new Response('{}'));
 const receipt={protocol,type:'ack',requestId:'saved',ok:true,result:{revision:4}},sending=relay!.send(receipt);
 await vi.advanceTimersByTimeAsync(0);await expect(relay!.send({protocol,type:'ping'})).resolves.toEqual({});
 await vi.advanceTimersByTimeAsync(999);expect(f.sent.filter(r=>r.type==='ack')).toHaveLength(1);
 await vi.advanceTimersByTimeAsync(1);await sending;expect(f.sent.filter(r=>r.type==='ack')).toEqual([receipt,receipt]);expect(f.changed).not.toHaveBeenCalled();
});
it('can redeliver an identical ACK after a lost response without issuing any command',async()=>{
 let first=true;const f=fixture(()=>{if(first){first=false;throw TypeError('response lost');}return new Response('{}');});
 const receipt={protocol,type:'ack',requestId:'already-committed',ok:true},sending=relay!.send(receipt);
 await vi.advanceTimersByTimeAsync(1000);await sending;expect(f.sent).toEqual([receipt,receipt]);
});
it('does not replay a mutation with an unknown transmission result',async()=>{
 const f=fixture(()=>{throw TypeError('response lost');});
 await expect(relay!.send({protocol,type:'stats',requestId:'unknown'})).rejects.toThrow('response lost');
 await vi.advanceTimersByTimeAsync(20000);expect(f.sent).toHaveLength(1);
});
it('does not keep retrying an expired command or a revoked receipt',async()=>{
 const f=fixture(body=>body.type==='ack'?new Response('{}',{status:403}):capacity());
 await expect(relay!.send({protocol,type:'stats',requestId:'expired',expiresAt:Date.now()+900})).rejects.toMatchObject({notSent:true});
 await expect(relay!.send({protocol,type:'ack',requestId:'revoked'})).rejects.toMatchObject({status:403});expect(f.sent).toHaveLength(2);
});
it('closing the transport releases a capacity retry without another send',async()=>{
 const f=fixture(()=>capacity());const sending=relay!.send({protocol,type:'ack',requestId:'closing'});const result=sending.catch(error=>error);
 await vi.advanceTimersByTimeAsync(0);relay!.close();expect(await result).toMatchObject({code:'REQUEST_CAPACITY'});expect(f.sent).toHaveLength(1);
});
