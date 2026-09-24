import {adapter,type Adapter,type Value} from './adapter';
import {discover,originOf,packet,send,valid,type Snapshot} from './protocol';
type Session={id:string;origin:string;itemId:string;child:Window|null;value:Value;revision:number;expires:number;operations:Map<string,Snapshot>;queue:Promise<void>};
const sessions=new Map<string,Session>();let runtime:Adapter|undefined,startError='';
const ready=adapter().then(a=>{runtime=a;a.onChange(()=>{for(const s of sessions.values())enqueue(s,()=>refresh(s));});}).catch(e=>{startError=String(e);});
function snapshot(s:Session):Snapshot{return {...s.value,revision:s.revision};}
function state(s:Session,extra:Record<string,unknown>={}){send(s.child,'state',{session:s.id,snapshot:snapshot(s),...extra},s.origin);}
function enqueue(s:Session,task:()=>Promise<void>){s.queue=s.queue.then(async()=>{if(sessions.get(s.id)===s)await task();}).catch(e=>revoke(s,String(e)));}
function revoke(s:Session,message:string){send(s.child,'revoked',{session:s.id,message},s.origin);sessions.delete(s.id);}
async function refresh(s:Session){const next=await runtime!.read(s.itemId);if(next.binding!==s.value.binding||next.scope!==s.value.scope){revoke(s,'场景或棋子的角色绑定已改变，请重新连接。');return;}if(JSON.stringify(next)!==JSON.stringify(s.value)){s.value=next;s.revision++;state(s);}}
function panelSource(e:MessageEvent){try{return e.origin===location.origin&&e.source!==window&&(e.source as Window|null)?.parent===window.parent;}catch{return false;}}
window.addEventListener('message',async e=>{
 if(!valid(e.data)||!e.source)return;const m=e.data,source=e.source as Window;
 if(m.type==='discover'&&panelSource(e)){send(source,'background',{nonce:m.nonce},e.origin);return;}
 if(m.type==='permit'&&panelSource(e)){
  await ready;const id=m.session,targetOrigin=typeof m.target==='string'?originOf(m.target):undefined;
  try{if(!runtime)throw Error(startError||'枭熊后台尚未就绪。');if(typeof id!=='string'||id.length<32||!targetOrigin||typeof m.itemId!=='string')throw Error('连接参数无效。');if(sessions.size>=8)throw Error('测试窗口过多，请先关闭不用的窗口。');
   const value=await runtime.read(m.itemId);const session:Session={id,origin:targetOrigin,itemId:m.itemId,child:null,value,revision:0,expires:Date.now()+2*60*60*1000,operations:new Map(),queue:Promise.resolve()};sessions.set(id,session);
   send(source,'permitted',{session:id},e.origin);
  }catch(error){send(source,'permit-error',{session:id,message:String(error)},e.origin);}return;
 }
 const s=typeof m.session==='string'?sessions.get(m.session):undefined;if(!s||e.origin!==s.origin)return;
 if(m.type==='hello'){
  if(s.child&&s.child!==source)return;
  s.child=source;enqueue(s,async()=>{await refresh(s);if(sessions.has(s.id))state(s);});return;
 }
 if(s.child!==source)return;
 if(m.type==='bye'){revoke(s,'已断开连接。');return;}
 if(m.type!=='change')return;
 enqueue(s,async()=>{
  const id=m.operationId;if(typeof id!=='string'||id.length>100)return;
  if(s.operations.has(id)){state(s,{ack:id});return;}
  await refresh(s);if(!sessions.has(s.id))return;
  if(m.baseRevision!==s.revision){state(s,{rejected:id,message:'场景中的生命值已变化，请确认新数值后重试。'});return;}
  const amount=m.value;if(!Number.isInteger(amount)||Math.abs(Number(amount))>9999||!['set','delta'].includes(String(m.mode))){state(s,{rejected:id,message:'生命值必须是有效整数。'});return;}
  const next=m.mode==='delta'?s.value.hp+Number(amount):Number(amount);
  if(next<0||next>9999){state(s,{rejected:id,message:'测试范围为 0～9999。'});return;}
  try{await runtime!.write(s.itemId,next,s.value);await refresh(s);if(!sessions.has(s.id))return;s.operations.set(id,snapshot(s));if(s.operations.size>256)s.operations.delete(s.operations.keys().next().value!);state(s,{ack:id});}
  catch(error){state(s,{rejected:id,message:String(error)});}
 });
});
// Active state heartbeats allow the child to reload even after its opener panel was removed.
setInterval(()=>{for(const s of sessions.values()){
 if(Date.now()>s.expires){revoke(s,'测试会话已过期，请从枭熊重新打开。');continue;}
 if(s.child?.closed){sessions.delete(s.id);continue;}
 enqueue(s,async()=>{await refresh(s);if(sessions.has(s.id)&&s.child)state(s);});
}},1000);
