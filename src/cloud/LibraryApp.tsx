import {useEffect,useState} from 'react';
import type {Character} from '../core/model';
import {exportCharacter} from '../core/export';
import {download,loadWorkspace,loadCloudBindings,stageCloudDraft,saveCloudBinding,type CloudBinding} from '../platform/storage';
import {cloudCards,cloudMutation,cloudSession,cloudViewUrl,readCloudCard,type CardSummary,type CloudCard,type CloudSession} from './api';
import './library.css';

export default function LibraryApp(){
  const [session,setSession]=useState<CloudSession>(),[cards,setCards]=useState<CardSummary[]>([]),[local,setLocal]=useState<Character[]>([]),[bindings,setBindings]=useState<Record<string,CloudBinding>>({}),[id,setId]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[upload,setUpload]=useState<Character>(),[manage,setManage]=useState<CloudCard>(),[qq,setQQ]=useState('');
  const account=session?.account?.id;
  async function refresh(){
    const results=await Promise.allSettled([loadWorkspace(),loadCloudBindings(),cloudSession()]);
    if(results[0].status==='fulfilled')setLocal(results[0].value?.characters||[]);else setMessage('本机角色读取失败，原记录保留。请回到在线车卡导出备份。');
    if(results[1].status==='fulfilled')setBindings(results[1].value);
    if(results[2].status==='fulfilled'){const next=results[2].value;setSession(next);if(next.authenticated){try{const rows=await cloudCards();setCards(rows.cards);setSession({...next,slots:rows.slots});}catch(error){setMessage(String(error));setCards([]);}}else setCards([]);}
    else {setSession(undefined);setCards([]);setMessage('云端服务暂时无法连接。本机角色和 JSON 导出仍可使用，可稍后刷新重试。');}
  }
  useEffect(()=>{void refresh();const update=()=>{if(document.visibilityState==='visible')void refresh();};document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  async function act(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action();}catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}}
  async function submitUpload(){
    if(!upload||!account)return;
    const snapshot=upload,binding=bindings[snapshot.id];
    if(binding&&binding.accountId!==account)throw Error('这份草稿属于另一个云端账号，请用原账号登录后核对。');
    const saved=await cloudMutation<CloudCard>(account,binding?'cards/'+binding.cloudId:'cards',binding?'PUT':'POST',{character:snapshot,revision:binding?.revision,confirmUpload:true});
    await saveCloudBinding(snapshot.id,{accountId:account,cloudId:saved.id,revision:saved.revision});setUpload(undefined);await refresh();setMessage('已保存完整云端角色卡。访客可使用独立 ID 查看全部五页。');
  }
  const draft=async(row:CardSummary)=>{
    if(!account)return;const current=await readCloudCard(row.id);
    if(!current.role)throw Error('当前账号没有编辑权限，本机草稿保留。');
    const localId=await stageCloudDraft(current.character,{accountId:account,cloudId:current.id,revision:current.revision});
    location.href='/card/?cloudDraft='+encodeURIComponent(localId);
  };
  return <main className="cloud-library">
    <header className="cloud-header"><a href="/"><img src="/card/dnd-center-logo.png" alt="DND 角色卡网站标志"/></a><div><h1>角色卡库</h1><p>完整角色卡 · 本机草稿 · 按 ID 分享</p></div><a className="cloud-button" href="/card/">在线车卡</a></header>
    <section className="cloud-frame"><h2>云端存储</h2><div className="cloud-content"><p role="status">{session?.authenticated?'已登录云端账号':'QQ 登录申请中，云端登录和保存暂不可用。在线车卡、本机保存及 JSON 导入导出可正常使用。'}</p>{session?.authenticated?<><p>自有卡槽位：{session.slots?.used} / {session.slots?.total}。被授权编辑的卡不占用你的槽位。</p><button disabled={busy} onClick={()=>void act(async()=>{await cloudMutation(account!,'logout','POST');setManage(undefined);setUpload(undefined);await refresh();})}>退出云端账号</button></>:<button disabled>QQ 登录（申请中）</button>} <button disabled={busy} onClick={()=>void act(refresh)}>刷新卡库</button><p>每个账号免费保存最多 10 张完整角色卡。上传后，任何知道卡片 ID 的访客都可以查看完整内容；请先检查人物背景、玩家姓名和其他私人信息。本站不公开全站卡片目录。</p></div></section>
    {message&&<p className="cloud-message" role="alert">{message}</p>}
    <section className="cloud-frame"><h2>按 ID 查看角色卡</h2><form className="cloud-content cloud-inline" onSubmit={event=>{event.preventDefault();if(/^[0-9a-f-]{36}$/i.test(id.trim()))location.href=cloudViewUrl(id.trim().toLowerCase());else setMessage('请输入完整的云端卡 ID。');}}><label>云端卡 ID<input value={id} onChange={event=>setId(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required/></label><button>查看完整角色卡</button></form></section>
    <section className="cloud-frame"><h2>本机角色与待保存草稿</h2><div className="cloud-content"><p>以下角色只保存在当前浏览器。选择“上传到云端”后，还需要明确确认；打开卡库不会自动上传。</p>{!local.length&&<p>本机尚无角色。请先打开在线车卡创建，或导入完整 JSON 备份。</p>}<ul className="cloud-card-list">{local.map(character=><li key={character.id}><div><strong>{character.name}</strong><small>{character.edition} · {bindings[character.id]?'云端卡的本机草稿':'仅本机保存'}</small></div><div className="cloud-inline"><button onClick={()=>download((character.name||'角色')+'-完整备份.json',exportCharacter(character))}>导出完整 JSON</button><button disabled={busy||!session?.authenticated||!!bindings[character.id]&&bindings[character.id].accountId!==account} onClick={()=>setUpload(structuredClone(character))}>{bindings[character.id]?'保存草稿到云端':'上传到云端'}</button></div></li>)}</ul></div></section>
    <section className="cloud-frame"><h2>我的云端卡与获授权卡</h2><div className="cloud-content">{!session?.authenticated?<p>QQ 登录接入后，才能列出自己的卡和获得编辑授权的卡。</p>:!cards.length?<p>当前没有自有卡或获授权卡。</p>:<ul className="cloud-card-list">{cards.map(row=><li key={row.id}><div><strong>{row.name}</strong><small>{row.edition} · {row.role==='owner'?'卡主':'获授权编辑'} · 修订 {row.revision}</small><code>{row.id}</code></div><div className="cloud-inline"><a className="cloud-button" href={cloudViewUrl(row.id)} target="_blank" rel="noopener noreferrer">查看五页</a><button disabled={busy} onClick={()=>void act(()=>draft(row))}>编辑本机草稿</button>{row.role==='owner'&&<button disabled={busy} onClick={()=>void act(async()=>{setManage(await readCloudCard(row.id));setQQ('');})}>授权与删除</button>}</div></li>)}</ul>}</div></section>
    <section className="cloud-frame"><h2>额外永久槽位</h2><div className="cloud-content"><p>额外永久槽位每个 2 元，付款暂不接入。</p><p>这是一项非常不必要的开销。可以尝试多开账号。设置免费卡片数量限制，是为了避免服务器被大量角色卡占满。</p><button disabled>购买槽位（暂未开放）</button></div></section>
    <section className="cloud-frame"><h2>旧站迁移与完整备份</h2><div className="cloud-content"><ol><li>使用原来保存角色的浏览器打开 <a href="https://obr.dnd.center/card/" target="_blank" rel="noopener noreferrer">旧站入口</a>。进入“导入 / 导出”，选择角色或“全部可见角色”，点击“下载 JSON”。</li><li>在 <a href="/card/">新站在线车卡</a>进入“导入 / 导出”，使用“批量导入 JSON 文件”或“导入角色 JSON”，校验并确认后导入。</li><li>核对全部五页、资源余额和人物背景，下载一份新站完整 JSON 备份后再关闭旧站。</li></ol><p>浏览器不会跨域搬运存档。旧站继续提供原角色读取及导出，不强制跳转。Wiki 缓存和界面偏好需在新域名重新建立；JSON 保留完整角色内容、来源快照、选择与运行资源。</p></div></section>
    <footer><a href="/">网站首页</a> · <a href="/card/source.zip">本版本完整源码</a> · <a href="https://github.com/FullPeople/DND-card-web">源码仓库</a><span>standalone-1.0.252</span></footer>
    {upload&&<dialog open className="cloud-dialog" aria-label="确认上传完整角色卡"><h2>确认上传“{upload.name}”</h2><p>将上传全部五页、头像、背景、条目快照与资源记录。任何知道这张卡 ID 的访客都可以查看完整内容。</p><p>{bindings[upload.id]?'保存时检查云端修订；发生冲突不覆盖云端，本机草稿保留。':'这张自有云端卡将占用一个槽位。'}</p><button disabled={busy} onClick={()=>void act(submitUpload)}>{busy?'正在保存…':'确认上传完整角色卡'}</button> <button disabled={busy} onClick={()=>setUpload(undefined)}>取消</button></dialog>}
    {manage&&<dialog open className="cloud-dialog" aria-label="管理云端角色卡"><h2>管理“{manage.character.name}”</h2><p>只有卡主可以授予、撤销编辑权限或删除卡片。QQ 号仅用于指定授权对象，不是登录凭证。编辑者必须通过实际身份验证。</p><form className="cloud-inline" onSubmit={event=>{event.preventDefault();void act(async()=>{setManage(await cloudMutation<CloudCard>(account!,'cards/'+manage.id+'/editors','POST',{qq}));setQQ('');});}}><label>编辑者 QQ 号<input value={qq} onChange={event=>setQQ(event.target.value)} pattern="[1-9][0-9]{4,11}" required/></label><button disabled={busy}>授予编辑权限</button></form><ul>{manage.editors?.map(editor=><li key={editor}>{editor} <button disabled={busy} onClick={()=>void act(async()=>setManage(await cloudMutation<CloudCard>(account!,'cards/'+manage.id+'/editors/'+editor,'DELETE')))}>撤销授权</button></li>)}</ul><button onClick={()=>download(manage.character.name+'-云端备份.json',exportCharacter(manage.character))}>导出完整 JSON</button> <button disabled={busy} onClick={()=>{if(window.confirm('删除这张云端卡及全部编辑授权？请先导出完整 JSON 备份。本机副本不会被删除。'))void act(async()=>{await cloudMutation(account!,'cards/'+manage.id,'DELETE',{revision:manage.revision});setManage(undefined);await refresh();setMessage('云端卡已删除，本机副本保留。');});}}>删除云端卡</button> <button disabled={busy} onClick={()=>setManage(undefined)}>关闭</button></dialog>}
  </main>;
}
