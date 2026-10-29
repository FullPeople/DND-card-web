import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Character} from '../core/model';
import {sourceLevelHpOffer,sourceLevelHpRequest,sourceLevelHpRequestFingerprint,performSourceLevelHpAction,sourceLevelHpReceipt} from '../core/automation/sourceLevelHp';
import type {Edit} from './CharacterPages';
import {useSpellActionFeedback} from './SpellActionFeedback';
import {useInteractionStatus} from './InteractionFeedback';
import {RetainedCardHideEffect,useRetainedCardActive} from './RetainedCardVisibility';

type Receipt=NonNullable<ReturnType<typeof sourceLevelHpReceipt>>;
type Action={id:string;scope:string;selectionId:string;kind:'confirm'|'withdraw';phase:'pending'|'applied'|'rejected'|'unconfirmed';expected?:Receipt;message?:string};
const matches=(a:Receipt,b:Receipt)=>a.id===b.id&&a.sequence===b.sequence&&a.selectionId===b.selectionId&&a.kind===b.kind&&a.fingerprint===b.fingerprint;

/** Consent changes an authenticated maximum-HP projection, never current HP.
 * A mutated draft is not a saved receipt: only the observed current card ACKs. */
export function SourceLevelHpControl({c,selectionId,edit,writable=false}:{c:Character;selectionId:string;edit:Edit;writable?:boolean}){
 const feedback=useSpellActionFeedback(c,edit,!writable),active=useRetainedCardActive(),status=useInteractionStatus(),offer=sourceLevelHpOffer(c,selectionId,feedback.authority);
 const [confirmed,setConfirmed]=useState(false),[action,setAction]=useState<Action>();
 const consent=useRef<{scope:string;selectionId:string;basis:string;sequence:number;canEdit:boolean;gm:boolean}|undefined>(undefined);
 const epoch=useRef(0),mounted=useRef(true),flight=useRef<string|undefined>(undefined),live=useRef({c,selectionId,writable,active});live.current={c,selectionId,writable,active};
 useLayoutEffect(()=>{epoch.current++;consent.current=undefined;setConfirmed(false);},[c.id,selectionId,offer?.basis,offer?.sequence,writable,active,c.locked,feedback.authority.canEdit,feedback.authority.gm]);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 useEffect(()=>{flight.current=undefined;setAction(undefined);},[c.id,selectionId]);
 const visible=action?.scope===c.id&&action.selectionId===selectionId?action:undefined,observed=visible?sourceLevelHpReceipt(c,visible.id):undefined;
 useLayoutEffect(()=>{if(visible&&['pending','unconfirmed'].includes(visible.phase)&&visible.expected&&observed&&matches(observed,visible.expected)){if(flight.current===visible.id)flight.current=undefined;setAction({...visible,phase:'applied',message:undefined});}},[visible,observed]);
 useEffect(()=>{if(visible?.phase!=='pending')return;const id=visible.id,timer=setTimeout(()=>setAction(old=>old?.id===id&&old.phase==='pending'?{...old,phase:'unconfirmed',message:'尚未收到当前卡面回执，请核对保存与同步状态。'}:old),4500);return()=>clearTimeout(timer);},[visible?.id,visible?.phase]);
 function cancel(){epoch.current++;flight.current=undefined;consent.current=undefined;setConfirmed(false);setAction(undefined);}
 const restricted=!writable||!active||!feedback.authority.canEdit,busy=visible?.phase==='pending'||visible?.phase==='unconfirmed';
 function submit(kind:'confirm'|'withdraw'){
  const current=live.current,authority=feedback.liveAuthority(),fresh=sourceLevelHpOffer(current.c,selectionId,authority);
  const attestation=consent.current;
  if(!mounted.current||flight.current||busy||!current.writable||!current.active||!authority.canEdit||current.selectionId!==selectionId||!fresh||!offer||fresh.basis!==offer.basis||fresh.sequence!==offer.sequence||kind==='confirm'&&(!confirmed||!fresh.canConfirm||!attestation||attestation.scope!==current.c.id||attestation.selectionId!==selectionId||attestation.basis!==fresh.basis||attestation.sequence!==fresh.sequence||attestation.canEdit!==authority.canEdit||attestation.gm!==authority.gm)||kind==='withdraw'&&!fresh.canWithdraw)return;
  if(!Number.isSafeInteger(fresh.sequence)||fresh.sequence<0||fresh.sequence>=Number.MAX_SAFE_INTEGER)return;
  const id=crypto.randomUUID(),scope=current.c.id,token=epoch.current,basis=fresh.basis,sequence=fresh.sequence,next:Action={id,scope,selectionId,kind,phase:'pending'};
  let request:ReturnType<typeof sourceLevelHpRequest>;
  try{request=sourceLevelHpRequest(current.c,selectionId,id,kind==='confirm'?{kind,confirmedManualHpExcluded:true}:{kind});}catch(error){setConfirmed(false);setAction({...next,phase:'rejected',message:error instanceof Error?error.message:String(error)});return;}
  const expected:Receipt={id,sequence:request.sequence,selectionId,kind,fingerprint:sourceLevelHpRequestFingerprint(request)};
  flight.current=id;consent.current=undefined;setConfirmed(false);setAction({...next,expected});let used=false;
  const reject=(message:string)=>{if(flight.current===id)flight.current=undefined;if(mounted.current)setAction(old=>old?.id===id?{...old,phase:'rejected',message}:old);};
  try{edit(draft=>{
   if(used)return;used=true;const latest=live.current,access=feedback.liveAuthority(),now=sourceLevelHpOffer(draft,selectionId,access);
   if(!mounted.current||token!==epoch.current||latest.c.id!==scope||draft.id!==scope||latest.selectionId!==selectionId||!latest.writable||!latest.active||!access.canEdit||!now||now.basis!==basis||now.sequence!==sequence||kind==='confirm'&&!now.canConfirm||kind==='withdraw'&&!now.canWithdraw){reject('归属、等级、来源、手工生命值、当前卡面或编辑权限已变化，未执行。');return;}
   const result=performSourceLevelHpAction(draft,request,access);
   if(result.status==='rejected'){reject(result.message);return;}
  });}catch(error){reject(error instanceof Error?error.message:String(error));}
 }
 if(!offer)return null;
 return <fieldset className="source-level-hp-control" data-source-level-hp-owner={selectionId} disabled={restricted}>
  <legend>来源生命值上限 · {offer.name}</legend>
  <RetainedCardHideEffect hide={cancel}/>
  <p>{offer.active?'本来源生命值上限加值已确认并生效。':offer.confirmed?'原确认保留，当前条件或手工基准已变化，暂不生效。':offer.withdrawn?'此来源的生命值确认已撤回；再次启用须重新核对。':'尚未确认本来源；打开面板、启用来源或升级不会自动确认。'}</p>
  <p>来源：{offer.name} · {offer.source}。按{offer.levelBasis==='owning-class-level'?'准确所属术士职业等级':'当前角色总等级'}{offer.level===undefined?'（待核对）':` ${offer.level}`}计算{typeof offer.bonus==='number'&&Number.isFinite(offer.bonus)?`，来源上限加值 +${offer.bonus}`:''}；未确认不应用。</p>
  <p>请先核对这项加值尚未计入手工基础生命值、额外加值或最终值修正，避免重复计算。已有生效的手工最终生命值覆盖会暂停此项；手工基准变化后须重新核对。仅重算生命值上限，不恢复当前生命值、临时生命值、生命骰或其他已消耗资源。</p>
  {offer.reason&&<p role="note">{offer.reason}</p>}
  <label><input type="checkbox" aria-label="确认本来源未计入手工生命值上限" checked={confirmed} disabled={busy||!offer.canConfirm} onChange={event=>{epoch.current++;const access=feedback.liveAuthority();consent.current=event.target.checked?{scope:c.id,selectionId,basis:offer.basis,sequence:offer.sequence,...access}:undefined;setConfirmed(event.target.checked);}}/>已核对：本来源加值尚未计入手工生命值上限。</label>
  <div className="feature-choice-actions"><button type="button" disabled={restricted||busy||!offer.canConfirm||!confirmed} onClick={()=>submit('confirm')}>确认来源生命值加值</button><button type="button" onClick={cancel}>取消来源生命值核对</button>{offer.record&&<button type="button" disabled={busy||!offer.canWithdraw} onClick={()=>submit('withdraw')}>撤回来源生命值确认</button>}</div>
  <small>旧客户端可能保留记录但不应用效果；字段保留不代表可安全编辑。若曾在旧版更改归属、等级、来源或手工上限，请先撤回、核对并重新确认，不改写或降级未知版本。</small>
  {visible&&<div role="status" aria-live="polite" data-source-level-hp-phase={visible.phase} data-source-level-hp-request={visible.id}>{visible.phase==='applied'?'来源生命值操作已由当前卡面回执确认':visible.phase==='rejected'?'来源生命值操作未执行':'等待来源生命值卡面确认'}{visible.message&&<p>{visible.message}</p>}{visible.phase==='applied'&&<small data-testid="source-level-hp-save-state">{status?.scope===c.id?status.saveLabel:'保存与同步结果请查看卡面状态'}</small>}</div>}
 </fieldset>;
}
