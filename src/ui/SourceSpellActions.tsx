import {useState} from 'react';
import type {Character} from '../core/model';
import type {Edit} from './CharacterPages';
import {performSpellAction,spellActionRequest,spellPayments,type SpellActionResult} from '../core/automation/actions';
import {sourceSpellEnabled} from '../core/automation/sourceSpellState';

export function SourceSpellActions({c,id,edit}:{c:Character;id:string;edit:Edit}){
 const offer=spellPayments(c,id),config=c.spellSettings?.special?.[id];
 const [chosen,setChosen]=useState(''),[message,setMessage]=useState('');
 const selected=chosen||offer.options[0]?.id||'',payment=offer.options.find(p=>p.id===selected),enabled=sourceSpellEnabled(c,id);
 function run(mode:'cast'|'restore'){
  const request=spellActionRequest(c,id,mode==='restore'?'source':selected,crypto.randomUUID(),mode);let result:SpellActionResult|undefined;
  edit(draft=>{result=performSpellAction(draft,request);});
  if(result)setMessage(result.message);
 }
 return <div className="source-spell-actions">
  {offer.options.length>1?<select aria-label={`${c.selections.find(s=>s.id===id)?.entry.name}施法消耗`} value={selected} onChange={e=>{setChosen(e.target.value);setMessage('');}}>{offer.options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select>:<small>{payment?.label||offer.reason}</small>}
  <div><button disabled={!payment?.available||!enabled} onClick={()=>run('cast')}>使用</button>{config?.mode==='uses'&&<button disabled={!enabled} onClick={()=>run('restore')}>{config.sourceGrant?.resourceKey?'恢复共用次数':'恢复次数'}</button>}</div>
  {!payment?.available&&payment?.reason&&<small>{payment.reason}</small>}
  {message&&<small role="status">{message}</small>}
 </div>;
}
