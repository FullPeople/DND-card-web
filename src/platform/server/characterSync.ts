import type {Character} from '../../core/model';
import {sameValue} from '../../core/merge';
import {applyCanonicalOperations,operationPaths,readPath} from '../../core/sync/operations';
import type {ApiError,CharacterSnapshot,Conflict,Operation,OperationBatch,OperationResult,WebSocketMessage} from '../../core/sync/protocol';
import {ServerError} from './characterApi';
import {recordKey,recoverRecord,SYNC_SCHEMA,type PendingEntry,type SyncRecord,type SyncStore} from './syncStore';
/**
 * Per-character confirmed + pending state machine (docs/protocol/SYNC.md).
 *
 * - confirmed: the server snapshot, advanced once per revision, persisted
 *   together with the outbox in one store transaction.
 * - outbox: every user intent is persisted before it is shown or sent. One
 *   batch is in flight per character; a sent body is frozen and only ever
 *   retried with its original operationId.
 * - view: confirmed document + replay of live pending intents. Never sent.
 */
export interface SyncApi {
  get(id:string):Promise<CharacterSnapshot>;
  delta(id:string,afterRevision:number):Promise<{currentRevision:number;operations:OperationResult[]}>;
  submit(id:string,batch:OperationBatch,signal?:AbortSignal):Promise<OperationResult>;
}
export interface SyncOptions {
  api:SyncApi; store:SyncStore; serverOrigin:string; accountId:string; characterId:string; clientId:string;
  /** Multi-tab sender election; only the holder submits the shared outbox. */
  canSend?:()=>boolean;
  uuid?:()=>string; random?:()=>number; maxBatchOperations?:number;
  /** Persisted change notification (e.g. BroadcastChannel to other tabs). */
  persisted?:()=>void;
  /** Ask the transport to subscribe again from the confirmed revision. */
  resubscribe?:()=>void;
  unauthorized?:()=>void;
}
export type SyncPhase='loading'|'offline'|'online'|'catching-up'|'resyncing'|'forbidden'|'unauthorized'|'closed';
const LIVE=new Set(['queued','sending','unknown']);
/** Live intents that the optimistic view replays onto confirmed. */
const shown=(entry:PendingEntry)=>LIVE.has(entry.status)&&!entry.maybeInSnapshot;
const MAX_APPLIED=1000;
/** Apply contiguous results to confirmed exactly once; settle matching intents. Pure. */
export function absorbResults(record:SyncRecord,results:readonly OperationResult[]):SyncRecord{
  let confirmed=record.confirmed,applied=record.applied,outbox=record.outbox;
  for(const result of [...results].sort((a,b)=>a.revision-b.revision)){
    if(result.characterId!==record.characterId)continue;
    if(result.revision===confirmed.revision+1){
      const document=applyCanonicalOperations(confirmed.document,result.operations);
      document.revision=result.revision;document.updatedAt=result.updatedAt;
      confirmed={...confirmed,document,revision:result.revision,updatedAt:result.updatedAt};
      applied=[...applied,{revision:result.revision,operationId:result.operationId}].slice(-MAX_APPLIED);
    }
    // A duplicate or older receipt only settles its intent; it is never re-applied.
    if(result.revision<=confirmed.revision)outbox=outbox.filter(entry=>entry.operationId!==result.operationId);
  }
  return {...record,confirmed,applied,outbox,updatedAt:new Date().toISOString()};
}
/** The confirmed revision this queued intent was really authored against. */
export function baseRevisionFor(record:SyncRecord,entry:PendingEntry):number{
  let base=Math.min(entry.authoredRevision,record.confirmed.revision);const prior=new Set(entry.priorOperationIds);
  for(;;){const next=record.applied.find(row=>row.revision===base+1);if(next&&prior.has(next.operationId))base++;else break;}
  return Math.max(1,base);
}
const keyPaths=(op:Operation)=>op.op==='entity.upsert'||op.op==='entity.delete'||op.op==='order.move'?operationPaths(op).filter(p=>!p.endsWith('/order')):[op.path];
export function contextOf(document:Character,operations:readonly Operation[]){
  const before:PendingEntry['before']={};
  for(const op of operations)for(const path of keyPaths(op))if(!(path in before))before[path]=structuredClone(readPath(document,path));
  return before;
}
/** Never-sent offline intents whose edited values changed on the server. */
export function staleConflicts(entry:PendingEntry,document:Character):Conflict[]{
  const conflicts:Conflict[]=[];
  for(const op of entry.operations){
    if(op.op==='inc')continue;
    for(const path of keyPaths(op)){
      const old=entry.before[path],now=readPath(document,path);
      if(!old||old.exists!==now.exists||!sameValue(old.value,now.value))conflicts.push({path,serverExists:now.exists,serverValue:now.value,clientValue:'value' in op?op.value:op.op==='order.move'?{entityId:op.entityId,beforeId:op.beforeId??null}:null});
    }
  }
  return conflicts;
}
const HELD=new Set(['conflict','rejected']);
/**
 * Re-place the outbox on a fresh snapshot after resync_required. Pure.
 *
 * Entries are walked in their original order over a `working` document that
 * starts at the snapshot and accumulates every live intent before it, so a
 * never-sent intent is compared with what the user actually saw when making it
 * (its own earlier offline edits included), not with the bare snapshot.
 * - Sent/unknown entries keep their frozen body, ID and baseRevision
 *   (`sending` → `unknown`). The snapshot may or may not already contain them,
 *   so nothing is guessed: they are marked `maybeInSnapshot` (not projected
 *   until the original-ID retry returns a receipt) and `working` keeps both
 *   candidates, with and without them.
 * - A never-sent intent built on an earlier held intent (via priorOperationIds)
 *   is held as a dependency and never sent past it.
 * - Otherwise it is held when its edited values differ from every candidate, or
 *   when it no longer applies; else it is re-based (authoredRevision = snapshot)
 *   with its prior chain limited to the still-live earlier intents, and applied
 *   to the candidates it fits. It still waits behind an unknown head, which is
 *   always sent first.
 */
