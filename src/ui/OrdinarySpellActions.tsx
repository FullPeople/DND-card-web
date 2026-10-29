import {useEffect,useState} from 'react';
import type {Character} from '../core/model';
import {spellPayments} from '../core/automation/actions';
import type {Edit} from './CharacterPages';
import {SpellActionFeedback,useSpellActionFeedback} from './SpellActionFeedback';

/** Ordinary owned readiness only. Source, special and book-ritual payments are
 * deliberately excluded, even when their offer is available. */
export function OrdinarySpellActions({c,id,edit,readOnly=false}:{c:Character;id:string;edit:Edit;readOnly?:boolean}){
 const [caster,setCaster]=useState(''),[chosen,setChosen]=useState(''),feedback=useSpellActionFeedback(c,edit,readOnly);
 const offer=spellPayments(c,id,feedback.authority,caster||undefined),options=offer.options.filter(row=>row.id.startsWith('ordinary:'));
 const selected=chosen||options[0]?.id||'',payment=options.find(row=>row.id===selected),restricted=!feedback.authority.canEdit;
 const casterBasis=JSON.stringify([c.id,id,c.edition,c.profile,c.automation,c.spellSettings?.modeOverride,c.spellSettings?.prepared,c.spellSettings?.classSpells,c.spellSettings?.cantrips,offer.casters,feedback.authority,c.selections.map(row=>[row.id,row.entry,row.level,row.parentId,row.grantKey])]);
 useEffect(()=>{setCaster('');setChosen('');},[casterBasis]);
 return <div className="source-spell-actions" data-ordinary-spell-actions="">
  {offer.casters&&offer.casters.length>1&&<label>本次施法职业<select aria-label="普通施法职业" value={caster} disabled={restricted||feedback.busy} onChange={event=>{setCaster(event.target.value);setChosen('');}}><option value="">请选择本次所属职业</option>{offer.casters.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
  {options.length>1?<label>本次支付<select aria-label="普通施法消耗" value={selected} disabled={restricted||feedback.busy} onChange={event=>setChosen(event.target.value)}>{options.map(row=><option key={row.id} value={row.id} disabled={!row.available}>{row.label}</option>)}</select></label>:<small>{payment?.label||offer.ordinaryReason||offer.reason}</small>}
  <p>只记录本次普通职业施法与已选自动法术位的消耗，不授予新法术，不处理目标、材料、攻击、豁免 DC、伤害、持续、专注或升环效果；这些仍需人工核对。</p>
  {payment?.reason&&<small>{payment.reason}</small>}
  <div className="spell-action-buttons"><button className="primary" disabled={restricted||feedback.busy||!payment?.available} onClick={()=>{if(!restricted&&payment?.available)feedback.run(id,payment.id,payment.label,'cast',{casterId:offer.casterId});}}>记录普通施法</button></div>
  <SpellActionFeedback action={feedback.action}/>
 </div>;
}
