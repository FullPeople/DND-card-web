import {useLayoutEffect,useRef,useState} from 'react';
import type {Character} from '../core/model';
import type {Edit} from './CharacterPages';
import {grimoireHoldingOffers,grimoireHoldingRequest,performGrimoireHolding} from '../core/automation/arcaneGrimoireHolding';
import {grimoireHoldingEdit} from './arcaneGrimoireHoldingSubmission';
import {useSpellActionFeedback} from './SpellActionFeedback';
import {useRetainedCardActive} from './RetainedCardVisibility';
export function ArcaneGrimoireHoldingControls({c,edit}:{c:Character;edit:Edit}){
 const access=useSpellActionFeedback(c,edit,false),active=useRetainedCardActive(),offers=grimoireHoldingOffers(c,access.authority),epoch=useRef(0),mounted=useRef(false),flight=useRef(false),live=useRef({c,active});live.current={c,active};
 const [message,setMessage]=useState(''),basis=offers.map(o=>o.basis).join('|');
 useLayoutEffect(()=>{epoch.current++;flight.current=false;setMessage('');},[c.id,basis,active,access.authority.canEdit,access.authority.gm]);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 function change(selectionId:string,held:boolean){
  const current=offers.find(o=>o.selectionId===selectionId);if(!current||!active||flight.current||!(held?current.canSet:current.canWithdraw))return;
  const token=epoch.current,scope=c.id,request=grimoireHoldingRequest(c,selectionId,held);let used=false;flight.current=true;setMessage('等待确认持握意图；未改库存或资源。');
  try{edit(grimoireHoldingEdit(draft=>{if(used)return;used=true;const authority=access.liveAuthority();if(!mounted.current||epoch.current!==token||live.current.c.id!==scope||draft.id!==scope||!live.current.active||authority.canEdit!==true){if(mounted.current){flight.current=false;setMessage('卡面或权限已变化，未修改。');}return;}
   const applied=performGrimoireHolding(draft,request,authority);if(mounted.current){flight.current=false;setMessage(applied?'持握意图已提交，请查看保存状态。':'当前来源或物品已变化，未修改。');}
  }));}catch(error){flight.current=false;if(mounted.current)setMessage(error instanceof Error?error.message:'未修改持握意图。');}
 }
 if(!offers.length)return null;
 return <section aria-label="奥法秘典持握"><h4>当前持握（不等于装备）</h4>{offers.map(o=><div key={o.selectionId} data-grimoire-holding={o.selectionId}><strong>{o.name}</strong><button type="button" aria-label={o.held?'停止持握秘典':'开始持握秘典'} disabled={!active||!(o.held?o.canWithdraw:o.canSet)} onClick={()=>change(o.selectionId,!o.held)}>{o.held?'停止持握':'开始持握'}</button><span role="status">{o.reason||'仅记录本实物持握；不要求装备或用本书处理材料。法术书、材料及奥术回想仍人工处理。'}</span></div>)}<small>本批支持已核 PHB2014 法师来源；旧客户端或备份可能丢失未知持握记录，重开后请核对。</small>{message&&<p role="status">{message}</p>}</section>;
}
