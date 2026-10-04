import {startupPhase,subscribeStartup} from './startup';
import {MonsterRuntime,runtimeFrom} from '../core/workbenchRuntime';
import {boundedDiceHistory} from './diceHistory';
import {WorkbenchSnapshotCache,type CacheAccess} from './workbench-cache';
import {previewInventory,overlayInventory} from '../core/inventory';
import {WorkbenchRevisions,currentInventory,documentRevision} from '../core/workbenchRevisions';
import {recordAction} from './actionHistory';
import {startWorkbenchSound,playWorkbenchSound} from './workbenchSound';
import type {InventoryState} from '../core/inventory';
import {Relay,type RelayState} from './relay';
import {documentChanges} from './document-delta';
import {mutationQueue} from './mutationQueue';
import {captureWriteIntent,invalidateWriteIntents,permissionChanged} from './workbenchWriteIntent';
import {safeWorkbenchDiagnostic} from './workbenchDiagnostic';
import {exportOwlbear} from '../core/export';
import {useSyncExternalStore} from 'react';
import type {Character,Derived,RulePack,Entry,Edition,RuleProfile} from '../core/model';
import type {ResourceWidgetLayout} from '../core/resourceWidgets';
const protocol='full-suite-workbench/v1',params=new URLSearchParams(location.hash.slice(1));
const session=params.get('suite'),origin=params.get('bridge');
export const inWorkbench=!!session&&origin===location.origin;
export type Target={targetId?:string;tokenPortrait?:{url:string;width?:number;height?:number};projectionPending?:boolean;documentRevision?:number;key:string;itemId:string;name:string;cardId:string;slug:string;kind:'character'|'monster'|'token';stats:Record<string,number>;write:boolean;role:string;pinned:boolean;locked?:boolean;statsLocked?:boolean;conditions?:{id:string;name:string;entry?:Entry;level?:number}[];resources?:any[]};
export type CardChoice={targetId?:string;resourceHidden?:string[];resourceWidgets?:Record<string,ResourceWidgetLayout>;resourceAttacks?:ResourceWidgetLayout;classSummary?:Character['selections'];owner_ids?:string[];player?:string;documentRevision?:number;kind?:'monster'|'character';passive?:number;coins?:Record<string,number>;conditions?:{id:string;name:string;entry?:Entry;level?:number}[];id:string;name:string;write:boolean;locked:boolean;inScene:boolean;itemId:string;resources:any[];stats:Record<string,any>};
export type SharedRules={edition:Edition;sourceMode:'full'|'short'|'both';profile:RuleProfile;packs:RulePack[];customEntries:Entry[]};
export type SharedDocument={key:string;scope:'room'|'scene';revision:number;rules:SharedRules};
export type WorkbenchReadFailure={targetId:string;message:string;status?:number;diagnostic:ReturnType<typeof safeWorkbenchDiagnostic>};
type State={readFailure?:WorkbenchReadFailure;access?:CacheAccess;inventory?:InventoryState;shared?:SharedDocument;settings?:Record<string,any>;visibility?:{wiki:boolean;monsters:boolean};console?:{timeStop:boolean;portalEffects:boolean;players:{id:string;name:string}[]};cards:CardChoice[];monsters:CardChoice[];role?:string;enabled:Record<string,boolean>;online:boolean;target?:Target;document?:any;loading?:boolean;message:string;rolls:any[];compose?:{id:string;expression:string;label?:string}};
let state:State={cards:[],monsters:[],enabled:{},online:false,message:'正在连接枭熊…',rolls:[]},host:Window|null=null,knownHost:Window|null=null,roomWindow:Window|null=null,last=0,lastDirect=0,lastRelayPing=0;
const listeners=new Set<()=>void>(),pending=new Map<string,{resolve:(value?:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>;started:number;type:string;writeTargets?:string[];cancelled?:boolean}>();
let authoritativeInventory:InventoryState|undefined;
let revisions=new WorkbenchRevisions();
const snapshotCache=new WorkbenchSnapshotCache();
let clientInstance=crypto.randomUUID(),clientStarted=performance.timeOrigin;
let clientSelection=0,wantedSelection:string|undefined,pendingSelection:string|undefined,readRetry=0,activeReadRetry=0;
let switchMetric:{id:number;started:number;key?:string;stages:Record<string,number|boolean>}|undefined;
function switchStage(stage:string,reused?:boolean){if(!switchMetric||!params.has('measureSwitch')||stage in switchMetric.stages)return;switchMetric.stages[stage]=Math.round((performance.now()-switchMetric.started)*100)/100;if(reused!==undefined)switchMetric.stages.reused=reused;window.dispatchEvent(new CustomEvent('workbench-switch-metric',{detail:{id:switchMetric.id,...switchMetric.stages}}));}
export function markWorkbenchView(stage:'prepare'|'prepared'|'committed',key:string,reused?:boolean){if(switchMetric?.key!==key)return;switchStage(stage,reused);if(stage==='committed'){const current=switchMetric;requestAnimationFrame(()=>{if(switchMetric===current)switchStage('nextFrame');});}}
const operationTimings:any[]=[];
export function workbenchDiagnostics(){return {online:state.online,cache:snapshotCache.diagnostics(),relayState,transport:host&&!host.closed?'direct':relay?'relay':'offline',hostStarted,pending:[...pending].map(([id,p])=>({id,type:p.type,elapsedMs:Math.round(performance.now()-p.started)})),recent:operationTimings.slice(-24)};}
const observedDocuments=new Map<string,{sequence:number;document:any}>();
function rememberDocument(m:any){if(!m.state?.key||m.document===undefined||snapshotCache.currentAccess&&!snapshotCache.permits(m.state))return;snapshotCache.remember(m,snapshotCache.currentAccess);const old=observedDocuments.get(m.state.key),sequence=m.sequence||0;if(!old||documentRevision(m.document,m.state)>=documentRevision(old.document))observedDocuments.set(m.state.key,{sequence,document:m.document});}
const stockDrafts=new Map<string,{before:InventoryState;after:InventoryState}>();
const inventoryRequests=new Map<string,string>();
const inventoryCompletions=new Map<string,(result:any)=>void>();
let updateDepth=0,updatePending=false;
function publishUpdate(){if(updateDepth){updatePending=true;return;}listeners.forEach(fn=>fn());}
function restrictInventory(inventory:InventoryState|undefined){
 const access=snapshotCache.currentAccess;if(!inventory||!access)return inventory;
 return {...inventory,containers:Object.fromEntries(Object.entries(inventory.containers).flatMap(([id,container])=>{if(container.kind==='public')return [[id,container]];const grant=container.kind==='card'?access.cards.find(card=>id===`card:${card.id}`&&access.enabled.characterCards!==false):access.monsters.find(card=>id===`monster:${card.itemId}`);return grant?[[id,{...container,write:snapshotCache.accessConfirmed&&grant.write}]]:[];}))};
}
function update(patch:Partial<State>,authority=true){
 if(authority&&!snapshotCache.currentAccess){const revoked:string[]=[];for(const field of ['cards','monsters'] as const)if(patch[field])for(const old of state[field])if(old.write&&!patch[field]!.some(next=>(field==='cards'?next.id===old.id:next.itemId===old.itemId)&&next.write))revoked.push(field==='cards'?`card:${old.id}`:`monster:${old.itemId}`);if(state.target?.write&&patch.target?.key===state.target.key&&!patch.target.write)revoked.push(state.target.cardId?`card:${state.target.cardId}`:`monster:${state.target.itemId}`);if(revoked.length)invalidateWrites(revoked);}
 if('inventory' in patch){authoritativeInventory=restrictInventory(currentInventory(authoritativeInventory,patch.inventory));let shown=authoritativeInventory;if(shown)for(const draft of stockDrafts.values())if(draft.before.publicId===shown.publicId)shown=overlayInventory(shown,draft.before,draft.after);patch={...patch,inventory:shown};}state={...state,...patch};if(patch.target&&switchMetric?.key===patch.target.key)switchStage('state');publishUpdate();}
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
 const affectedTargets=[op.container,op.from,op.to].filter((id):id is string=>typeof id==='string'),validate=captureWriteIntent(...affectedTargets);
 const before=state.inventory;if(!before)throw Error('背包尚未载入');if(op.action==='move'&&!op.observedSlots)op.observedSlots=Object.fromEntries((op.positions||[]).map((p:any)=>[p.id,before.containers[op.container]?.items.find(row=>row.id===p.id)?.slot]));const after=previewInventory(before,op);stockDrafts.set(op.operationId,{before,after});update({inventory:authoritativeInventory});
 let uncertain=false,recorded=false;
 const completed=(result:any)=>{if(recorded||!result?.historyId||op.action==='silent')return;recorded=true;let reference=result.historyId,old=before,next=after;const reverse=async()=>{if(before.publicId!==authoritativeInventory?.publicId)throw Error('请回到该背包所在场景再撤销');for(const itemId of affectedTargets)if(before.containers[itemId]?.kind!=='public'&&before.containers[itemId]?.write)writeTarget('save',{key:undefined,itemId});const validateReverse=captureWriteIntent(...affectedTargets);const id=crypto.randomUUID();stockDrafts.set(id,{before:next,after:old});update({inventory:authoritativeInventory});let unknown=false;try{const r=await inventoryQueue.run(before.publicId,()=>{validateReverse();return workbenchRequest('inventory',{key:undefined,itemId:undefined,scopeKey:before.publicId,operation:{action:'history',operationId:id,reference}},affectedTargets);});reference=r.historyId;[old,next]=[next,old];}catch(error){unknown=!!(error as any)?.uncertain&&!(error as any)?.queueBlocked;throw error;}finally{if(!unknown)stockDrafts.delete(id);update({inventory:authoritativeInventory});}};recordAction({label:'背包',undo:reverse,redo:reverse});};
 inventoryCompletions.set(op.operationId,completed);
 try{const result=await inventoryQueue.run(before.publicId,()=>{validate();return workbenchRequest('inventory',{key:undefined,itemId:undefined,scopeKey:before.publicId,operation:inventoryPayload(op,before)});});completed(result);return result;
 }catch(error){uncertain=!!(error as any)?.uncertain&&!(error as any)?.queueBlocked;throw error;}finally{if(!uncertain){stockDrafts.delete(op.operationId);inventoryCompletions.delete(op.operationId);}update({inventory:authoritativeInventory});}
}

