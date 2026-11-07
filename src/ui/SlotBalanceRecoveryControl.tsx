import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Character} from '../core/model';
import {currentSlotCapacityReview} from '../core/automation/slotCapacityReview';
import {slotBalanceRecoveryOffer,slotBalanceRecoveryRequest,slotBalanceRecoveryFingerprint,performSlotBalanceRecovery} from '../core/automation/slotBalanceRecovery';
import {useSpellActionFeedback} from './SpellActionFeedback';
import {useInteractionStatus} from './InteractionFeedback';
import type {Edit} from './CharacterPages';

type Feedback={id:string;scope:string;resourceId:string;remaining:number;fingerprint:string;phase:'pending'|'unconfirmed'|'applied'|'rejected';message?:string};
const amount=(text:string,max:number)=>/^\d+$/.test(text)&&Number.isSafeInteger(Number(text))&&Number(text)<=max?Number(text):undefined;
function retainEntries<T>(value:Record<string,T>,previous:Record<string,string>,next:Record<string,string>):Record<string,T>{
 const entries=Object.keys(next).filter(id=>previous[id]===next[id]&&Object.hasOwn(value,id)).map(id=>[id,value[id]] as const);
 return entries.length===Object.keys(value).length?value:Object.fromEntries(entries);
}
export function SlotBalanceRecoveryControl({c,edit,writable=true}:{c:Character;edit:Edit;writable?:boolean}){
 const access=useSpellActionFeedback(c,edit,!writable),status=useInteractionStatus(),state=currentSlotCapacityReview(c);
 const [values,setValues]=useState<Record<string,string>>({}),[feedback,setFeedback]=useState<Feedback>();
 const [existingConfirmed,setExistingConfirmed]=useState<Record<string,boolean>>({});
 const [manualDestinations,setManualDestinations]=useState<Record<string,string>>({});
 const inputScopes=useRef<Record<string,string>>({}),existingScopes=useRef<Record<string,string>>({});
 const latest=useRef({c,edit,writable});latest.current={c,edit,writable};
 const epoch=useRef(0),mounted=useRef(true),flight=useRef<string|undefined>(undefined);
 const offers=state?Object.keys(state.pending).map(id=>slotBalanceRecoveryOffer(c,id,access.authority,existingConfirmed[id]===true,manualDestinations[id])):[];
 const context=JSON.stringify([c.id,writable,access.authority,offers.map(o=>[o.resourceId,o.basis,o.available,manualDestinations[o.resourceId]])]);
 const scopeBase=JSON.stringify([c.id,c.edition,writable,access.authority,c.selections.filter(s=>s.entry.kind==='class'||s.entry.kind==='subclass').map(s=>[s.id,s.entry.id,s.entry.source,s.entry.edition,s.entry.revision,s.level,s.parentId])]);
 const nextInputScopes=Object.fromEntries(offers.map(o=>[o.resourceId,JSON.stringify([scopeBase,o.max,o.available,o.reason])])),inputContext=JSON.stringify(nextInputScopes);
 const nextExistingScopes=Object.fromEntries(offers.map(o=>[o.resourceId,JSON.stringify([scopeBase,o.max,o.requiresExistingConfirmation,o.requiresManualPreservation,o.existingFingerprint])])),existingContext=JSON.stringify(nextExistingScopes);
 const visible=feedback?.scope===c.id?feedback:undefined,busy=visible?.phase==='pending'||visible?.phase==='unconfirmed';
 useLayoutEffect(()=>{epoch.current++;flight.current=undefined;},[context]);
 useLayoutEffect(()=>{const previous=inputScopes.current;setValues(old=>retainEntries(old,previous,nextInputScopes));inputScopes.current=nextInputScopes;},[inputContext]);
 useLayoutEffect(()=>{const previous=existingScopes.current;setExistingConfirmed(old=>retainEntries(old,previous,nextExistingScopes));setManualDestinations(old=>retainEntries(old,previous,nextExistingScopes));existingScopes.current=nextExistingScopes;},[existingContext]);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 useEffect(()=>{setFeedback(undefined);},[c.id]);
 const receipt=state?.lastConfirmation;
 useLayoutEffect(()=>{if(visible&&(visible.phase==='pending'||visible.phase==='unconfirmed')&&receipt?.id===visible.id&&receipt.fingerprint===visible.fingerprint&&receipt.resourceId===visible.resourceId&&receipt.remaining===visible.remaining){flight.current=undefined;setFeedback({...visible,phase:'applied'});}},[receipt,visible]);
 useEffect(()=>{if(visible?.phase!=='pending')return;const id=visible.id,timer=setTimeout(()=>setFeedback(old=>old?.id===id&&old.phase==='pending'?{...old,phase:'unconfirmed',message:'尚未收到卡面确认，请查看保存与同步状态。'}:old),4500);return()=>clearTimeout(timer);},[visible?.id,visible?.phase]);
 function cancel(){epoch.current++;flight.current=undefined;setValues({});setExistingConfirmed({});setManualDestinations({});setFeedback(undefined);}
 function acknowledge(resourceId:string,manual:boolean,checked:boolean){const destination=manual&&checked?'manual-slot:'+crypto.randomUUID():undefined;setExistingConfirmed(old=>({...old,[resourceId]:checked}));setManualDestinations(old=>{const next={...old};if(destination)next[resourceId]=destination;else delete next[resourceId];return next;});}
 function confirm(resourceId:string,max:number){
  const remaining=amount(values[resourceId]??'',max);if(remaining===undefined||flight.current||busy||!access.liveAuthority().canEdit)return;
  const live=latest.current,scope=live.c.id,token=epoch.current,request=slotBalanceRecoveryRequest(live.c,resourceId,remaining,crypto.randomUUID(),existingConfirmed[resourceId]===true,manualDestinations[resourceId]);
  const next:Feedback={id:request.id,scope,resourceId,remaining,fingerprint:slotBalanceRecoveryFingerprint(request),phase:'pending'};
  flight.current=request.id;setFeedback(next);let used=false;
  const reject=(message:string)=>{flight.current=undefined;if(mounted.current)setFeedback({...next,phase:'rejected',message});};
  try{live.edit(draft=>{
   if(used)return;used=true;
   const authority=access.liveAuthority();if(!mounted.current||token!==epoch.current||latest.current.c.id!==scope||draft.id!==scope||!latest.current.writable||!authority.canEdit){reject('卡面或当前编辑权限已变化，未确认余量。');return;}
   const result=performSlotBalanceRecovery(draft,request,authority);if(result.status==='rejected')reject(result.message);
  });}catch{reject('余量确认未提交，请查看保存状态。');}
 }
 if(!offers.length&&!visible&&c.runtime.slotCapacityReview===undefined)return null;
 if(!offers.length&&!visible&&state)return null;
 return <section className="source-spell-actions" data-slot-balance-recovery="" style={{minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}}>
  {offers.length>0&&<><strong>核对法术位余量</strong><p>旧记录缺少余量，请填写当前实际剩余次数。</p>{offers.map(offer=>{const level=offer.resourceId.split(':')[1],value=values[offer.resourceId]??'',disabled=busy||!offer.available||!writable;return <div key={offer.resourceId} className="feature-choice-actions" style={{flexWrap:'wrap'}}>{offer.requiresExistingConfirmation&&<label><input type="checkbox" aria-label={offer.requiresManualPreservation?`保留${level}环位置的手工资源`:`已核对${level}环已有法术位记录`} checked={existingConfirmed[offer.resourceId]===true} disabled={busy||!writable||!access.authority.canEdit} onChange={event=>acknowledge(offer.resourceId,!!offer.requiresManualPreservation,event.target.checked)}/>{offer.requiresManualPreservation?<>保留“{offer.existingName}”为独立资源，再建立自动法术位</>:<>已核对现有记录（余量 {offer.existingRemaining}），按当前上限更新</>}</label>}<label>{level}环法术位（上限 {offer.max}）<input aria-label={`${level}环法术位剩余次数`} type="number" min={0} max={offer.max} step={1} value={value} disabled={disabled} onChange={event=>setValues(old=>({...old,[offer.resourceId]:event.target.value}))} style={{width:'6em',maxWidth:'100%'}}/></label><button type="button" aria-label={`确认${level}环法术位余量`} disabled={disabled||amount(value,offer.max)===undefined} onClick={()=>confirm(offer.resourceId,offer.max)}>确认余量</button>{offer.reason&&<small>{offer.reason}</small>}</div>;})}</>}
  {!state&&c.runtime.slotCapacityReview!==undefined&&<small role="status">法术位余额记录来自其他版本，已有记录保留。</small>}
  {visible&&<div role="status" aria-live="polite" data-slot-recovery-feedback="" data-phase={visible.phase}><small>{visible.phase==='applied'?`${visible.resourceId.split(':')[1]}环余量已记录：${visible.remaining}`:visible.phase==='rejected'?'未确认余量':'等待卡面确认'}</small>{visible.message&&<small>{visible.message}</small>}{visible.phase==='applied'&&receipt?.id===visible.id&&receipt.preservedManualAs&&<small>手工记录已独立保留</small>}{visible.phase==='applied'&&<small className="action-save-state">{status?.scope===visible.scope?status.saveLabel:'请查看卡面保存状态'}</small>}{busy&&<button type="button" onClick={cancel}>取消确认</button>}</div>}
 </section>;
}
