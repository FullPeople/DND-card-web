import {useCallback,useEffect,useRef,useState} from 'react';
import type {Character} from '../core/model';
import {readPath} from '../core/sync/operations';
import type {Conflict,Operation} from '../core/sync/protocol';
import {ServerError} from '../platform/server/characterApi';
import type {CharacterSync} from '../platform/server/characterSync';
import {ServerSession,rememberBaseUrl,savedBaseUrl,type ServerCharacterRow} from '../platform/server/serverSession';
import type {PendingEntry} from '../platform/server/syncStore';
import {MANAGED_PREFIX,isManaged} from '../platform/localWorkspace';
import './serverSync.css';
/**
 * Server-hosted characters live in the workspace only in memory under
 * `server:<uuid>`; the server snapshot is their authority and IndexedDB keeps
 * the cache/outbox. Local cards are never uploaded without the explicit button.
 */
export {MANAGED_PREFIX,isManaged};
export const managedId=(serverId:string)=>MANAGED_PREFIX+serverId;
export const serverIdOf=(id:string)=>id.slice(MANAGED_PREFIX.length);
const DEFAULT_BASE='/api/v1';
export interface ServerSync {
  session?:ServerSession; baseUrl:string; error:string; busy:boolean;
  login(baseUrl:string,token:string):Promise<void>; logout():Promise<void>;
  open(serverId:string):Promise<string>; close(serverId:string):void;
  upload(document:Character):Promise<string>;
  sync(workspaceId:string):CharacterSync|undefined;
  /** The native document (original document.id) for export/backup. */
  native(workspaceId:string):Character|undefined;
}
export function useServerSync(onView:(workspaceId:string,view:Character|undefined)=>void,onRestored?:(workspaceId:string)=>void):ServerSync{
  const [session,setSession]=useState<ServerSession>();
  const [baseUrl,setBaseUrl]=useState(()=>savedBaseUrl()||DEFAULT_BASE);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[,setTick]=useState(0);
  const latest=useRef(onView);latest.current=onView;const restored=useRef(onRestored);restored.current=onRestored;
  const listeners=useRef(new Map<string,()=>void>());
  const attach=useCallback((current:ServerSession,sync:CharacterSync)=>{
    if(listeners.current.has(sync.characterId))return;
    const publish=()=>{setTick(n=>n+1);latest.current(managedId(sync.characterId),sync.view&&{...sync.view,id:managedId(sync.characterId)});};
    listeners.current.set(sync.characterId,sync.listen(publish));publish();
    void current.rememberLastCharacter(sync.characterId);
  },[]);
  const detachAll=useCallback(()=>{for(const [id,stop] of listeners.current){stop();latest.current(managedId(id),undefined);}listeners.current.clear();},[]);
  /** Re-render on session changes; a logout in another tab drops back to signed out at once. */
  const follow=useCallback((current:ServerSession)=>current.listen(()=>{
    setTick(n=>n+1);
    if(current.signedOutElsewhere){detachAll();setSession(s=>s===current?undefined:s);setError('已在其他标签页退出服务器账户。');}
  }),[detachAll]);
  useEffect(()=>{
    const saved=savedBaseUrl();if(!saved)return;
    let alive=true;const current=new ServerSession({baseUrl:saved,coordinateTabs:true});
    void current.restore().then(async ok=>{
      if(!alive){current.dispose();return;}
      if(!ok){current.dispose();return;}
      setSession(current);follow(current);
      const last=await current.lastCharacter();
      if(last&&alive)await current.open(last).then(sync=>{attach(current,sync);restored.current?.(managedId(last));}).catch(e=>setError(`读取上次的服务器角色失败：${describe(e)}`));
    }).catch(e=>{if(alive)setError(describe(e));});
    return ()=>{alive=false;detachAll();current.dispose();};
  },[]);
  return {
    session,baseUrl,error,busy,
    async login(url,token){
      setBusy(true);setError('');
      try{
        const next=new ServerSession({baseUrl:url||DEFAULT_BASE,coordinateTabs:true});
        await next.login(token);rememberBaseUrl(url||DEFAULT_BASE);setBaseUrl(url||DEFAULT_BASE);
        detachAll();session?.dispose();follow(next);setSession(next);
      }catch(e){setError(describe(e));throw e;}finally{setBusy(false);}
    },
    async logout(){
      if(!session)return;setBusy(true);
      // The session is signed out locally whatever the server answers; only report what stayed unconfirmed.
      try{detachAll();const result=await session.logout();setError(result.warnings.join(' '));}catch(e){setError(describe(e));}finally{setSession(undefined);setBusy(false);}
    },
    async open(serverId){
      if(!session)throw new Error('尚未登录服务器');
      const sync=await session.open(serverId);attach(session,sync);return managedId(serverId);
    },
    close(serverId){listeners.current.get(serverId)?.();listeners.current.delete(serverId);session?.closeCharacter(serverId);void session?.rememberLastCharacter(undefined);latest.current(managedId(serverId),undefined);setTick(n=>n+1);},
    async upload(document){
      if(!session)throw new Error('尚未登录服务器');
      const snapshot=await session.upload(document);attach(session,session.sync(snapshot.id)!);return managedId(snapshot.id);
    },
    sync:id=>isManaged(id)?session?.sync(serverIdOf(id)):undefined,
    native:id=>isManaged(id)?session?.sync(serverIdOf(id))?.view:undefined,
  };
}
export function describe(error:unknown){
  if(error instanceof ServerError){
    const hint:Record<string,string>={unauthorized:'令牌无效或会话已过期',forbidden:'没有该角色的权限',not_found:'角色不存在或已不可访问',payload_too_large:'内容过大（例如图片），请缩减后再试',schema_mismatch:'角色格式版本不受支持，原文件已保留',validation_error:'角色数据未通过服务器校验',rate_limited:'请求过于频繁'};
    return `${hint[error.code]||error.message}（${error.code}${error.uncertain?'，结果未知':''}）`;
  }
  return String((error as Error)?.message||error);
}
const PHASE_LABEL:Record<string,string>={loading:'读取中',offline:'离线，修改已保存在本机',online:'已连接','catching-up':'补齐中',resyncing:'重新读取服务器快照',forbidden:'没有编辑/读取权限，已停止发送',unauthorized:'需要重新登录',closed:'已关闭'};
/** Compact toolbar status for the open server character. */
export function SyncStatus({sync,openDetails}:{sync:CharacterSync;openDetails:()=>void}){
  const pending=sync.pending.length,blocked=sync.blocked.length;
  const text=blocked?`需处理 ${blocked}`:pending?`待同步 ${pending}`:sync.phase==='online'?'已同步':PHASE_LABEL[sync.phase];
  return <button className={`server-sync-status${blocked?' blocked':''}`} data-phase={sync.phase} title={`服务器角色 · ${PHASE_LABEL[sync.phase]}${sync.lastError?` · ${sync.lastError}`:''}`} onClick={openDetails}>服务器 · {text}</button>;
}
const FIELD_LABELS:Record<string,string>={'/name':'角色名','/player':'玩家','/runtime/hp':'当前生命值','/runtime/tempHp':'临时生命值','/runtime/inspiration':'激励','/baseHp':'生命值基础上限','/abilities/str':'力量','/abilities/dex':'敏捷','/abilities/con':'体质','/abilities/int':'智力','/abilities/wis':'感知','/abilities/cha':'魅力','/notes':'笔记','/spellSettings/prepared':'预备法术槽','/inventory/order':'背包顺序'};
export function pathLabel(path:string,document?:Character){
  if(FIELD_LABELS[path])return FIELD_LABELS[path];
  const selection=/^\/selections\/entities\/([^/]+)(\/.*)?$/.exec(path);
  if(selection){const id=selection[1].replaceAll('~1','/').replaceAll('~0','~');const row=document?.selections.find(s=>s.id===id);return `条目「${row?.entry.name||id}」${selection[2]?' '+selection[2].slice(1):''}`;}
  const resource=/^\/runtime\/resources\/([^/]+)(\/.*)?$/.exec(path);
  if(resource){const id=resource[1].replaceAll('~1','/').replaceAll('~0','~');return `资源「${document?.runtime.resources[id]?.name||id}」${resource[2]==='/current'?'剩余':resource[2]?' '+resource[2].slice(1):''}`;}
  return path;
}
function brief(value:unknown):string{
  if(value===null)return 'null';
  if(typeof value==='string')return value.startsWith('data:')?'[图片数据]':value.length>80?value.slice(0,80)+'…':value||'（空）';
  if(typeof value!=='object')return String(value);
  const text=JSON.stringify(value);return text.length>80?text.slice(0,80)+'…':text;
}
function clientValue(op:Operation|undefined,value:unknown){
  if(op?.op==='inc')return op.value<0?`扣除 ${-op.value}`:`增加 ${op.value}`;
  if(op?.op==='unset'||op?.op==='entity.delete')return '删除';
  return brief(value);
}
/** Conflicts/rejections are never resolved silently; each needs a user decision. */
export function SyncConflicts({sync,close}:{sync:CharacterSync;close:()=>void}){
  const [busy,setBusy]=useState(''),[error,setError]=useState('');
  const document=sync.view;
  const decide=async(entry:PendingEntry,decision:'server'|'mine')=>{setBusy(entry.operationId);setError('');try{await sync.resolve(entry.operationId,decision);}catch(e){setError(describe(e));}finally{setBusy('');}};
  const rows=(entry:PendingEntry):Conflict[]=>entry.conflicts?.length?entry.conflicts:entry.operations.map(op=>{const path=op.path+('entityId' in op&&op.op!=='order.move'?(op.path==='/runtime/resources'?'/':'/entities/')+op.entityId:'');const now=document?readPath(sync.record!.confirmed.document,path):{exists:false};return {path,serverExists:now.exists,serverValue:now.value,clientValue:'value' in op?op.value:null};});
  return <section className="server-sync-conflicts">
    <p>状态：{PHASE_LABEL[sync.phase]}{sync.lastError&&<> · {sync.lastError}</>}。待同步 {sync.pending.length} 项。</p>
    {(sync.phase==='forbidden'||sync.phase==='unauthorized')&&<div className="dialog-actions"><button onClick={()=>sync.retryNow()}>权限恢复后重试（沿用原请求）</button></div>}
    {!sync.blocked.length&&<p>没有需要处理的冲突。</p>}
    {sync.blocked.map(entry=><article key={entry.operationId}>
      <h3>{entry.hold?.reason==='dependency'?'前面的离线修改需要先处理':entry.status==='conflict'?entry.error?.code==='resync_required'?'无法确认是否已提交，需要核对':'与服务器上的新变化冲突':'服务器拒绝了这项修改'}</h3>
      {entry.hold&&<p className="server-sync-code">{entry.hold.message}</p>}
      {entry.error&&<p className="server-sync-code">{entry.error.code}：{entry.error.message}</p>}
      <table><thead><tr><th>位置</th><th>服务器当前</th><th>我的修改</th></tr></thead><tbody>
        {rows(entry).map((row,i)=>{const op=entry.operations.find(o=>row.path===o.path||row.path.startsWith(o.path+'/'));return <tr key={i}><td title={row.path}>{pathLabel(row.path,document)}</td><td>{row.serverExists?brief(row.serverValue):'（不存在 / 已删除）'}</td><td>{clientValue(op,row.clientValue)}</td></tr>;})}
      </tbody></table>
      <div className="dialog-actions">
        <button disabled={!!busy} onClick={()=>void decide(entry,'server')}>保留服务器</button>
        <button disabled={!!busy} onClick={()=>{void decide(entry,'server').then(close);}}>重新编辑</button>
        <button disabled={!!busy||sync.phase==='forbidden'} onClick={()=>{if(confirm('读取最新版本后，以新的请求提交我的这项修改？'))void decide(entry,'mine');}}>明确提交我的决定</button>
      </div>
    </article>)}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
/** Sign-in, server character list, explicit upload and owner permissions. */
export function ServerPanel({server,current,activeId,activate,writable}:{server:ServerSync;current?:Character;activeId?:string;activate:(workspaceId:string)=>void;writable:boolean}){
  const [url,setUrl]=useState(server.baseUrl),[token,setToken]=useState(''),[rows,setRows]=useState<ServerCharacterRow[]>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [grantUser,setGrantUser]=useState(''),[grantRole,setGrantRole]=useState<'editor'|'viewer'>('editor'),[permissions,setPermissions]=useState<{userId:string;role:string}[]>();
  const session=server.session,activeServer=isManaged(activeId)?serverIdOf(activeId!):undefined;
  const run=async(task:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await task();}catch(e){setError(describe(e));}finally{setBusy(false);}};
  const refresh=()=>run(async()=>{setRows(await session!.list());});
  useEffect(()=>{if(session?.account)void refresh();},[session?.account?.id]);
  const owner=activeServer&&server.sync(activeId!)?.record?.confirmed.ownerId===session?.account?.id;
  useEffect(()=>{setPermissions(undefined);if(owner)void session!.api.permissions(activeServer!).then(r=>setPermissions(r.permissions)).catch(()=>{});},[activeServer,owner]);
  if(!session?.account)return <section className="server-panel">
    <p>连接独立服务器后，角色以服务器快照为准，本机只保存缓存与待发送修改。本机角色不会自动上传。</p>
    <label>服务器 API 地址<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="/api/v1"/></label>
    <label>管理员提供的令牌<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)}/></label>
    <div className="dialog-actions"><button className="primary" disabled={server.busy||!token.trim()} onClick={()=>void server.login(url.trim(),token).then(()=>setToken('')).catch(()=>{})}>登录</button></div>
    {server.error&&<p role="alert">{server.error}</p>}
  </section>;
  return <section className="server-panel">
    <p>已登录：<strong>{session.account.name}</strong>（{session.origin}，{session.state==='online'?'实时连接':session.state==='connecting'?'连接中':'离线'}）<button disabled={server.busy} onClick={()=>void server.logout()}>退出</button></p>
    <div className="dialog-actions"><button disabled={busy} onClick={()=>void refresh()}>刷新列表</button>
      {current&&!isManaged(current.id)&&<button disabled={busy||!writable} onClick={()=>{if(confirm(`将本机角色「${current.name}」上传为新的服务器角色？本机原卡保留。创建不可自动重试，失败时请先刷新列表核对。`))void run(async()=>{activate(await server.upload(current));await refresh();});}}>上传当前本机角色</button>}
    </div>
    <ul className="server-character-list">{rows?.map(row=><li key={row.meta.id} data-server-id={row.meta.id}>
      <span><strong>{row.name||'（未缓存，打开后显示名字）'}</strong><small>rev {row.meta.revision}{row.pending?` · 待同步 ${row.pending}`:''}{row.blocked?` · 需处理 ${row.blocked}`:''}{row.meta.ownerId===session.account!.id?' · 我拥有':''}</small></span>
      {activeServer===row.meta.id?<button onClick={()=>server.close(row.meta.id)}>关闭</button>:<button disabled={busy} onClick={()=>void run(async()=>{activate(await server.open(row.meta.id));})}>打开</button>}
    </li>)}</ul>
    {owner&&<div className="server-permissions"><h3>当前角色权限</h3>
      <ul>{permissions?.map(p=><li key={p.userId}>{p.userId} · {p.role}{p.role!=='owner'&&<button disabled={busy} onClick={()=>void run(async()=>{await session.api.revoke(activeServer!,p.userId);setPermissions((await session.api.permissions(activeServer!)).permissions);})}>撤销</button>}</li>)}</ul>
      <label>用户 ID<input value={grantUser} onChange={e=>setGrantUser(e.target.value)}/></label>
      <select aria-label="权限" value={grantRole} onChange={e=>setGrantRole(e.target.value as 'editor'|'viewer')}><option value="editor">可编辑</option><option value="viewer">只读</option></select>
      <button disabled={busy||!grantUser.trim()} onClick={()=>void run(async()=>{await session.api.grant(activeServer!,grantUser.trim(),grantRole);setPermissions((await session.api.permissions(activeServer!)).permissions);setGrantUser('');})}>授予</button>
    </div>}
    {(error||server.error)&&<p role="alert">{error||server.error}</p>}
  </section>;
}
