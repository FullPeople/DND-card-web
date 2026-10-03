import type {Character} from '../core/model';
import {signed} from '../core/model';
import {armorAdjustmentReview,resolveLegacyArmorAdjustments} from '../core/armorAdjustments';
import {NumberInput} from './NumberInput';

export function ArmorAdjustmentReview({c,edit}:{c:Character;edit:(fn:(draft:Character)=>void)=>void}){
 const review=armorAdjustmentReview(c),pending=review.records.length>0;
 return <section aria-label="护甲调整与旧覆盖核对">
  <p>护甲等级由规则、装备和特性计算，只能通过调整值加减。调整值归零即可撤回，不覆盖基础计算。</p>
  {pending?<div role="alert"><p>这张卡保留了旧护甲最终值覆盖，仍会遮住规则变化。请核对后选择如何移除；读取和场景同步不会替你决定。</p>
   {review.records.map((row,index)=><p key={`${row.id}:${index}`}>旧记录：{row.value} · {row.reason}</p>)}
   <p>当前护甲 {review.previousTotal}；规则计算 {review.ruleTotal}；已有调整 {signed(review.previousBonus)}。</p>
   <div className="dialog-actions"><button onClick={()=>edit(draft=>resolveLegacyArmorAdjustments(draft,'restore'))}>恢复规则计算（护甲 {review.ruleTotal+review.previousBonus}）</button><button disabled={Math.abs(review.convertedBonus)>9999} onClick={()=>edit(draft=>resolveLegacyArmorAdjustments(draft,'convert'))}>将当前总值转为调整 {signed(review.convertedBonus)}</button></div>
   <p className="muted">恢复规则计算会保留已有调整。转换按当前规则计算差额，之后规则变化仍生效；两种操作都会保存旧记录，且可撤销。</p>
  </div>:<label>护甲调整值<NumberInput aria-label="数值面板护甲调整值" type="number" min="-9999" max="9999" value={c.sheetBonuses?.ac||0} onChange={event=>{const value=Number(event.target.value);if(Number.isFinite(value))edit(draft=>{draft.sheetBonuses={...draft.sheetBonuses,ac:Math.max(-9999,Math.min(9999,value))};});}}/></label>}
  {!!c.armorAdjustmentHistory?.length&&<details><summary>已处理的旧护甲记录</summary>{c.armorAdjustmentHistory.map((record,index)=><div key={index}><p>{record.action==='restore'?'恢复规则计算':'转换为调整'}：原总值 {record.previousTotal}，当时规则 {record.ruleTotal}，调整 {signed(record.previousBonus)} → {signed(record.resultingBonus)}</p>{record.records.map((row,i)=><p key={`${row.id}:${i}`}>{row.id} · {row.value} · {row.reason}</p>)}</div>)}</details>}
 </section>;
}
