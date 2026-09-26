import type {Entry} from '../core/model';
import {spellLearners} from '../core/spellLearners';
import {Reference} from './Reference';
import {SourceName} from './SourceName';
export function SpellLearners({entry,onLink}:{entry:Entry;onLink?:(reference:string,kind?:string)=>void}){
  if(entry.kind!=='spell')return null;
  const groups=spellLearners(entry);
  return <section className="spell-learners" aria-label="谁能学"><h4>谁能学</h4>{groups.length?groups.map(group=><p key={group.label}><strong>{group.label}：</strong>{group.learners.map((item,index)=><span key={`${item.kind}:${item.reference}`}>{index>0?'、':''}<Reference reference={item.reference} kind={item.kind} onClick={()=>onLink?.(item.reference,item.kind)}>{item.name}</Reference> <small>（<SourceName id={item.source}/>）</small></span>)}</p>):<p>当前资料未提供可学习者名单，请核对职业或特性说明。</p>}</section>;
}
