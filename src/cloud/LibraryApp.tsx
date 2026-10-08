import {useEffect,useState} from 'react';
import type {Character} from '../core/model';
import {exportCharacter} from '../core/export';
import {download,loadWorkspace,loadCloudBindings,stageCloudDraft,saveCloudBinding,type CloudBinding} from '../platform/storage';
import {cloudCards,cloudMutation,cloudSession,cloudViewUrl,readCloudCard,type CardSummary,type CloudCard,type CloudSession} from './api';
import './library.css';
import {forgetDeletedCloudCard} from './bindings';

const warning='在接入 QQ 登录之前，所有的卡并不会安全保存，所有人都可以在云端看到所有卡。';
const options=[['all','全部云端卡'],['local','本机角色'],['mine','我的上传'],['id','按 ID 查看'],['migration','迁移与备份']] as const;
type View=typeof options[number][0];
export default function LibraryApp(){
  const [session,setSession]=useState<CloudSession>(),[cards,setCards]=useState<CardSummary[]>([]),[mine,setMine]=useState<CardSummary[]>([]),[local,setLocal]=useState<Character[]>([]),[bindings,setBindings]=useState<Record<string,CloudBinding>>({}),[id,setId]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[upload,setUpload]=useState<Character>(),[confirmed,setConfirmed]=useState(false),[manage,setManage]=useState<CloudCard>(),[qq,setQQ]=useState(''),[view,setView]=useState<View>('all'),[total,setTotal]=useState(0),[hasMore,setHasMore]=useState(false),[nextOffset,setNextOffset]=useState(0);
  const account=session?.authenticated?session.account?.id:session?.uploadOwner?.id;
  async function refresh(){
    const results=await Promise.allSettled([loadWorkspace(),loadCloudBindings(),cloudSession()]);
    if(results[0].status==='fulfilled')setLocal(results[0].value?.characters||[]);else setMessage('本机角色读取失败，原记录保留。请回到在线车卡导出备份。');
    if(results[1].status==='fulfilled')setBindings(results[1].value);
    if(results[2].status==='fulfilled'){
      const next=results[2].value;setSession(next);
      if(next.authenticated||next.temporaryUpload){try{const rows=await cloudCards();setCards(rows.cards);setMine(rows.mine||rows.cards.filter(row=>row.role));setTotal(rows.total??rows.cards.length);setHasMore(!!rows.hasMore);setNextOffset(rows.cards.length);setSession({...next,slots:rows.slots});}catch(error){setMessage(error instanceof Error?error.message:String(error));setCards([]);setMine([]);}}
      else {setCards([]);setMine([]);}
    }else {setSession(undefined);setCards([]);setMine([]);setMessage('云端服务暂时无法连接。本机角色和 JSON 导出仍可使用，可稍后刷新重试。');}
  }
  useEffect(()=>{void refresh();const update=()=>{if(document.visibilityState==='visible')void refresh();};document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  useEffect(()=>{setConfirmed(false);},[upload]);
  async function act(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action();}catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}}
  async function submitUpload(){
    if(!upload||!account||!confirmed)return;
    const snapshot=upload,binding=bindings[snapshot.id];
    if(binding&&binding.accountId!==account)throw Error('原上传浏览器或账号已改变，无法覆盖这张云端卡。本机草稿保留，请先导出备份。');
    const saved=await cloudMutation<CloudCard>(account,binding?'cards/'+binding.cloudId:'cards',binding?'PUT':'POST',{character:snapshot,revision:binding?.revision,confirmUpload:true,confirmPublicTemporary:true});
    await saveCloudBinding(snapshot.id,{accountId:account,cloudId:saved.id,revision:saved.revision});setUpload(undefined);setView('mine');await refresh();setMessage('已上传完整角色卡，ID：'+saved.id+'。请保留本机完整 JSON 备份。');
  }
  async function draft(row:CardSummary){
    if(!account)return;const current=await readCloudCard(row.id);
    if(!current.role)throw Error('当前浏览器没有编辑权限，本机草稿保留。');
    const localId=await stageCloudDraft(current.character,{accountId:account,cloudId:current.id,revision:current.revision});location.href='/card/?cloudDraft='+encodeURIComponent(localId);
  }
  function cardList(rows:CardSummary[]){return <ul className="cloud-card-list">{rows.map(row=><li key={row.id}><div className="cloud-card-info"><strong>{row.name||'未命名角色'}</strong><small>{row.edition} · 修订 {row.revision}{row.role==='owner'?' · 当前浏览器上传':row.role==='editor'?' · 获授权编辑':''}</small><code>{row.id}</code></div><div className="cloud-inline"><a className="cloud-button" href={cloudViewUrl(row.id)} target="_blank" rel="noopener noreferrer">查看五页</a>{row.role&&<button disabled={busy} onClick={()=>void act(()=>draft(row))}>编辑本机草稿</button>}{row.role==='owner'&&<button disabled={busy} onClick={()=>void act(async()=>{setManage(await readCloudCard(row.id));setQQ('');})}>{session?.authenticated?'授权与删除':'导出与删除'}</button>}</div></li>)}</ul>;}
  return <main className="cloud-library">
    <header className="cloud-header"><a className="cloud-brand" href="/"><img src="/card/dnd-center-logo.png" alt="DND 角色卡网站标志"/><h1>角色卡库</h1></a><div className="cloud-header-tools"><span>QQ 登录申请中</span><a href="/card/">在线车卡</a><a href="/">首页</a></div></header>
    <div className="cloud-workspace"><aside className="cloud-sidebar"><nav aria-label="卡库选项">{options.map(([key,label])=><button key={key} aria-current={view===key?'page':undefined} onClick={()=>setView(key)}>{label}</button>)}</nav><div className="cloud-sidebar-status"><p>{session?.temporaryUpload?'当前 IP 上传额度':'自有卡槽位'}</p><strong>{session?.slots?session.slots.used+' / '+session.slots.total:'— / 10'}</strong><p>数量限制用于避免服务器被大量角色卡占满。</p><button disabled={busy} onClick={()=>void act(refresh)}>刷新卡库</button><button disabled>QQ 登录（申请中）</button></div></aside>
    <div className="cloud-main">
      <section className="cloud-frame cloud-warning"><h2>临时云端存储警告</h2><div className="cloud-content"><p><strong>{warning}</strong></p><p>请勿上传私人信息，并始终保留本机完整 JSON 备份。同一个 IP 最多上传 10 张；共用网络的人共享额度。临时上传无需登录，只有原上传浏览器可以修改或删除；清除 Cookie 或更换设备可能失去管理权限。</p>{!session?.temporaryUpload&&!session?.authenticated&&<p role="status">正在连接后端；服务未开放时仍可使用本机保存与导入导出。</p>}</div></section>
      {message&&<p className="cloud-message" role="alert">{message}</p>}
      {view==='all'&&<section className="cloud-frame"><h2>全部云端卡 · {total} 张</h2><div className="cloud-content"><p>临时开放阶段，所有人都可以浏览这里的全部卡片。点击“查看五页”打开完整角色卡。</p>{!cards.length?<p>云端尚无角色卡。可在左侧“本机角色”选择要上传的角色。</p>:cardList(cards)}{hasMore&&<button disabled={busy} onClick={()=>void act(async()=>{const rows=await cloudCards(nextOffset);setCards(previous=>[...previous,...rows.cards.filter(row=>!previous.some(old=>old.id===row.id))]);setHasMore(!!rows.hasMore);setNextOffset((rows.offset||0)+rows.cards.length);setTotal(rows.total||0);})}>加载更多角色卡</button>}</div></section>}
      {view==='local'&&<section className="cloud-frame"><h2>本机角色与待保存草稿</h2><div className="cloud-content"><p>以下角色只保存在当前浏览器。选择“上传到云端”后，还需要勾选警告并明确确认；打开卡库不会自动上传。</p>{!local.length&&<p>本机尚无角色。请先打开在线车卡创建，或导入完整 JSON 备份。</p>}<ul className="cloud-card-list">{local.map(character=><li key={character.id}><div className="cloud-card-info"><strong>{character.name}</strong><small>{character.edition} · {bindings[character.id]?'云端卡的本机草稿':'仅本机保存'}</small></div><div className="cloud-inline"><button onClick={()=>download((character.name||'角色')+'-完整备份.json',exportCharacter(character))}>导出完整 JSON</button><button disabled={busy||!account||!!bindings[character.id]&&bindings[character.id].accountId!==account} onClick={()=>setUpload(structuredClone(character))}>{bindings[character.id]?'保存草稿到云端':'上传到云端'}</button></div></li>)}</ul></div></section>}
      {view==='mine'&&<section className="cloud-frame"><h2>我的上传{session?.authenticated?'与获授权卡':''}</h2><div className="cloud-content"><p>这里列出当前浏览器可管理的角色卡。IP 相同不会获得其他浏览器上传卡片的修改或删除权限。</p>{mine.length?cardList(mine):<p>当前浏览器尚未上传角色卡。</p>}</div></section>}
      {view==='id'&&<section className="cloud-frame"><h2>按 ID 查看角色卡</h2><form className="cloud-content cloud-inline" onSubmit={event=>{event.preventDefault();const value=id.trim();if(/^[a-z]{6}$/i.test(value))location.href=cloudViewUrl(value.toUpperCase());else if(/^[0-9a-f-]{36}$/i.test(value))location.href=cloudViewUrl(value.toLowerCase());else setMessage('请输入 6 位大写字母卡片 ID，例如 KQXJTP。');}}><label>云端卡 ID<input value={id} onChange={event=>setId(event.target.value)} placeholder="例如 KQXJTP" required/></label><button>查看完整角色卡</button></form></section>}
      {view==='migration'&&<section className="cloud-frame"><h2>旧站迁移与完整备份</h2><div className="cloud-content"><ol><li>使用原来保存角色的浏览器打开 <a href="https://obr.dnd.center/card/" target="_blank" rel="noopener noreferrer">旧站入口</a>。进入“导入 / 导出”，选择角色或“全部可见角色”，点击“下载 JSON”。</li><li>在 <a href="/card/">新站在线车卡</a>进入“导入 / 导出”，使用“批量导入 JSON 文件”或“导入角色 JSON”，校验并确认后导入。</li><li>核对全部五页、资源余额和人物背景，下载一份新站完整 JSON 备份后再关闭旧站。</li></ol><p>浏览器不会跨域搬运存档。旧站继续提供原角色读取及导出，不强制跳转。Wiki 缓存和界面偏好需在新域名重新建立；JSON 保留完整角色内容、来源快照、选择与运行资源。</p></div></section>}
      <footer><a href="/card/source.zip">本版本完整源码</a> · <a href="https://github.com/FullPeople/DND-card-web">源码仓库</a><span>standalone-1.0.254</span></footer>
    </div></div>
    {upload&&<dialog open className="cloud-dialog" aria-label="确认上传完整角色卡"><h2>确认上传“{upload.name}”</h2><p>将上传全部五页、头像、背景、条目快照与资源记录。</p><p className="cloud-dialog-warning"><strong>{warning}</strong></p><p>{bindings[upload.id]?'保存时检查云端修订；发生冲突不覆盖云端，本机草稿保留。':'这张云端卡占用当前 IP 的一个上传名额。'}请先导出完整 JSON 备份。</p><label className="cloud-confirm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>我已了解卡片公开且不会安全保存，仍要上传。</label><div className="cloud-inline"><button disabled={busy||!confirmed} onClick={()=>void act(submitUpload)}>{busy?'正在保存…':'确认上传完整角色卡'}</button><button disabled={busy} onClick={()=>setUpload(undefined)}>取消</button></div></dialog>}
    {manage&&<dialog open className="cloud-dialog" aria-label="管理云端角色卡"><h2>管理“{manage.character.name}” · {manage.id}</h2><p>{session?.authenticated?'只有卡主可以授予、撤销编辑权限或删除卡片。QQ 号用于指定授权对象，不是登录凭证。':'只有原上传浏览器可以删除。QQ 登录接入前，编辑授权暂不开放。'}</p>{session?.authenticated&&<><form className="cloud-inline" onSubmit={event=>{event.preventDefault();void act(async()=>{setManage(await cloudMutation<CloudCard>(account!,'cards/'+manage.id+'/editors','POST',{qq}));setQQ('');});}}><label>编辑者 QQ 号<input value={qq} onChange={event=>setQQ(event.target.value)} pattern="[1-9][0-9]{4,11}" required/></label><button disabled={busy}>授予编辑权限</button></form><ul>{manage.editors?.map(editor=><li key={editor}>{editor} <button disabled={busy} onClick={()=>void act(async()=>setManage(await cloudMutation<CloudCard>(account!,'cards/'+manage.id+'/editors/'+editor,'DELETE')))}>撤销授权</button></li>)}</ul></>}<button onClick={()=>download(manage.character.name+'-云端备份.json',exportCharacter(manage.character))}>导出完整 JSON</button> <button disabled={busy} onClick={()=>{if(window.confirm('删除这张云端卡？请先导出完整 JSON 备份。本机副本不会被删除。'))void act(async()=>{await cloudMutation(account!,'cards/'+manage.id,'DELETE',{revision:manage.revision});await forgetDeletedCloudCard(manage.id);setManage(undefined);await refresh();setMessage('云端卡已删除，本机副本保留。');});}}>删除云端卡</button> <button disabled={busy} onClick={()=>setManage(undefined)}>关闭</button></dialog>}
  </main>;
}
