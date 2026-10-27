import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Character,Entry} from '../core/model';
import {itemAtWillOffer,itemAtWillObservedIntent,setItemAtWillIntent} from '../core/automation/itemAtWill';
import type {Edit} from './CharacterPages';
import {useSpellActionFeedback} from './SpellActionFeedback';
import {useInteractionStatus} from './InteractionFeedback';
import {useRetainedCardActive} from './RetainedCardVisibility';
import './sourceSpellControls.css';

/** Explicit owned-source intent, not learning, effects or a resource grant. */
export function ItemAtWillSpellControl({c,ownerId,entries,edit,writable=true}:{c:Character;ownerId:string;entries:Entry[];edit:Edit;writable?:boolean}){
 const feedback=useSpellActionFeedback(c,edit,!writable),active=useRetainedCardActive(),status=useInteractionStatus(),offer=itemAtWillOffer(c,ownerId,entries,feedback.authority);
 const [genuine,setGenuine]=useState(false),[action,setAction]=useState<{id:string;scope:string;nonce:number;enabled:boolean;phase:'pending'|'applied'|'rejected'|'unconfirmed';message?:string}>();
 const epoch=useRef(0),mounted=useRef(true),flight=useRef<string|undefined>(undefined),live=useRef({c,ownerId,entries,writable,active});live.current={c,ownerId,entries,writable,active};
 useLayoutEffect(()=>{epoch.current++;setGenuine(false);},[c.id,ownerId,offer.basis,writable,active,feedback.authority.canEdit]);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 useEffect(()=>{flight.current=undefined;setAction(undefined);},[c.id,ownerId]);
 const visible=action?.scope===c.id?action:undefined,record=offer.record,observed=itemAtWillObservedIntent(c,ownerId);
 useLayoutEffect(()=>{if(visible&&['pending','unconfirmed'].includes(visible.phase)&&observed?.nonce===visible.nonce&&observed.enabled===visible.enabled&&(!visible.enabled||offer.active)){flight.current=undefined;setAction({...visible,phase:'applied',message:undefined});}},[observed,offer.active,visible]);
 useEffect(()=>{if(visible?.phase!=='pending')return;const id=visible.id,timer=setTimeout(()=>setAction(old=>old?.id===id&&old.phase==='pending'?{...old,phase:'unconfirmed',message:'尚未收到卡面确认，请核对保存与同步状态。'}:old),4500);return()=>clearTimeout(timer);},[visible?.id,visible?.phase]);
 const restricted=!writable||!active||!feedback.authority.canEdit,busy=visible?.phase==='pending'||visible?.phase==='unconfirmed';
 function cancel(){epoch.current++;flight.current=undefined;setGenuine(false);setAction(undefined);}
 function submit(enabled:boolean){
  if(restricted||busy||flight.current||enabled&&(!genuine||!offer.canConfirm)||!enabled&&!offer.canWithdraw)return;
  const sequence=c.automation?.itemAtWill?.sequence??0;if(!Number.isSafeInteger(sequence)||sequence<0||sequence>=Number.MAX_SAFE_INTEGER)return;
  const id=crypto.randomUUID(),scope=c.id,token=epoch.current,basis=offer.basis,nonce=sequence+1;flight.current=id;setGenuine(false);setAction({id,scope,nonce,enabled,phase:'pending'});let used=false;
  try{edit(draft=>{
   if(used)return;used=true;const access=feedback.liveAuthority(),current=live.current,next=itemAtWillOffer(draft,ownerId,current.entries,access);
   if(!mounted.current||token!==epoch.current||current.c.id!==scope||draft.id!==scope||current.ownerId!==ownerId||!current.writable||!current.active||!access.canEdit||next.basis!==basis||enabled&&!next.canConfirm||!enabled&&!next.canWithdraw){if(mounted.current){flight.current=undefined;setAction({id,scope,nonce,enabled,phase:'rejected',message:'物品、来源、核对草稿或当前权限已变化，未执行。'});}return;}
   setItemAtWillIntent(draft,ownerId,enabled?{confirmedGenuineOwnedItem:true}:null,current.entries,access);
  });}catch(error){flight.current=undefined;setAction({id,scope,nonce,enabled,phase:'rejected',message:error instanceof Error?error.message:String(error)});}
 }
 return <fieldset className="source-spell-choice" data-item-atwill="" data-item-atwill-owner={ownerId} disabled={restricted}>
  <legend>物品随意施法来源 · {offer.label}</legend>
  <p>{offer.active?'当前来源已确认且可核对；法术仍附属于此实物。':record?.enabled?'原确认已保留，但当前穿戴、来源或归属不可用；不能施法。':record?'此物品来源确认已撤回；再次使用须明确重新核对。':'尚未确认当前真实拥有的物品来源；打开或穿戴不会自动获得法术。'}</p>
  {offer.reason&&<p role="note">{offer.reason}</p>}
  <p>{offer.requiresAttunement?'需要背包中当前已穿戴且已同调的实物标记。':'需要背包中当前穿戴实物的标记。'}实际穿戴、同调程序、资格与限制仍需人工核对；不会自动穿戴或同调。</p>
  <ul>{offer.grants.map(grant=><li key={grant.key}>{entries.filter(entry=>entry.id===grant.targetEntryId).length===1?entries.find(entry=>entry.id===grant.targetEntryId)!.name:'来源法术引用'} · {grant.targetScope==='self'?'仅限自身，不允许其他目标。':'目标按来源法术条目人工核对。'}</li>)}</ul>
  <p>这里只确认物品附属的免费来源施法，不是学习法术，不占普通学习或预备名额，也不新增、恢复或重置资源。动作与施法时间、施法属性、攻击与 DC、材料、目标条件、伤害与效果、持续时间和专注仍需人工处理；来源未支持的限制不能通过确认解除。</p>
  <label><input type="checkbox" aria-label="确认当前真实拥有此物品来源" checked={genuine} disabled={!offer.canConfirm||busy} onChange={event=>{setGenuine(event.target.checked);epoch.current++;}}/>我已核对当前真实拥有此实物，并满足其当前来源条件。</label>
  <div className="spell-action-buttons"><button disabled={restricted||busy||!offer.canConfirm||!genuine} onClick={()=>submit(true)}>确认物品随意施法来源</button><button disabled={!busy&&!genuine&&!offer.canConfirm&&!offer.canWithdraw} onClick={cancel}>取消物品来源核对</button>{record?.enabled&&<button disabled={busy||!offer.canWithdraw} onClick={()=>submit(false)}>撤回物品随意施法来源</button>}</div>
  {visible&&<div role="status" aria-live="polite" data-item-atwill-phase={visible.phase}>{visible.phase==='applied'?'物品来源操作已由当前卡面确认':visible.phase==='rejected'?'物品来源操作未执行':'等待物品来源卡面确认'}{visible.message&&<p>{visible.message}</p>}{visible.phase==='applied'&&<small data-testid="item-atwill-save-state">{status?.scope===c.id?status.saveLabel:'保存与同步结果请查看卡面状态'}</small>}</div>}
 </fieldset>;
}
