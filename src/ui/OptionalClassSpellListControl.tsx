import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Character,Entry} from '../core/model';
import {optionalClassListOffer,optionalClassListObservedIntent,setOptionalClassListIntent} from '../core/automation/optionalClassSpellLists';
import type {Edit} from './CharacterPages';
import {useSpellActionFeedback} from './SpellActionFeedback';
import {useInteractionStatus} from './InteractionFeedback';
import {useRetainedCardActive} from './RetainedCardVisibility';
import './sourceSpellControls.css';

/** An editor's explicit attestation for one owned class, not a spell grant. */
export function OptionalClassSpellListControl({c,ownerId,entries,edit,writable=true,onChooseOwner}:{c:Character;ownerId:string;entries:Entry[];edit:Edit;writable?:boolean;onChooseOwner?:()=>void}){
 const feedback=useSpellActionFeedback(c,edit,!writable),active=useRetainedCardActive(),status=useInteractionStatus(),offer=optionalClassListOffer(c,ownerId,entries,feedback.authority);
 const [dm,setDm]=useState(false),[player,setPlayer]=useState(false),[action,setAction]=useState<{id:string;scope:string;nonce:number;enabled:boolean;phase:'pending'|'applied'|'rejected'|'unconfirmed';message?:string}>();
 const epoch=useRef(0),mounted=useRef(true),flight=useRef<string|undefined>(undefined),live=useRef({c,ownerId,entries,writable,active});live.current={c,ownerId,entries,writable,active};
 useLayoutEffect(()=>{epoch.current++;setDm(false);setPlayer(false);},[c.id,ownerId,offer.basis,writable,active,feedback.authority.canEdit,feedback.authority.gm]);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 useEffect(()=>{flight.current=undefined;setAction(undefined);},[c.id,ownerId]);
 const visible=action?.scope===c.id?action:undefined,record=offer.record,observed=optionalClassListObservedIntent(c,ownerId);
 useLayoutEffect(()=>{if(visible&&['pending','unconfirmed'].includes(visible.phase)&&observed?.nonce===visible.nonce&&observed.enabled===visible.enabled&&(!visible.enabled||offer.active)){flight.current=undefined;setAction({...visible,phase:'applied',message:undefined});}},[observed,offer.active,visible]);
 useEffect(()=>{if(visible?.phase!=='pending')return;const id=visible.id,timer=setTimeout(()=>setAction(old=>old?.id===id&&old.phase==='pending'?{...old,phase:'unconfirmed',message:'尚未收到卡面确认，请核对保存与同步状态。'}:old),4500);return()=>clearTimeout(timer);},[visible?.id,visible?.phase]);
 const restricted=!writable||!active||!feedback.authority.canEdit,busy=visible?.phase==='pending'||visible?.phase==='unconfirmed';
 function cancel(){epoch.current++;flight.current=undefined;setDm(false);setPlayer(false);setAction(undefined);}
 function submit(enabled:boolean){
  if(restricted||busy||flight.current||enabled&&(!dm||!player||!offer.canConfirm)||!enabled&&!offer.canWithdraw)return;
  const sequence=c.automation?.optionalClassSpellLists?.sequence??0;if(!Number.isSafeInteger(sequence)||sequence<0||sequence>=Number.MAX_SAFE_INTEGER)return;
  const id=crypto.randomUUID(),scope=c.id,token=epoch.current,basis=offer.basis,nonce=sequence+1;flight.current=id;setDm(false);setPlayer(false);setAction({id,scope,nonce,enabled,phase:'pending'});let used=false;
  try{edit(draft=>{
   if(used)return;used=true;const access=feedback.liveAuthority(),current=live.current,next=optionalClassListOffer(draft,ownerId,current.entries,access);
   if(!mounted.current||token!==epoch.current||current.c.id!==scope||draft.id!==scope||current.ownerId!==ownerId||!current.writable||!current.active||!access.canEdit||next.basis!==basis||(draft.automation?.optionalClassSpellLists?.sequence??0)!==sequence||enabled&&!next.canConfirm||!enabled&&!next.canWithdraw){if(mounted.current){flight.current=undefined;setAction({id,scope,nonce,enabled,phase:'rejected',message:'职业、来源、核对草稿或当前权限已变化，未执行。'});}return;}
   setOptionalClassListIntent(draft,ownerId,enabled?{confirmedDmDiscussedInclusion:true,confirmedPlayerOptIn:true}:null,current.entries,access);
  });}catch(error){flight.current=undefined;setAction({id,scope,nonce,enabled,phase:'rejected',message:error instanceof Error?error.message:String(error)});}
 }
 return <fieldset className="source-spell-choice" data-optional-class-list="" data-optional-class-owner={ownerId} disabled={restricted}>
  <legend>可选职业扩展法表 · {offer.label}</legend>
  <p>{offer.active?'此职业的扩展法表采用记录当前可核对；选择法术仍须沿用本职业的学习或预备流程。':record?.enabled?'原采用记录已保留，但当前职业或来源不可用；不提供扩展法表权限。':record?'此职业已撤回采用；再次采用需要重新明确核对。':'尚未为此职业采用扩展法表；仅开启来源书不会视为同意。'}</p>
  {offer.reason&&<p role="note">{offer.reason}</p>}
  {offer.eligible&&<p>来源核对的扩展法表关联：{offer.targetCount} 项；这不是已学或已预备数量。</p>}
  <p>以下是当前编辑者对“已与 DM 讨论纳入”和“玩家选择采用”的声明，不是两人身份认证或自动取得主持人批准。这里只记录所选职业的采用意图，不自动学习、预备或赠送法术，不改变名额、法术位、手工设置或已消耗资源；施法仍按现有流程付费。原有基础法表不依赖此确认。</p>
  <p>未知版本原样保留、暂停且不可编辑；保留未知字段不等于旧客户端可安全编辑。若在旧版改过所属职业、来源、法术选择或可选法表，请先撤回，重新核对后再确认；无法检测旧版是否清空后重选。高环邪术师法术与秘法奥秘等独立机制不会因采用而开放，仍需按原规则核对。</p>
  <label><input type="checkbox" aria-label="确认已与DM讨论纳入此职业扩展法表" checked={dm} disabled={!offer.canConfirm||busy} onChange={event=>{setDm(event.target.checked);epoch.current++;}}/>我确认已与 DM 讨论纳入此职业扩展法表。</label>
  <label><input type="checkbox" aria-label="确认玩家选择为此职业采用扩展法表" checked={player} disabled={!offer.canConfirm||busy} onChange={event=>{setPlayer(event.target.checked);epoch.current++;}}/>我确认玩家选择为此职业采用扩展法表。</label>
  <div className="spell-action-buttons"><button disabled={restricted||busy||!offer.canConfirm||!dm||!player} onClick={()=>submit(true)}>确认采用此职业扩展法表</button><button disabled={!busy&&!dm&&!player&&!offer.canConfirm&&!offer.canWithdraw} onClick={cancel}>取消扩展法表核对</button>{record?.enabled&&<button disabled={busy||!offer.canWithdraw} onClick={()=>submit(false)}>撤回此职业扩展法表</button>}{onChooseOwner&&<button disabled={restricted||busy||!offer.active} onClick={onChooseOwner}>为此职业选择法术</button>}</div>
  {visible&&<div role="status" aria-live="polite" data-optional-class-phase={visible.phase}>{visible.phase==='applied'?'扩展法表操作已由当前卡面确认':visible.phase==='rejected'?'扩展法表操作未执行':'等待扩展法表卡面确认'}{visible.message&&<p>{visible.message}</p>}{visible.phase==='applied'&&<small data-testid="optional-class-save-state">{status?.scope===c.id?status.saveLabel:'保存与同步结果请查看卡面状态'}</small>}</div>}
 </fieldset>;
}
