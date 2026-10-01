import {openDB,type IDBPDatabase} from 'idb';
import type {Account,ApiError,CharacterSnapshot,Conflict,Operation,OperationBatch} from '../../core/sync/protocol';
/**
 * Versioned server-sync cache, separate from the legacy `dnd-card-*` workspace
 * databases. Records are isolated by server origin + account + server character
 * id. Confirmed snapshot and outbox live in one record, so every receipt and
 * every queued intent is committed in a single transaction.
 */
export const SYNC_SCHEMA=1;
export type PendingStatus='queued'|'sending'|'unknown'|'conflict'|'rejected';
export interface PendingEntry {
  operationId:string; clientId:string; operations:Operation[];
  status:PendingStatus; everSent:boolean;
  /** Frozen request body once first sent; retries must reuse it byte-for-byte. */
  batch?:OperationBatch;
  /** Confirmed revision the user saw, and pending intents already shown then. */
  authoredRevision:number; priorOperationIds:string[];
  /** Values at the edited paths when the intent was made (missing ≠ null). */
  before:Record<string,{exists:boolean;value?:unknown}>;
  createdAt:string; attempts:number; resyncRetried?:boolean;
  /** A real server error for this request. Client-side holds use `hold` instead. */
  error?:ApiError; conflicts?:Conflict[];
  /**
   * Client-only reason a never-sent intent waits for the user (never a server
   * error code): its edited values changed on the server, it cannot be replayed
   * on the new snapshot, or it was made on top of earlier intents that are held.
   */
  hold?:{reason:'stale'|'unreplayable'|'dependency';message:string;blockedBy?:string[]};
  /**
   * A sent body whose outcome was unknown when confirmed was replaced by a
   * fresh snapshot, which may or may not already contain it. It is not
   * projected until its original-ID retry returns a receipt.
   */
  maybeInSnapshot?:boolean;
}
export interface SyncRecord {
  schema:typeof SYNC_SCHEMA; serverOrigin:string; accountId:string; characterId:string;
  confirmed:CharacterSnapshot; outbox:PendingEntry[];
  /** Recent confirmed revision → operationId, used to place queued intents. */
  applied:{revision:number;operationId:string}[];
  updatedAt:string;
}
export interface AccountRecord { serverOrigin:string; account:Account; baseUrl:string; lastCharacterId?:string; updatedAt:string }
export const recordKey=(serverOrigin:string,accountId:string,characterId:string)=>JSON.stringify([serverOrigin,accountId,characterId]);
export interface SyncStore {
  get(key:string):Promise<SyncRecord|undefined>;
  /** Atomic read-modify-write against the latest stored record. `fn` must be synchronous. Returning undefined keeps the record. */
  update(key:string,fn:(current:SyncRecord|undefined)=>SyncRecord|undefined):Promise<SyncRecord|undefined>;
  list(serverOrigin:string,accountId:string):Promise<SyncRecord[]>;
  remove(key:string):Promise<void>;
  getAccount(serverOrigin:string):Promise<AccountRecord|undefined>;
  putAccount(record:AccountRecord):Promise<void>;
  removeAccount(serverOrigin:string):Promise<void>;
}
/** Restore after reload: a request that was in flight has an unknown outcome. */
export function recoverRecord(record:SyncRecord):SyncRecord{
  if(!record.outbox.some(entry=>entry.status==='sending'))return record;
  return {...record,outbox:record.outbox.map(entry=>entry.status==='sending'?{...entry,status:'unknown'}:entry)};
}
function validRecord(value:any):value is SyncRecord{return !!value&&value.schema===SYNC_SCHEMA&&Array.isArray(value.outbox)&&!!value.confirmed&&Array.isArray(value.applied);}
export class IndexedDbSyncStore implements SyncStore {
  private connection?:Promise<IDBPDatabase>;
  constructor(private readonly name='dnd-card-server-sync'){}
  private db(){return this.connection??=openDB(this.name,1,{upgrade(db){db.createObjectStore('characters');db.createObjectStore('accounts');}});}
  async get(key:string){const value=await (await this.db()).get('characters',key);return validRecord(value)?value:undefined;}
  async update(key:string,fn:(current:SyncRecord|undefined)=>SyncRecord|undefined){
    const tx=(await this.db()).transaction('characters','readwrite');
    const stored=await tx.store.get(key),current=validRecord(stored)?stored:undefined,next=fn(current&&structuredClone(current));
    if(next)await tx.store.put(next,key);
    await tx.done;return next||current;
  }
  async list(serverOrigin:string,accountId:string){
    const db=await this.db(),keys=await db.getAllKeys('characters'),rows:SyncRecord[]=[];
    for(const key of keys){try{const [origin,account]=JSON.parse(String(key));if(origin!==serverOrigin||account!==accountId)continue;}catch{continue;}const value=await db.get('characters',key);if(validRecord(value))rows.push(value);}
    return rows;
  }
  async remove(key:string){await (await this.db()).delete('characters',key);}
  async getAccount(serverOrigin:string){return (await this.db()).get('accounts',serverOrigin);}
  async putAccount(record:AccountRecord){await (await this.db()).put('accounts',record,record.serverOrigin);}
  async removeAccount(serverOrigin:string){await (await this.db()).delete('accounts',serverOrigin);}
}
/** Same contract in memory; tests use `failWrites` to model a failing disk. */
export class MemorySyncStore implements SyncStore {
  readonly records=new Map<string,SyncRecord>();readonly accounts=new Map<string,AccountRecord>();
  failWrites=0;
  private chain=Promise.resolve();
  private write<T>(fn:()=>T):Promise<T>{const task=this.chain.then(()=>{if(this.failWrites>0){this.failWrites--;throw new Error('模拟的本机存储写入失败');}return fn();});this.chain=task.then(()=>{},()=>{});return task;}
  async get(key:string){const value=this.records.get(key);return value&&structuredClone(value);}
  update(key:string,fn:(current:SyncRecord|undefined)=>SyncRecord|undefined){
    return this.write(()=>{const current=this.records.get(key),next=fn(current&&structuredClone(current));if(next)this.records.set(key,structuredClone(next));return structuredClone(next||current);});
  }
  async list(serverOrigin:string,accountId:string){return [...this.records.values()].filter(r=>r.serverOrigin===serverOrigin&&r.accountId===accountId).map(r=>structuredClone(r));}
  async remove(key:string){this.records.delete(key);}
  async getAccount(serverOrigin:string){return this.accounts.get(serverOrigin);}
  async putAccount(record:AccountRecord){await this.write(()=>{this.accounts.set(record.serverOrigin,structuredClone(record));});}
  async removeAccount(serverOrigin:string){this.accounts.delete(serverOrigin);}
}
