import type {Character} from '../../core/model';
import {isUuid,type Account,type CharacterMeta,type CharacterSnapshot} from '../../core/sync/protocol';
import {CharacterApi,ServerError,type ApiOptions} from './characterApi';
import {CharacterSync} from './characterSync';
import {IndexedDbSyncStore,recordKey,type SyncRecord,type SyncStore} from './syncStore';
import {WsClient,type SocketLike} from './wsClient';
/**
 * One signed-in server account. The administrator-issued token is only used to
 * open the HttpOnly cookie session and is never stored. Characters opened here
 * are server-authoritative; local workspace cards are never uploaded implicitly.
 */
export type SessionState='signed-out'|'connecting'|'online'|'offline';
/** The slice of Web Storage used here; tests and non-browser tools pass their own. */
export type KeyValue=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export interface SessionOptions extends ApiOptions {
  store?:SyncStore; createSocket?:(url:string)=>SocketLike; clientId?:string;
  /** Use Web Locks + BroadcastChannel to share one outbox between tabs. */
  coordinateTabs?:boolean;
  /** Defaults to navigator.locks; null forces the single-tab fallback. */
  locks?:Pick<LockManager,'request'>|null;
  /** Durable per-browser flags (default localStorage) and per-tab values (default sessionStorage). */
  prefs?:KeyValue|null; tabStore?:KeyValue|null;
}
export interface ServerCharacterRow { meta:CharacterMeta; name?:string; cached:boolean; pending:number; blocked:number }
/** What a logout could and could not confirm; the local session is signed out either way. */
export interface LogoutResult { serverConfirmed:boolean; accountCleared:boolean; barrier:boolean; warnings:string[] }
const BASE_URL_KEY='dnd-card:server-base-url',SIGNED_OUT_KEY='dnd-card:server-signed-out:',CLIENT_ID_KEY='dnd-card:server-client-id';
const CHANNEL='dnd-card-server-sync';
const webStorage=(kind:'localStorage'|'sessionStorage'):KeyValue|undefined=>{try{return (globalThis as any)[kind]??undefined;}catch{return undefined;}};
export function savedBaseUrl(){try{return localStorage.getItem(BASE_URL_KEY)||'';}catch{return '';}}
export function rememberBaseUrl(url:string){try{if(url)localStorage.setItem(BASE_URL_KEY,url);else localStorage.removeItem(BASE_URL_KEY);}catch{/* preference only */}}
/** One clientId per browser tab: kept across reloads in sessionStorage, fresh in a new tab. */
export function tabClientId(store:KeyValue|null|undefined=webStorage('sessionStorage')):string{
  try{const saved=store?.getItem(CLIENT_ID_KEY);if(saved&&isUuid(saved))return saved;}catch{/* unavailable */}
  const id=crypto.randomUUID();
  try{store?.setItem(CLIENT_ID_KEY,id);}catch{/* this load still uses one stable id */}
  return id;
}
export class ServerSession {
  readonly api:CharacterApi;readonly store:SyncStore;readonly clientId:string;
  account?:Account;state:SessionState='signed-out';
  /** Another tab signed this origin out while this session was signed in. */
  signedOutElsewhere=false;
  private ws?:WsClient;private readonly syncs=new Map<string,CharacterSync>();
  private readonly listeners=new Set<()=>void>();
  private channel?:BroadcastChannel;private readonly senders=new Set<string>();private readonly lockReleases=new Map<string,()=>void>();
  private readonly prefs?:KeyValue;
  /** Signed-out flag as it was when this session signed in; any later value means a logout elsewhere. */
  private barrierAtStart:string|null=null;private storageListener?:(event:StorageEvent)=>void;
  constructor(private readonly options:SessionOptions){
    this.api=new CharacterApi(options);
    this.store=options.store||new IndexedDbSyncStore();
    this.prefs=options.prefs===null?undefined:options.prefs||webStorage('localStorage');
    this.clientId=options.clientId||tabClientId(options.tabStore===null?undefined:options.tabStore||webStorage('sessionStorage'));
  }
  private get signedOutKey(){return SIGNED_OUT_KEY+this.origin;}
  /**
   * The user explicitly signed out of this origin in this browser. Fails
   * closed: an unreadable flag store counts as signed out. Without any flag
   * store (non-browser tools) there is nothing to restore from anyway.
   */
  explicitlySignedOut():boolean{
    if(!this.prefs)return false;
    try{return this.prefs.getItem(this.signedOutKey)!==null;}catch{return true;}
  }
  get origin(){return this.api.origin;}
  listen(listener:()=>void){this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
  private emit(){for(const listener of this.listeners)listener();}
  /** Resume the cookie session; offline falls back to the cached account. */
  async restore():Promise<boolean>{
    // An explicit logout is only undone by an explicit login, never by /me or the cached account.
    if(this.explicitlySignedOut())return false;
    try{this.account=await this.api.me();}
    catch(error){
      if(error instanceof ServerError&&!error.uncertain)return false;
      const cached=await this.store.getAccount(this.origin);if(!cached)return false;
      this.account=cached.account;this.state='offline';this.startSocket();this.emit();return true;
    }
    await this.rememberAccount();this.startSocket();return true;
  }
  async login(token:string){
    this.account=await this.api.login(token.trim());
    try{this.prefs?.removeItem(this.signedOutKey);}catch{/* stays signed out after reload: fails closed */}
    await this.rememberAccount();this.startSocket();
    return this.account;
  }
  private async rememberAccount(){
    const previous=await this.store.getAccount(this.origin).catch(()=>undefined);
    await this.store.putAccount({serverOrigin:this.origin,account:this.account!,baseUrl:this.api.baseUrl,lastCharacterId:previous?.account.id===this.account!.id?previous.lastCharacterId:undefined,updatedAt:new Date().toISOString()}).catch(()=>{});
    this.emit();
  }
  async rememberLastCharacter(characterId:string|undefined){
    const previous=await this.store.getAccount(this.origin).catch(()=>undefined);
    if(previous&&this.account&&previous.account.id===this.account.id)await this.store.putAccount({...previous,lastCharacterId:characterId,updatedAt:new Date().toISOString()}).catch(()=>{});
  }
  async lastCharacter(){const record=await this.store.getAccount(this.origin).catch(()=>undefined);return record&&record.account.id===this.account?.id?record.lastCharacterId:undefined;}
  /** null = no barrier, undefined = the shared barrier store is unreadable. */
  private readBarrier():string|null|undefined{if(!this.prefs)return null;try{return this.prefs.getItem(this.signedOutKey);}catch{return undefined;}}
  /** True (and this session is revoked) once another tab wrote a new barrier, or the barrier can no longer be verified. */
  private barrierRaised(){
    const value=this.readBarrier();
    if(value===undefined){this.revoke();return true;}
    if(value===null||value===this.barrierAtStart)return false;
    this.revoke();return true;
  }
  private startSocket(){
    if(this.ws)return;
    this.state='connecting';this.signedOutElsewhere=false;const barrier=this.readBarrier();this.barrierAtStart=barrier===undefined?null:barrier;
    if(this.options.coordinateTabs&&typeof BroadcastChannel!=='undefined'){
      this.channel=new BroadcastChannel(CHANNEL);
      this.channel.onmessage=event=>{
        const data=event.data;
        if(data?.type==='signed-out'){if(data.origin===this.origin)this.revoke();return;}
        for(const sync of this.syncs.values())if(sync.key===data?.key)void sync.reload();
      };
    }
    // Fallback without BroadcastChannel: the logout barrier itself, written to the shared localStorage.
    if(this.options.coordinateTabs&&this.options.prefs===undefined&&typeof addEventListener==='function'&&!this.storageListener){
      this.storageListener=event=>{if(event.key===this.signedOutKey&&event.newValue!==null)this.revoke();};
      addEventListener('storage',this.storageListener);
    }
    this.ws=new WsClient({url:this.api.wsUrl(),createSocket:this.options.createSocket,onState:state=>{this.state=state==='open'?'online':state==='connecting'?'connecting':'offline';this.emit();}});
    this.ws.start();
  }
  /** Accessible server characters, titled from cached snapshots when available. */
  async list():Promise<ServerCharacterRow[]>{
    const metas=await this.api.listAll(),cached=new Map((await this.store.list(this.origin,this.account!.id)).map(r=>[r.characterId,r]));
    return metas.map(meta=>{const record=cached.get(meta.id);return {meta,name:record?.confirmed.document.name,cached:!!record,pending:record?.outbox.filter(e=>['queued','sending','unknown'].includes(e.status)).length||0,blocked:record?.outbox.filter(e=>e.status==='conflict'||e.status==='rejected').length||0};});
  }
  async cachedRecords():Promise<SyncRecord[]>{return this.account?this.store.list(this.origin,this.account.id):[];}
  sync(characterId:string){return this.syncs.get(characterId);}
  /** Open (cache first) and subscribe from the confirmed revision. */
  async open(characterId:string,initial?:CharacterSnapshot):Promise<CharacterSync>{
    if(!this.account)throw new Error('尚未登录服务器');
    const existing=this.syncs.get(characterId);if(existing)return existing;
    const key=recordKey(this.origin,this.account.id,characterId);
    const sync=new CharacterSync({api:this.api,store:this.store,serverOrigin:this.origin,accountId:this.account.id,characterId,clientId:this.clientId,
      // A tab elected right after another tab's logout released the lock must not send before it hears of it.
      canSend:this.options.coordinateTabs?()=>this.senders.has(key)&&!this.barrierRaised():undefined,
      persisted:()=>this.channel?.postMessage({key}),
      resubscribe:()=>this.ws?.resubscribe(characterId),
      unauthorized:()=>{this.state='offline';this.emit();}});
    this.syncs.set(characterId,sync);
    try{await sync.open(initial);}catch(error){this.syncs.delete(characterId);throw error;}
    this.claimSender(key,sync);
    this.ws?.subscribe(characterId,{lastRevision:()=>sync.record?.confirmed.revision??1,message:message=>sync.handleMessage(message),disconnected:()=>sync.disconnected()});
    return sync;
  }
  private claimSender(key:string,sync:CharacterSync){
    if(!this.options.coordinateTabs)return;
    const locks=this.options.locks===undefined?typeof navigator==='undefined'?undefined:navigator.locks:this.options.locks;
    // canSend just turned true: open()'s pump already returned, so sending must be restarted explicitly.
    if(!locks){this.senders.add(key);void sync.resumeSending();return;}
    const abort=new AbortController();
    void locks.request('dnd-card-sync-send:'+key,{signal:abort.signal},()=>new Promise<void>(release=>{
      this.senders.add(key);this.lockReleases.set(key,()=>{this.senders.delete(key);release();});
      // Another tab may have died mid-request: reload, mark its in-flight intent unknown, resend.
      void sync.resumeSending();
    })).catch(()=>{});
    const previous=this.lockReleases.get(key);
    this.lockReleases.set(key,()=>{abort.abort();previous?.();});
  }
  closeCharacter(characterId:string){
    const sync=this.syncs.get(characterId);if(!sync)return;
    this.ws?.unsubscribe(characterId);sync.close();this.syncs.delete(characterId);
    this.lockReleases.get(sync.key)?.();this.lockReleases.delete(sync.key);
  }
  /** Explicit upload of a local card; creation is not idempotent, so no auto-retry. */
  async upload(document:Character){const snapshot=await this.api.create(document);await this.open(snapshot.id,snapshot);return snapshot;}
  /**
   * Fail-closed logout: the signed-out flag is written first and independently,
   * so neither an uncertain DELETE /session nor a failed account-record removal
   * lets a reload restore this account. Caches stay keyed to the account.
   * Throws only when no local barrier could be persisted at all.
   */
  async logout():Promise<LogoutResult>{
    const warnings:string[]=[];let barrier=false,accountCleared=false,serverConfirmed=false;
    // Publish the durable cross-tab barrier before releasing any sender lock. A tab
    // that acquires the lock afterwards must observe this value before it can send.
    try{if(this.prefs){this.prefs.setItem(this.signedOutKey,new Date().toISOString());barrier=true;}}catch{/* reported below */}
    // Mark and announce signed-out before teardown too; BroadcastChannel closes the
    // notification gap while the durable barrier protects sender takeover.
    this.account=undefined;this.state='signed-out';this.emit();this.announceSignedOut();
    this.stopAll();
    try{await this.store.removeAccount(this.origin);accountCleared=true;}catch{/* reported below */}
    try{await this.api.logout();serverConfirmed=true;}
    catch(error){if(error instanceof ServerError&&error.code==='unauthorized')serverConfirmed=true;else warnings.push('已停止本机自动恢复；服务器会话注销结果无法确认。');}
    finally{this.account=undefined;this.state='signed-out';this.emit();}
    if(!accountCleared)warnings.push('本机账户缓存未能删除；已用退出标记阻止自动恢复。');
    if(!barrier&&!(accountCleared&&serverConfirmed))throw new Error('本机无法记录退出状态，刷新后可能自动恢复登录。请清除本站数据，或重新登录后再退出。');
    return {serverConfirmed,accountCleared,barrier,warnings};
  }
  /**
   * Another tab of this origin signed out: stop every sync, the socket and the
   * sender locks, and forget the account. Caches and outboxes stay; nothing is
   * restored through /me and nothing is broadcast again.
   */
  private revoke(){
    if(!this.account&&this.state==='signed-out')return;
    this.stopAll();this.account=undefined;this.state='signed-out';this.signedOutElsewhere=true;this.emit();
  }
  private announceSignedOut(){
    if(!this.options.coordinateTabs||typeof BroadcastChannel==='undefined')return;
    try{const channel=new BroadcastChannel(CHANNEL);channel.postMessage({type:'signed-out',origin:this.origin});channel.close();}catch{/* the storage barrier still reaches other tabs */}
  }
  private stopAll(){
    for(const id of [...this.syncs.keys()])this.closeCharacter(id);
    this.ws?.close();this.ws=undefined;this.channel?.close();this.channel=undefined;
    if(this.storageListener){removeEventListener('storage',this.storageListener);this.storageListener=undefined;}
  }
  dispose(){this.stopAll();}
}
