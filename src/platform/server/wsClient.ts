import {isOperationResult,type WebSocketMessage} from '../../core/sync/protocol';
/**
 * One authenticated WebSocket per session. It is transport only: messages are
 * validated and handed to the per-character sync in arrival order; reconnects
 * use exponential backoff with jitter and resubscribe from the last *confirmed*
 * revision. Edits never travel over this socket.
 */
export interface SocketLike {
  readyState:number; send(data:string):void; close(code?:number,reason?:string):void;
  onopen:((event:any)=>void)|null; onclose:((event:any)=>void)|null; onerror:((event:any)=>void)|null; onmessage:((event:{data:any})=>void)|null;
}
export interface Subscriber {
  lastRevision():number;
  message(message:WebSocketMessage):void;
  /** The socket dropped; the subscription must be re-established. */
  disconnected():void;
}
export interface WsOptions {
  url:string; createSocket?:(url:string)=>SocketLike;
  random?:()=>number; baseDelayMs?:number; maxDelayMs?:number; heartbeatMs?:number; idleTimeoutMs?:number;
  onState?:(state:'connecting'|'open'|'closed')=>void;
}
const OPEN=1;
function parse(data:unknown):WebSocketMessage|undefined{
  if(typeof data!=='string'||data.length>32*1024*1024)return;
  let value:any;try{value=JSON.parse(data);}catch{return;}
  if(!value||typeof value!=='object')return;
  switch(value.type){
    case 'character.operations':return isOperationResult(value)?{...value,type:'character.operations'}:undefined;
    case 'subscribed':return typeof value.characterId==='string'&&Number.isSafeInteger(value.revision)?value:undefined;
    case 'unsubscribed':return typeof value.characterId==='string'?value:undefined;
    case 'error':case 'resync_required':return typeof value.code==='string'?value:undefined;
    case 'pong':return value;
  }
}
export class WsClient {
  private socket?:SocketLike;private closed=false;private attempt=0;
  private reconnectTimer?:ReturnType<typeof setTimeout>;private heartbeat?:ReturnType<typeof setInterval>;private lastMessage=0;
  private readonly subscribers=new Map<string,Subscriber>();
  constructor(private readonly options:WsOptions){}
  get connected(){return this.socket?.readyState===OPEN;}
  start(){this.closed=false;if(!this.socket)this.connect();}
  subscribe(characterId:string,subscriber:Subscriber){
    this.subscribers.set(characterId,subscriber);
    if(this.connected)this.send({type:'subscribe',characterId,lastRevision:subscriber.lastRevision()});else this.start();
  }
  /** Re-subscribe after recovery (e.g. resync) on the current socket. */
  resubscribe(characterId:string){const s=this.subscribers.get(characterId);if(s&&this.connected)this.send({type:'subscribe',characterId,lastRevision:s.lastRevision()});}
  unsubscribe(characterId:string){if(this.subscribers.delete(characterId)&&this.connected)this.send({type:'unsubscribe',characterId});}
  close(){
    this.closed=true;clearTimeout(this.reconnectTimer);clearInterval(this.heartbeat);
    const socket=this.socket;this.socket=undefined;
    if(socket){socket.onclose=socket.onmessage=socket.onerror=socket.onopen=null;try{socket.close(1000,'logout');}catch{/* already closed */}}
    for(const s of this.subscribers.values())s.disconnected();
    this.subscribers.clear();this.options.onState?.('closed');
  }
  private send(value:unknown){try{this.socket?.send(JSON.stringify(value));}catch{/* the close handler reconnects */}}
  private connect(){
    if(this.closed)return;
    this.options.onState?.('connecting');
    let socket:SocketLike;
    try{socket=(this.options.createSocket||(url=>new WebSocket(url) as unknown as SocketLike))(this.options.url);}
    catch{this.scheduleReconnect();return;}
    this.socket=socket;
    socket.onopen=()=>{
      this.lastMessage=Date.now();this.options.onState?.('open');
      for(const [characterId,s] of this.subscribers)this.send({type:'subscribe',characterId,lastRevision:s.lastRevision()});
      clearInterval(this.heartbeat);
      const every=this.options.heartbeatMs??20000,idle=this.options.idleTimeoutMs??75000;
      this.heartbeat=setInterval(()=>{if(Date.now()-this.lastMessage>idle){try{socket.close(4000,'idle');}catch{/* ignore */}return;}this.send({type:'ping'});},every);
    };
    socket.onmessage=event=>{
      this.lastMessage=Date.now();
      const message=parse(event.data);if(!message)return;
      if(message.type==='subscribed')this.attempt=0;
      if(message.type==='pong')return;
      const id=(message as {characterId?:string}).characterId;
      if(id)this.subscribers.get(id)?.message(message);
      else for(const s of this.subscribers.values())s.message(message);
    };
    socket.onerror=()=>{/* close follows */};
    socket.onclose=()=>{
      if(this.socket!==socket)return;
      this.socket=undefined;clearInterval(this.heartbeat);this.options.onState?.('closed');
      for(const s of this.subscribers.values())s.disconnected();
      this.scheduleReconnect();
    };
  }
  private scheduleReconnect(){
    if(this.closed)return;
    const base=this.options.baseDelayMs??500,max=this.options.maxDelayMs??30000,random=this.options.random||Math.random;
    const delay=Math.min(max,base*2**Math.min(this.attempt++,10))*(0.5+random()/2);
    clearTimeout(this.reconnectTimer);this.reconnectTimer=setTimeout(()=>this.connect(),delay);
  }
}
