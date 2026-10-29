import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Character,Entry} from '../core/model';
import {chargedItemSpellOffer,chargedItemSpellObservedIntent,setChargedItemSpellIntent} from '../core/automation/chargedItemSpells';
import type {Edit} from './CharacterPages';
import {useSpellActionFeedback} from './SpellActionFeedback';
import {useInteractionStatus} from './InteractionFeedback';
import {useRetainedCardActive} from './RetainedCardVisibility';
import './sourceSpellControls.css';

/** An explicit owned-source activation, never pool acquisition or spell learning. */
export function ChargedItemSpellControl({c,ownerId,entries,edit,writable=true}:{c:Character;ownerId:string;entries:Entry[];edit:Edit;writable?:boolean}){
 const feedback=useSpellActionFeedback(c,edit,!writable),active=useRetainedCardActive(),status=useInteractionStatus(),offer=chargedItemSpellOffer(c,ownerId,entries,feedback.authority);
 const [genuine,setGenuine]=useState(false),[action,setAction]=useState<{id:string;scope:string;nonce:number;enabled:boolean;phase:'pending'|'applied'|'rejected'|'unconfirmed';message?:string}>();
 const epoch=useRef(0),mounted=useRef(true),flight=useRef<string|undefined>(undefined),live=useRef({c,ownerId,entries,writable,active});live.current={c,ownerId,entries,writable,active};
 useLayoutEffect(()=>{epoch.current++;setGenuine(false);},[c.id,ownerId,offer.basis,writable,active,feedback.authority.canEdit,feedback.authority.gm]);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 useEffect(()=>{flight.current=undefined;setAction(undefined);},[c.id,ownerId]);
 const visible=action?.scope===c.id?action:undefined,observed=chargedItemSpellObservedIntent(c,ownerId),record=offer.record;
 useLayoutEffect(()=>{if(visible&&['pending','unconfirmed'].includes(visible.phase)&&observed?.nonce===visible.nonce&&observed.enabled===visible.enabled&&(!visible.enabled||offer.active)){flight.current=undefined;setAction({...visible,phase:'applied',message:undefined});}},[observed,offer.active,visible]);
 useEffect(()=>{if(visible?.phase!=='pending')return;const id=visible.id,timer=setTimeout(()=>setAction(old=>old?.id===id&&old.phase==='pending'?{...old,phase:'unconfirmed',message:'尚未收到卡面确认，请核对保存与同步状态。'}:old),4500);return()=>clearTimeout(timer);},[visible?.id,visible?.phase]);
 const restricted=!writable||!active||!feedback.authority.canEdit,busy=visible?.phase==='pending'||visible?.phase==='unconfirmed';
 function cancel(){epoch.current++;flight.current=undefined;setGenuine(false);setAction(undefined);}
 function submit(enabled:boolean){
  if(restricted||busy||flight.current||enabled&&(!genuine||!offer.canConfirm)||!enabled&&!offer.canWithdraw)return;
  const sequence=c.automation?.chargedItemSpells?.sequence??0;if(!Number.isSafeInteger(sequence)||sequence<0||sequence>=Number.MAX_SAFE_INTEGER)return;
  const id=crypto.randomUUID(),scope=c.id,token=epoch.current,basis=offer.basis,nonce=sequence+1;flight.current=id;setGenuine(false);setAction({id,scope,nonce,enabled,phase:'pending'});let used=false;
  try{edit(draft=>{
   if(used)return;used=true;const access=feedback.liveAuthority(),current=live.current,next=chargedItemSpellOffer(draft,ownerId,current.entries,access);
   if(!mounted.current||token!==epoch.current||current.c.id!==scope||draft.id!==scope||current.ownerId!==ownerId||!current.writable||!current.active||!access.canEdit||next.basis!==basis||enabled&&!next.canConfirm||!enabled&&!next.canWithdraw){if(mounted.current){flight.current=undefined;setAction({id,scope,nonce,enabled,phase:'rejected',message:'实物、来源、充能、核对草稿或当前权限已变化，未执行。'});}return;}
   setChargedItemSpellIntent(draft,ownerId,enabled?{confirmedGenuineOwnedItem:true}:null,current.entries,access);
  });}catch(error){flight.current=undefined;setAction({id,scope,nonce,enabled,phase:'rejected',message:error instanceof Error?error.message:String(error)});}
 }
 return <fieldset className="source-spell-choice" data-charged-item-spell-owner={ownerId} disabled={restricted}>
  <legend>物品充能施法来源 · {offer.label}</legend>
  <p>{offer.active?'当前实物施法来源已确认；每次施法仍须重新核对并支付其充能。':record?.enabled?'原确认已保留，但当前实物、来源或充能记录不可用；不能施法。':record?'此实物的充能施法来源已撤回；再次使用须明确重新核对。':'尚未确认本实物的充能施法来源；打开、启用来源书或穿戴不会自动授予。'}</p>
  {offer.reason&&<p role="note">{offer.reason}</p>}
  <p>须先通过原有物品充能入口核对真实实例及当前已知余额；此确认不创建、恢复或重置充能。需要当前装备{offer.requiresAttunement?'与同调':''}标记；实际持用／穿戴、同调程序和资格仍须人工核对。</p>
  <ul>{offer.grants.map(grant=><li key={grant.key}>{grant.targetName} · {grant.castLevel} 环 · 消耗 {grant.cost} 充能 · {grant.targetScope==='self'?'仅限自身':'目标按来源法术条目核对'} · 来源施法时间：{grant.sourceActionTiming==='bonus-action'?'附赠动作':grant.sourceActionTiming==='action'?'动作':'按法术原有施法时间'}{grant.statistics.kind==='fixed-dc'?<small>来源固定豁免 DC：{grant.statistics.saveDC}；不使用职业 DC。</small>:<small>本支路无需施法攻击或豁免 DC；不借用职业属性。</small>}{grant.minAfter===1&&<small>最后 1 充能保留；未支持的末次充能后果不执行。</small>}</li>)}</ul>
  <p>法术附属于这一件实物，不是学习法术，不占职业学习或预备格。请在法术页打开其施放详情，一次记录施法并从唯一实物池扣费；不要再另扣一次通用记账。这里不施加法术效果、动作经济、材料、伤害、持续或专注，也不提供法术位替代、升环、恢复或自动退款。</p>
  <p>旧客户端不支持本施法协议；保留未知字段不等于可以安全编辑。不要用旧客户端改动实物归属、来源、法术选择或充能历史；若曾改动，应回到支持的客户端撤回、核对并重新确认，不要降级或重写历史。</p>
  <label><input type="checkbox" aria-label="确认当前真实实物的充能施法来源" checked={genuine} disabled={!offer.canConfirm||busy} onChange={event=>{setGenuine(event.target.checked);epoch.current++;}}/>我已核对当前真实拥有此实物，并确认本物品充能施法来源。</label>
  <div className="spell-action-buttons"><button disabled={restricted||busy||!offer.canConfirm||!genuine} onClick={()=>submit(true)}>确认物品充能施法来源</button><button disabled={!busy&&!genuine&&!offer.canConfirm&&!offer.canWithdraw} onClick={cancel}>取消充能施法来源核对</button>{record?.enabled&&<button disabled={busy||!offer.canWithdraw} onClick={()=>submit(false)}>撤回物品充能施法来源</button>}</div>
  {visible&&<div role="status" aria-live="polite" data-charged-item-intent-phase={visible.phase}>{visible.phase==='applied'?'充能施法来源操作已由当前卡面确认':visible.phase==='rejected'?'充能施法来源操作未执行':'等待充能施法来源卡面确认'}{visible.message&&<p>{visible.message}</p>}{visible.phase==='applied'&&<small data-testid="charged-item-intent-save-state">{status?.scope===c.id?status.saveLabel:'保存与同步结果请查看卡面状态'}</small>}</div>}
 </fieldset>;
}
