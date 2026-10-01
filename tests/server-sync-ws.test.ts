import {describe,expect,it,vi} from 'vitest';
import {WsClient,type SocketLike} from '../src/platform/server/wsClient';
class FakeSocket implements SocketLike {
  readyState=0;sent:string[]=[];onopen:any=null;onclose:any=null;onerror:any=null;onmessage:any=null;
  send(data:string){this.sent.push(data);}close(){this.readyState=3;this.onclose?.({});}
  open(){this.readyState=1;this.onopen?.({});}receive(value:unknown){this.onmessage?.({data:typeof value==='string'?value:JSON.stringify(value)});}
}
describe('WsClient transport',()=>{
  it('backs off exponentially with jitter, resubscribes from the confirmed revision and drops invalid messages',()=>{
    vi.useFakeTimers();
    const sockets:FakeSocket[]=[],messages:unknown[]=[];let revision=4,disconnects=0;
    const ws=new WsClient({url:'ws://x/api/v1/ws',createSocket:()=>{const s=new FakeSocket();sockets.push(s);return s;},random:()=>1,baseDelayMs:100,maxDelayMs:1000});
    ws.subscribe('c1',{lastRevision:()=>revision,message:m=>messages.push(m),disconnected:()=>{disconnects++;}});
    sockets[0].open();
    expect(JSON.parse(sockets[0].sent[0])).toEqual({type:'subscribe',characterId:'c1',lastRevision:4});
    sockets[0].receive('not json');sockets[0].receive({type:'character.operations',characterId:'c1'});sockets[0].receive({type:'unknown'});
    expect(messages).toEqual([]);
    sockets[0].close();expect(disconnects).toBe(1);
    vi.advanceTimersByTime(99);expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);expect(sockets).toHaveLength(2);
    sockets[1].close();vi.advanceTimersByTime(199);expect(sockets).toHaveLength(2);vi.advanceTimersByTime(1);expect(sockets).toHaveLength(3);
    revision=9;sockets[2].open();
    expect(JSON.parse(sockets[2].sent[0])).toEqual({type:'subscribe',characterId:'c1',lastRevision:9});
    sockets[2].receive({type:'subscribed',characterId:'c1',revision:9});
    expect(messages).toEqual([{type:'subscribed',characterId:'c1',revision:9}]);
    ws.close();vi.advanceTimersByTime(5000);expect(sockets).toHaveLength(3);
    vi.useRealTimers();
  });
});
