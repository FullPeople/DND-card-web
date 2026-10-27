import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Character} from '../core/model';
import {itemChargeOffers,itemChargeRequest,performItemChargeAction} from '../core/automation/itemChargeDebits';
import type {Edit} from './CharacterPages';
import {useSpellActionFeedback} from './SpellActionFeedback';
import {useInteractionStatus} from './InteractionFeedback';
import {useRetainedCardActive} from './RetainedCardVisibility';
import './sourceSpellControls.css';

/** A source-proved fixed-cost bookkeeping route, not item effect execution. */
export function ItemChargeUseControl({c,ownerId,edit,writable=true}:{c:Character;ownerId:string;edit:Edit;writable?:boolean}){
 const feedback=useSpellActionFeedback(c,edit,!writable),active=useRetainedCardActive(),status=useInteractionStatus();
 const matches=itemChargeOffers(c,feedback.authority).filter(row=>row.ownerId===ownerId),offer=matches.length===1?matches[0]:undefined;
 const [remaining,setRemaining]=useState(''),[genuine,setGenuine]=useState(false),[known,setKnown]=useState(false),[action,setAction]=useState<{id:string;scope:string;phase:'pending'|'applied'|'rejected'|'unconfirmed';message?:string}>();
 const epoch=useRef(0),mounted=useRef(true),flight=useRef<string|undefined>(undefined),live=useRef({c,ownerId,writable,active});live.current={c,ownerId,writable,active};
 const clearDraft=()=>{setRemaining('');setGenuine(false);setKnown(false);};
 useLayoutEffect(()=>{epoch.current++;clearDraft();},[c.id,ownerId,offer?.basis,writable,active,feedback.authority.canEdit]);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 useEffect(()=>{flight.current=undefined;setAction(undefined);},[c.id,ownerId]);
 const last=c.runtime.itemChargeDebits?.last,receipt=c.runtime.itemChargeDebits?.version===1&&offer?.record?.ownerId===ownerId&&last&&last.key===offer.key&&offer.record.events.some(event=>event.id===last.id&&event.sequence===last.sequence)?last:undefined,visible=action?.scope===c.id?action:undefined;
 useLayoutEffect(()=>{if(visible&&['pending','unconfirmed'].includes(visible.phase)&&receipt?.id===visible.id){flight.current=undefined;setAction({...visible,phase:'applied',message:undefined});}},[receipt,visible]);
 useEffect(()=>{if(visible?.phase!=='pending')return;const id=visible.id,timer=setTimeout(()=>setAction(old=>old?.id===id&&old.phase==='pending'?{...old,phase:'unconfirmed',message:'尚未收到卡面确认，请核对保存与同步状态。'}:old),4500);return()=>clearTimeout(timer);},[visible?.id,visible?.phase]);
 const number=/^(?:0|[1-9]\d*)$/.test(remaining)?Number(remaining):undefined,capacity=typeof offer?.capacity==='number'&&Number.isSafeInteger(offer.capacity)&&offer.capacity>=1&&offer.capacity<=10000?offer.capacity:undefined,restricted=!writable||!active||!feedback.authority.canEdit,busy=visible?.phase==='pending'||visible?.phase==='unconfirmed';
 const canAcquire=!!offer?.canAcquire&&!restricted&&!busy&&genuine&&known&&number!==undefined&&Number.isSafeInteger(number)&&capacity!==undefined&&number<=capacity;
 function cancel(){epoch.current++;flight.current=undefined;clearDraft();setAction(undefined);}
 function submit(kind:'acquire'|'debit'|'withdraw'){
  if(flight.current||restricted||busy||!offer||kind==='acquire'&&!canAcquire||kind==='debit'&&!offer.canDebit||kind==='withdraw'&&!offer.canWithdraw)return;
  const token=epoch.current,scope=c.id,expected=offer.basis,id=crypto.randomUUID(),request=itemChargeRequest(c,ownerId,id,kind==='acquire'?{kind,knownRemaining:number!,confirmedGenuineItem:true,confirmedKnownBalance:true}:kind==='debit'?{kind,actionKey:offer.actionKey!}:{kind});
  flight.current=id;setAction({id,scope,phase:'pending'});clearDraft();let used=false;
  try{edit(draft=>{
   if(used)return;used=true;const access=feedback.liveAuthority(),current=live.current,rows=itemChargeOffers(draft,access).filter(row=>row.ownerId===ownerId);
   if(!mounted.current||token!==epoch.current||current.c.id!==scope||draft.id!==scope||!current.writable||!current.active||!access.canEdit||rows.length!==1||rows[0].basis!==expected){if(mounted.current){flight.current=undefined;setAction({id,scope,phase:'rejected',message:'物品、余额、权限或核对草稿已变化，未执行。'});}return;}
   const result=performItemChargeAction(draft,request,access);if(result.status==='rejected'){flight.current=undefined;setAction({id,scope,phase:'rejected',message:result.message});}
  });}catch(error){flight.current=undefined;setAction({id,scope,phase:'rejected',message:error instanceof Error?error.message:String(error)});}
 }
 if(!offer)return <p role="status">物品充能当前无法唯一核对；未获得或重置任何充能。</p>;
 return <fieldset className="source-spell-choice" data-item-charge-use="" data-item-charge-owner={ownerId} disabled={restricted}>
  <legend>物品充能记账 · {offer.ownerName}</legend>
  <p>{offer.withdrawn?'此物理实例已撤回，余额及历史保留。':offer.initialized?`当前已记录剩余 ${offer.remaining??'待核对'} / ${offer.capacity??'待核对'} 充能。`:'尚未记录真实物品与当前已知余额；打开、装备或刷新不会获得满充能。'}</p>
  {offer.reason&&<p role="note">{offer.reason}</p>}
  <p>这里只记录来源已核对的固定费用，不执行物品动作、施法或效果，不恢复或重置。目标、命令、触发与使用条件、动作和施法时间、施法属性、攻击与 DC、伤害、持续时间、专注及失效均需人工处理；确认不能解除尚未适配的来源限制。</p>
  {capacity!==undefined?<label>当前已知剩余<input aria-label="物品充能当前已知剩余" type="number" min="0" max={capacity} value={remaining} disabled={!offer.canAcquire||busy} onChange={event=>{setRemaining(event.target.value);setKnown(false);epoch.current++;}}/></label>:<p>充能容量尚未通过当前来源核对，保持只读。</p>}
  <label><input type="checkbox" aria-label="确认本次物品是真实物理实例" checked={genuine} disabled={!offer.canAcquire||busy} onChange={event=>setGenuine(event.target.checked)}/>确认这是当前真实物理实例，不是刷新或旧记录重复领取。</label>
  <label><input type="checkbox" aria-label="确认物品当前充能已核对" checked={known} disabled={!offer.canAcquire||busy} onChange={event=>setKnown(event.target.checked)}/>确认已核对当前剩余，可明确记录 0；不会默认为满充能。</label>
  {offer.actionKey&&<><p>记录固定费用分支：<code>{offer.actionKey}</code> · 费用 1 充能。{offer.minAfter===1?'必须至少保留 1 充能；末次耗尽分支尚未支持。':'本分支可记录至 0 充能；不会恢复。'}</p>{offer.equipmentRequired&&<small>此记账分支要求已标记装备；实际穿戴／持用及其他条件仍须人工核对。</small>}{offer.fixedUnits&&<p>本分支固定单位：{Object.entries(offer.fixedUnits).map(([key,value])=>`${key}=${value}`).join('，')}；不包含其他环阶、数量或费用分支。</p>}{!!offer.manualBoundaries?.length&&<details><summary>仍需人工核对的条件标识</summary><ul>{offer.manualBoundaries.map(code=><li key={code}><code>{code}</code></li>)}</ul></details>}</>}
  {offer.debitReason&&<p role="note">{offer.debitReason}</p>}
  <div className="spell-action-buttons"><button disabled={!canAcquire} onClick={()=>submit('acquire')}>确认记录物品充能</button>{offer.initialized&&<button disabled={busy||!offer.canDebit} onClick={()=>submit('debit')}>记录固定费用分支 · 扣 1 充能</button>}<button disabled={!offer.canAcquire&&!offer.canWithdraw} onClick={cancel}>取消物品充能核对</button>{offer.initialized&&<button disabled={busy||!offer.canWithdraw} onClick={()=>submit('withdraw')}>撤销此物品充能记账</button>}</div>
  {visible&&<div role="status" aria-live="polite" data-item-charge-phase={visible.phase}>{visible.phase==='applied'?'物品充能操作已由当前卡面确认':visible.phase==='rejected'?'物品充能操作未执行':'等待物品充能卡面确认'}{visible.message&&<p>{visible.message}</p>}{visible.phase==='applied'&&<small data-testid="item-charge-save-state">{status?.scope===c.id?status.saveLabel:'保存与同步结果请查看卡面状态'}</small>}</div>}
 </fieldset>;
}
