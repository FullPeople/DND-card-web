import {previewInventory,overlayInventory} from '../core/inventory';
import {WorkbenchRevisions,currentInventory,documentRevision} from '../core/workbenchRevisions';
import {recordAction} from './actionHistory';
import {startWorkbenchSound,playWorkbenchSound} from './workbenchSound';
import type {InventoryState} from '../core/inventory';
import {Relay} from './relay';
import {documentChanges} from './document-delta';
import {mutationQueue} from './mutationQueue';
import {exportOwlbear} from '../core/export';
import {useSyncExternalStore} from 'react';
import type {Character,Derived,RulePack,Entry,Edition,RuleProfile} from '../core/model';
const protocol='full-suite-workbench/v1',params=new URLSearchParams(location.hash.slice(1));
const session=params.get('suite'),origin=params.get('bridge');
export const inWorkbench=!!session&&origin===location.origin;
export type Target={tokenPortrait?:{url:string;width?:number;height?:number};projectionPending?:boolean;documentRevision?:number;key:string;itemId:string;name:string;cardId:string;slug:string;kind:'character'|'monster'|'token';stats:Record<string,number>;write:boolean;role:string;pinned:boolean;locked?:boolean;statsLocked?:boolean;conditions?:{id:string;name:string;entry?:Entry;level?:number}[];resources?:any[]};
export type CardChoice={player?:string;documentRevision?:number;kind?:'monster'|'character';passive?:number;coins?:Record<string,number>;conditions?:{id:string;name:string;entry?:Entry;level?:number}[];id:string;name:string;write:boolean;locked:boolean;inScene:boolean;itemId:string;resources:any[];stats:Record<string,any>};
export type SharedRules={edition:Edition;sourceMode:'full'|'short'|'both';profile:RuleProfile;packs:RulePack[];customEntries:Entry[]};
export type SharedDocument={key:string;scope:'room'|'scene';revision:number;rules:SharedRules};
type State={inventory?:InventoryState;shared?:SharedDocument;settings?:Record<string,any>;visibility?:{wiki:boolean;monsters:boolean};console?:{timeStop:boolean;portalEffects:boolean;players:{id:string;name:string}[]};cards:CardChoice[];monsters:CardChoice[];role?:string;enabled:Record<string,boolean>;online:boolean;target?:Target;document?:any;loading?:boolean;message:string;rolls:any[];compose?:{id:string;expression:string;label?:string}};
let state:State={cards:[],monsters:[],enabled:{},online:false,message:'正在连接枭熊…',rolls:[]},host:Window|null=null,roomWindow:Window|null=null,last=0,lastDirect=0;
const listeners=new Set<()=>void>(),pending=new Map<string,{resolve:(value?:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>;started:number;type:string}>();
let authoritativeInventory:InventoryState|undefined;
const revisions=new WorkbenchRevisions();
const operationTimings:any[]=[];
export function workbenchDiagnostics(){return {transport:host&&!host.closed?'direct':relay?'relay':'offline',hostStarted,pending:[...pending].map(([id,p])=>({id,type:p.type,elapsedMs:Math.round(performance.now()-p.started)})),recent:operationTimings.slice(-24)};}
const observedDocuments=new Map<string,{sequence:number;document:any}>();
function rememberDocument(m:any){if(!m.state?.key||m.document===undefined)return;const old=observedDocuments.get(m.state.key),sequence=m.sequence||0;if(!old||documentRevision(m.document,m.state)>=documentRevision(old.document))observedDocuments.set(m.state.key,{sequence,document:m.document});}
const stockDrafts=new Map<string,{before:InventoryState;after:InventoryState}>();
const inventoryRequests=new Map<string,string>();
const inventoryCompletions=new Map<string,(result:any)=>void>();
let updateDepth=0,updatePending=false;
function publishUpdate(){if(updateDepth){updatePending=true;return;}listeners.forEach(fn=>fn());}
function update(patch:Partial<State>){if('inventory' in patch){authoritativeInventory=currentInventory(authoritativeInventory,patch.inventory);let shown=authoritativeInventory;if(shown)for(const draft of stockDrafts.values())if(draft.before.publicId===shown.publicId)shown=overlayInventory(shown,draft.before,draft.after);patch={...patch,inventory:shown};}state={...state,...patch};publishUpdate();}
const inventoryQueue=mutationQueue();
const inventoryContent=(container:InventoryState['containers'][string])=>JSON.stringify({locked:!!container.locked,items:container.items.map(({revision,...row})=>row).sort((a,b)=>a.id.localeCompare(b.id))});
function inventoryPayload(op:any,before:InventoryState){
 if(before.publicId!==authoritativeInventory?.publicId)throw Error('公共仓库作用域已切换，请在当前场景操作');
 const expected={...op.expected};
 for(const id of new Set([op.container,op.from,op.to].filter(Boolean)) as Set<string>){
  const old=before.containers[id],live=authoritativeInventory?.containers[id];if(!old||!live)continue;
  // Only our own earlier receipts may advance a generic command's base. A
  // concurrent content edit still requires the host's conflict validation.
  // A move has a narrower guard: exact original slots, not unrelated quantity.
  if(op.action==='move'||inventoryContent(old)===inventoryContent(live))expected[id]=live.revision;
 }
 return {...op,expected};
}
function acceptInventoryReceipt(incoming:InventoryState){
 const current=authoritativeInventory;if(current&&incoming.publicId!==current.publicId)return;
 // A receipt confirms content; it must not restore the old scene's visibility
 // or permissions. Catalog messages own that access scope.
 if(current&&incoming.access!==current.access)incoming={...incoming,access:current.access,containers:Object.fromEntries(Object.entries(current.containers).map(([id,c])=>[id,incoming.containers[id]?{...incoming.containers[id],name:c.name,write:c.write}:c]))};
 update({inventory:incoming});
}
export const getWorkbench=()=>state;
export async function requestInventory(operation:Record<string,unknown>){
 const op:any={operationId:crypto.randomUUID(),...operation};if(op.rows)op.rows=op.rows.map((row:any)=>({...row,newId:row.newId||crypto.randomUUID()}));if(op.action==='split')op.newId||=crypto.randomUUID();
 const before=state.inventory;if(!before)throw Error('背包尚未载入');if(op.action==='move'&&!op.observedSlots)op.observedSlots=Object.fromEntries((op.positions||[]).map((p:any)=>[p.id,before.containers[op.container]?.items.find(row=>row.id===p.id)?.slot]));const after=previewInventory(before,op);stockDrafts.set(op.operationId,{before,after});update({inventory:authoritativeInventory});
 let uncertain=false,recorded=false;
 const completed=(result:any)=>{if(recorded||!result?.historyId||op.action==='silent')return;recorded=true;let reference=result.historyId,old=before,next=after;const reverse=async()=>{if(before.publicId!==authoritativeInventory?.publicId)throw Error('请回到该背包所在场景再撤销');const id=crypto.randomUUID();stockDrafts.set(id,{before:next,after:old});update({inventory:authoritativeInventory});let unknown=false;try{const r=await inventoryQueue.run(before.publicId,()=>workbenchRequest('inventory',{key:undefined,itemId:undefined,scopeKey:before.publicId,operation:{action:'history',operationId:id,reference}}));reference=r.historyId;[old,next]=[next,old];}catch(error){unknown=!!(error as any)?.uncertain&&!(error as any)?.queueBlocked;throw error;}finally{if(!unknown)stockDrafts.delete(id);update({inventory:authoritativeInventory});}};recordAction({label:'背包',undo:reverse,redo:reverse});};
 inventoryCompletions.set(op.operationId,completed);
 try{const result=await inventoryQueue.run(before.publicId,()=>workbenchRequest('inventory',{key:undefined,itemId:undefined,scopeKey:before.publicId,operation:inventoryPayload(op,before)}));completed(result);return result;
 }catch(error){uncertain=!!(error as any)?.uncertain&&!(error as any)?.queueBlocked;throw error;}finally{if(!uncertain){stockDrafts.delete(op.operationId);inventoryCompletions.delete(op.operationId);}update({inventory:authoritativeInventory});}
}

let relay:Relay|undefined,selectionSequence=0,catalogSequence=0,hostStarted=0;
const monsterRuntimeSequence=new Map<string,number>();
const runtimeFrom=(value:any)=>({stats:value.stats,resources:value.resources,conditions:value.conditions,documentRevision:value.documentRevision});
function acceptSnapshot(m:any){
 m=revisions.snapshot(m);rememberDocument(m);if(!m.state)return;
 const same=state.target?.key===m.state.key;
 if(m.sequence&&m.sequence<selectionSequence){
  // The durable card revision outranks message timing, but an older receipt
  // must not restore an old selection, owner permission, or lock state.
  if(same&&m.state.cardId&&documentRevision(m.document,m.state)>documentRevision(state.document,state.target))update({target:{...state.target!,...runtimeFrom(m.state)},document:m.document});
  return;
 }
 selectionSequence=m.sequence||selectionSequence;update({target:m.state,document:m.document!==undefined?m.document:same?state.document:undefined,loading:!!m.loading,message:m.error||''});
}
function send(type:string,extra:Record<string,unknown>={}){const m={protocol,type,session,...extra};if(host&&!host.closed)host.postMessage(m,origin!);else if(relay)void relay.send(m).catch(()=>{});}
export function chooseWorkbench(itemId:string){send('select',{itemId});window.dispatchEvent(new Event('workbench-show-sheet'));}
export function composeRoll(expression:string,label=''){window.dispatchEvent(new CustomEvent('workbench-compose-local',{detail:{expression,label,id:crypto.randomUUID()}}));}
function discover(w:Window,depth=0){if(depth>3)return;try{w.postMessage({protocol,type:'hello',session},origin!);for(let i=0;i<Math.min(w.length,64);i++)discover(w.frames[i],depth+1);}catch{}}
if(inWorkbench){
 startWorkbenchSound();
 function accept(m:any){if(m.protocol!==protocol||m.session!==session||m.hostStarted&&m.hostStarted<hostStarted)return;updateDepth++;try{if(m.hostStarted>hostStarted){hostStarted=m.hostStarted;selectionSequence=0;catalogSequence=0;monsterRuntimeSequence.clear();}last=Date.now();
  if(!state.online)update({online:true,message:''});
  if(m.type==='ready'||m.type==='rolls')update({rolls:Array.isArray(m.rolls)?m.rolls:[]});
  if(m.type==='catalog'&&(!m.sequence||m.sequence>=catalogSequence)){catalogSequence=m.sequence||catalogSequence;update({cards:(m.cards||[]).map((card:CardChoice)=>revisions.card(card)),monsters:(m.monsters||[]).map((card:CardChoice)=>{const previous=state.monsters.find(c=>c.itemId===card.itemId);if(previous&&(monsterRuntimeSequence.get(card.itemId)||0)>(m.sequence||0))return {...card,...runtimeFrom(previous)};monsterRuntimeSequence.set(card.itemId,m.sequence||0);return card;}),role:m.role,enabled:m.enabled||{},visibility:m.visibility,console:m.console,inventory:m.inventory?.revision===authoritativeInventory?.revision&&m.inventory?.publicId===authoritativeInventory?.publicId&&m.inventory?.access===authoritativeInventory?.access&&m.role===state.role?authoritativeInventory:m.inventory,shared:m.shared?.key===state.shared?.key&&m.shared?.revision===state.shared?.revision?state.shared:m.shared,settings:m.settings});}
  if(m.type==='showWiki')window.dispatchEvent(new CustomEvent('workbench-open-entry',{detail:m.entry}));
  if(m.type==='navigate')window.dispatchEvent(new Event('workbench-show-sheet'));
  if(m.type==='panelEvent')window.dispatchEvent(new CustomEvent('workbench-panel-event',{detail:m}));
  if(m.type==='diceEvent'&&m.event==='com.obr-suite/sfx')playWorkbenchSound(m.data?.data?.name);
  if(m.type==='diceEvent')window.dispatchEvent(new CustomEvent('workbench-dice-event',{detail:{event:m.event,data:m.data}}));
  if(m.type==='error')window.dispatchEvent(new CustomEvent('workbench-error',{detail:m.message}));
  if(m.type==='compose')update({compose:m.compose});
  if(m.type==='selection'){
   if(!m.state){update({target:undefined,document:undefined,loading:false,message:m.message||''});return;}
   acceptSnapshot(m);
  }
  if(m.type==='ack'){
   if(m.ok&&Array.isArray(m.result?.snapshots)){
    const catalog=m.result.catalog;
    if(catalog&&catalog.sequence>=catalogSequence){catalogSequence=catalog.sequence;update({cards:catalog.cards.map((card:CardChoice)=>revisions.card(card)),monsters:catalog.monsters});}
    for(const input of m.result.snapshots){if(!input?.state)continue;const snap=revisions.snapshot(input);rememberDocument(snap);
     update({cards:state.cards.map(card=>card.id===snap.state.cardId?revisions.card({...card,...runtimeFrom(snap.state)}):card),monsters:state.monsters.map(card=>{if(card.itemId!==snap.state.itemId||(snap.sequence||0)<(monsterRuntimeSequence.get(card.itemId)||0))return card;monsterRuntimeSequence.set(card.itemId,snap.sequence||0);return {...card,...runtimeFrom(snap.state)};})});
     if(snap.state.key===state.target?.key)acceptSnapshot(snap);
    }
   }
   const operationId=inventoryRequests.get(m.requestId);if(operationId&&!m.uncertain){const completed=inventoryCompletions.get(operationId);inventoryCompletions.delete(operationId);if(m.ok&&completed)queueMicrotask(()=>completed(m.result));inventoryRequests.delete(m.requestId);stockDrafts.delete(operationId);update({inventory:authoritativeInventory});}
   // Includes late terminal receipts after a lost-response timeout. App keeps
   // uncertain local edits until a real receipt or explicit reconciliation.
  }
  if(m.type==='ack'){if(m.result?.warning)window.dispatchEvent(new CustomEvent('workbench-error',{detail:{message:m.result.warning,diagnostic:JSON.stringify({product:'Full Suite',at:new Date().toISOString(),message:m.result.warning,diagnostic:m.result.diagnostic,connection:workbenchDiagnostics()},null,2)}}));if(m.result?.historyId)stockDrafts.delete(m.result.historyId);if(m.ok&&m.result?.inventory){acceptInventoryReceipt(m.result.inventory);}if(m.ok&&m.result?.shared&&(!state.shared||m.result.shared.key!==state.shared.key||m.result.shared.revision>=state.shared.revision)){update({shared:m.result.shared});}if(m.ok&&m.result?.consolePatch&&m.result.sequence>=catalogSequence){update({console:{...state.console!,...m.result.consolePatch}});}if(m.ok&&m.result?.snapshot){const snap=revisions.snapshot(m.result.snapshot);m.result.snapshot=snap;rememberDocument(snap);const currentPermissions=!snap.sequence||snap.sequence>=catalogSequence;
    update({monsters:state.monsters.map(card=>{
     if(card.itemId!==snap.state.itemId||(snap.sequence||0)<(monsterRuntimeSequence.get(card.itemId)||0))return card;
     monsterRuntimeSequence.set(card.itemId,snap.sequence||0);return {...card,stats:snap.state.stats,resources:snap.state.resources||card.resources,...(currentPermissions?{locked:snap.state.locked??card.locked}:{})};
    }),cards:state.cards.map(card=>card.id===snap.state.cardId?revisions.card({...card,...runtimeFrom(snap.state),...(currentPermissions?{locked:snap.state.locked??card.locked}:{})}):card)});
    if(snap.state.key===state.target?.key)acceptSnapshot(snap);}const p=pending.get(m.requestId);if(p){operationTimings.push({requestId:m.requestId,type:p.type,ok:m.ok,totalMs:Math.round(performance.now()-p.started),...m.timing});if(operationTimings.length>24)operationTimings.shift();clearTimeout(p.timer);pending.delete(m.requestId);m.ok?p.resolve(m.result):p.reject(Object.assign(Error(m.message||'操作失败'),{diagnostic:{...m.diagnostic,timing:m.timing,connection:workbenchDiagnostics()},requestId:m.requestId,uncertain:!!m.uncertain}));}}
  if(m.type==='ack')window.dispatchEvent(new CustomEvent('workbench-operation-result',{detail:{requestId:m.requestId,ok:m.ok,uncertain:!!m.uncertain,result:m.result,message:m.message}}));
 }finally{updateDepth--;if(!updateDepth&&updatePending){updatePending=false;publishUpdate();}}}
 if(params.get('relay')){relay=new Relay(new URL('../relay',location.href.split('#')[0]).href,session!,'client',params.get('relay')!,accept);send('hello');}
 window.addEventListener('message',e=>{if(e.origin!==origin||e.data?.protocol!==protocol||e.data.session!==session||!e.source)return;if(host&&host!==e.source&&!host.closed&&!(e.data.type==='ready'&&e.data.hostStarted>hostStarted))return;if(!host&&e.data.type!=='ready')return;host=e.source as Window;lastDirect=Date.now();try{roomWindow=host.top;if(roomWindow)window.opener=roomWindow;}catch{}accept(e.data);});
 const connect=()=>{let lostDirect=false;if(host&&(host.closed||Date.now()-lastDirect>5000)){host=null;lostDirect=true;}if(last&&Date.now()-last>45000&&state.online)update({online:false,message:'正在重新连接枭熊…'});if(!host){try{const room=roomWindow||window.opener;if(room&&!room.closed)discover(room.top||room);}catch{}if(lostDirect||Date.now()-last>10000)send('hello');}else if(Date.now()-lastDirect>2500)send('ping');};
 connect();setInterval(connect,1000);window.addEventListener('focus',connect);window.addEventListener('pageshow',connect);
}
export function useWorkbench(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},()=>state);}
export function pinWorkbench(pinned:boolean){if(!state.online||!state.target)return;const target=state.target;update({target:{...target,pinned}});send('pin',{pinned,itemId:target.itemId});}
export function workbenchRequest(type:string,extra:Record<string,unknown>={}){
 if(!state.online||!host&&!relay)return Promise.reject(Error('枭熊未连接'));
 const requestId=crypto.randomUUID(),target=state.target;
 return new Promise<any>((resolve,reject)=>{
  const started=Date.now(),check=()=>{if(!pending.has(requestId))return;if(Date.now()-started>=180000){pending.delete(requestId);send('cancel',{requestId});reject(Object.assign(Error('枭熊尚未确认操作结果。已停止后续排队修改，请重连后核对。'),{uncertain:true,requestId}));return;}send('requestStatus',{requestId});const current=pending.get(requestId);if(current)current.timer=setTimeout(check,10000);};
  const timer=setTimeout(check,15000);pending.set(requestId,{resolve,reject,timer,started:performance.now(),type});let body=extra;
  if(type==='inventory'&&(extra.operation as any)?.operationId)inventoryRequests.set(requestId,(extra.operation as any).operationId);
  if(type==='save'&&(extra.observed as any)?.dnd_card_web){const {previous,native,observed,previousData,data,...rest}=extra;body={...rest,delta:{native:documentChanges(previous,native,(observed as any).dnd_card_web),legacy:documentChanges(previousData,data,observed)}};}
  const payload={requestId,expiresAt:Date.now()+30000,key:target?.key,itemId:target?.itemId,...body};
  // A POST transport timeout cannot tell whether the server committed. Query the
  // request receipt, never replay the mutation or roll back an optimistic draft.
  if(host&&!host.closed){send('ping');send(type,payload);}else if(relay)void relay.send({protocol,type,session,...payload}).catch(error=>{if(error?.status&&error.status<500){clearTimeout(timer);pending.delete(requestId);reject(error);}else send('requestStatus',{requestId});});
 });
}
export const workbenchCharacterId=(target:Target)=>`suite:${target.key}`;
const saves=new Map<string,{queuedAfter?:Promise<any>;observed:any;before:Character;beforeDerived:Derived;after:Character;derived:Derived;projection?:{before:Character;after:Character};target:Target;timer:ReturnType<typeof setTimeout>;waiters:{resolve:(value?:any)=>void;reject:(e:Error)=>void}[]}>();
const saveChains=new Map<string,Promise<any>>();
const characterQueue=mutationQueue();
export function patchWorkbenchStats(before:Character,after:Character,_previous:Derived,next:Derived,target=state.target,projection?:{before:Character;after:Character}){
 if(!inWorkbench||!target||after.id!==workbenchCharacterId(target))return;
 return new Promise<void>((resolve,reject)=>{
  let batch=saves.get(target.key);if(!batch){batch={queuedAfter:saveChains.get(target.key),observed:structuredClone(observedDocuments.get(target.key)?.document),before,beforeDerived:_previous,after,derived:next,projection,target,timer:0 as any,waiters:[]};saves.set(target.key,batch);}batch.after=after;batch.derived=next;if(projection)batch.projection={before:batch.projection?.before||projection.before,after:projection.after};batch.waiters.push({resolve,reject});clearTimeout(batch.timer);const current=batch;
  batch.timer=setTimeout(()=>{saves.delete(target.key);const run=(ack?:any)=>workbenchRequest('save',{key:current.target.key,itemId:current.target.itemId,observed:ack?.snapshot?.document||current.observed,previous:current.before,previousData:exportOwlbear(current.projection?.before||current.before,current.beforeDerived),native:current.after,data:exportOwlbear(current.projection?.after||current.after,current.derived),expected:{...current.target.stats,'health':current.before.runtime.hp,'temporary health':current.before.runtime.tempHp,'max health':current.beforeDerived.maxHp,'armor class':current.beforeDerived.ac},statPatch:Object.fromEntries(Object.entries({'health':current.after.runtime.hp,'temporary health':current.after.runtime.tempHp,'max health':current.derived.maxHp,'armor class':current.derived.ac}).filter(([key,value])=>value!==({'health':current.before.runtime.hp,'temporary health':current.before.runtime.tempHp,'max health':current.beforeDerived.maxHp,'armor class':current.beforeDerived.ac} as Record<string,number>)[key]))});const flight=characterQueue.run(current.target.key,run);saveChains.set(current.target.key,flight);void flight.then(()=>current.waiters.forEach(w=>w.resolve())).catch(e=>current.waiters.forEach(w=>w.reject(e))).finally(()=>{if(saveChains.get(current.target.key)===flight)saveChains.delete(current.target.key);});},80);
 });
}
