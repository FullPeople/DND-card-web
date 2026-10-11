import {it,expect,vi,afterEach} from 'vitest';
import {Relay} from '../src/platform/relay';
// A scriptable WebSocket: the test decides when it opens, what it pushes and when it closes.
class FakeSocket{
 static instances:FakeSocket[]=[];
 readyState=0;onopen:(()=>void)|null=null;onmessage:((e:{data:string})=>void)|null=null;onclose:((e:{code?:number})=>void)|null=null;onerror:(()=>void)|null=null;
 constructor(public url:string,public protocols:string[]){FakeSocket.instances.push(this);}
 open(){this.readyState=1;this.onopen?.();}
 message(data:string){this.onmessage?.({data});}
 close(code?:number){if(this.readyState===3)return;this.readyState=3;this.onclose?.({code});}
}
// A long-poll GET stays pending until the test (or an abort) releases it.
const longPoll=()=>{let release!:(messages:unknown[])=>void;const response=new Promise<Response>(resolve=>{release=messages=>resolve(new Response(JSON.stringify(messages)));});return {response,release};};
const polls:ReturnType<typeof longPoll>[]=[];
const fetchLongPoll=()=>vi.fn(async(_url:string,init?:RequestInit)=>{if(init?.method==='POST')return new Response('{}');const poll=longPoll();polls.push(poll);init?.signal?.addEventListener('abort',()=>poll.release([]),{once:true});return poll.response;});
let relay:Relay|undefined;
afterEach(()=>{relay?.close();relay=undefined;polls.length=0;FakeSocket.instances.length=0;vi.useRealTimers();vi.unstubAllGlobals();});
it('pushes host messages over the socket and stops polling while it is open',async()=>{
 vi.useFakeTimers();vi.stubGlobal('WebSocket',FakeSocket);const fetch=fetchLongPoll();vi.stubGlobal('fetch',fetch);
 const received:unknown[]=[];relay=new Relay('http://fixture/relay','session','client','key',m=>received.push(m));await vi.advanceTimersByTimeAsync(0);
 // The first long-poll goes out immediately; the socket is only an optimisation on top of it.
 expect(fetch).toHaveBeenCalledTimes(1);expect(FakeSocket.instances).toHaveLength(1);
 const socket=FakeSocket.instances[0];expect(socket.url).toBe('ws://fixture/relay?session=session&role=client');expect(socket.protocols).toEqual(['full-suite-relay','token.key']);
 socket.open();polls[0].release([]);await vi.advanceTimersByTimeAsync(0);
 // While the socket is open nothing polls, however long the table stays idle.
 await vi.advanceTimersByTimeAsync(120000);expect(fetch).toHaveBeenCalledTimes(1);
 socket.message(JSON.stringify([{type:'ready'},{type:'rolls',rolls:[1]}]));socket.message('pong');socket.message('not json');
 expect(received).toEqual([{type:'ready'},{type:'rolls',rolls:[1]}]);
 // When the socket drops, the long-poll resumes at once and a fresh socket is attempted.
 socket.close();await vi.advanceTimersByTimeAsync(0);
 expect(fetch).toHaveBeenCalledTimes(2);expect(FakeSocket.instances).toHaveLength(2);
});
it('keeps long-polling when the upgrade is refused and retries the socket with backoff',async()=>{
 vi.useFakeTimers();vi.stubGlobal('WebSocket',FakeSocket);const fetch=fetchLongPoll();vi.stubGlobal('fetch',fetch);
 const received:unknown[]=[];relay=new Relay('http://fixture/relay','session','client','key',m=>received.push(m));await vi.advanceTimersByTimeAsync(0);
 expect(fetch).toHaveBeenCalledTimes(1);expect(FakeSocket.instances).toHaveLength(1);
 // A proxy without Upgrade support closes the socket before it ever opens.
 FakeSocket.instances[0].close(1006);await vi.advanceTimersByTimeAsync(0);
 polls[0].release([{type:'ready'}]);await vi.advanceTimersByTimeAsync(0);
 expect(received).toEqual([{type:'ready'}]);expect(fetch).toHaveBeenCalledTimes(2);expect(FakeSocket.instances).toHaveLength(1);
 // The next attempt waits for the first backoff step (15 s) and then happens on the following poll turn.
 await vi.advanceTimersByTimeAsync(14000);polls[1].release([]);await vi.advanceTimersByTimeAsync(0);
 expect(fetch).toHaveBeenCalledTimes(3);expect(FakeSocket.instances).toHaveLength(1);
 await vi.advanceTimersByTimeAsync(1000);polls[2].release([]);await vi.advanceTimersByTimeAsync(0);
 expect(fetch).toHaveBeenCalledTimes(4);expect(FakeSocket.instances).toHaveLength(2);
});
