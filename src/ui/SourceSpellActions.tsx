import {useState,type KeyboardEvent} from 'react';
import type {Character} from '../core/model';
import type {Edit} from './CharacterPages';
import {spellPayments,sourceSpellRestoreOffer} from '../core/automation/actions';
import {sourceSpellEnabled} from '../core/automation/sourceSpellState';
import {SpellActionFeedback,useSpellActionFeedback} from './SpellActionFeedback';
import {useChoiceWorkspace} from './ChoiceWorkspaceContext';

export function SourceSpellActions({c,id,edit,readOnly=false}:{c:Character;id:string;edit:Edit;readOnly?:boolean}){
 const offer=spellPayments(c,id),config=c.spellSettings?.special?.[id],workspace=useChoiceWorkspace();
 const [chosen,setChosen]=useState(''),feedback=useSpellActionFeedback(c,edit);
 const selected=chosen||offer.options[0]?.id||'',payment=offer.options.find(p=>p.id===selected),enabled=sourceSpellEnabled(c,id);
 const available=offer.options.filter(option=>option.available),dual=config?.sourceGrant?.usage==='invocation-pact',restore=dual?sourceSpellRestoreOffer(c,id):undefined,restricted=readOnly||dual&&workspace.canEdit===false;
 function recover(){
  if(restricted||feedback.busy||!enabled||dual&&!restore?.available)return;
  if(dual&&!window.confirm('确认角色已经完成长休？这里只恢复本祈唤的 1 次使用次数，不恢复契约位、生命值或其他资源。'))return;
  feedback.run(id,restore?.paymentId||'source',dual?'确认已长休，恢复本祈唤次数':'恢复来源次数','restore');
 }
 function navigate(event:KeyboardEvent<HTMLButtonElement>,id:string){
  const index=available.findIndex(option=>option.id===id),next=['ArrowRight','ArrowDown'].includes(event.key)?(index+1)%available.length:['ArrowLeft','ArrowUp'].includes(event.key)?(index+available.length-1)%available.length:event.key==='Home'?0:event.key==='End'?available.length-1:-1;
  if(next<0||!available[next])return;event.preventDefault();setChosen(available[next].id);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=radio]:not(:disabled)')[next]?.focus();
 }
 return <div className="source-spell-actions">
  {offer.options.length>1?<div className="spell-payment-choices" role="radiogroup" aria-label={`${c.selections.find(s=>s.id===id)?.entry.name}施法消耗`}>{offer.options.map(option=><button key={option.id} type="button" role="radio" aria-checked={selected===option.id} tabIndex={option.id===(available.find(row=>row.id===selected)?.id||available[0]?.id)?0:-1} disabled={restricted||!enabled||!option.available||feedback.busy} onKeyDown={event=>navigate(event,option.id)} onClick={()=>setChosen(option.id)}><b>{option.label}</b>{option.reason&&<small>{option.reason}</small>}</button>)}</div>:<small>{payment?.label||offer.reason}</small>}
  {dual&&<><p>每次同时消耗本祈唤 1 次和所属魔契师契约位 1 枚{payment?`，以 ${payment.level} 环施法`:''}。</p><ul aria-label="双资源余额">{payment?.debits?.map(debit=>{const resource=c.runtime.resources[debit.resourceId],pact=/^pact-slot:([1-9])$/.exec(debit.resourceId);return <li key={debit.resourceId} data-payment-resource={debit.resourceId}>{pact?`${pact[1]}环契约位`:'本祈唤次数'}：{resource?.current??0} / {resource?.max??0}（消耗 {debit.cost}）</li>;})}</ul><small>不能用普通法术位替代；目标、豁免、专注、持续及法术效果仍需手动处理，不豁免材料成分。</small></>}
  <div className="spell-action-buttons"><button className="primary" disabled={restricted||!payment?.available||!enabled||feedback.busy} onClick={()=>{if(!restricted)feedback.run(id,selected,payment?.label||'施法');}}>{feedback.busy?'等待确认…':'使用'}</button>{config?.mode==='uses'&&<button disabled={restricted||!enabled||feedback.busy||dual&&!restore?.available} onClick={recover}>{dual?'确认已长休，恢复本祈唤次数':config.sourceGrant?.resourceKey?'恢复共用次数':'恢复次数'}</button>}</div>
  {dual&&<small>此恢复只处理本祈唤次数；契约位仍需在原有资源设置中手动调整，不会执行完整休息。{restricted?' 当前为只读，不能施法或恢复。':''}</small>}
  {!payment?.available&&payment?.reason&&<small>{payment.reason}</small>}
  {dual&&restore?.reason&&<small>{restore.reason}</small>}
  <SpellActionFeedback action={feedback.action}/>
 </div>;
}
