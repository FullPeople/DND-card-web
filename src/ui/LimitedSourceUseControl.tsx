import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Character} from '../core/model';
import {limitedSourceUseOffers,limitedSourceUseRequest,performLimitedSourceUseAction} from '../core/automation/limitedSourceUses';
import type {Edit} from './CharacterPages';
import {useSpellActionFeedback} from './SpellActionFeedback';
import {useInteractionStatus} from './InteractionFeedback';
import {useRetainedCardActive} from './RetainedCardVisibility';
import './sourceSpellControls.css';

/** This records a genuinely current source grant and its known remaining
 * balance. Merely displaying, reopening or selecting the source grants nothing. */
export function LimitedSourceUseControl({c,ownerId,poolId,edit,writable=true}:{c:Character;ownerId:string;poolId:string;edit:Edit;writable?:boolean}){
 const feedback=useSpellActionFeedback(c,edit,!writable),active=useRetainedCardActive(),status=useInteractionStatus();
 const matches=limitedSourceUseOffers(c,feedback.authority).filter(row=>row.ownerId===ownerId&&row.poolId===poolId),offer=matches.length===1?matches[0]:undefined;
 const [remaining,setRemaining]=useState(''),[genuine,setGenuine]=useState(false),[known,setKnown]=useState(false),[action,setAction]=useState<{id:string;scope:string;phase:'pending'|'applied'|'rejected'|'unconfirmed';message?:string}>();
 const epoch=useRef(0),mounted=useRef(true),flight=useRef<string|undefined>(undefined),live=useRef({c,ownerId,poolId,basis:offer?.basis,writable,active});live.current={c,ownerId,poolId,basis:offer?.basis,writable,active};
 const basis=offer?.basis;
 const clearDraft=()=>{setRemaining('');setGenuine(false);setKnown(false);};
 useLayoutEffect(()=>{epoch.current++;clearDraft();},[c.id,ownerId,poolId,basis,writable,active,feedback.authority.canEdit]);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 useEffect(()=>{flight.current=undefined;setAction(undefined);},[c.id,ownerId,poolId]);
 const last=c.runtime.limitedSourceUses?.last,receipt=c.runtime.limitedSourceUses?.version===1&&offer?.record?.ownerId===ownerId&&offer.record.poolId===poolId&&last&&last.key===offer.key&&offer.record.events.some(event=>event.id===last.id&&event.sequence===last.sequence)?last:undefined,visible=action?.scope===c.id?action:undefined;
 useLayoutEffect(()=>{if(visible&&['pending','unconfirmed'].includes(visible.phase)&&receipt?.id===visible.id){flight.current=undefined;setAction({...visible,phase:'applied',message:undefined});}},[receipt,visible]);
 useEffect(()=>{if(visible?.phase!=='pending')return;const id=visible.id,timer=setTimeout(()=>setAction(old=>old?.id===id&&old.phase==='pending'?{...old,phase:'unconfirmed',message:'尚未收到卡面确认，请核对保存与同步状态。'}:old),4500);return()=>clearTimeout(timer);},[visible?.id,visible?.phase]);
 const number=/^(?:0|[1-9]\d*)$/.test(remaining)?Number(remaining):undefined,capacity=typeof offer?.capacity==='number'&&Number.isSafeInteger(offer.capacity)&&offer.capacity>=1&&offer.capacity<=100?offer.capacity:undefined,restricted=!writable||!active||!feedback.authority.canEdit,busy=visible?.phase==='pending'||visible?.phase==='unconfirmed';
 const canAcquire=!!offer?.canAcquire&&!restricted&&!busy&&genuine&&known&&number!==undefined&&Number.isSafeInteger(number)&&capacity!==undefined&&number<=capacity;
 function cancel(){epoch.current++;flight.current=undefined;clearDraft();setAction(undefined);}
 function submit(kind:'acquire'|'withdraw'){
  if(flight.current||restricted||busy||!offer||kind==='acquire'&&!canAcquire||kind==='withdraw'&&!offer.canWithdraw)return;
  const token=epoch.current,scope=c.id,expected=offer.basis,id=crypto.randomUUID(),request=limitedSourceUseRequest(c,ownerId,poolId,id,kind==='withdraw'?{kind}:{kind,knownRemaining:number!,confirmedGenuineGrant:true,confirmedKnownBalance:true});
  flight.current=id;setAction({id,scope,phase:'pending'});clearDraft();let used=false;
  try{edit(draft=>{
   if(used)return;used=true;const access=feedback.liveAuthority(),current=live.current,rows=limitedSourceUseOffers(draft,access).filter(row=>row.ownerId===ownerId&&row.poolId===poolId);
   if(!mounted.current||token!==epoch.current||current.c.id!==scope||draft.id!==scope||!current.writable||!current.active||!access.canEdit||rows.length!==1||rows[0].basis!==expected){if(mounted.current){flight.current=undefined;setAction({id,scope,phase:'rejected',message:'来源、余额或核对草稿已变化，未执行。'});}return;}
   const result=performLimitedSourceUseAction(draft,request,access);if(result.status==='rejected'){flight.current=undefined;setAction({id,scope,phase:'rejected',message:result.message});}
  });}catch(error){flight.current=undefined;setAction({id,scope,phase:'rejected',message:error instanceof Error?error.message:String(error)});}
 }
 const owner=c.selections.find(row=>row.id===ownerId);
 if(!offer)return <p role="status">有限来源当前无法唯一核对；未获得或重置任何次数。</p>;
 return <fieldset className="source-spell-choice" data-limited-source-use="" data-limited-owner={ownerId} data-limited-pool={poolId} disabled={restricted}>
  <legend>有限来源次数 · {owner?.entry.name||'保留的来源记录'}</legend>
  <p>{offer.withdrawn?'本次来源授权已撤销，历史消耗保留。':offer.initialized?offer.remaining===0?'次数已耗尽；不会恢复或重新初始化。':`当前已记录剩余 ${offer.remaining??'待核对'} / ${offer.capacity} 次。`:'尚未记录当前真实授予及剩余次数；选择或打开来源不会获得次数。'}</p>
  {offer.reason&&<p role="note">{offer.reason}</p>}
  <p>这里只记录有限次数，不是每日或休息资源，不恢复或重置。动作与施法时间、施法属性、攻击与 DC、材料与目标、伤害和其他效果、持续时间及专注仍需人工处理；不自动计时或判定来源失效。已暂停的来源不能通过确认解除。</p>
  {capacity!==undefined?<label>当前已知剩余<input aria-label="有限来源当前已知剩余" type="number" min="0" max={capacity} value={remaining} disabled={!offer.canAcquire||busy} onChange={event=>{setRemaining(event.target.value);setKnown(false);epoch.current++;}}/></label>:<p>有限次数的容量尚未通过当前来源核对；保持只读，不接受手工确认覆盖。</p>}
  <label><input type="checkbox" aria-label="确认本次有限来源是真实当前授予" checked={genuine} disabled={!offer.canAcquire||busy} onChange={event=>setGenuine(event.target.checked)}/>确认这是本次真实且当前有效的来源授予，不是刷新、重选或恢复旧记录。</label>
  <label><input type="checkbox" aria-label="确认有限来源当前剩余已核对" checked={known} disabled={!offer.canAcquire||busy} onChange={event=>setKnown(event.target.checked)}/>确认已核对当前剩余，可明确记录 0；不会默认为满次数。</label>
  <div className="spell-action-buttons"><button disabled={!canAcquire} onClick={()=>submit('acquire')}>确认记录有限来源</button><button disabled={!offer.canAcquire&&!offer.canWithdraw} onClick={cancel}>取消有限来源核对</button>{offer.initialized&&<button disabled={busy||!offer.canWithdraw} onClick={()=>submit('withdraw')}>撤销有限来源授权</button>}</div>
  {visible&&<div role="status" aria-live="polite" data-limited-phase={visible.phase}>{visible.phase==='applied'?'有限来源操作已由当前卡面确认':visible.phase==='rejected'?'有限来源操作未执行':'等待有限来源卡面确认'}{visible.message&&<p>{visible.message}</p>}{visible.phase==='applied'&&<small data-testid="limited-source-save-state">{status?.scope===c.id?status.saveLabel:'保存与同步结果请查看卡面状态'}</small>}</div>}
 </fieldset>;
}
