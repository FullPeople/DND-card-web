import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Character,Entry} from '../core/model';
import {refuelingRingOffer,refuelingRingActionRequest,type RefuelingRingAction,type RefuelingSlot} from '../core/automation/refuelingRing';
import {useInteractionStatus} from './InteractionFeedback';
import {RetainedCardHideEffect,useRetainedCardActive} from './RetainedCardVisibility';
import {confirmRefuelingRingPresentation,rejectRefuelingRingPresentation,refuelingRingPresentationBusy,type RefuelingRingPresentation} from './refuelingRingPresentation';
import {refuelingRingConfirmation,dispatchRefuelingRingRequest} from './refuelingRingSubmission';
type Props={c:Character;choiceId:string;entry:Entry;unavailable:boolean;writable:boolean;edit?:(action:(draft:Character)=>void)=>void};
type Draft={id:string;scope:string;kind:RefuelingRingAction['kind'];basis:Character;slots:RefuelingSlot[]};
const slotLabel=(slot:RefuelingSlot)=>`${slot.kind==='pact'?'契约':'普通'} ${slot.level} 环：${slot.current} / ${slot.max} → ${slot.current+1} / ${slot.max}`;
function RingDialog({title,draft,disabled,confirm,cancel}:{title:string;draft:Draft;disabled:boolean;confirm:(action:RefuelingRingAction)=>void;cancel:()=>void}){
 const node=useRef<HTMLDialogElement>(null),[value,setValue]=useState(''),[confirmed,setConfirmed]=useState(false),{kind,slots}=draft;
 useLayoutEffect(()=>{const dialog=node.current!,focus=document.activeElement;dialog.showModal();return()=>{dialog.close();if(focus instanceof HTMLElement&&focus.isConnected)focus.focus();};},[]);
 const action=refuelingRingConfirmation(kind,value,confirmed);
 return createPortal(<dialog ref={node} className="dialog" aria-modal="true" aria-label={title} style={{width:'min(460px, calc(100vw - 24px))',maxWidth:'calc(100vw - 24px)'}} onCancel={event=>{event.preventDefault();cancel();}} onClick={event=>{if(event.target===event.currentTarget)cancel();}}><div className="dialog-head"><h2>{title}</h2><button type="button" aria-label="关闭法力恢复确认" onClick={cancel}>×</button></div><div className="dialog-body">
  {kind==='initialize'?<><p>请核对该戒指当前是否仍可使用。学习、绑定或重开不会自动授予使用资格；同一物品已有记录不能重置。</p><label>已核对的使用资格 <select aria-label="已核对的使用资格" value={value} disabled={disabled} onChange={event=>setValue(event.target.value)}><option value="">请选择可用或已用</option><option value="1">可用 · 1 次</option><option value="0">已用 · 0 次</option></select></label></>:kind==='use'?<><p>穿戴并同调此戒指，使用一个动作，恢复一个已消耗的 1–3 环法术位。使用资格和所选法术位同时提交；不会创建新池、改动手工池或将高环契约位降环。</p><label>恢复的法术位 <select aria-label="恢复的法术位" style={{maxWidth:'100%'}} value={value} disabled={disabled} onChange={event=>setValue(event.target.value)}><option value="">请选择一个已消耗的法术位</option>{slots.map(slot=><option key={slot.key} value={slot.key}>{slotLabel(slot)}</option>)}</select></label><label><input type="checkbox" aria-label="确认本次使用一个动作恢复法术位" checked={confirmed} disabled={disabled} onChange={event=>setConfirmed(event.target.checked)}/>确认本次使用一个动作恢复法术位</label></>:<><p>新的黎明只恢复此戒指的一次使用资格，不恢复任何法术位；不是长休、短休或掷骰回充。不要求当前穿戴或同调。</p><label><input type="checkbox" aria-label="确认游戏内已到新的黎明" checked={confirmed} disabled={disabled} onChange={event=>setConfirmed(event.target.checked)}/>确认游戏内已到新的黎明</label></>}
  <p>关闭、Escape 或取消不会写入。游戏时间与动作仍由玩家核对。</p><div className="feature-choice-actions"><button type="button" onClick={cancel}>取消</button><button type="button" aria-label="确认法力恢复操作" disabled={disabled||!action} onClick={()=>{if(!disabled&&action)confirm(action);}}>确认</button></div>{disabled&&<p role="alert">当前不能写入，未执行法力恢复操作。</p>}
 </div></dialog>,document.body);
}
export function RefuelingRingControl({c,choiceId,entry,unavailable,writable,edit}:Props){
 const offer=refuelingRingOffer(c,choiceId,entry.id),active=useRetainedCardActive(),flight=useRef<string|undefined>(undefined),[draft,setDraft]=useState<Draft>(),[feedback,setFeedback]=useState<RefuelingRingPresentation>();
 const visible=feedback?.scope===c.id?feedback:undefined,dialog=draft?.scope===c.id&&active?draft:undefined,busy=refuelingRingPresentationBusy(visible),canEdit=writable&&!!edit&&!unavailable&&active;
 const receipt=c.runtime.refuelingRing?.version===1?c.runtime.refuelingRing.last:undefined;
 useLayoutEffect(()=>{const next=confirmRefuelingRingPresentation(visible,c.id,receipt);if(next!==visible){flight.current=undefined;setFeedback(next);}},[receipt,c.id,visible]);
 useEffect(()=>{flight.current=undefined;setDraft(undefined);setFeedback(undefined);},[c.id,choiceId,entry.id,offer.key]);
 useEffect(()=>{if(visible?.phase!=='pending')return;const id=visible.id,timer=setTimeout(()=>setFeedback(old=>old?.id===id&&old.phase==='pending'?{...old,phase:'unconfirmed',message:'尚未收到卡面确认，请查看保存与同步状态；不要重复恢复。'}:old),4500);return()=>clearTimeout(timer);},[visible?.id,visible?.phase]);
 if(!offer.supported)return null;
 const blocked=!writable||!edit?'当前角色卡只读，不能修改戒指使用资格或法术位。':unavailable?'此学习选项当前不可用，已有记录保留。':offer.reason;
 function open(kind:Draft['kind']){if(!canEdit||busy||!(kind==='initialize'?offer.canInitialize:kind==='use'?offer.canUse:offer.canDawn))return;setDraft({id:crypto.randomUUID(),scope:c.id,kind,basis:structuredClone(c),slots:structuredClone(offer.slots)});}
 function confirm(action:RefuelingRingAction){
  if(!dialog||!canEdit||flight.current||busy)return;
  const next:RefuelingRingPresentation={id:dialog.id,scope:c.id,phase:'pending'};flight.current=dialog.id;setFeedback(next);setDraft(undefined);
  const reject=(message:string)=>{if(flight.current===next.id)flight.current=undefined;setFeedback(old=>rejectRefuelingRingPresentation(old,next.id,next.scope,message));};
  try{dispatchRefuelingRingRequest(edit!,refuelingRingActionRequest(dialog.basis,choiceId,entry.id,dialog.id,action),reject);}catch(error){reject(error instanceof Error?error.message:String(error));}
 }
 return <section className="refueling-ring-control" aria-label={`${entry.name}法术位恢复`} style={{minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}}>
  <RetainedCardHideEffect hide={()=>setDraft(undefined)}/><small data-testid="refueling-ring-balance">{offer.current===undefined?c.runtime.refuelingRing&&!offer.key?'当前使用资格待核实，已有记录保留':'尚未记录当前使用资格':offer.current===1?'当前使用资格：可用 · 1 / 1':'当前使用资格：已用 · 0 / 1'}</small>
  <small>使用一个动作恢复一个法术位（1–3 环普通位或契约位），每日黎明只恢复一次使用资格。学习、换绑、遗忘或重新学习不补满。</small>
  <small>仅核对本卡 TCE 奇械师单职，或加唯一 PHB 魔契师的真实来源法术位；其他混合职业、未知来源或手工池待核实，不默认授予。</small>
  <small>原生 JSON 或含完整关联数据的枭熊备份可保留记录；普通枭熊导出不是完整备份。</small>
  <div className="feature-choice-actions">
   {offer.current===undefined&&<button type="button" aria-label={`记录${entry.name}初始使用资格`} disabled={!canEdit||busy||!offer.canInitialize} onClick={()=>open('initialize')}>记录初始使用资格</button>}
   <button type="button" aria-label={`使用${entry.name}恢复法术位`} disabled={!canEdit||busy||!offer.canUse} onClick={()=>open('use')}>动作 · 恢复一个法术位</button>
   <button type="button" aria-label={`恢复${entry.name}黎明使用资格`} disabled={!canEdit||busy||!offer.canDawn} onClick={()=>open('dawn')}>黎明 · 恢复使用资格</button>
  </div>{blocked&&<small>{blocked}</small>}{!unavailable&&!offer.canUse&&offer.useReason&&<small>{offer.useReason}</small>}
  <RefuelingRingFeedback action={visible}/>{dialog&&<RingDialog key={dialog.id} title={`${entry.name} · ${dialog.kind==='initialize'?'记录初始使用资格':dialog.kind==='use'?'恢复法术位':'黎明恢复使用资格'}`} draft={dialog} disabled={!canEdit} confirm={confirm} cancel={()=>setDraft(undefined)}/>}
 </section>;
}
export function RefuelingRingFeedback({action}:{action?:RefuelingRingPresentation}){
 const status=useInteractionStatus();if(!action)return null;
 return <div role="status" aria-live="polite" data-testid="refueling-ring-feedback" data-phase={action.phase}><small>{action.phase==='applied'?'法力恢复操作已反映到当前卡':action.phase==='rejected'?'未执行法力恢复操作':'等待卡面确认'}</small>{action.message&&<small>{action.message}</small>}{action.phase==='applied'?<><small>使用资格：{action.receipt?.before===undefined?'未记录':action.receipt.before} → {action.receipt?.after}</small>{action.receipt?.slot&&<small>{action.receipt.slot.kind==='pact'?'契约':'普通'} {action.receipt.slot.level} 环：{action.receipt.slot.before} → {action.receipt.slot.after}</small>}<small>{status?.saveLabel||'保存与同步结果请查看卡面状态'}</small></>:action.phase!=='rejected'&&<small>尚未确认本次操作保存，请查看卡面保存与同步状态。</small>}</div>;
}
