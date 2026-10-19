import {cloudDirectory as cloudCards} from './directoryReader';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {Character} from '../core/model';
import {exportCharacter} from '../core/export';
import {download,loadWorkspace,loadCloudBindings,stageCloudDraft,type CloudBinding} from '../platform/storage';
import {cloudMutation,cloudSession,subscribeCloudSessionChanges,cloudViewUrl,readCloudCard,type CardSummary,type CloudCard,type CloudSession} from './api';
import './library.css';
import {QQLogin} from './QQLogin';
import {forgetDeletedCloudCard} from './bindings';
import {CloudSaveProvider,CloudSaveControl} from './CloudSave';
import {subscribeAccountChanges} from './accountChanges';
import {queuedRefresh} from './queuedRefresh';
import {CardStack} from './CardStack';
import {withSiteSources} from '../core/siteSources';
import './galleryPresentation.css';
import {CloseIcon,CloudCheckIcon,CloudUploadIcon,DownloadIcon,EditIcon,GridIcon,HouseIcon,IdCardIcon,InfoIcon,LockClosedIcon,MenuIcon,RefreshIcon,SearchIcon,SheetIcon,SlidersIcon,TransferIcon,TrashIcon,UserIcon,UsersIcon,WarningIcon} from '../ui/icons';

const warning='所有人都可以在云端看到所有卡。';
const warningDetails='请勿上传私人信息，同一个 IP 最多上传 10 张；共用网络的人共享额度。临时上传无需登录，只有原上传浏览器可以修改或删除；清除 Cookie 或更换设备可能失去管理权限。';
const options=[['all','全部云端卡'],['local','本机角色'],['mine','我的上传'],['migration','迁移与备份']] as const;
type View=typeof options[number][0];
const icons:Record<View,ReactNode>={all:<GridIcon size={16}/>,local:<SheetIcon size={16}/>,mine:<UserIcon size={16}/>,migration:<TransferIcon size={16}/>};
/** "战士 5 / 法师 2" from the saved class selections; no catalog is needed. */
export function classLine(character:Pick<Character,'selections'>){return (character.selections||[]).filter(row=>row.entry?.kind==='class').map(row=>`${row.entry.name}${row.level?' '+row.level:''}`).join(' / ');}
/** Friendly recency for list rows; falls back to the date for older saves. */
export function updatedLabel(iso:string,now=Date.now()){const time=Date.parse(iso);if(!Number.isFinite(time))return '';const minutes=Math.round((now-time)/60000);if(minutes<1)return '刚刚更新';if(minutes<60)return minutes+' 分钟前更新';if(minutes<60*24)return Math.round(minutes/60)+' 小时前更新';if(minutes<60*24*7)return Math.round(minutes/1440)+' 天前更新';return new Date(time).toISOString().slice(0,10)+' 更新';}
export default function LibraryApp(){
  const [session,setSession]=useState<CloudSession>(),[cards,setCards]=useState<CardSummary[]>([]),[mine,setMine]=useState<CardSummary[]>([]),[temporary,setTemporary]=useState<CardSummary[]>([]),[local,setLocal]=useState<Character[]>([]),[bindings,setBindings]=useState<Record<string,CloudBinding>>({}),[rights,setRights]=useState<Record<string,string|undefined>>({}),[query,setQuery]=useState(()=>new URLSearchParams(location.search).get('q')||''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[manage,setManage]=useState<CloudCard>(),[qq,setQQ]=useState(''),[view,setView]=useState<View>('all'),[total,setTotal]=useState(0),[hasMore,setHasMore]=useState(false),[nextOffset,setNextOffset]=useState(0);
  const [sidebarOpen,setSidebarOpen]=useState(false),[localLoaded,setLocalLoaded]=useState(false);
  const account=session?.authenticated?session.account?.id:session?.uploadOwner?.id;
  const privateLibrary=session?.authenticated||session?.libraryMode==='account';
  const refreshGeneration=useRef(0);
  const latestAccount=useRef(account);latestAccount.current=account;
  const pollRefresh=useRef<()=>Promise<void>>(()=>Promise.resolve());
  useEffect(()=>{
    let alive=true;const queue=queuedRefresh(async()=>{
      if(!alive||document.visibilityState==='hidden'||!navigator.onLine)return;const epoch=refreshGeneration.current;
      try{const next=await cloudSession();if(!alive||epoch!==refreshGeneration.current)return;
        const actor=next.authenticated?next.account?.id:next.uploadOwner?.id;
        if(actor!==latestAccount.current){await refresh();return;}
        if(!actor)return;
        const rows=await cloudCards(0,actor);if(!alive||epoch!==refreshGeneration.current)return;
        const update=<T,>(before:T,after:T)=>JSON.stringify(before)===JSON.stringify(after)?before:after;
        setSession(before=>update(before,{...next,slots:rows.slots}));setCards(before=>{const incoming=new Map(rows.cards.map(row=>[row.id,row])),ordered=before.flatMap(row=>{const current=incoming.get(row.id);incoming.delete(row.id);return current?[current]:[];});return update(before,[...ordered,...incoming.values()]);});setMine(before=>update(before,rows.mine||rows.cards.filter(row=>row.role)));setTemporary(before=>update(before,rows.temporary||[]));
        setTotal(rows.total??rows.cards.length);setHasMore(!!rows.hasMore);setNextOffset(rows.cards.length);
      }catch(error){throw error;}
    });pollRefresh.current=queue.request;const poll=()=>{void queue.request().catch(()=>{});};
    const timer=setInterval(()=>void poll(),60000);window.addEventListener('online',poll);
    return()=>{alive=false;queue.stop();pollRefresh.current=()=>Promise.resolve();clearInterval(timer);window.removeEventListener('online',poll);};
  },[]);
  useEffect(()=>{if(!session?.authenticated||!account)return;return subscribeAccountChanges(account,()=>pollRefresh.current());},[session?.authenticated,account]);
  const latestView=useRef(view);latestView.current=view;
  useEffect(()=>{if(!sidebarOpen)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setSidebarOpen(false);};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[sidebarOpen]);
  async function refreshLocal(){
    const results=await Promise.allSettled([loadWorkspace(),loadCloudBindings()]);
    if(results[0].status==='fulfilled'){setLocal(results[0].value?.characters||[]);setLocalLoaded(true);}else setMessage('本机角色读取失败，原记录保留。请回到在线车卡导出备份。');
    if(results[1].status==='fulfilled')setBindings(results[1].value);
  }
  async function refresh(){
    if(latestView.current==='local')void refreshLocal();
    const generation=++refreshGeneration.current;setManage(undefined);
    try{
      const next=await cloudSession();if(generation!==refreshGeneration.current)return;
      const actor=next.authenticated?next.account?.id:next.uploadOwner?.id;
      if(actor!==latestAccount.current){setCards([]);setMine([]);setTemporary([]);latestAccount.current=actor;}
      setSession(next);
      if(next.authenticated||next.temporaryUpload){const rows=await cloudCards(0,next.account?.id||next.uploadOwner?.id);if(generation!==refreshGeneration.current)return;setTemporary(rows.temporary||[]);setCards(rows.cards);setMine(rows.mine||rows.cards.filter(row=>row.role));setTotal(rows.total??rows.cards.length);setHasMore(!!rows.hasMore);setNextOffset(rows.cards.length);setSession({...next,slots:rows.slots});}
      else {setCards([]);setMine([]);}
    }catch{if(generation!==refreshGeneration.current)return;setSession(undefined);setCards([]);setMine([]);setTemporary([]);setMessage('云端服务暂时无法连接。本机角色和 JSON 导出仍可使用，可稍后刷新重试。');}
  }
  // Read local characters only when the person opens the local-card view.
  useEffect(()=>{if(view==='local')void refreshLocal();},[view]);
  function missing(id:string){
    setCards(old=>old.filter(row=>row.id!==id));setMine(old=>old.filter(row=>row.id!==id));
    setMessage('一张卡已删除或不存在，已移出画廊并刷新列表。');void refresh();
  }
  useEffect(()=>{const stopSession=subscribeCloudSessionChanges(()=>{setCards([]);setMine([]);setTemporary([]);setSession(undefined);latestAccount.current=undefined;void refresh();});void refresh();let timer:ReturnType<typeof setTimeout>;const update=()=>{if(document.visibilityState==='visible')void refresh();};const changed=(event:Event|MessageEvent)=>{const detail='data' in event?event.data:(event as CustomEvent).detail;if(detail?.pending||detail?.failed)return;clearTimeout(timer);timer=setTimeout(()=>void refresh(),250);};const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('dnd-card-cloud'):undefined;channel?.addEventListener('message',changed);window.addEventListener('cloud-binding-changed',changed);document.addEventListener('visibilitychange',update);return()=>{stopSession();clearTimeout(timer);channel?.close();window.removeEventListener('cloud-binding-changed',changed);document.removeEventListener('visibilitychange',update);};},[]);

  async function act(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action();}catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}}
  useEffect(()=>{
    if(!query.trim()||view!=='all'||!hasMore)return;
    const generation=refreshGeneration.current;
    let active=true;
    const timer=setTimeout(()=>{void(async()=>{let offset=nextOffset,more=true;while(active&&more){const rows=await cloudCards(offset);if(!active||generation!==refreshGeneration.current)return;setCards(previous=>[...previous,...rows.cards.filter(row=>!previous.some(old=>old.id===row.id))]);offset=(rows.offset||0)+rows.cards.length;more=!!rows.hasMore;if(!rows.cards.length)break;setNextOffset(offset);setHasMore(more);setTotal(rows.total||0);}})().catch(()=>{if(active)setMessage('搜索暂时只包含已读取的卡片。请刷新卡库后重试。');});},350);
    return()=>{active=false;clearTimeout(timer);};
  },[query,view]);
  async function draft(row:CardSummary){
    if(!account)return;const generation=refreshGeneration.current,current=await readCloudCard(row.id),now=await cloudSession();
    if(generation!==refreshGeneration.current||(now.account?.id||now.uploadOwner?.id)!==account)throw Error('账号已改变，请刷新卡库后重试。');
    if(!current.role)throw Error('当前浏览器没有编辑权限，本机草稿保留。');
    const localId=await stageCloudDraft(current.character,{accountId:account,cloudId:current.id,revision:current.revision});location.href='/card/?intro=0&cloudDraft='+encodeURIComponent(localId);
  }
  async function manageCard(row:CardSummary){const generation=refreshGeneration.current,current=await readCloudCard(row.id);if(generation!==refreshGeneration.current)return;if(current.role!=='owner')throw Error('只有卡主可以管理权限。');setManage(current);setQQ('');}
  const matches=(name:string,id:string,edition:string)=>`${name} ${id} ${edition}`.toLowerCase().includes(query.trim().toLowerCase());
  const visible=(view==='mine'?mine:cards).filter(row=>matches(row.name,row.id,row.edition));
  const localVisible=local.filter(row=>matches(row.name,bindings[row.id]?.cloudId||'',row.edition));
  const counts:Partial<Record<View,number>>={all:privateLibrary?cards.length:Math.max(total,cards.length),local:localLoaded?local.length:undefined,mine:mine.length};
  const slots=session?.slots,slotRatio=slots&&slots.total>0?Math.min(1,slots.used/slots.total):0;
  const links=<><a href="/card/?intro=0"><EditIcon size={15}/><span>在线车卡</span></a><a href="/"><HouseIcon size={15}/><span>首页</span></a></>;
  return <CloudSaveProvider enabled={view==='local'&&local.length>0} disabled={busy} characters={local} access={setRights} readCharacter={async id=>{const w=await loadWorkspace(),card=w?.characters.find(row=>row.id===id);if(!card)throw Error('本机角色已不存在，未上传。');return withSiteSources(card,w?.siteSources,w?.packs||[]);}}><main className={`cloud-library ${view==='all'||view==='mine'?'has-gallery':''} ${sidebarOpen?'sidebar-open':''}`}>
    <header className="cloud-header"><button type="button" className="cloud-menu-toggle" aria-label="打开卡库侧栏" aria-expanded={sidebarOpen} aria-controls="cloud-sidebar" onClick={()=>setSidebarOpen(value=>!value)}><MenuIcon size={20}/></button><a className="cloud-brand" href="/"><img src="/card/dnd-center-icon.png" alt="DND 角色卡网站标志"/><h1>角色卡库</h1></a>
      <form className="cloud-search" role="search" onSubmit={event=>event.preventDefault()}><SearchIcon size={16} className="cloud-search-icon"/><label htmlFor="cloud-search-input" className="cloud-visually-hidden">搜索角色卡</label><input id="cloud-search-input" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索角色名、卡片 ID 或规则版本" type="search" autoComplete="off"/>{query&&<button type="button" className="cloud-search-clear" aria-label="清除搜索" onClick={()=>setQuery('')}><CloseIcon size={15}/></button>}</form>
      <div className="cloud-header-tools"><QQLogin managed session={session} refresh={refresh}/><nav className="cloud-header-links" aria-label="站点导航">{links}</nav></div></header>
    <div className="cloud-sidebar-shade" onClick={()=>setSidebarOpen(false)}/><div className="cloud-workspace"><aside className="cloud-sidebar" id="cloud-sidebar"><div className="cloud-sidebar-head"><strong>卡库</strong><button type="button" className="cloud-sidebar-close" aria-label="关闭侧栏" onClick={()=>setSidebarOpen(false)}><CloseIcon size={16}/></button></div><nav aria-label="卡库选项">{options.filter(([key])=>!privateLibrary||key!=='mine').map(([key,label])=><button key={key} type="button" aria-current={view===key?'page':undefined} onClick={()=>{setView(key);setSidebarOpen(false);}}>{icons[key]}<span className="cloud-nav-label">{privateLibrary&&key==='all'?'我的卡库':label}</span>{counts[key]!==undefined&&<span className="cloud-nav-count" aria-hidden="true">{counts[key]}</span>}</button>)}</nav><div className="cloud-sidebar-actions"><button type="button" disabled={busy} onClick={()=>void act(refresh)}><RefreshIcon size={15}/><span>刷新卡库</span></button></div>
      <div className="cloud-sidebar-status"><p className="cloud-status-label">{session?.temporaryUpload&&!session.authenticated?'当前 IP 上传额度':'自有卡槽位'}</p><strong className="cloud-status-count">{slots?slots.used+' / '+slots.total:'— / 10'}</strong><div className="cloud-status-meter" role="presentation"><span style={{width:Math.round(slotRatio*100)+'%'}}/></div><p className="cloud-status-hint">数量限制用于避免服务器被大量角色卡占满。</p>
        <section className="cloud-sidebar-warning"><h2>{privateLibrary?<LockClosedIcon size={14}/>:<WarningIcon size={14}/>}<strong>{privateLibrary?'个人卡库':warning}</strong></h2><p>{privateLibrary?(session?.authenticated?'只有你和你授权的账号可以读取、编辑账号卡片。房间解锁只授予该房间对已加载卡片的修改权。':'请先完成 QQ 登录，再读取自己的卡库。'):warningDetails}</p></section></div>
      <nav className="cloud-sidebar-links" aria-label="站点导航">{links}</nav></aside>
    <div className="cloud-main">{temporary.length>0&&session?.authenticated&&<section className="cloud-frame"><header className="cloud-frame-head"><h2><CloudUploadIcon size={16}/>原浏览器上传的临时卡</h2><span className="cloud-frame-count">{temporary.length} 张</span></header><div className="cloud-content"><p>这些卡是这台浏览器在登录前临时上传的。迁移后它们归入当前账号，保留卡片 ID，并计入账号槽位。</p><ul className="cloud-card-list">{temporary.map(row=><li key={row.id} className="cloud-card-row"><div className="cloud-card-info"><strong>{row.name||'未命名角色'}</strong><small>{row.edition} · <code>{row.id}</code></small></div><div className="cloud-card-actions"><button type="button" disabled={busy} onClick={()=>{if(window.confirm('将这张临时卡迁移到当前 QQ 账号？'))void act(async()=>{await cloudMutation(account!,'cards/'+row.id+'/claim','POST',{revision:row.revision,confirmClaim:true});await refresh();});}}><TransferIcon size={15}/><span>迁移到我的卡库</span></button></div></li>)}</ul></div></section>}
      {message&&<p className="cloud-message" role="alert"><WarningIcon size={16}/><span>{message}</span></p>}
      {view==='all'&&<section className="cloud-frame cloud-gallery-frame"><CardStack key={account} title={privateLibrary?'我的卡库':'全部云端卡'} missing={missing} cards={visible} edit={row=>void act(()=>draft(row))} manage={row=>void act(()=>manageCard(row))}/>{hasMore&&<div className="cloud-load-more"><button type="button" disabled={busy} onClick={()=>void act(async()=>{const generation=refreshGeneration.current,rows=await cloudCards(nextOffset);if(generation!==refreshGeneration.current)return;setCards(previous=>[...previous,...rows.cards.filter(row=>!previous.some(old=>old.id===row.id))]);setHasMore(!!rows.hasMore);setNextOffset((rows.offset||0)+rows.cards.length);setTotal(rows.total||0);})}>加载更多角色卡</button><span>已读取 {cards.length} / {total} 张</span></div>}</section>}
      {view==='local'&&<section className="cloud-frame"><header className="cloud-frame-head"><h2>本机角色与待保存草稿</h2><span className="cloud-frame-count">{localVisible.length} 张</span></header><div className="cloud-content"><p className="cloud-frame-lead"><InfoIcon size={15}/><span>每张角色卡分别显示本机保存、云端 ID 或同步状态。首次选择“保存到云端”后，需要阅读警告并明确同意。</span></p>{!local.length&&<div className="cloud-empty"><SheetIcon size={28}/><p><strong>本机还没有角色</strong></p><p>先在在线车卡创建一张，或导入完整 JSON 备份，它就会出现在这里。</p><a className="cloud-button" href="/card/?intro=0"><EditIcon size={15}/><span>打开在线车卡</span></a></div>}{local.length>0&&!localVisible.length&&<div className="cloud-empty"><SearchIcon size={28}/><p><strong>没有匹配的本机角色</strong></p><p>换个关键词，或清除搜索后再看。</p><button type="button" onClick={()=>setQuery('')}>清除搜索</button></div>}<ul className="cloud-card-list">{localVisible.map(character=>{const line=[character.edition,classLine(character),updatedLabel(character.updatedAt)].filter(Boolean).join(' · ');return <li key={character.id} className="cloud-card-row"><div className="cloud-card-info"><strong>{character.name||'未命名角色'}</strong><small>{line}</small><span className="cloud-chips">{bindings[character.id]?<span className="cloud-chip is-cloud"><CloudCheckIcon size={13}/>云端</span>:<span className="cloud-chip"><SheetIcon size={13}/>仅本机</span>}{rights[character.id]&&<span className="cloud-chip is-readonly" title={rights[character.id]}><LockClosedIcon size={13}/>只读</span>}</span></div><div className="cloud-card-actions"><button type="button" title="下载这张卡的完整 JSON 备份" onClick={()=>download((character.name||'角色')+'-完整备份.json',exportCharacter(character))}><DownloadIcon size={15}/><span>导出完整 JSON</span></button><CloudSaveControl id={character.id} book library/></div></li>;})}</ul></div></section>}
      {view==='mine'&&<section className="cloud-frame cloud-gallery-frame"><CardStack key={account} title="我的上传" missing={missing} cards={visible} edit={row=>void act(()=>draft(row))} manage={row=>void act(()=>manageCard(row))}/></section>}
      {view==='migration'&&<section className="cloud-frame"><header className="cloud-frame-head"><h2>旧站迁移与完整备份</h2></header><div className="cloud-content cloud-prose"><ol className="cloud-steps"><li><strong>从旧站导出</strong><span>使用原来保存角色的浏览器打开 <a href="https://obr.dnd.center/card/" target="_blank" rel="noopener noreferrer">旧站入口</a>，进入“导入 / 导出”，选择角色或“全部可见角色”，点击“下载 JSON”。</span></li><li><strong>导入新站</strong><span>在 <a href="/card/?intro=0">新站在线车卡</a>进入“导入 / 导出”，使用“批量导入 JSON 文件”或“导入角色 JSON”，校验并确认后导入。</span></li><li><strong>核对并备份</strong><span>核对全部五页、资源余额和人物背景，下载一份新站完整 JSON 备份后再关闭旧站。</span></li></ol><p className="cloud-frame-lead"><InfoIcon size={15}/><span>浏览器不会跨域搬运存档。旧站继续提供原角色读取及导出，不强制跳转。Wiki 缓存和界面偏好需在新域名重新建立；JSON 保留完整角色内容、来源快照、选择与运行资源。</span></p></div></section>}
      <footer className="cloud-source-footer"><a href="/card/source.zip">本版本完整源码</a> · <a href="https://github.com/FullPeople/DND-card-web" target="_blank" rel="noopener noreferrer">源码仓库 ↗</a></footer>
    </div></div>
    {manage&&<dialog open className="cloud-dialog cloud-modal" aria-label="管理云端角色卡"><header className="cloud-modal-head"><span className="cloud-modal-icon"><SlidersIcon size={18}/></span><div className="cloud-modal-heading"><h2>管理云端卡</h2><p>“{manage.character.name||'未命名角色'}” · <code>{manage.id}</code></p></div><button type="button" className="cloud-modal-close" aria-label="关闭" disabled={busy} onClick={()=>setManage(undefined)}><CloseIcon size={18}/></button></header>
      <div className="cloud-modal-body">
        <section className="cloud-modal-section"><h3><UsersIcon size={16}/>编辑者</h3>{session?.account?.id?<><p className="cloud-modal-help">被授权的账号可以修改这张卡的完整内容；只有你能授权、撤销或删除。让对方登录后在账号弹窗里复制“账号 ID”发给你。</p><form className="cloud-inline cloud-editor-form" onSubmit={event=>{event.preventDefault();void act(async()=>{setManage(await cloudMutation<CloudCard>(account!,'cards/'+manage.id+'/editors','POST',{accountId:qq}));setQQ('');});}}><label>编辑者账号 ID<input value={qq} onChange={event=>setQQ(event.target.value)} pattern="[a-f0-9-]{36}" placeholder="对方的 36 位账号 ID" required/></label><button type="submit" className="cloud-primary" disabled={busy}><UsersIcon size={15}/><span>授予编辑权限</span></button></form>{manage.editors?.length?<ul className="cloud-editor-list">{manage.editors.map(editor=><li key={editor}><IdCardIcon size={16}/><code>{editor}</code><button type="button" disabled={busy} onClick={()=>void act(async()=>setManage(await cloudMutation<CloudCard>(account!,'cards/'+manage.id+'/editors/'+editor,'DELETE')))}>撤销授权</button></li>)}</ul>:<p className="cloud-muted">还没有授权任何账号。</p>}</>:<p className="cloud-modal-help">只有卡主或原上传浏览器可以删除这张卡。按 QQ 账号分配编辑权限需要先登录。</p>}</section>
        <section className="cloud-modal-section"><h3><DownloadIcon size={16}/>备份</h3><p className="cloud-modal-help">下载云端当前版本的完整 JSON，可随时在在线车卡重新导入。</p><button type="button" onClick={()=>download(manage.character.name+'-云端备份.json',exportCharacter(manage.character))}><DownloadIcon size={15}/><span>导出完整 JSON</span></button></section>
        <section className="cloud-modal-section cloud-modal-danger"><h3><TrashIcon size={16}/>删除云端卡</h3><p className="cloud-modal-help">删除后别人无法再读取这张卡，已授权的编辑者和房间关联一并失效；本机副本不受影响。建议先导出备份。</p><button type="button" className="cloud-danger" disabled={busy} onClick={()=>{if(window.confirm('删除这张云端卡？请先导出完整 JSON 备份。本机副本不会被删除。'))void act(async()=>{await cloudMutation(account!,'cards/'+manage.id,'DELETE',{revision:manage.revision});await forgetDeletedCloudCard(manage.id);setManage(undefined);await refresh();setMessage('云端卡已删除，本机副本保留。');});}}><TrashIcon size={15}/><span>删除云端卡</span></button></section>
      </div></dialog>}
  </main></CloudSaveProvider>;
}
