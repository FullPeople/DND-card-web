import {useEffect,useRef,useState} from 'react';
import type {Character} from '../core/model';
import {exportCharacter} from '../core/export';
import {download,loadWorkspace,loadCloudBindings,stageCloudDraft,type CloudBinding} from '../platform/storage';
import {cloudCards,cloudMutation,cloudSession,cloudViewUrl,readCloudCard,type CardSummary,type CloudCard,type CloudSession} from './api';
import './library.css';
import {forgetDeletedCloudCard} from './bindings';
import {CloudSaveProvider,CloudSaveControl} from './CloudSave';
import {CardStack} from './CardStack';
import {withSiteSources} from '../core/siteSources';

const warning='所有人都可以在云端看到所有卡。';
const warningDetails='请勿上传私人信息，同一个 IP 最多上传 10 张；共用网络的人共享额度。临时上传无需登录，只有原上传浏览器可以修改或删除；清除 Cookie 或更换设备可能失去管理权限。';
const options=[['all','全部云端卡'],['local','本机角色'],['mine','我的上传'],['migration','迁移与备份']] as const;
type View=typeof options[number][0];
export default function LibraryApp(){
  const [session,setSession]=useState<CloudSession>(),[cards,setCards]=useState<CardSummary[]>([]),[mine,setMine]=useState<CardSummary[]>([]),[local,setLocal]=useState<Character[]>([]),[bindings,setBindings]=useState<Record<string,CloudBinding>>({}),[query,setQuery]=useState(()=>new URLSearchParams(location.search).get('q')||''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[manage,setManage]=useState<CloudCard>(),[qq,setQQ]=useState(''),[view,setView]=useState<View>('all'),[total,setTotal]=useState(0),[hasMore,setHasMore]=useState(false),[nextOffset,setNextOffset]=useState(0);
  const account=session?.authenticated?session.account?.id:session?.uploadOwner?.id;
  const latestView=useRef(view);latestView.current=view;
  async function refreshLocal(){
    const results=await Promise.allSettled([loadWorkspace(),loadCloudBindings()]);
    if(results[0].status==='fulfilled')setLocal(results[0].value?.characters||[]);else setMessage('本机角色读取失败，原记录保留。请回到在线车卡导出备份。');
    if(results[1].status==='fulfilled')setBindings(results[1].value);
  }
  async function refresh(){
    if(latestView.current==='local')void refreshLocal();
    try{
      const next=await cloudSession();setSession(next);
      if(next.authenticated||next.temporaryUpload){const rows=await cloudCards();setCards(rows.cards);setMine(rows.mine||rows.cards.filter(row=>row.role));setTotal(rows.total??rows.cards.length);setHasMore(!!rows.hasMore);setNextOffset(rows.cards.length);setSession({...next,slots:rows.slots});}
      else {setCards([]);setMine([]);}
    }catch{setSession(undefined);setMessage('云端服务暂时无法连接。本机角色和 JSON 导出仍可使用，可稍后刷新重试。');}
  }
  useEffect(()=>{if(view==='local')void refreshLocal();},[view]);
  function missing(id:string){
    setCards(old=>old.filter(row=>row.id!==id));setMine(old=>old.filter(row=>row.id!==id));
    setMessage('一张卡已删除或不存在，已移出画廊并刷新列表。');void refresh();
  }
  useEffect(()=>{void refresh();let timer:ReturnType<typeof setTimeout>;const update=()=>{if(document.visibilityState==='visible')void refresh();};const changed=(event:Event|MessageEvent)=>{const detail='data' in event?event.data:(event as CustomEvent).detail;if(detail?.pending||detail?.failed)return;clearTimeout(timer);timer=setTimeout(()=>void refresh(),250);};const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('dnd-card-cloud'):undefined;channel?.addEventListener('message',changed);window.addEventListener('cloud-binding-changed',changed);document.addEventListener('visibilitychange',update);return()=>{clearTimeout(timer);channel?.close();window.removeEventListener('cloud-binding-changed',changed);document.removeEventListener('visibilitychange',update);};},[]);

  async function act(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action();}catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}}
  useEffect(()=>{
    if(!query.trim()||view!=='all'||!hasMore)return;
    let active=true;
    const timer=setTimeout(()=>{void(async()=>{let offset=nextOffset,more=true;while(active&&more){const rows=await cloudCards(offset);if(!active)return;setCards(previous=>[...previous,...rows.cards.filter(row=>!previous.some(old=>old.id===row.id))]);offset=(rows.offset||0)+rows.cards.length;more=!!rows.hasMore;if(!rows.cards.length)break;setNextOffset(offset);setHasMore(more);setTotal(rows.total||0);}})().catch(()=>{if(active)setMessage('搜索暂时只包含已读取的卡片。请刷新卡库后重试。');});},350);
    return()=>{active=false;clearTimeout(timer);};
  },[query,view]);
  async function draft(row:CardSummary){
    if(!account)return;const current=await readCloudCard(row.id);
    if(!current.role)throw Error('当前浏览器没有编辑权限，本机草稿保留。');
    const localId=await stageCloudDraft(current.character,{accountId:account,cloudId:current.id,revision:current.revision});location.href='/card/?cloudDraft='+encodeURIComponent(localId);
  }
  const matches=(name:string,id:string,edition:string)=>`${name} ${id} ${edition}`.toLowerCase().includes(query.trim().toLowerCase());
  const visible=(view==='mine'?mine:cards).filter(row=>matches(row.name,row.id,row.edition));
  const localVisible=local.filter(row=>matches(row.name,bindings[row.id]?.cloudId||'',row.edition));
  return <CloudSaveProvider enabled={view==='local'&&local.length>0} disabled={busy} characters={local} readCharacter={async id=>{const w=await loadWorkspace(),card=w?.characters.find(row=>row.id===id);if(!card)throw Error('本机角色已不存在，未上传。');return withSiteSources(card,w?.siteSources,w?.packs||[]);}}><main className={`cloud-library ${view==='all'||view==='mine'?'has-gallery':''}`}>
    <header className="cloud-header"><a className="cloud-brand" href="/"><img src="/card/dnd-center-icon.png" alt="DND 角色卡网站标志"/><h1>角色卡库</h1></a><div className="cloud-header-tools"><span>QQ 登录申请中</span><a href="/card/">在线车卡</a><a href="/">首页</a></div></header>
    <div className="cloud-workspace"><aside className="cloud-sidebar"><nav aria-label="卡库选项">{options.map(([key,label])=><button key={key} aria-current={view===key?'page':undefined} onClick={()=>setView(key)}>{label}</button>)}</nav><div className="cloud-sidebar-status"><p>{session?.temporaryUpload?'当前 IP 上传额度':'自有卡槽位'}</p><strong>{session?.slots?session.slots.used+' / '+session.slots.total:'— / 10'}</strong><p>数量限制用于避免服务器被大量角色卡占满。</p><button disabled={busy} onClick={()=>void act(refresh)}>刷新卡库</button><button disabled>QQ 登录（申请中）</button><section className="cloud-sidebar-warning"><h2><strong>{warning}</strong></h2><p>{warningDetails}</p></section></div></aside>
    <div className="cloud-main"><div className="cloud-search"><label htmlFor="cloud-search-input">搜索角色卡</label><input id="cloud-search-input" value={query} onChange={event=>setQuery(event.target.value)} placeholder="角色名 / 卡片 ID / 规则版本" type="search"/>{query&&<button onClick={()=>setQuery('')}>清除</button>}</div>
      {message&&<p className="cloud-message" role="alert">{message}</p>}
      {view==='all'&&<section className="cloud-frame cloud-gallery-frame"><h2>全部云端卡 · {total} 张</h2><div className="cloud-content"><CardStack missing={missing} cards={visible} edit={row=>void act(()=>draft(row))} manage={row=>void act(async()=>{setManage(await readCloudCard(row.id));setQQ('');})}/>{hasMore&&<button disabled={busy} onClick={()=>void act(async()=>{const rows=await cloudCards(nextOffset);setCards(previous=>[...previous,...rows.cards.filter(row=>!previous.some(old=>old.id===row.id))]);setHasMore(!!rows.hasMore);setNextOffset((rows.offset||0)+rows.cards.length);setTotal(rows.total||0);})}>加载更多角色卡</button>}</div></section>}
      {view==='local'&&<section className="cloud-frame"><h2>本机角色与待保存草稿</h2><div className="cloud-content"><p>每张角色卡分别显示本机保存、云端 ID 或同步状态。首次选择“保存到云端”后，需要阅读警告并明确同意。</p>{!local.length&&<p>本机尚无角色。请先打开在线车卡创建，或导入完整 JSON 备份。</p>}{local.length>0&&!localVisible.length&&<p>没有找到本机角色，可以清除搜索后重试。</p>}<ul className="cloud-card-list">{localVisible.map(character=><li key={character.id}><div className="cloud-card-info"><strong>{character.name}</strong><small>{character.edition} · {bindings[character.id]?'云端卡的本机草稿':'仅本机保存'}</small></div><div className="cloud-inline"><button onClick={()=>download((character.name||'角色')+'-完整备份.json',exportCharacter(character))}>导出完整 JSON</button><CloudSaveControl id={character.id} book/></div></li>)}</ul></div></section>}
      {view==='mine'&&<section className="cloud-frame cloud-gallery-frame"><h2>我的上传{session?.authenticated?'与获授权卡':''}</h2><div className="cloud-content"><CardStack missing={missing} cards={visible} edit={row=>void act(()=>draft(row))} manage={row=>void act(async()=>{setManage(await readCloudCard(row.id));setQQ('');})}/></div></section>}
      {view==='migration'&&<section className="cloud-frame"><h2>旧站迁移与完整备份</h2><div className="cloud-content"><ol><li>使用原来保存角色的浏览器打开 <a href="https://obr.dnd.center/card/" target="_blank" rel="noopener noreferrer">旧站入口</a>。进入“导入 / 导出”，选择角色或“全部可见角色”，点击“下载 JSON”。</li><li>在 <a href="/card/">新站在线车卡</a>进入“导入 / 导出”，使用“批量导入 JSON 文件”或“导入角色 JSON”，校验并确认后导入。</li><li>核对全部五页、资源余额和人物背景，下载一份新站完整 JSON 备份后再关闭旧站。</li></ol><p>浏览器不会跨域搬运存档。旧站继续提供原角色读取及导出，不强制跳转。Wiki 缓存和界面偏好需在新域名重新建立；JSON 保留完整角色内容、来源快照、选择与运行资源。</p></div></section>}
      <footer className="cloud-source-footer"><a href="/card/source.zip">本版本完整源码</a> · <a href="https://github.com/FullPeople/DND-card-web" target="_blank" rel="noopener noreferrer">源码仓库 ↗</a></footer>
    </div></div>
    {manage&&<dialog open className="cloud-dialog" aria-label="管理云端角色卡"><h2>管理“{manage.character.name}” · {manage.id}</h2><p>{session?.authenticated?'只有卡主可以授予、撤销编辑权限或删除卡片。QQ 号用于指定授权对象，不是登录凭证。':'只有原上传浏览器可以删除。QQ 登录接入前，编辑授权暂不开放。'}</p>{session?.authenticated&&<><form className="cloud-inline" onSubmit={event=>{event.preventDefault();void act(async()=>{setManage(await cloudMutation<CloudCard>(account!,'cards/'+manage.id+'/editors','POST',{qq}));setQQ('');});}}><label>编辑者 QQ 号<input value={qq} onChange={event=>setQQ(event.target.value)} pattern="[1-9][0-9]{4,11}" required/></label><button disabled={busy}>授予编辑权限</button></form><ul>{manage.editors?.map(editor=><li key={editor}>{editor} <button disabled={busy} onClick={()=>void act(async()=>setManage(await cloudMutation<CloudCard>(account!,'cards/'+manage.id+'/editors/'+editor,'DELETE')))}>撤销授权</button></li>)}</ul></>}<button onClick={()=>download(manage.character.name+'-云端备份.json',exportCharacter(manage.character))}>导出完整 JSON</button> <button disabled={busy} onClick={()=>{if(window.confirm('删除这张云端卡？请先导出完整 JSON 备份。本机副本不会被删除。'))void act(async()=>{await cloudMutation(account!,'cards/'+manage.id,'DELETE',{revision:manage.revision});await forgetDeletedCloudCard(manage.id);setManage(undefined);await refresh();setMessage('云端卡已删除，本机副本保留。');});}}>删除云端卡</button> <button disabled={busy} onClick={()=>setManage(undefined)}>关闭</button></dialog>}
  </main></CloudSaveProvider>;
}
