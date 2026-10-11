import {useContext,useEffect,useRef,useState} from 'react';
import {cloudCards,cloudSession,type CardSummary} from './api';
import {CloudSaveContext} from './CloudSaveContext';
import {CloudIcon} from '../ui/CloudIcon';

export function QQCardPicker(){
 const context=useContext(CloudSaveContext),account=context?.session?.account?.id;
 const [cards,setCards]=useState<CardSummary[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const generation=useRef(0),current=useRef(account),busyRef=useRef(busy),loading=useRef(false);current.current=account;busyRef.current=busy;
 async function refresh(quiet=false){if(loading.current||quiet&&busyRef.current)return;loading.current=true;const epoch=++generation.current;if(!quiet){setBusy(true);setError('');}try{
  const rows=await cloudCards(),session=await cloudSession();
  if(epoch!==generation.current||account!==current.current)return;
  if(session.account?.id!==account)throw Error('账号已改变，请关闭弹窗后重新打开。');
  setCards((rows.mine||rows.cards).filter(card=>card.role));
 }catch(error){if(epoch===generation.current)setError(error instanceof Error?error.message:String(error));}finally{loading.current=false;if(!quiet&&epoch===generation.current)setBusy(false);}}
 useEffect(()=>{setCards([]);void refresh();const timer=setInterval(()=>void refresh(true),5000);return()=>{generation.current++;clearInterval(timer);};},[account]);
 if(!account||!context?.importCard)return null;
 return <section className="qq-card-picker"><header><h3>我的 QQ 卡库</h3><button disabled={busy} onClick={()=>void refresh()}>刷新卡库</button></header><input type="search" aria-label="搜索我的云端角色卡" placeholder="搜索角色名或卡片 ID" value={query} onChange={event=>setQuery(event.target.value)}/><div className="qq-card-picker-list">{cards.filter(card=>(card.name+' '+card.id).toLowerCase().includes(query.trim().toLowerCase())).map(card=><div key={card.id}><span><CloudIcon/><strong>{card.name||'未命名角色'}</strong><small>{card.edition} · {card.role==='owner'?'我的卡':'已获授权'} · {card.id}</small></span><button disabled={busy||context.disabled} onClick={()=>{const epoch=generation.current;setBusy(true);setError('');setMessage('');void context.importCard!(card.id).then(()=>{if(epoch===generation.current)setMessage('已导入当前场景，可关闭弹窗查看角色卡。');}).catch(error=>{if(epoch===generation.current)setError(error instanceof Error?error.message:String(error));}).finally(()=>{if(epoch===generation.current)setBusy(false);});}}>导入当前场景</button></div>)}</div>{!busy&&!cards.length&&<p>当前账号还没有可导入的云端卡。</p>}{busy&&<p role="status">正在读取…</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</section>;
}
