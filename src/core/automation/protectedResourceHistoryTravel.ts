import {validateItemAtWillState} from './itemAtWill';
import {validateChargedItemSpellState,chargedItemSpellAuthorityReason,chargedItemSpellBoundCastReceipt} from './chargedItemSpells';
import {optionalClassListAuthorityReason,validateOptionalClassListState} from './optionalClassSpellLists';
import type {Character,RuntimeResource} from '../model';
import {validateLimitedSourceUseState,ownedLimitedSourceResource} from './limitedSourceUses';
import {validateItemChargeDebitState,ownedItemChargeResource,itemChargeHasVariableHistory,itemChargeVariableAuthorityReason} from './itemChargeDebits';
import {liveSpellActionAuthority,spellActionAuthorityReason,type SpellActionAuthority} from './spellActionAuthority';
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const mechanics=(r:RuntimeResource|undefined)=>r&&[r.current,r.max,r.unlimited,r.automatic,r.featureGrant,r.sourceSpellGrant,r.limitedSourceUseGrant,r.itemChargeDebitGrant,(r as any).recovery,r.locked];
/** Explicit authorized Undo/redo may reverse bookkeeping. This guard neither
 * projects irreversible history nor repairs a damaged/unknown ledger. */
export function assertProtectedResourceHistoryTravel(live:Character,candidate:Character,authority?:SpellActionAuthority):void{
 if(!same(live.automation?.chargedItemSpells,candidate.automation?.chargedItemSpells)){
  const pools=[live,candidate].flatMap(card=>{const rows=card.automation?.chargedItemSpells?.records;return Array.isArray(rows)?rows.map(row=>row.poolKey).filter((key):key is string=>typeof key==='string'):[];}),issue=chargedItemSpellAuthorityReason(live,authority,[...new Set(pools)]);if(issue)throw Error(issue);
  for(const card of [live,candidate]){const value=card.automation?.chargedItemSpells;validateChargedItemSpellState(value);if(value&&value.version!==1)throw Error('未知版本的物品施法确认不能通过撤销或重做修改。');}
 }
 if(!same(live.runtime.automationActions,candidate.runtime.automationActions)&&(live.runtime.automationActions?.last?.itemChargedSpell!==undefined||candidate.runtime.automationActions?.last?.itemChargedSpell!==undefined)){
  const keys=[live,candidate].map(card=>card.runtime.automationActions?.last?.resourceId).filter((key):key is string=>typeof key==='string'),issue=chargedItemSpellAuthorityReason(live,authority,keys);if(issue)throw Error(issue);
  for(const card of [live,candidate]){const last=card.runtime.automationActions?.last;if(last?.itemChargedSpell!==undefined&&!chargedItemSpellBoundCastReceipt(card,last.selectionId,last.id))throw Error('物品施法与原充能支出无法共同核实；未通过历史修复。');}
 }
 if(!same(live.automation?.optionalClassSpellLists,candidate.automation?.optionalClassSpellLists)){
  const denied=optionalClassListAuthorityReason(live,authority!);if(denied)throw Error(denied);
  for(const card of [live,candidate]){const value=card.automation?.optionalClassSpellLists;validateOptionalClassListState(value);if(value&&value.version!==1)throw Error('未知版本的可选职业法表确认不能通过撤销或重做修改。');}
 }
 if(!same(live.automation?.itemAtWill,candidate.automation?.itemAtWill)){
  const denied=spellActionAuthorityReason(live,authority);if(denied)throw Error(denied);
  for(const card of [live,candidate]){const value=card.automation?.itemAtWill;validateItemAtWillState(value);if(value&&value.version!==1)throw Error('未知版本的物品随意施法确认不能通过撤销或重做修改。');}
 }
 const groups=[{name:'limitedSourceUses' as const,validate:validateLimitedSourceUseState,owns:ownedLimitedSourceResource,marker:'limitedSourceUseGrant' as const},{name:'itemChargeDebits' as const,validate:validateItemChargeDebitState,owns:ownedItemChargeResource,marker:'itemChargeDebitGrant' as const}];
 const allKeys=new Set([...Object.keys(live.runtime.resources),...Object.keys(candidate.runtime.resources)]),locked=new Set<string>();let changed=false;
 for(const group of groups){
  const keys=[...allKeys].filter(id=>group.owns(live,id)||group.owns(candidate,id));
  if(same(live.runtime[group.name],candidate.runtime[group.name])&&!keys.some(id=>!same(mechanics(live.runtime.resources[id]),mechanics(candidate.runtime.resources[id]))))continue;
  changed=true;for(const id of keys)locked.add(id);
  if(group.name==='itemChargeDebits'&&(live.runtime.itemChargeDebits?.version===2||candidate.runtime.itemChargeDebits?.version===2||itemChargeHasVariableHistory(live)||itemChargeHasVariableHistory(candidate))){const issue=itemChargeVariableAuthorityReason(live,authority,keys);if(issue)throw Error(issue);}
  for(const card of [live,candidate]){
   const store=card.runtime[group.name];group.validate(store);if(store===undefined)continue;if(store.version!==1&&!(group.name==='itemChargeDebits'&&store.version===2))throw Error('未知版本的受保护充能历史不能通过撤销或重做修改。');
   for(const record of store.records){const r=card.runtime.resources[record.key];if(!r||r.current!==record.initial-record.spent||r.max!==record.capacity||(r.unlimited!==undefined&&r.unlimited!==false)||(r.automatic!==undefined&&r.automatic!==false)||r.featureGrant!==undefined||r.sourceSpellGrant!==undefined||r[group.marker]?.key!==record.key||group.marker==='itemChargeDebitGrant'&&(r.limitedSourceUseGrant!==undefined||(r as any).recovery!==undefined)||group.marker==='limitedSourceUseGrant'&&r.itemChargeDebitGrant||r.locked!==undefined&&typeof r.locked!=='boolean')throw Error('受保护充能镜像与历史不一致，未通过撤销或重做修复。');}
  }
 }
 if(!changed)return;
 const denied=spellActionAuthorityReason(live,authority,[...locked]);if(denied)throw Error(denied);
 const current=liveSpellActionAuthority(authority);for(const id of locked){const before=live.runtime.resources[id],after=candidate.runtime.resources[id];if(after?.locked!==undefined&&typeof after.locked!=='boolean'||!!before?.locked!==!!after?.locked&&!current.gm)throw Error('受保护资源锁定设置需要当前明确主持人权限。');}
}
