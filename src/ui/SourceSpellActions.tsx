import {useLayoutEffect,useState,type KeyboardEvent} from 'react';
import type {Character} from '../core/model';
import type {Edit} from './CharacterPages';
import {spellPayments,sourceSpellRestoreOffer} from '../core/automation/actions';
import {sourceSpellEnabled} from '../core/automation/sourceSpellState';
import {chargedItemSpellGrantKey,chargedItemSpellBasis,chargedItemSpellBoundCastReceipt} from '../core/automation/chargedItemSpells';
import {SpellActionFeedback,useSpellActionFeedback} from './SpellActionFeedback';
import {useRetainedCardActive} from './RetainedCardVisibility';

const sourceTimingLabel=(timing:unknown)=>timing==='bonus-action'?'附赠动作':timing==='action'?'动作':timing==='spell-default'?'按法术原有施法时间':undefined;

export function SourceSpellActions({c,id,edit,readOnly=false}:{c:Character;id:string;edit:Edit;readOnly?:boolean}){
 const config=c.spellSettings?.special?.[id],charged=chargedItemSpellGrantKey(config?.sourceGrant?.key);
 const [chosen,setChosen]=useState(''),[currentValid,setCurrentValid]=useState(false),active=useRetainedCardActive(),feedback=useSpellActionFeedback(c,edit,readOnly,charged?(card,requestId)=>chargedItemSpellBoundCastReceipt(card,id,requestId):undefined),offer=spellPayments(c,id,feedback.authority);
 const selected=chosen||offer.options[0]?.id||'',payment=offer.options.find(p=>p.id===selected),enabled=sourceSpellEnabled(c,id);
 const available=offer.options.filter(option=>option.available),dual=config?.sourceGrant?.usage==='invocation-pact',limited=config?.sourceGrant?.usage==='limited',restore=dual?sourceSpellRestoreOffer(c,id,feedback.authority):undefined,restricted=readOnly||!feedback.authority.canEdit;
 const limitedBasis=JSON.stringify([c.id,id,c.profile,c.automation,config?.sourceGrant,offer.options,c.runtime.limitedSourceUses]);
 useLayoutEffect(()=>setCurrentValid(false),[limitedBasis,active,restricted]);
 const chargedBasis=charged?chargedItemSpellBasis(c,id):undefined;
 useLayoutEffect(()=>{if(charged){feedback.invalidate();setCurrentValid(false);setChosen('');}},[charged,chargedBasis,id,active,restricted,feedback.authority.canEdit,feedback.authority.gm]);
 function recover(){
  if(charged||limited||restricted||feedback.busy||!enabled||dual&&!restore?.available)return;
  if(dual&&!window.confirm('确认角色已经完成长休？这里只恢复本祈唤的 1 次使用次数，不恢复契约位、生命值或其他资源。'))return;
  feedback.run(id,restore?.paymentId||'source',dual?'确认已长休，恢复本祈唤次数':'恢复来源次数','restore');
 }
 function navigate(event:KeyboardEvent<HTMLButtonElement>,id:string){
  const index=available.findIndex(option=>option.id===id),next=['ArrowRight','ArrowDown'].includes(event.key)?(index+1)%available.length:['ArrowLeft','ArrowUp'].includes(event.key)?(index+available.length-1)%available.length:event.key==='Home'?0:event.key==='End'?available.length-1:-1;
  if(next<0||!available[next])return;event.preventDefault();setChosen(available[next].id);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=radio]:not(:disabled)')[next]?.focus();
 }
 return <div className="source-spell-actions" data-charged-item-spell-actions={charged?'':undefined}>
  {offer.options.length>1?<div className="spell-payment-choices" role="radiogroup" aria-label={`${c.selections.find(s=>s.id===id)?.entry.name}施法消耗`}>{offer.options.map(option=><button key={option.id} type="button" role="radio" aria-checked={selected===option.id} tabIndex={option.id===(available.find(row=>row.id===selected)?.id||available[0]?.id)?0:-1} disabled={restricted||!enabled||!option.available||feedback.busy} onKeyDown={event=>navigate(event,option.id)} onClick={()=>setChosen(option.id)}><b>{option.label}</b>{option.reason&&<small>{option.reason}</small>}</button>)}</div>:<small>{payment?.label||offer.reason}</small>}
  {payment?.targetScope==='self'?<p data-item-target-scope="self">仅限自身：此物品来源施法不能扩展到其他目标。这里只记录来源施法；效果、动作、施法时间、属性与 DC、持续时间和专注仍需人工处理。</p>:payment?.targetScope==='spell'&&<p data-item-target-scope="spell">目标按已核对的来源法术条目人工处理；此处不施加效果或推算施法属性、DC、持续时间与专注。</p>}
  {sourceTimingLabel(payment?.sourceActionTiming)&&<p data-item-source-timing={payment?.sourceActionTiming}>来源施法时间：{sourceTimingLabel(payment?.sourceActionTiming)}。只读提示；动作经济仍需人工处理。</p>}
  {charged&&payment?.id==='item-charge'&&<><p data-item-cast-level={payment.level}>来源施法环阶：{payment.level} 环。每次记录施法同时从所属实物的唯一充能池扣除 {payment.cost}；不另扣通用记账，不使用法术位或新增法术次数。</p>{payment.statistics?.kind==='fixed-dc'?<p data-item-cast-statistics="fixed-dc">来源固定豁免 DC：{payment.statistics.saveDC}。不借用职业 DC，也不推算施法攻击。</p>:payment.statistics?.kind==='none'&&<p data-item-cast-statistics="none">本支路无需施法攻击或豁免 DC；不借用职业施法属性。</p>}<p>余额只读；不恢复充能，不处理最后充能的破坏或其他后果。材料、实际持用／穿戴与同调资格、合法目标、效果、持续与专注仍须人工核对；失败的效果不会自动退还已支付充能。</p></>}
  {dual&&<><p>每次同时消耗本祈唤 1 次和所属魔契师契约位 1 枚{payment?`，以 ${payment.level} 环施法`:''}。</p><ul aria-label="双资源余额">{payment?.debits?.map(debit=>{const resource=c.runtime.resources[debit.resourceId],pact=/^pact-slot:([1-9])$/.exec(debit.resourceId);return <li key={debit.resourceId} data-payment-resource={debit.resourceId}>{pact?`${pact[1]}环契约位`:'本祈唤次数'}：{resource?.current??0} / {resource?.max??0}（消耗 {debit.cost}）</li>;})}</ul><small>不能用普通法术位替代；目标、豁免、专注、持续及法术效果仍需手动处理，不豁免材料成分。</small></>}
  {limited&&<><label><input type="checkbox" aria-label="确认有限来源本次施法当前仍有效" checked={currentValid} disabled={restricted||!enabled||feedback.busy||!payment?.available} onChange={event=>setCurrentValid(event.target.checked)}/>我已核对本次来源仍有效，本次施法满足当前条件。</label><small>每次须重新核对。只扣一次有限使用，不恢复；动作与施法时间、施法属性、攻击与 DC、材料、目标、伤害与效果、持续时间和专注均需人工处理，也不自动判定过期。</small></>}
  {charged&&<label><input type="checkbox" aria-label="确认本次物品充能施法当前有效" checked={currentValid} disabled={restricted||!enabled||feedback.busy||!payment?.available} onChange={event=>setCurrentValid(event.target.checked)}/>我已重新核对当前实物持用／穿戴、同调和来源，本次施法满足当前条件。此确认只用于本次记账，不是自动资格判定。</label>}
  <div className="spell-action-buttons"><button className="primary" disabled={restricted||!payment?.available||!enabled||feedback.busy||(limited||charged)&&!currentValid} onClick={()=>{if(!restricted&&(!(limited||charged)||currentValid)){feedback.run(id,selected,payment?.label||'施法','cast',charged?{confirmedCurrentItemCastValid:true}:limited?{confirmedLimitedSourceValid:true}:{});setCurrentValid(false);}}}>{feedback.busy?'等待确认…':charged?'记录施法并支付物品充能':'使用'}</button>{charged&&<button onClick={()=>{feedback.cancel();setCurrentValid(false);}}>取消本次物品施法</button>}{config?.mode==='uses'&&!limited&&!charged&&<button disabled={restricted||!enabled||feedback.busy||dual&&!restore?.available} onClick={recover}>{dual?'确认已长休，恢复本祈唤次数':config.sourceGrant?.resourceKey?'恢复共用次数':'恢复次数'}</button>}</div>
  {dual&&<small>此恢复只处理本祈唤次数；契约位仍需在原有资源设置中手动调整，不会执行完整休息。{restricted?' 当前为只读，不能施法或恢复。':''}</small>}
  {!payment?.available&&payment?.reason&&<small>{payment.reason}</small>}
  {dual&&restore?.reason&&<small>{restore.reason}</small>}
  <SpellActionFeedback action={feedback.action}/>
 </div>;
}
