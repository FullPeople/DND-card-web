import type {Character} from '../model';
import {evaluate} from '../engine';
import {spellState,spellValues} from '../characterDetails';
import {ordinarySpellOffer} from './ordinarySpellCasting';
import {arcaneGrimoireRule,grimoireHoldingOffers,verifiedGrimoireWizard,grimoireHoldingDataSafe} from './arcaneGrimoireHolding';
import {projectItemCastingBonuses} from './itemCastingBonuses';
import type {SpellActionAuthority} from './spellActionAuthority';
export interface GrimoireSpellProjection {values?:{attack:number;dc:number};bonus?:number;reason?:string}
/** Pure per-cast view. Read permission/payment balance never grants or removes
 * the already-proven recipient; ordinary action keeps its own payment gates. */
export function arcaneGrimoireSpellValues(c:Character,spellId:string,casterId:string|undefined,authority:SpellActionAuthority):GrimoireSpellProjection{
 if(!grimoireHoldingDataSafe(c))return {reason:'当前卡面含未知数据结构，持握数值暂停，原数据保留。'};
 const holdings=grimoireHoldingOffers(c,authority);if(!holdings.length)return {};
 const offer=ordinarySpellOffer(c,spellId,casterId,authority);
 if(!casterId||offer.casterId!==casterId)return {reason:'尚未核实本次普通施法职业与实际已学习／预备归属；不推断秘典加值。'};
 const caster=offer.casters.find(p=>p.id===casterId);if(!caster||!['int','wis','cha'].includes(caster.ability))return {reason:'当前施法属性尚未核验。'};
 const d=evaluate(c),settings=spellState(c,d),ability=settings.abilityOverride?settings.ability:caster.ability as 'int'|'wis'|'cha',values=spellValues(c,d,ability,{casterId}),held=holdings.filter(o=>o.held);
 if(!held.length)return {values,bonus:0,reason:holdings.find(o=>o.reason)?.reason||'未记录已核当前持握；仅显示原有普通施法数值。'};
 const wizard=verifiedGrimoireWizard(c);if(!wizard||wizard.id!==casterId)return {values,bonus:0,reason:'当前并非法师施法归属；不借用秘典加值。'};
 if(settings.abilityOverride&&settings.ability!=='int')return {values,bonus:0,reason:'非原生手工施法属性的秘典投影暂未受审（技术限制，非书本规则）；原设置保留。'};
 const one=held[0];if(!one.active||!one.rank)return {values,bonus:0,reason:one.reason||'当前持握意图暂停。'};
 const concurrent=c.selections.filter(s=>arcaneGrimoireRule(s.entry)&&s.attuned===true&&s.quantity>0);
 if(held.length!==1||concurrent.length!==1)return {values,bonus:0,reason:'多个当前同调秘典或等阶并存，叠加政策技术暂停；不相加、不自动选最高。'};
 if(projectItemCastingBonuses(c,{ability,casterId}).grants.length)return {values,bonus:0,reason:'秘典与其他生效施法物品的叠加组合尚未受审；保留原数值，仅暂停新增秘典加值。'};
 return {values:{attack:values.attack+one.rank,dc:values.dc+one.rank},bonus:one.rank,reason:`${one.name}：已核当前同调、持握与本次法师法术归属，攻击／DC +${one.rank}。材料、实体法术书及奥术回想仍需人工处理。`};
}
