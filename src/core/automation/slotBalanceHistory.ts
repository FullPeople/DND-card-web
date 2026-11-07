import type {Character,RuntimeResource} from '../model';
import {automaticSlotCounter,currentSlotCapacityReview,validateSlotCapacityReview} from './slotCapacityReview';
import {liveSpellActionAuthority,spellActionAuthorityReason,type SpellActionAuthority} from './spellActionAuthority';
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const mechanics=(r:RuntimeResource|undefined)=>r&&[r.current,r.max,r.automatic,r.unlimited,r.locked,r.featureGrant,r.sourceSpellGrant,r.limitedSourceUseGrant,r.itemChargeDebitGrant];
const balanceMechanics=(r:RuntimeResource|undefined)=>r&&[r.current,r.max,r.automatic,r.unlimited,r.featureGrant,r.sourceSpellGrant,r.limitedSourceUseGrant,r.itemChargeDebitGrant];
/** Guard explicit history/edit transactions. Ordinary projections remain pure;
 * opaque or torn accounting is never repaired by Undo, redo or a generic form. */
export function assertSlotBalanceHistoryTravel(live:Character,candidate:Character,authority?:SpellActionAuthority):void{
 if(live.runtime.slotCapacityReview===undefined&&candidate.runtime.slotCapacityReview===undefined)return;
 const before=currentSlotCapacityReview(live),after=currentSlotCapacityReview(candidate);
 const ids=Array.from({length:9},(_,i)=>`spell-slot:${i+1}`);
 const changed=ids.filter(id=>{
  const a=live.runtime.resources[id],b=candidate.runtime.resources[id],level=id.split(':')[1];
  const owned=!!a&&automaticSlotCounter(a)||!!b&&automaticSlotCounter(b);
  return owned&&(!same(mechanics(a),mechanics(b))||!same(live.spellSettings?.slots[level],candidate.spellSettings?.slots[level]))||!same(before?.balances?.[id],after?.balances?.[id])||!same(before?.pending[id],after?.pending[id]);
 });
 if(!changed.length&&same(live.runtime.slotCapacityReview,candidate.runtime.slotCapacityReview))return;
 const denied=spellActionAuthorityReason(live,authority);if(denied)throw Error(denied);
 const access=liveSpellActionAuthority(authority);
 for(const card of [live,candidate]){validateSlotCapacityReview(card.runtime.slotCapacityReview);if(card.runtime.slotCapacityReview&&card.runtime.slotCapacityReview.version!==1)throw Error('其他版本的法术位余额不能通过撤销、重做或资源设置修改。');}
 for(const id of changed){
  const a=live.runtime.resources[id],b=candidate.runtime.resources[id],level=id.split(':')[1];
  if((a?.locked||!!a?.locked!==!!b?.locked)&&!access.gm)throw Error('法术位已锁定，需要当前主持人权限。');
  if(before?.pending[id]&&after?.pending[id]&&(!same(balanceMechanics(a),balanceMechanics(b))||!same(live.spellSettings?.slots[level],candidate.spellSettings?.slots[level])))throw Error('该法术位余额尚待核对，不能通过资源设置或历史修改。');
  if(before?.pending[id]&&after&&!after.pending[id]){
   const receipt=after.lastConfirmation;
   if(!receipt||receipt.resourceId!==id||receipt.max!==b?.max||receipt.remaining!==b?.current)throw Error('缺少对应的法术位余量确认，原记录保留。');
  }
  for(const card of [live,candidate]){
   const state=currentSlotCapacityReview(card),r=card.runtime.resources[id],balance=state?.balances?.[id],mirror=card.spellSettings?.slots[level];
   if(!state||state.pending[id]||!balance||!r||!automaticSlotCounter(r))continue;
   if(r.max!==balance.max||r.current!==balance.current||mirror&&(mirror.max!==r.max||mirror.used!==r.max-r.current))throw Error('法术位余量与消耗历史不一致，未通过历史或资源设置修复。');
  }
 }
}
