import {useState,type KeyboardEvent} from 'react';
import type {Character} from '../core/model';
import type {Edit} from './CharacterPages';
import {spellPayments} from '../core/automation/actions';
import {sourceSpellEnabled} from '../core/automation/sourceSpellState';
import {SpellActionFeedback,useSpellActionFeedback} from './SpellActionFeedback';

export function SourceSpellActions({c,id,edit}:{c:Character;id:string;edit:Edit}){
 const offer=spellPayments(c,id),config=c.spellSettings?.special?.[id];
 const [chosen,setChosen]=useState(''),feedback=useSpellActionFeedback(c,edit);
 const selected=chosen||offer.options[0]?.id||'',payment=offer.options.find(p=>p.id===selected),enabled=sourceSpellEnabled(c,id);
 const available=offer.options.filter(option=>option.available);
 function navigate(event:KeyboardEvent<HTMLButtonElement>,id:string){
  const index=available.findIndex(option=>option.id===id),next=['ArrowRight','ArrowDown'].includes(event.key)?(index+1)%available.length:['ArrowLeft','ArrowUp'].includes(event.key)?(index+available.length-1)%available.length:event.key==='Home'?0:event.key==='End'?available.length-1:-1;
  if(next<0||!available[next])return;event.preventDefault();setChosen(available[next].id);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=radio]:not(:disabled)')[next]?.focus();
 }
 return <div className="source-spell-actions">
  {offer.options.length>1?<div className="spell-payment-choices" role="radiogroup" aria-label={`${c.selections.find(s=>s.id===id)?.entry.name}施法消耗`}>{offer.options.map(option=><button key={option.id} type="button" role="radio" aria-checked={selected===option.id} tabIndex={option.id===(available.find(row=>row.id===selected)?.id||available[0]?.id)?0:-1} disabled={!enabled||!option.available||feedback.busy} onKeyDown={event=>navigate(event,option.id)} onClick={()=>setChosen(option.id)}><b>{option.label}</b>{option.reason&&<small>{option.reason}</small>}</button>)}</div>:<small>{payment?.label||offer.reason}</small>}
  <div className="spell-action-buttons"><button className="primary" disabled={!payment?.available||!enabled||feedback.busy} onClick={()=>feedback.run(id,selected,payment?.label||'施法')}>{feedback.busy?'等待确认…':'使用'}</button>{config?.mode==='uses'&&<button disabled={!enabled||feedback.busy} onClick={()=>feedback.run(id,'source','恢复来源次数','restore')}>{config.sourceGrant?.resourceKey?'恢复共用次数':'恢复次数'}</button>}</div>
  {!payment?.available&&payment?.reason&&<small>{payment.reason}</small>}
  <SpellActionFeedback action={feedback.action}/>
 </div>;
}