let relayState:RelayState|undefined;
let relay:Relay|undefined,selectionSequence=0,catalogSequence=0,hostStarted=0,followRevision=0;
let handshakeReady=false,handshakeCatalog=false,lastHello:number|undefined,helloAttempts=0;
function resetGroup(disconnected=false){if(hostStarted)window.dispatchEvent(new CustomEvent('workbench-group-roll-reset',{detail:{hostStarted,disconnected}}));}
function resetHandshake(restartRetries=true,disconnected=true){if(disconnected){resetGroup(true);snapshotCache.suspend();invalidateWrites(undefined,false);update({target:state.target?{...state.target,write:false}:undefined,cards:state.cards.map(card=>({...card,write:false})),monsters:state.monsters.map(card=>({...card,write:false})),inventory:authoritativeInventory},false);}handshakeReady=false;handshakeCatalog=false;if(restartRetries){lastHello=undefined;helloAttempts=0;}}
const monsterRuntime=new MonsterRuntime();
function normalizeSnapshot(m:any,authority=true){
 if(!m.state)return m;
 const previous=state.target?.key===m.state.key?state.target:m.state.cardId?state.cards.find(card=>card.id===m.state.cardId):state.monsters.find(card=>card.itemId===m.state.itemId);
 const normalized=m.state.cardId?{...m,state:{...m.state,...runtimeFrom(m.state,previous)}}:monsterRuntime.snapshot(m);
 const access=snapshotCache.currentAccess,grant=access?(m.state.cardId?access.cards.find(card=>card.id===m.state.cardId):access.monsters.find(card=>card.itemId===m.state.itemId)):!authority||m.sequence&&m.sequence<catalogSequence?previous:undefined;
 if(grant)normalized.state={...normalized.state,write:grant.write,locked:grant.locked,...(access?{role:access.role}:{}),...(grant.targetId?{targetId:grant.targetId}:{})};
 return normalized;
}
function catalogCards(cards:any){return (Array.isArray(cards)?cards:[]).filter(card=>card&&typeof card.id==='string'&&(!snapshotCache.currentAccess||snapshotCache.currentAccess.enabled.characterCards!==false&&snapshotCache.currentAccess.cards.some(grant=>grant.id===card.id))).map(card=>{const grant=snapshotCache.currentAccess?.cards.find(g=>g.id===card.id);return revisions.card({...card,...runtimeFrom(card,state.cards.find(old=>old.id===card.id)),...(grant?{write:snapshotCache.accessConfirmed&&grant.write,locked:grant.locked}:{})});});}
function catalogMonsters(cards:any,sequence=0){return (Array.isArray(cards)?cards:[]).filter(card=>card&&typeof card.itemId==='string'&&(!snapshotCache.currentAccess||snapshotCache.currentAccess.monsters.some(grant=>grant.itemId===card.itemId))).map(card=>{const grant=snapshotCache.currentAccess?.monsters.find(g=>g.itemId===card.itemId);return {...monsterRuntime.catalog(card,sequence),kind:'monster',...(grant?{write:snapshotCache.accessConfirmed&&grant.write,locked:grant.locked,...(grant.targetId?{targetId:grant.targetId}:{})}:{})};});}
function receiptCards(cards:any,monsters=false){
 if(snapshotCache.currentAccess)return cards;
 const current=monsters?state.monsters:state.cards;
 return (Array.isArray(cards)?cards:[]).flatMap(card=>{const grant=current.find(live=>monsters?live.itemId===card?.itemId:live.id===card?.id);return grant?[{...card,write:grant.write,locked:grant.locked}]:[];});
}
function applySnapshotRuntime(snap:any,currentPermissions=false){
 update({cards:state.cards.map(card=>snap.state.cardId&&card.id===snap.state.cardId?revisions.card({...card,...runtimeFrom(snap.state,card),...(currentPermissions?{locked:snap.state.locked??card.locked}:{})}):card),
  monsters:state.monsters.map(card=>!snap.state.cardId&&card.itemId===snap.state.itemId?{...card,...runtimeFrom(snap.state,card),...(currentPermissions?{locked:snap.state.locked??card.locked}:{})}:card)});
}
function acceptsReceiptAccess(access:CacheAccess|undefined){const current=snapshotCache.currentAccess;return !access?!current||snapshotCache.accessConfirmed:!!current&&snapshotCache.accessConfirmed&&current.epoch===access.epoch&&current.room===access.room&&current.scope===access.scope&&current.role===access.role;}
function acceptSnapshot(m:any,authority=true){
 if(m.access&&!(authority?acceptAccess(m.access):acceptsReceiptAccess(m.access))||snapshotCache.currentAccess&&!snapshotCache.permits(m.state))return;
 m=revisions.snapshot(normalizeSnapshot(m,authority));rememberDocument(m);if(!m.state)return;
 if(authority&&!snapshotCache.currentAccess&&(!m.sequence||m.sequence>=catalogSequence))update({cards:state.cards.map(card=>m.state.cardId===card.id?{...card,write:m.state.write,locked:m.state.locked??card.locked}:card),monsters:state.monsters.map(card=>!m.state.cardId&&m.state.itemId===card.itemId?{...card,write:m.state.write,locked:m.state.locked??card.locked}:card)});
 applySnapshotRuntime(m);
 const same=state.target?.key===m.state.key;
 if(m.sequence&&m.sequence<selectionSequence){
  // The durable card revision outranks message timing, but an older receipt
  // must not restore an old selection, owner permission, or lock state.
  if(same&&m.state.cardId&&documentRevision(m.document,m.state)>documentRevision(state.document,state.target))update({target:{...state.target!,...runtimeFrom(m.state)},document:m.document});
  return;
 }
 selectionSequence=m.sequence||selectionSequence;pendingSelection=undefined;update({readFailure:undefined,target:m.state,document:m.document!==undefined?m.document:same?state.document:undefined,loading:!!m.loading,message:m.error||''});
}
function send(type:string,extra:Record<string,unknown>={}){const m={protocol,type,session,clientInstance,clientStarted,...(['hello','ping'].includes(type)?{startupPhase:startupPhase()}:{}),...extra};if(host&&!host.closed)host.postMessage(m,origin!);else if(relay)void relay.send(m).catch(()=>{});}
function previewSelection(itemId:string){
 update({readFailure:undefined});
 if(pendingSelection!==itemId){lastHello=Date.now();helloAttempts=1;}
 pendingSelection=itemId;
 const card=state.cards.find(card=>itemId===`card:${card.id}`||itemId===card.itemId),cached=state.online?snapshotCache.get(itemId,card?.documentRevision||0):undefined;
 if(cached){pendingSelection=undefined;if(switchMetric)switchMetric.key=cached.state.key;switchStage('memory');update({target:{...cached.state,pinned:state.target?.pinned??cached.state.pinned},document:cached.document,loading:false,message:''});}
 else{
  // Older hosts have no access directory and cannot populate the warm cache.
  // Clicking the already displayed, still-listed card need not erase its
  // authorized response. This never restores a previously visited card.
  const current=state.target;
  if(!snapshotCache.currentAccess&&state.online&&handshakeReady&&handshakeCatalog&&!state.loading&&state.document!=null&&current?.kind==='character'&&card?.id===current.cardId&&state.enabled.characterCards!==false&&documentRevision(state.document,current)>=(card.documentRevision||0)){
   if(switchMetric)switchMetric.key=current.key;switchStage('current');pendingSelection=undefined;update({target:{...current,write:card.write,locked:card.locked,role:state.role||current.role},loading:false,message:''});return;
  }
  update({target:undefined,document:undefined,loading:true,message:'读取角色资料…'});
 }
}
export function chooseWorkbench(itemId:string){activeReadRetry=0;readRetry++;clientSelection++;if(params.has('measureSwitch'))switchMetric={id:clientSelection,started:performance.now(),stages:{}};wantedSelection=itemId;previewSelection(itemId);send('select',{itemId,clientSelection});window.dispatchEvent(new Event('workbench-show-sheet'));}
function acceptAccess(access:CacheAccess){
 const previous=snapshotCache.currentAccess,confirmed=snapshotCache.accessConfirmed;if(!snapshotCache.acceptAccess(access))return false;
 access=snapshotCache.currentAccess!;
 if(confirmed&&previous===access)return true;
 const scopeChanged=previous&&(previous.scope!==access.scope||previous.room!==access.room||previous.role!==access.role);
 const revoked=previous?[...previous.cards.filter(card=>card.write&&!access.cards.some(next=>next.id===card.id&&next.write&&next.grantVersion===card.grantVersion&&access.enabled.characterCards!==false)).map(card=>`card:${card.id}`),...previous.monsters.filter(card=>card.write&&!access.monsters.some(next=>next.itemId===card.itemId&&next.key===card.key&&next.write&&next.grantVersion===card.grantVersion)).map(card=>`monster:${card.itemId}`)]:[];
 if(scopeChanged)invalidateWrites();else if(revoked.length)invalidateWrites(revoked);
 if(scopeChanged){activeReadRetry=0;readRetry++;resetGroup();revisions=new WorkbenchRevisions();monsterRuntime.reset();observedDocuments.clear();wantedSelection=undefined;pendingSelection=undefined;authoritativeInventory=undefined;update({readFailure:undefined,target:undefined,document:undefined,inventory:undefined,shared:undefined,loading:false});}
 if(pendingSelection&&!access.cards.some(card=>access.enabled.characterCards!==false&&(pendingSelection===`card:${card.id}`||pendingSelection===card.itemId||card.itemIds?.includes(pendingSelection!)))&&!access.monsters.some(card=>pendingSelection===(card.targetId||card.itemId)||pendingSelection===card.itemId)){pendingSelection=undefined;wantedSelection=undefined;update({readFailure:undefined,loading:false,message:'当前角色的查看权限或场景已改变'});}
 monsterRuntime.restrict(access.monsters);
 update({access,inventory:authoritativeInventory,cards:state.cards.filter(card=>access.enabled.characterCards!==false&&access.cards.some(grant=>grant.id===card.id)).map(card=>({...card,...access.cards.find(grant=>grant.id===card.id)})),monsters:state.monsters.filter(card=>access.monsters.some(grant=>grant.itemId===card.itemId)).map(card=>({...card,...access.monsters.find(grant=>grant.itemId===card.itemId),kind:'monster' as const})),role:access.role,enabled:access.enabled});
 if(state.target){if(!snapshotCache.permits(state.target))update({readFailure:undefined,target:undefined,document:undefined,loading:false,message:'当前角色的查看权限或场景已改变'});else{const grant=state.target.cardId?access.cards.find(card=>card.id===state.target!.cardId):access.monsters.find(card=>card.itemId===state.target!.itemId);if(grant&&(grant.write!==state.target.write||grant.locked!==state.target.locked||access.role!==state.target.role))update({target:{...state.target,write:grant.write,locked:grant.locked,role:access.role}});}}
 return true;
}
export function composeRoll(expression:string,label=''){window.dispatchEvent(new CustomEvent('workbench-compose-local',{detail:{expression,label,id:crypto.randomUUID()}}));}
function discover(w:Window,depth=0){if(depth>3)return;try{w.postMessage({protocol,type:'hello',session,clientInstance,clientStarted,startupPhase:startupPhase()},origin!);for(let i=0;i<Math.min(w.length,64);i++)discover(w.frames[i],depth+1);}catch{}}
function requestHello(){
 // A heartbeat proves transport liveness, not that the initial catalog arrived.
 // Retry only this read-only handshake; pending mutations keep their own ACK path.
 const now=Date.now(),delay=Math.min(10000,1000*2**Math.min(Math.max(helloAttempts-1,0),4));
 if(lastHello!==undefined&&now-lastHello<delay)return;
 lastHello=now;helloAttempts++;
 if(!host){try{const room=roomWindow||window.opener;if(room&&!room.closed)discover(room.top||room);}catch{}}
 send('hello');
}
if(inWorkbench){
 subscribeStartup(()=>send('startup',{startupPhase:startupPhase()}));
 startWorkbenchSound();
 function accept(m:any){if(m.protocol!==protocol||m.session!==session||m.hostStarted&&m.hostStarted<hostStarted)return;updateDepth++;try{if(m.hostStarted>hostStarted){invalidateWrites();observedDocuments.clear();hostStarted=m.hostStarted;selectionSequence=0;catalogSequence=0;followRevision=0;monsterRuntime.reset();revisions=new WorkbenchRevisions();snapshotCache.reset();wantedSelection=undefined;pendingSelection=undefined;clientSelection=0;activeReadRetry=0;readRetry++;update({readFailure:undefined,access:undefined,target:undefined,document:undefined,cards:[],monsters:[],role:undefined,enabled:{},inventory:undefined,shared:undefined,settings:undefined,visibility:undefined,console:undefined});resetHandshake();resetGroup();}last=Date.now();
  if(!state.online)update({online:true,message:''});
  const cancelledReceipt=m.type==='ack'&&pending.get(m.requestId)?.cancelled;
  const accessAccepted=m.type==='selectionError'?(snapshotCache.currentAccess?!!m.access&&acceptsReceiptAccess(m.access):!m.access):!m.access||(['ack','cacheSnapshot'].includes(m.type)?acceptsReceiptAccess(m.access):acceptAccess(m.access));
  if(m.type==='access'||!accessAccepted&&m.type!=='ack')return;
  if(m.type==='cacheSnapshot'){if(accessAccepted&&m.state&&(!snapshotCache.currentAccess||snapshotCache.permits(m.state))){const snap=revisions.snapshot(normalizeSnapshot(m,false));rememberDocument(snap);if(snap.state)applySnapshotRuntime(snap);if(snap.state?.key===state.target?.key)acceptSnapshot(snap,false);
    else if(pendingSelection&&snapshotCache.get(pendingSelection))previewSelection(pendingSelection);
   }return;}
  if(m.type==='ready')handshakeReady=true;
  if(m.type==='groupRollState'||m.type==='ready')window.dispatchEvent(new CustomEvent('workbench-group-roll-state',{detail:{group:m.type==='ready'?m.groupRoll??null:m.group,groupRevision:m.groupRevision??0,hostStarted:m.hostStarted||hostStarted,snapshot:m.type==='ready'}}));
  if(m.type==='ready'||m.type==='rolls')update({rolls:boundedDiceHistory(m.rolls)});
  if(m.type==='directory'&&(!m.sequence||m.sequence>=catalogSequence)){catalogSequence=m.sequence||catalogSequence;update({cards:catalogCards(m.cards),monsters:catalogMonsters(m.monsters,m.sequence),role:snapshotCache.currentAccess?.role||m.role,enabled:snapshotCache.currentAccess?.enabled||m.enabled||{}});}
  if(m.type==='catalog'&&(!m.sequence||m.sequence>=catalogSequence)){handshakeCatalog=true;catalogSequence=m.sequence||catalogSequence;update({cards:catalogCards(m.cards),monsters:catalogMonsters(m.monsters,m.sequence),role:snapshotCache.currentAccess?.role||m.role,enabled:snapshotCache.currentAccess?.enabled||m.enabled||{},visibility:m.visibility,console:m.console,inventory:m.inventory?.revision===authoritativeInventory?.revision&&m.inventory?.publicId===authoritativeInventory?.publicId&&m.inventory?.access===authoritativeInventory?.access&&m.role===state.role?authoritativeInventory:m.inventory,shared:m.shared?.key===state.shared?.key&&m.shared?.revision===state.shared?.revision?state.shared:m.shared,settings:m.settings});}
  if(m.type==='catalog'&&state.target){const card=state.target.cardId?state.cards.find(c=>c.id===state.target!.cardId):state.monsters.find(c=>c.itemId===state.target!.itemId);if(card&&card.write!==state.target.write)update({target:{...state.target,write:card.write,locked:card.locked}});}
  if(m.type==='showWiki')window.dispatchEvent(new CustomEvent('workbench-open-entry',{detail:m.entry}));
  if(['navigate','followSelection','followEnd','selection'].includes(m.type)&&Number.isSafeInteger(m.followRevision)){if(m.followRevision<followRevision)return;followRevision=m.followRevision;}
  if(m.type==='followSelection')window.dispatchEvent(new CustomEvent('workbench-follow-selection',{detail:{active:true}}));
  if(m.type==='followEnd'){wantedSelection=undefined;pendingSelection=undefined;window.dispatchEvent(new CustomEvent('workbench-follow-selection',{detail:{active:false,itemId:m.itemId,restore:m.restore!==false}}));}
  if(m.type==='navigate'&&(!clientSelection||(!m.clientInstance||m.clientInstance===clientInstance)&&(m.clientSelection===undefined||m.clientSelection>=clientSelection))){activeReadRetry=0;readRetry++;if(m.itemId)wantedSelection=m.itemId;if(m.followSelection)window.dispatchEvent(new CustomEvent('workbench-follow-selection',{detail:{active:true}}));if(m.itemId)previewSelection(m.itemId);window.dispatchEvent(new Event('workbench-show-sheet'));}
  if(m.type==='panelEvent')window.dispatchEvent(new CustomEvent('workbench-panel-event',{detail:m}));
  if(m.type==='diceEvent'&&m.event==='com.obr-suite/sfx')playWorkbenchSound(m.data?.data?.name);
  if(m.type==='diceEvent')window.dispatchEvent(new CustomEvent('workbench-dice-event',{detail:{event:m.event,data:m.data}}));
  if(m.type==='selectionError'){
   const expected=pendingSelection||wantedSelection||(state.target?.targetId||(state.target?.cardId?'card:'+state.target.cardId:state.target?.itemId));
   const listed=state.cards.some(card=>m.targetId==='card:'+card.id||m.targetId===card.itemId)||state.monsters.some(card=>m.targetId===(card.targetId||card.itemId));
   if(activeReadRetry||!accessAccepted||typeof m.targetId!=='string'||(expected?m.targetId!==expected&&m.itemId!==expected:!listed)||m.clientInstance&&m.clientInstance!==clientInstance||m.clientSelection!==undefined&&m.clientSelection<clientSelection||m.sequence&&m.sequence<selectionSequence)return;
   if(Number.isSafeInteger(m.followRevision)){if(m.followRevision<followRevision)return;followRevision=m.followRevision;}
   selectionSequence=m.sequence||selectionSequence;pendingSelection=undefined;wantedSelection=m.targetId;
   update({loading:false,readFailure:readFailure(m.targetId,m),message:m.message||'角色资料读取失败'});
  }
  if(m.type==='error')window.dispatchEvent(new CustomEvent('workbench-error',{detail:m.message}));
  if(m.type==='compose')update({compose:m.compose});
  if(m.type==='selection'){
   if(!accessAccepted||m.clientInstance&&m.clientInstance!==clientInstance&&wantedSelection||(!m.clientInstance||m.clientInstance===clientInstance)&&m.clientSelection!==undefined&&m.clientSelection<clientSelection)return;
   if(wantedSelection&&m.clientSelection===undefined&&m.state&&wantedSelection!==(m.state.targetId||(m.state.cardId?'card:'+m.state.cardId:m.state.itemId))&&wantedSelection!==m.state.itemId)return;
   wantedSelection=undefined;
   if(!m.state){pendingSelection=undefined;update({readFailure:undefined,target:undefined,document:undefined,loading:false,message:m.message||''});return;}
   acceptSnapshot(m);
  }
  if(m.type==='ack'){
   if(m.ok&&pending.get(m.requestId)?.type==='refreshCatalog'&&m.result?.catalog&&acceptsReceiptAccess(m.result.access)){
    const catalog=m.result.catalog;if(catalog.sequence>=catalogSequence){catalogSequence=catalog.sequence;update({cards:catalogCards(catalog.cards),monsters:catalogMonsters(catalog.monsters,catalog.sequence)});}
   }
   if(m.ok&&Array.isArray(m.result?.snapshots)){
    const catalog=m.result.catalog;
    if(catalog&&catalog.sequence>=catalogSequence){catalogSequence=catalog.sequence;update({cards:catalogCards(receiptCards(catalog.cards)).filter((card:CardChoice)=>!snapshotCache.currentAccess||snapshotCache.currentAccess.cards.some(grant=>grant.id===card.id)),monsters:catalogMonsters(receiptCards(catalog.monsters,true),catalog.sequence).filter((card:CardChoice)=>!snapshotCache.currentAccess||snapshotCache.currentAccess.monsters.some(grant=>grant.itemId===card.itemId))});}
    for(const input of m.result.snapshots){if(!input?.state||input.access&&!acceptsReceiptAccess(input.access)||snapshotCache.currentAccess&&!snapshotCache.permits(input.state))continue;const snap=revisions.snapshot(normalizeSnapshot(input,false));rememberDocument(snap);
     applySnapshotRuntime(snap);
     if(snap.state.key===state.target?.key)acceptSnapshot(snap,false);
    }
   }
   const operationId=inventoryRequests.get(m.requestId);if(operationId&&!m.uncertain){const completed=inventoryCompletions.get(operationId);inventoryCompletions.delete(operationId);if(m.ok&&completed)queueMicrotask(()=>completed(m.result));inventoryRequests.delete(m.requestId);stockDrafts.delete(operationId);update({inventory:authoritativeInventory});}
   // Includes late terminal receipts after a lost-response timeout. App keeps
   // uncertain local edits until a real receipt or explicit reconciliation.
  }
  if(m.type==='ack'){if(m.result?.warning)window.dispatchEvent(new CustomEvent('workbench-error',{detail:{message:m.result.warning,diagnostic:JSON.stringify(safeWorkbenchDiagnostic({diagnostic:m.result.diagnostic,requestId:m.requestId},{connection:{...workbenchDiagnostics(),online:state.online}}),null,2)}}));if(m.result?.historyId)stockDrafts.delete(m.result.historyId);if(m.ok&&m.result?.inventory){acceptInventoryReceipt(m.result.inventory);}if(m.ok&&m.result?.shared&&(!state.shared||m.result.shared.key!==state.shared.key||m.result.shared.revision>=state.shared.revision)){update({shared:m.result.shared});}if(m.ok&&m.result?.consolePatch&&m.result.sequence>=catalogSequence){update({console:{...state.console!,...m.result.consolePatch}});}if(m.ok&&m.result?.snapshot&&acceptsReceiptAccess(m.result.snapshot.access)&&(!snapshotCache.currentAccess||snapshotCache.permits(m.result.snapshot.state))){const snap=revisions.snapshot(normalizeSnapshot(m.result.snapshot,false));m.result.snapshot=snap;rememberDocument(snap);const currentPermissions=!snap.sequence||snap.sequence>=catalogSequence;
    applySnapshotRuntime(snap,currentPermissions);
    if(snap.state.key===state.target?.key)acceptSnapshot(snap,false);}const p=pending.get(m.requestId);if(p){operationTimings.push({requestId:m.requestId,type:p.type,ok:m.ok,totalMs:Math.round(performance.now()-p.started),...m.timing});if(operationTimings.length>24)operationTimings.shift();clearTimeout(p.timer);pending.delete(m.requestId);m.ok?p.resolve(m.result):p.reject(Object.assign(Error(m.message||'操作失败'),{diagnostic:{...m.diagnostic,timing:m.timing,connection:workbenchDiagnostics()},requestId:m.requestId,uncertain:!!m.uncertain}));}}
  if(m.type==='ack'){const publishReceipt=()=>window.dispatchEvent(new CustomEvent('workbench-operation-result',{detail:{requestId:m.requestId,ok:m.ok,uncertain:!!m.uncertain,result:m.result,message:m.message}}));
   // A relay poll may contain revocation and its terminal ACK together. Let the
   // rejected promise's recovery handlers settle before reconciling that ACK.
   if(cancelledReceipt)setTimeout(publishReceipt,0);else publishReceipt();
  }
  if(handshakeReady&&handshakeCatalog&&!pendingSelection){lastHello=undefined;helloAttempts=0;}
 }finally{updateDepth--;if(!updateDepth&&updatePending){updatePending=false;publishUpdate();}}}
 if(params.get('relay')){relay=new Relay(new URL('../relay',location.href.split('#')[0]).href,session!,'client',params.get('relay')!,accept,undefined,undefined,undefined,status=>{relayState=status;if(!host){resetHandshake(handshakeReady&&handshakeCatalog);if(!state.online)update({message:status.message});}});requestHello();}
 window.addEventListener('message',e=>{if(e.origin!==origin||e.data?.protocol!==protocol||e.data.session!==session||!e.source||e.data.hostStarted&&e.data.hostStarted<hostStarted)return;if(host&&host!==e.source&&!host.closed&&!(e.data.type==='ready'&&e.data.hostStarted>hostStarted))return;if(!host&&e.data.type!=='ready'&&!(e.source===knownHost&&e.data.type==='pong'&&e.data.hostStarted===hostStarted))return;host=e.source as Window;knownHost=host;lastDirect=Date.now();try{roomWindow=host.top;if(roomWindow)window.opener=roomWindow;}catch{}accept(e.data);});
 const connect=()=>{const now=Date.now();
  // A short busy/throttled interval must not erase the group or warm cache.
  if(host&&(host.closed||now-lastDirect>15000)){host=null;resetHandshake(true,false);}
  if(last&&now-last>45000&&state.online){resetHandshake();update({online:false,message:relayState?.message||'正在重新连接枭熊…'});}
  if(!handshakeReady||!handshakeCatalog||pendingSelection&&state.loading&&state.online&&(typeof document==='undefined'||document.visibilityState!=='hidden'))requestHello();
  if(host&&now-lastDirect>2500)send('ping');
  else if(!host&&relay&&handshakeReady&&handshakeCatalog&&now-lastRelayPing>=10000){lastRelayPing=now;send('ping');}
 };
 connect();setInterval(connect,1000);window.addEventListener('focus',connect);window.addEventListener('pageshow',event=>{
  if((event as PageTransitionEvent).persisted){
   // BFCache revives the old document after another document may have retired
   // its identity. Treat this activation as fresh while preserving its actual
   // intro phase and workspace; never replay edits or skip a pending fade.
   clientInstance=crypto.randomUUID();clientStarted=Math.max(clientStarted+1,Date.now(),performance.timeOrigin+performance.now());resetHandshake(true,true);
  }
  connect();
 });
}
function readFailure(targetId:string,error:any):WorkbenchReadFailure {
 const status=Number.isInteger(error?.status)?error.status:Number.isInteger(error?.diagnostic?.status)?error.diagnostic.status:Number.isInteger(error?.diagnostic?.httpStatus)?error.diagnostic.httpStatus:undefined;
 const message=status===404?'角色资料未找到（HTTP 404）。目录可能已过期，或资料位置／访问状态已改变；这不能证明角色已被删除。':status===401||status===403?'当前连接无法读取这张角色卡，请重新核对账号和 Owner 权限。':error?.message||'角色资料读取失败，请重试或复制诊断信息。';
 return {targetId,message,status,diagnostic:safeWorkbenchDiagnostic(error,{operation:'readCard',connection:{...workbenchDiagnostics(),online:state.online}})};
}
export async function retryWorkbenchRead(){
 const failed=state.readFailure;if(!failed||!state.online||activeReadRetry)return;
 const id=++readRetry,selection=clientSelection,started=hostStarted,scope=snapshotCache.currentAccess?.scope,room=snapshotCache.currentAccess?.room;activeReadRetry=id;
 const current=()=>id===readRetry&&selection===clientSelection&&started===hostStarted&&scope===snapshotCache.currentAccess?.scope&&room===snapshotCache.currentAccess?.room&&(wantedSelection===failed.targetId||state.readFailure?.targetId===failed.targetId);
 update({loading:true,readFailure:undefined,message:'正在重新读取角色资料…'});
 try{const result=await workbenchRequest('refreshCard',{key:undefined,itemId:failed.targetId});if(!current())return;
  const snap=result?.snapshot;const targetId=snap?.state?.targetId||(snap?.state?.cardId?'card:'+snap.state.cardId:snap?.state?.itemId);if(!snap?.state||(targetId!==failed.targetId&&snap.state.itemId!==failed.targetId)||!acceptsReceiptAccess(snap.access)||snapshotCache.currentAccess&&!snapshotCache.permits(snap.state))throw Error('当前角色的查看权限或连接已改变，请重新选择角色');
  acceptSnapshot(snap,false);wantedSelection=undefined;
 }catch(error){if(current()){pendingSelection=undefined;update({loading:false,readFailure:readFailure(failed.targetId,error),message:'角色资料仍未读到'});}}
 finally{if(activeReadRetry===id)activeReadRetry=0;}
}
export async function refreshWorkbenchCatalog(){await workbenchRequest('refreshCatalog',{key:undefined,itemId:undefined});}
export function useWorkbench(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},()=>state);}
export function pinWorkbench(pinned:boolean){if(!state.online||!state.target)return;const target=state.target;update({target:{...target,pinned}});send('pin',{pinned,itemId:target.targetId||target.itemId});}
const cardMutationTypes=new Set(['save','stats','resource','monsterSave','assignName','lock','statsLock','delete']);
function writeTarget(type:string,extra:Record<string,unknown>):string|undefined {
 if(type==='inventory'){
  if(snapshotCache.currentAccess&&!snapshotCache.accessConfirmed)throw permissionChanged();
  const operation=extra.operation as any,source=operation?.container||operation?.from;
  if(typeof source==='string'&&/^(card|monster):/.test(source))return writeTarget('save',{key:undefined,itemId:source});
  return;
 }
 if(!cardMutationTypes.has(type))return;
 const target=state.target,itemId=Object.hasOwn(extra,'itemId')?extra.itemId:target?.targetId||target?.itemId,key=Object.hasOwn(extra,'key')?extra.key:target?.key;
 const access=snapshotCache.currentAccess;
 if(!state.online||access&&!snapshotCache.accessConfirmed||!access&&(!handshakeReady||!handshakeCatalog))throw permissionChanged();
 const cards=access?.cards||state.cards,monsters=access?.monsters||state.monsters;
 const card=cards.find(card=>itemId===`card:${card.id}`||key===`${access?.room||''}:card:${card.id}`||itemId===card.itemId||'itemIds' in card&&card.itemIds?.includes(String(itemId)));
 const monster=monsters.find(card=>itemId===(card.targetId||`monster:${card.itemId}`)||itemId===card.itemId);
 const selected=target&&(target.key===key||itemId===(target.targetId||target.itemId))?target:undefined;
 const grant=card||monster||(!access?selected:undefined);
 if(!grant?.write||card&&state.enabled.characterCards===false)throw permissionChanged();
 return card?`card:${card.id}`:selected?.cardId?`card:${selected.cardId}`:`monster:${monster?.itemId||selected!.itemId}`;
}
function invalidateWrites(ids?:string[],cancelPending=true){
 invalidateWriteIntents(ids);
 for(const [key,batch] of saves){if(ids&&!ids.includes(`card:${batch.target.cardId}`))continue;clearTimeout(batch.timer);saves.delete(key);for(const waiter of batch.waiters)waiter.reject(permissionChanged());}
 if(!cancelPending)return;
 for(const [requestId,operation] of pending){if(!operation.writeTargets||operation.cancelled||ids&&!operation.writeTargets.some(id=>ids.includes(id)))continue;operation.cancelled=true;send('cancel',{requestId});operation.reject(Object.assign(permissionChanged(),{requestId,uncertain:true}));}
}
export function workbenchRequest(type:string,extra:Record<string,unknown>={},affectedTargets:string[]=[]){
 if(!state.online||!host&&!relay)return Promise.reject(Error('枭熊未连接'));
 let writeId:string|undefined;try{writeId=writeTarget(type,extra);}catch(error){return Promise.reject(error);}
 const requestId=crypto.randomUUID(),target=state.target;
 return new Promise<any>((resolve,reject)=>{
  const started=Date.now(),check=()=>{if(!pending.has(requestId))return;if(Date.now()-started>=180000){pending.delete(requestId);send('cancel',{requestId});reject(Object.assign(Error('枭熊尚未确认操作结果。已停止后续排队修改，请重连后核对。'),{uncertain:true,requestId}));return;}send('requestStatus',{requestId});const current=pending.get(requestId);if(current)current.timer=setTimeout(check,10000);};
  const timer=setTimeout(check,15000);pending.set(requestId,{resolve,reject,timer,started:performance.now(),type,writeTargets:type==='inventory'?[...new Set([writeId,...affectedTargets,(extra.operation as any)?.container,(extra.operation as any)?.from,(extra.operation as any)?.to].filter((id):id is string=>typeof id==='string'&&/^(card|monster):/.test(id)))]:writeId?[writeId]:undefined});let body=extra;
  if(type==='inventory'&&(extra.operation as any)?.operationId)inventoryRequests.set(requestId,(extra.operation as any).operationId);
  if(type==='save'&&(extra.observed as any)?.dnd_card_web){const {previous,native,observed,previousData,data,...rest}=extra;body={...rest,delta:{native:documentChanges(previous,native,(observed as any).dnd_card_web),legacy:documentChanges(previousData,data,observed)}};}
  const payload={requestId,expiresAt:Date.now()+30000,key:target?.key,itemId:target?.targetId||target?.itemId,...body,...(snapshotCache.currentAccess?{accessEpoch:snapshotCache.currentAccess.epoch,accessScope:snapshotCache.currentAccess.scope,accessRoom:snapshotCache.currentAccess.room}:{})};
  // A POST transport timeout cannot tell whether the server committed. Query the
  // request receipt, never replay the mutation or roll back an optimistic draft.
  if(host&&!host.closed){send('ping');send(type,payload);}else if(relay)void relay.send({protocol,type,session,...payload}).catch(error=>{if(error?.status&&error.status<500){clearTimeout(timer);pending.delete(requestId);reject(error);}else send('requestStatus',{requestId});});
 });
}
export const workbenchCharacterId=(target:Target)=>`suite:${target.key}`;
const saves=new Map<string,{queuedAfter?:Promise<any>;validate:()=>void;observed:any;before:Character;beforeDerived:Derived;after:Character;derived:Derived;projection?:{before:Character;after:Character};target:Target;timer:ReturnType<typeof setTimeout>;waiters:{resolve:(value?:any)=>void;reject:(e:Error)=>void}[]}>();
const saveChains=new Map<string,Promise<any>>();
const characterQueue=mutationQueue();
export function patchWorkbenchStats(before:Character,after:Character,_previous:Derived,next:Derived,target=state.target,projection?:{before:Character;after:Character}){
 if(!inWorkbench||!target||after.id!==workbenchCharacterId(target))return;
 return new Promise<void>((resolve,reject)=>{
  let batch=saves.get(target.key);if(!batch){batch={queuedAfter:saveChains.get(target.key),validate:captureWriteIntent(`card:${target.cardId}`),observed:structuredClone(observedDocuments.get(target.key)?.document),before,beforeDerived:_previous,after,derived:next,projection,target,timer:0 as any,waiters:[]};saves.set(target.key,batch);}batch.after=after;batch.derived=next;if(projection)batch.projection={before:batch.projection?.before||projection.before,after:projection.after};batch.waiters.push({resolve,reject});clearTimeout(batch.timer);const current=batch;
  batch.timer=setTimeout(()=>{saves.delete(target.key);const run=(ack?:any)=>{current.validate();return workbenchRequest('save',{key:current.target.key,itemId:current.target.itemId,observed:ack?.snapshot?.document||current.observed,previous:current.before,previousData:exportOwlbear(current.projection?.before||current.before,current.beforeDerived),native:current.after,data:exportOwlbear(current.projection?.after||current.after,current.derived),expected:{...current.target.stats,'health':current.before.runtime.hp,'temporary health':current.before.runtime.tempHp,'max health':current.beforeDerived.maxHp,'armor class':current.beforeDerived.ac},statPatch:Object.fromEntries(Object.entries({'health':current.after.runtime.hp,'temporary health':current.after.runtime.tempHp,'max health':current.derived.maxHp,'armor class':current.derived.ac}).filter(([key,value])=>value!==({'health':current.before.runtime.hp,'temporary health':current.before.runtime.tempHp,'max health':current.beforeDerived.maxHp,'armor class':current.beforeDerived.ac} as Record<string,number>)[key]))});};const flight=characterQueue.run(current.target.key,run);saveChains.set(current.target.key,flight);void flight.then(()=>current.waiters.forEach(w=>w.resolve())).catch(e=>current.waiters.forEach(w=>w.reject(e))).finally(()=>{if(saveChains.get(current.target.key)===flight)saveChains.delete(current.target.key);});},80);
 });
}
