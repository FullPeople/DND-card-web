import {createHash,randomUUID} from 'node:crypto';
import {CloudError} from './store';

type Notice={cursor:string;changed:boolean;cancelled?:boolean};
type Waiter={keys:string[];client:string;account?:string;finish:(cancelled?:boolean)=>void};
type State={token:string;touched:number;waiters:Set<Waiter>};

/** One bounded request can observe an account and all of its loaded room cards. */
export class CloudChanges{
 private readonly states=new Map<string,State>();
 private readonly waiters=new Set<Waiter>();
 private closed=false;
 constructor(private readonly waitMs=20000,private readonly maxConnections=128,private readonly maxStates=8192){
  if(!Number.isInteger(waitMs)||waitMs<1||waitMs>25000)throw Error('Invalid change wait duration');
 }
 private state(key:string):State{
  const existing=this.states.get(key);if(existing){existing.touched=Date.now();return existing;}
  if(this.states.size>=this.maxStates){for(const [id,state] of this.states){if(!state.waiters.size){this.states.delete(id);break;}}}
  if(this.states.size>=this.maxStates)throw new CloudError(503,'changes_busy','变更读取暂时繁忙，现有轮询仍可继续。');
  const state={token:randomUUID(),touched:Date.now(),waiters:new Set<Waiter>()};this.states.set(key,state);return state;
 }
 cursor(keys:readonly string[]):string{
  return createHash('sha256').update(JSON.stringify([...new Set(keys)].sort().map(key=>[key,this.state(key).token]))).digest('hex');
 }
 wait(keys:readonly string[],previous:unknown,client:string,account?:string){
  if(this.closed)throw new CloudError(503,'changes_closed','变更读取正在重新连接。');
  const scopes=[...new Set(keys)];if(!scopes.length||scopes.length>33)throw new CloudError(400,'changes_scope','变更读取范围无效。');
  if(previous!==undefined&&previous!==null&&(typeof previous!=='string'||!/^[a-f0-9]{64}$/.test(previous)))throw new CloudError(400,'changes_cursor','变更读取状态无效，请重新连接。');
  const current=this.cursor(scopes);
  if(current!==previous)return {promise:Promise.resolve<Notice>({cursor:current,changed:true}),cancel:()=>{}};
  if(this.waiters.size>=this.maxConnections||[...this.waiters].filter(waiter=>waiter.client===client).length>=16||account&&[...this.waiters].filter(waiter=>waiter.account===account).length>=4)throw new CloudError(429,'changes_busy','变更读取连接过多，现有轮询仍可继续。');
  let finish!:(cancelled?:boolean)=>void;
  const promise=new Promise<Notice>(resolve=>{
   let settled=false;
   const waiter:Waiter={keys:scopes,client,account,finish:cancelled=>finish(cancelled)};
   finish=(cancelled=false)=>{
    if(settled)return;settled=true;clearTimeout(timer);this.waiters.delete(waiter);
    for(const key of scopes)this.states.get(key)?.waiters.delete(waiter);
    const cursor=this.cursor(scopes);resolve({cursor,changed:cursor!==previous,...cancelled?{cancelled:true}:{}});
   };
   const timer=setTimeout(()=>finish(),this.waitMs);
   this.waiters.add(waiter);for(const key of scopes)this.state(key).waiters.add(waiter);
  });
  return {promise,cancel:()=>finish(true)};
 }
 invalidate(keys:readonly string[]){
  const affected=new Set<Waiter>();
  for(const key of new Set(keys)){const state=this.states.get(key);if(!state)continue;state.token=randomUUID();for(const waiter of state.waiters)affected.add(waiter);}
  for(const waiter of affected)waiter.finish();
 }
 stats(){return {connections:this.waiters.size,scopes:this.states.size};}
 close(){this.closed=true;for(const waiter of [...this.waiters])waiter.finish(true);this.states.clear();}
}
