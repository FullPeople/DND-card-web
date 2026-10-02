import {useEffect,useMemo,useState} from 'react';
import type {Character,Entry} from '../core/model';
import {bookRitualGroups,bookRitualPaymentId,BOOK_RITUAL_TIME} from '../core/bookRituals';
import {automationEnabled} from '../core/automation/state';
import {performSpellAction,spellActionRequest,type SpellActionResult} from '../core/automation/actions';
import {SheetCell} from './SheetCell';
import {Reference} from './Reference';
import './bookRituals.css';

/** Another view of the same book rows, never another prepared or learned list. */
export function BookRituals({c,edit,inspect,readOnly=false}:{c:Character;edit:(action:(draft:Character)=>void)=>void;inspect:(entry:Entry)=>void;readOnly?:boolean}){
 const groups=useMemo(()=>bookRitualGroups(c),[c]),[message,setMessage]=useState('');
 useEffect(()=>setMessage(''),[c.id]);
 if(!groups.length)return null;
 const enabled=automationEnabled(c)&&!readOnly;
 function cast(selectionId:string,ownerId:string){
  const request=spellActionRequest(c,selectionId,bookRitualPaymentId(ownerId),crypto.randomUUID());let result:SpellActionResult|undefined;
  edit(draft=>{result=performSpellAction(draft,request);});
  if(result)setMessage(result.message);
 }
 return <SheetCell label="书内仪式" className="book-ritual-cell">
  <p className="spell-group-hint">无需预备，不占预备格。{BOOK_RITUAL_TIME}施法时须阅读法术书。</p>
  {groups.map(group=><section key={group.owner.id} className="book-ritual-group" data-ritual-owner={group.owner.id}>
   {groups.length>1&&<h4>{group.owner.entry.name}</h4>}
   {group.reason?<p className="spell-group-hint" role="note">{group.reason}</p>:<>
    <small className="book-ritual-source">资格来源：{group.source!.entry.name}</small>
    {group.spells.length?<div className="book-ritual-grid">{group.spells.map(row=><div key={row.id} className="book-ritual-row" data-ritual-spell-id={row.id}>
     <Reference reference={`entry:${row.entry.id}`} entry={row.entry} className="feature-caption" commitOnClick={false} onClick={()=>inspect(row.entry)}>{row.entry.name}</Reference>
     <button className="book-ritual-cast" disabled={!enabled} aria-label={`${row.entry.name}仪式施法`} onClick={()=>cast(row.id,group.owner.id)}>仪式施法</button>
    </div>)}</div>:<p className="spell-group-hint">法术书中尚无符合条件的仪式法术。</p>}
   </>}
  </section>)}
  {!automationEnabled(c)&&<p className="spell-group-hint">自动化已关闭，仪式资格仅供查阅。</p>}
  {message&&<p className="spell-group-hint" role="status">{message}</p>}
 </SheetCell>;
}