const MAX_CANDIDATES=8;
export function rebaseNeverSentOutbox(outbox:readonly PendingEntry[],snapshot:CharacterSnapshot):PendingEntry[]{
  let working=[snapshot.document];const live=new Set<string>(),held=new Set<string>();
  const applyAll=(documents:Character[],operations:Operation[])=>documents.flatMap(document=>{try{return [applyCanonicalOperations(document,operations)];}catch{return [];}});
  return outbox.map((entry):PendingEntry=>{
    if(entry.everSent||entry.status!=='queued'){
      const next=entry.status==='sending'?{...entry,status:'unknown' as const}:entry;
      if(HELD.has(next.status)){held.add(next.operationId);return next;}
      // Dropping candidates beyond the cap only adds holds for review, never a silent pass.
      live.add(next.operationId);working=[...working,...applyAll(working,next.operations)].slice(0,MAX_CANDIDATES);
      return {...next,maybeInSnapshot:true};
    }
    const hold=(value:NonNullable<PendingEntry['hold']>,conflicts?:Conflict[]):PendingEntry=>{held.add(entry.operationId);return {...entry,status:'conflict',hold:value,...(conflicts?{conflicts}:{})};};
    const blockedBy=entry.priorOperationIds.filter(id=>held.has(id));
    if(blockedBy.length)return hold({reason:'dependency',message:'这项离线修改建立在前面尚未处理的离线修改之上，请先处理前面的修改',blockedBy});
    const fits=working.filter(document=>!staleConflicts(entry,document).length);
    if(!fits.length)return hold({reason:'stale',message:'离线修改基于的旧版本已被服务器更新，需要确认'},staleConflicts(entry,working[0]));
    const applied=applyAll(fits,entry.operations);
    if(!applied.length)return hold({reason:'unreplayable',message:'服务器上的新变化使这项本地修改无法继续套用'});
    working=applied;
    const rebased={...entry,authoredRevision:snapshot.revision,priorOperationIds:entry.priorOperationIds.filter(id=>live.has(id))};
    live.add(entry.operationId);return rebased;
  });
}
export class CharacterSync {
  readonly key:string;
  record?:SyncRecord;view?:Character;lastError?:string;
  subscribed=false;
  private forbidden=false;private unauthorized=false;private resyncing=false;private catching=false;private closed=false;
  private chain:Promise<unknown>=Promise.resolve();
  private listeners=new Set<()=>void>();
  private buffered=new Map<number,OperationResult>();
  private catchUpTask?:Promise<boolean>;private resyncTask?:Promise<void>;
  private sending=false;private resyncFailed=false;private retryTimer?:ReturnType<typeof setTimeout>;
  constructor(private readonly options:SyncOptions){this.key=recordKey(options.serverOrigin,options.accountId,options.characterId);}
  get characterId(){return this.options.characterId;}
  get phase():SyncPhase{
    if(this.closed)return 'closed';if(this.forbidden)return 'forbidden';if(this.unauthorized)return 'unauthorized';
    if(this.resyncing)return 'resyncing';if(this.catching)return 'catching-up';if(!this.record)return 'loading';
    return this.subscribed?'online':'offline';
  }
  get outbox(){return this.record?.outbox||[];}
  get pending(){return this.outbox.filter(entry=>LIVE.has(entry.status));}
  get blocked(){return this.outbox.filter(entry=>entry.status==='conflict'||entry.status==='rejected');}
  listen(listener:()=>void){this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
  private emit(){for(const listener of this.listeners)listener();}
  private serial<T>(task:()=>Promise<T>):Promise<T>{const run=this.chain.then(task,task);this.chain=run.then(()=>{},()=>{});return run;}
  /** Atomic read-modify-write of the shared record, then reproject. */
  private async commit(change:(record:SyncRecord)=>SyncRecord|undefined):Promise<SyncRecord>{
    const next=await this.options.store.update(this.key,current=>current?change(current):undefined);
    if(!next)throw new Error('本机同步记录不存在');
    this.adopt(next);this.options.persisted?.();return next;
  }
  private adopt(record:SyncRecord){this.record=record;this.project();this.emit();}
  private project(){
    const record=this.record!;let view=record.confirmed.document;const invalid:string[]=[];
    for(const entry of record.outbox){
      if(!shown(entry))continue;
      try{view=applyCanonicalOperations(view,entry.operations);}catch{if(entry.status==='queued')invalid.push(entry.operationId);}
    }
    this.view={...view,revision:record.confirmed.revision,updatedAt:record.confirmed.updatedAt};
    if(invalid.length)void this.serial(()=>this.commit(r=>({...r,outbox:r.outbox.map(entry=>invalid.includes(entry.operationId)&&entry.status==='queued'?{...entry,status:'conflict',hold:{reason:'unreplayable',message:'服务器上的新变化使这项本地修改无法继续套用'}}:entry)}))).catch(()=>{});
  }
  /** Load cache (or the given/remote snapshot) and recover in-flight requests as unknown. */
  async open(initial?:CharacterSnapshot){
    return this.serial(async()=>{
      let record=await this.options.store.get(this.key);
      if(!record){
        const snapshot=initial||await this.options.api.get(this.options.characterId);
        const {serverOrigin,accountId,characterId}=this.options;
        record=await this.options.store.update(this.key,current=>current||{schema:SYNC_SCHEMA,serverOrigin,accountId,characterId,confirmed:snapshot,outbox:[],applied:[],updatedAt:new Date().toISOString()});
      }
      if(record!.outbox.some(entry=>entry.status==='sending'))record=await this.options.store.update(this.key,current=>current&&recoverRecord(current));
      this.adopt(record!);
    }).then(()=>{this.pump();});
  }
  /** Re-read the shared record after another tab persisted it. */
  async reload(){await this.serial(async()=>{const record=await this.options.store.get(this.key);if(record)this.adopt(record);});this.pump();}
  /**
   * This tab just became the sender (canSend false → true): re-read the latest
   * shared record, mark a request a previous sender left in flight as unknown
   * (retried later with its original ID/body), then start sending.
   */
  async resumeSending(){
    await this.serial(async()=>{const record=await this.options.store.update(this.key,current=>current&&recoverRecord(current));if(record)this.adopt(record);});
    this.pump();
  }
  /**
   * Persist intents first; only then do they appear in the view and get sent.
   * The recorded context (`before`, authoredRevision, priorOperationIds) is the
   * committed projection the intent is queued onto, so an edit made before the
   * previous one finished persisting still counts as built on top of it.
   */
  async propose(operations:Operation[]):Promise<string[]>{
    if(!operations.length)return [];
    if(this.closed)throw new Error('同步已关闭');
    const max=this.options.maxBatchOperations??128,uuid=this.options.uuid||(()=>crypto.randomUUID()),ids:string[]=[];
    await this.serial(()=>this.commit(record=>{
      const outbox=[...record.outbox];let seen=record.confirmed.document;
      for(const entry of outbox)if(shown(entry)){try{seen=applyCanonicalOperations(seen,entry.operations);}catch{/* as in the view */}}
      for(let i=0;i<operations.length;i+=max){
        const chunk=operations.slice(i,i+max),operationId=uuid();ids.push(operationId);
        outbox.push({operationId,clientId:this.options.clientId,operations:chunk,status:'queued',everSent:false,authoredRevision:record.confirmed.revision,
          priorOperationIds:outbox.filter(entry=>LIVE.has(entry.status)).map(entry=>entry.operationId),before:contextOf(seen,chunk),createdAt:new Date().toISOString(),attempts:0});
        try{seen=applyCanonicalOperations(seen,chunk);}catch{/* invalid chunks are held by project() */}
      }
      return {...record,outbox,updatedAt:new Date().toISOString()};
    }));
    this.pump();return ids;
  }
  /** Handle a server result from HTTP or WS; each revision is applied once. */
  receive(result:OperationResult):Promise<void>{
    return this.serial(async()=>{
      const record=this.record;if(!record||result.characterId!==this.options.characterId)return;
      if(result.revision>record.confirmed.revision+1){this.buffered.set(result.revision,result);void this.catchUp();return;}
      await this.absorb([result]);
    }).catch(error=>{
      // Not persisted, so confirmed did not advance; later revisions trigger a delta.
      this.lastError=`本机保存服务器结果失败：${String((error as Error)?.message||error)}`;this.emit();
    }).then(()=>{this.pump();});
  }
  private async absorb(results:OperationResult[]){
    const all=[...results,...this.buffered.values()];
    try{await this.commit(record=>absorbResults(record,all));}
    catch(error){if(error instanceof Error&&'code' in error){this.lastError='服务器操作无法在本地快照重放，正在重新读取';void this.resync();return;}throw error;}
    for(const revision of [...this.buffered.keys()])if(revision<=this.record!.confirmed.revision)this.buffered.delete(revision);
  }
  /** Single-flight HTTP delta from the confirmed revision; false when it could not be read. */
  catchUp():Promise<boolean>{
    return this.catchUpTask??=(async()=>{
      this.catching=true;this.emit();
      try{
        for(let guard=0;guard<50;guard++){
          const after=this.record!.confirmed.revision,delta=await this.options.api.delta(this.options.characterId,after);
          await this.serial(()=>this.absorb(delta.operations));
          if(this.record!.confirmed.revision>=delta.currentRevision&&![...this.buffered.keys()].some(r=>r>this.record!.confirmed.revision))break;
        }
        return true;
      }catch(error){
        if(error instanceof ServerError&&error.code==='resync_required'){await this.resync();return !this.resyncFailed;}
        await this.transportFailure(error,false);return false;
      }
      finally{this.catching=false;this.catchUpTask=undefined;this.emit();this.pump();}
    })();
  }
  /** Replace confirmed from a fresh snapshot while keeping every intent. */
  resync():Promise<void>{
    return this.resyncTask??=(async()=>{
      this.resyncing=true;this.subscribed=false;this.emit();
      try{
        const snapshot=await this.options.api.get(this.options.characterId);
        await this.serial(()=>this.commit(record=>({...record,confirmed:snapshot,applied:[],outbox:rebaseNeverSentOutbox(record.outbox,snapshot),updatedAt:new Date().toISOString()})));
        this.buffered.clear();
        this.resyncFailed=false;
      }catch(error){this.resyncFailed=true;await this.transportFailure(error,false);}
      finally{this.resyncing=false;this.resyncTask=undefined;this.emit();this.options.resubscribe?.();this.pump();}
    })();
  }
  private async transportFailure(error:unknown,canResync:boolean){
    if(error instanceof ServerError){
      if(error.code==='resync_required'&&canResync){await this.resync();return;}
      if(error.code==='forbidden'||error.code==='not_found'){this.forbidden=true;this.subscribed=false;}
      if(error.code==='unauthorized'){this.unauthorized=true;this.options.unauthorized?.();}
    }
    this.lastError=String((error as Error)?.message||error);this.emit();
  }
  /** WebSocket messages for this character, in arrival order. */
  handleMessage(message:WebSocketMessage){
    switch(message.type){
      case 'character.operations':void this.receive(message);break;
      case 'subscribed':this.subscribed=true;this.emit();
        void this.serial(async()=>{const revision=this.record?.confirmed.revision??0;if(message.revision>revision)void this.catchUp();else if(message.revision<revision)void this.resync();});break;
      case 'unsubscribed':this.subscribed=false;this.emit();break;
      case 'resync_required':this.subscribed=false;void this.resync();break;
      case 'error':if(message.code==='forbidden'||message.code==='not_found'){this.forbidden=true;this.subscribed=false;}this.lastError=message.message;this.emit();break;
    }
  }
  disconnected(){this.subscribed=false;this.emit();}
  /** User retry after a permission/auth problem; never changes a frozen body. */
  retryNow(){this.forbidden=false;this.unauthorized=false;clearTimeout(this.retryTimer);this.retryTimer=undefined;this.emit();this.pump();}
  close(){this.closed=true;clearTimeout(this.retryTimer);this.emit();}
  private scheduleRetry(ms:number){clearTimeout(this.retryTimer);this.retryTimer=setTimeout(()=>{this.retryTimer=undefined;this.pump();},ms);}
  /** Send the head of the outbox. Conflicts and rejections halt later intents. */
  pump(){
    if(this.closed||this.sending||this.retryTimer||this.forbidden||this.unauthorized||this.resyncing||!this.record)return;
    if(this.options.canSend&&!this.options.canSend())return;
    const head=this.record.outbox[0];
    if(!head||!LIVE.has(head.status))return;
    this.sending=true;
    void this.sendHead(head.operationId).finally(()=>{this.sending=false;if(!this.retryTimer)queueMicrotask(()=>this.pump());});
  }
  private async sendHead(operationId:string){
    let batch:OperationBatch|undefined;
    try{
      const record=await this.serial(()=>this.commit(current=>{
        const entry=current.outbox[0];
        if(!entry||entry.operationId!==operationId||!LIVE.has(entry.status))return undefined;
        const frozen=entry.batch||{operationId:entry.operationId,clientId:entry.clientId,baseRevision:baseRevisionFor(current,entry),operations:entry.operations};
        return {...current,outbox:[{...entry,batch:frozen,status:'sending',everSent:true,attempts:entry.attempts+1},...current.outbox.slice(1)]};
      }));
      batch=record.outbox[0]?.operationId===operationId?record.outbox[0].batch:undefined;
    }catch(error){this.lastError=`本机保存失败，暂停发送：${String((error as Error)?.message||error)}`;this.emit();this.scheduleRetry(5000);return;}
    if(!batch)return;
    let result:OperationResult;
    try{result=await this.options.api.submit(this.options.characterId,batch);}
    catch(error){await this.serial(()=>this.failed(operationId,error)).catch(()=>{this.scheduleRetry(5000);});return;}
    this.lastError=undefined;
    await this.receive(result);
  }
  private backoff(attempts:number){const random=this.options.random||Math.random;return Math.min(30000,500*2**Math.min(attempts,10))*(0.5+random()/2);}
  private async failed(operationId:string,error:unknown){
    const entry=this.record?.outbox.find(row=>row.operationId===operationId);if(!entry)return;
    const update=(change:Partial<PendingEntry>)=>this.commit(r=>({...r,outbox:r.outbox.map(row=>row.operationId===operationId?{...row,...change}:row)}));
    this.lastError=String((error as Error)?.message||error);
    if(!(error instanceof ServerError)||error.uncertain){await update({status:'unknown'});this.scheduleRetry(this.backoff(entry.attempts));return;}
    const apiError:ApiError=error.error;
    switch(error.code){
      case 'rate_limited':await update({status:'unknown'});this.scheduleRetry(((error.retryAfter??1)*1000)*(1+(this.options.random||Math.random)()/2));return;
      case 'unauthorized':this.unauthorized=true;await update({status:'unknown'});this.options.unauthorized?.();return;
      case 'forbidden':case 'not_found':this.forbidden=true;this.subscribed=false;await update({status:'unknown',error:apiError});return;
      case 'resync_required':
        if(!entry.resyncRetried){await update({status:'unknown',resyncRetried:true});void this.resync();return;}
        await update({status:'conflict',error:apiError});return;
      case 'revision_conflict':await update({status:'conflict',error:apiError,conflicts:apiError.conflicts||[]});return;
      default:await update({status:'rejected',error:apiError});
    }
  }
  /**
   * Explicit user decision on a conflicted/rejected intent. `server` discards
   * it; `mine` re-reads the newest revision and submits the same intent (inc
   * stays inc) under a new operationId. Nothing is decided silently.
   */
  async resolve(operationId:string,decision:'server'|'mine'){
    if(decision==='mine'&&!await this.catchUp())throw new Error('无法读取服务器最新版本，暂不提交；请联网后重试');
    const uuid=this.options.uuid||(()=>crypto.randomUUID());
    await this.serial(()=>this.commit(record=>{
      const at=record.outbox.findIndex(entry=>entry.operationId===operationId);if(at<0)return undefined;
      const outbox=[...record.outbox],old=outbox[at];
      if(decision==='server'||LIVE.has(old.status)&&old.everSent){if(decision==='server')outbox.splice(at,1);else return undefined;}
      else{
        // Placed after the earlier live intents it was decided on top of, so they never count as its own conflict.
        const prior=outbox.slice(0,at).filter(entry=>LIVE.has(entry.status));let seen=record.confirmed.document;
        for(const entry of prior)if(shown(entry)){try{seen=applyCanonicalOperations(seen,entry.operations);}catch{/* as in the view */}}
        const operationId=uuid();
        outbox[at]={operationId,clientId:this.options.clientId,operations:old.operations,status:'queued',everSent:false,authoredRevision:record.confirmed.revision,priorOperationIds:prior.map(entry=>entry.operationId),before:contextOf(seen,old.operations),createdAt:new Date().toISOString(),attempts:0};
        // Later unsent intents were made on top of this one; they now build on its replacement.
        for(let i=at+1;i<outbox.length;i++)if(!outbox[i].everSent&&outbox[i].priorOperationIds.includes(old.operationId))outbox[i]={...outbox[i],priorOperationIds:outbox[i].priorOperationIds.map(id=>id===old.operationId?operationId:id)};
      }
      return {...record,outbox,updatedAt:new Date().toISOString()};
    }));
    this.pump();
  }
}
