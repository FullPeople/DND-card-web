import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Character,Entry} from '../core/model';
import {infusionChargeOffer,infusionChargeActionRequest} from '../core/automation/infusionCharges';
import {infusionRule} from '../core/automation/infusions';
import {useInteractionStatus} from './InteractionFeedback';
import {RetainedCardHideEffect,useRetainedCardActive} from './RetainedCardVisibility';
import {confirmInfusionChargePresentation,rejectInfusionChargePresentation,infusionChargePresentationBusy,type InfusionChargePresentation} from './infusionChargePresentation';
import {infusionChargeConfirmation,dispatchInfusionChargeRequest} from './infusionChargeSubmission';

type Props={c:Character;choiceId:string;entry:Entry;unavailable:boolean;writable:boolean;edit?:(action:(draft:Character)=>void)=>void};
type Kind='initialize'|'use'|'dawn';
type Draft={id:string;scope:string;kind:Kind;basis:Character};
type ChargeAction=Parameters<typeof infusionChargeActionRequest>[4];

function ChargeDialog({title,kind,mind,radiant,upgrade,disabled,confirm,cancel}:{title:string;kind:Kind;mind:boolean;radiant:boolean;upgrade:boolean;disabled:boolean;confirm:(action:ChargeAction)=>void;cancel:()=>void}){
 const node=useRef<HTMLDialogElement>(null),[value,setValue]=useState(''),[trigger,setTrigger]=useState(false),[reaction,setReaction]=useState(false),[upgradeConfirmed,setUpgradeConfirmed]=useState(false);
 useLayoutEffect(()=>{const dialog=node.current!,focus=document.activeElement;dialog.showModal();return()=>{dialog.close();if(focus instanceof HTMLElement&&focus.isConnected)focus.focus();};},[]);
 const baseAction=infusionChargeConfirmation(kind,value,trigger,reaction),action=baseAction?.kind==='initialize'&&upgrade?(upgradeConfirmed?{...baseAction,upgradeConfirmed:true}:undefined):baseAction;
 function commit(){if(disabled||!action)return;confirm(action);}
 return createPortal(<dialog ref={node} className="dialog" aria-modal="true" aria-label={title} style={{width:'min(420px, calc(100vw - 24px))',maxWidth:'calc(100vw - 24px)'}} onCancel={event=>{event.preventDefault();cancel();}} onClick={event=>{if(event.target===event.currentTarget)cancel();}}><div className="dialog-head"><h2>{title}</h2><button type="button" aria-label="关闭充能确认" onClick={cancel}>×</button></div><div className="dialog-body">
  {kind==='initialize'?<><p>初始余额必须由玩家核对，不是新授予 4 充能。已有的同物品记录不能重置。</p>{upgrade&&<><p>此卡已有旧版充能记录。继续将明确升级为充能 v2，保留全部旧余额、序号与旧回执，不补满其他物品。</p><label><input type="checkbox" aria-label="确认升级充能记录至 v2 并保留旧余额与回执" checked={upgradeConfirmed} disabled={disabled} onChange={event=>setUpgradeConfirmed(event.target.checked)}/>确认升级充能记录至 v2 并保留旧余额与回执</label></>}<label>已核对的当前充能 <select aria-label="已核对的当前充能" value={value} disabled={disabled} onChange={event=>setValue(event.target.value)}><option value="">请选择 0–4</option>{[0,1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}</select></label></>:kind==='use'?<><p>{mind?'维持法术专注的体质豁免失败后，使用反应与 1 充能，将该次结果改为成功；请自行应用该结果。':radiant?'被近战攻击命中后，使用反应与 1 充能。攻击者须进行对抗你的奇械师法术豁免 DC 的体质豁免，失败则致盲至其下回合结束；豁免掷骰、DC、致盲和光照均需手动处理。':'被近战攻击命中后，使用反应与 1 充能，可将攻击者推开至多 15 尺；请自行移动，无额外豁免。'}</p><label><input type="checkbox" aria-label={mind?'确认维持法术专注的体质豁免失败':'确认被近战攻击命中'} checked={trigger} disabled={disabled} onChange={event=>setTrigger(event.target.checked)}/>{mind?'确认维持法术专注的体质豁免失败':'确认被近战攻击命中'}</label><label><input type="checkbox" aria-label="确认本次使用反应" checked={reaction} disabled={disabled} onChange={event=>setReaction(event.target.checked)}/>确认本次使用反应</label></>:<><p>每日黎明恢复实际 d4 点已消耗充能，上限 4。不是长休、短休或固定回满；无需当前装备、同调或持握。</p><label><input type="checkbox" aria-label="确认游戏内已到新的黎明" checked={trigger} disabled={disabled} onChange={event=>setTrigger(event.target.checked)}/>确认游戏内已到新的黎明</label><label>实际 d4 结果 <select aria-label="实际 d4 结果" value={value} disabled={disabled} onChange={event=>setValue(event.target.value)}><option value="">请选择 1–4</option>{[1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}</select></label></>}
  <p>关闭、Escape 或取消都不会写入。每轮反应、游戏时钟与骰子结果由玩家核对。</p><div className="feature-choice-actions"><button type="button" onClick={cancel}>取消</button><button type="button" aria-label="确认充能操作" disabled={disabled||!action} onClick={commit}>确认</button></div>{disabled&&<p role="alert">当前不能写入，未执行充能操作。</p>}
 </div></dialog>,document.body);
}

export function InfusionChargeControl({c,choiceId,entry,unavailable,writable,edit}:Props){
 const offer=infusionChargeOffer(c,choiceId,entry.id),mind=infusionRule(entry)?.mechanism==='concentration-reaction',radiant=infusionRule(entry)?.reference==='Radiant Weapon|TCE',active=useRetainedCardActive(),flight=useRef<string|undefined>(undefined);
 const [draft,setDraft]=useState<Draft>(),[feedback,setFeedback]=useState<InfusionChargePresentation>();
 const visible=feedback?.scope===c.id?feedback:undefined,dialog=draft?.scope===c.id&&active?draft:undefined;
 const busy=infusionChargePresentationBusy(visible),canEdit=writable&&!!edit&&!unavailable&&active;
 const receipt=(c.runtime.infusionCharges?.version===1||c.runtime.infusionCharges?.version===2)?c.runtime.infusionCharges.last:undefined;
 useLayoutEffect(()=>{const next=confirmInfusionChargePresentation(visible,c.id,receipt);if(next!==visible){flight.current=undefined;setFeedback(next);}},[receipt,c.id,visible]);
 useEffect(()=>{flight.current=undefined;setDraft(undefined);setFeedback(undefined);},[c.id,choiceId,entry.id,offer.key]);
 useEffect(()=>{if(visible?.phase!=='pending')return;const id=visible.id,timer=setTimeout(()=>setFeedback(old=>old?.id===id&&old.phase==='pending'?{...old,phase:'unconfirmed',message:'尚未收到卡面确认，请查看保存与同步状态；不要重复扣除。'}:old),4500);return()=>clearTimeout(timer);},[visible?.id,visible?.phase]);
 if(!offer.supported)return null;
 const blocked=!writable||!edit?'当前角色卡只读，不能修改充能。':unavailable?'此学习选项当前不可用，充能记录保留。':offer.reason;
 function open(kind:Kind){if(!canEdit||busy||!(kind==='initialize'?offer.canInitialize:kind==='use'?offer.canUse:offer.canDawn))return;setDraft({id:crypto.randomUUID(),scope:c.id,kind,basis:structuredClone(c)});}
 function confirm(action:ChargeAction){
  if(!dialog||!canEdit||flight.current||busy)return;
  const next:InfusionChargePresentation={id:dialog.id,scope:c.id,title:entry.name,phase:'pending'};flight.current=dialog.id;setFeedback(next);setDraft(undefined);
  const reject=(message:string)=>{if(flight.current===next.id)flight.current=undefined;setFeedback(old=>rejectInfusionChargePresentation(old,next.id,next.scope,message));};
  try{const request=infusionChargeActionRequest(dialog.basis,choiceId,entry.id,dialog.id,action);dispatchInfusionChargeRequest(edit!,request,reject);}
  catch(error){reject(error instanceof Error?error.message:String(error));}
 }
 return <section className="infusion-charge-control" aria-label={`${entry.name}充能`} style={{minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}}>
  <RetainedCardHideEffect hide={()=>setDraft(undefined)}/><small data-testid="infusion-charge-balance">{offer.current===undefined?c.runtime.infusionCharges&&!offer.key?'当前充能暂不可核对，已有记录保留':'尚未记录当前充能':`当前充能：${offer.current} / 4`}</small>
  <small>初始余额必须由玩家核对。学习、绑定或重新学习都不会自动授予充能；同一物品的消耗历史保留。</small>
  <small>每日黎明恢复实际 d4 点，上限 4；不随短休或长休恢复。不会移动敌人、改写专注或跟踪每轮反应与游戏时钟；激活的触摸及死亡失效仍手动处理。</small>
  <small>请使用原生 JSON 或含完整关联数据的枭熊备份；普通枭熊导出不是完整备份。</small>
  <div className="feature-choice-actions">
   {offer.current===undefined&&<button type="button" aria-label={`记录${entry.name}初始充能`} disabled={!canEdit||busy||!offer.canInitialize} onClick={()=>open('initialize')}>记录初始充能</button>}
   <button type="button" aria-label={`使用${entry.name}反应充能`} disabled={!canEdit||busy||!offer.canUse} onClick={()=>open('use')}>使用反应 · 1 充能</button>
   <button type="button" aria-label={`恢复${entry.name}黎明充能`} disabled={!canEdit||busy||!offer.canDawn} onClick={()=>open('dawn')}>黎明恢复 · 实际 d4</button>
  </div>{blocked&&<small>{blocked}</small>}{!blocked&&!offer.canUse&&offer.useReason&&<small>{offer.useReason}</small>}
  <InfusionChargeFeedback action={visible}/>
  {dialog&&<ChargeDialog key={dialog.id} title={`${entry.name} · ${dialog.kind==='initialize'?'记录初始充能':dialog.kind==='use'?'使用反应充能':'黎明充能恢复'}`} kind={dialog.kind} mind={mind} radiant={radiant} upgrade={radiant&&c.runtime.infusionCharges?.version===1} disabled={!canEdit} confirm={confirm} cancel={()=>setDraft(undefined)}/>}
 </section>;
}


export function InfusionChargeFeedback({action}:{action?:InfusionChargePresentation}){
 const status=useInteractionStatus();if(!action)return null;
 return <div role="status" aria-live="polite" data-testid="infusion-charge-feedback" data-phase={action.phase}>
  <small>{action.phase==='applied'?'充能操作已反映到当前卡':action.phase==='rejected'?'未执行充能操作':'等待卡面确认'}</small>
  {action.message&&<small>{action.message}</small>}
  {action.phase==='applied'?<><small>{action.receipt?.before===undefined?'未记录':action.receipt.before} → {action.receipt?.after}</small><small>{status?.saveLabel||'保存与同步结果请查看卡面状态'}</small></>:action.phase!=='rejected'&&<small>尚未确认本次操作保存，请查看卡面保存与同步状态。</small>}
 </div>;
}
