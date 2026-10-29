import type {Character,Derived,Entry,Issue,Selection} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {armorRule,armorType,type ArmorReport} from './equipment';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './racialNaturalArmorEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};

export type RacialNaturalArmorRule=typeof evidence.rules[number];
export interface RacialNaturalArmorContext {modifiers:Derived['modifiers'];armor?:ArmorReport;explicitBaseOverride?:number}
export interface RacialNaturalArmorGrant {selectionId:string;entryId:string;source:string;operation:'alternative-base'|'additive-bonus';value:number;modifier:'dex'|'con'|'none';wearingPolicy:string;snapshotSha256:string}
export interface RacialNaturalArmorProjection {base?:number;bonus:number;trace:string[];issues:Issue[];grants:RacialNaturalArmorGrant[]}
const rules=new Map(evidence.rules.map(rule=>[rule.id,rule])),canonical=new Set(ordinary.canonicalIds);
const validIdentity=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=2000&&!value.includes('\0');
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
export const racialNaturalArmorSnapshot=(value:unknown)=>sourceTextSha256(JSON.stringify(sorted(value)));

/** Recognition locates a complete proof; names never grant a formula or bonus. */
export function racialNaturalArmorFamilyId(entry:Entry):string|undefined{
 if(!entry||typeof entry!=='object')return;const exact=typeof entry.id==='string'&&rules.get(entry.id);if(exact)return exact.id;
 const matches=evidence.rules.filter(rule=>rule.packId===entry.packId&&rule.source===entry.source&&rule.name===entry.name&&rule.english===entry.english&&rule.category===entry.raw?._category);return matches.length===1?matches[0].id:undefined;
}
export function racialNaturalArmorRule(entry:Entry):RacialNaturalArmorRule|undefined{
 const id=racialNaturalArmorFamilyId(entry),rule=id&&rules.get(id);
 if(!rule||entry.kind!=='race'||!validIdentity(entry.id)||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==rule.id&&canonical.has(entry.id)||entry.packId!==rule.packId||entry.source!==rule.source||entry.edition!==rule.edition||entry.name!==rule.name||entry.english!==rule.english||(entry.page??null)!==rule.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._category!==rule.category||rule.category!=='race'||Object.hasOwn(entry.raw,'_copy')||entry.raw._unresolvedParent||entry.raw._versionBaseName)return;
 try{const hash=racialNaturalArmorSnapshot({...entry,id:rule.id,revision:rule.revision});if(rule.forms.some(form=>form.canonicalReboundSnapshotSha256===hash))return rule;}catch{/* Never repair an unknown complete snapshot. */}
}

/** Only the source-owned calculation/flat bonus is projected. The caller retains
 * explicit base overrides, existing armor/shield bonuses, final manual totals
 * and independent sheet offsets in their established order. No card mutation. */
export function projectRacialNaturalArmor(c:Character,context:RacialNaturalArmorContext,providedActive?:readonly Selection[]):RacialNaturalArmorProjection{
 const out:RacialNaturalArmorProjection={bonus:0,trace:[],issues:[],grants:[]},races=c.selections.filter(row=>row.entry.kind==='race'),candidate=races.find(row=>racialNaturalArmorFamilyId(row.entry));
 if(!candidate)return out;
 const hold=(code:string,message:string)=>{const text=`${candidate.entry.name}：${message}；原护甲、盾牌、手工最终值和独立卡面调整保留。`;out.issues.push({id:`racial-natural-armor:${code}:${candidate.id}`,selectionId:candidate.id,severity:'warning',message:text});out.trace.push(text);return out;};
 if(!automationEnabled(c))return hold('paused','天生护甲暂停：自动化关闭或协议未知');
 // A race is one source root, not an equipped/attuned inventory stack.
 if(races.length!==1||!Object.hasOwn(candidate,'id')||!validIdentity(candidate.id)||candidate.parentId!==undefined||candidate.grantKey!==undefined||candidate.requirementId!==undefined)return hold('owner','种族不是唯一有效完整根记录，不合并重复种族或别名');
 const rule=racialNaturalArmorRule(candidate.entry);if(!rule)return hold('unproved','完整来源、身份、版本、条款或快照尚未通过核对，不凭名称推定 AC');
 const disabled=c.profile.disabledEntries||[];
 if(disabled.includes(candidate.entry.id)||disabled.includes(rule.id)||rule.requiredSources.some(source=>!c.profile.enabledSources.includes(source)))return hold('source','当前来源、实际依赖或规范／实例身份已停用');
 const live=activeEffectSelections(c);
 if(!live.includes(candidate)||providedActive&&!providedActive.includes(candidate))return hold('inactive','当前真实种族归属未生效，外部列表不能代替当前归属');
 const policy=rule.policy;
 const grant=(operation:RacialNaturalArmorGrant['operation'],value:number,modifier:RacialNaturalArmorGrant['modifier'])=>{out.grants.push({selectionId:candidate.id,entryId:rule.id,source:rule.source,operation,value,modifier,wearingPolicy:policy.wearing,snapshotSha256:racialNaturalArmorSnapshot(candidate.entry)});};
 if(policy.operation==='additive-bonus'){
  if(policy.modifier!=='none'||policy.wearing!=='unconditional'||!Number.isSafeInteger(policy.constant)||policy.constant<=0)return hold('policy','固定加值政策未核实');
  out.bonus=policy.constant;grant('additive-bonus',policy.constant,'none');out.trace.push(`${rule.name} · ${rule.source}：来源明确的天生护甲 AC +${policy.constant}，不是另一套基础 AC。`);return out;
 }
 if(policy.operation!=='alternative-base'||!['dex','con','none'].includes(policy.modifier)||!Number.isSafeInteger(policy.constant))return hold('policy','基础 AC 政策未核实');
 if(context.explicitBaseOverride!==undefined)return hold('explicit-base','已有显式来源 AC 基础覆盖，不以新的天生护甲计算替换');
 const modifier=policy.modifier==='dex'?context.modifiers.dex:policy.modifier==='con'?context.modifiers.con:0;
 if(!Number.isFinite(modifier))return hold('modifier','当前实际派生属性调整值无效，未猜测或回退属性');
 const value=policy.constant+modifier;
 // Physical wearing is independent of active effect permission. A disabled or
 // unproved armor row is not silently unequipped to satisfy an unarmored clause.
 const worn=c.selections.filter(row=>row.entry.kind==='item'&&row.equipped&&row.quantity>0),body=worn.filter(row=>['LA','MA','HA'].includes(armorType(row.entry)||'')),unknown=worn.some(row=>!armorType(row.entry)&&(row.entry.raw?.armor===true||row.entry.raw?._customType==='armor'));
 if(unknown||body.length>1)return hold('wearing-unknown','当前身体护甲分类未知或同时穿戴多件护甲，新的基础 AC 暂缓');
 if(body.length){
  if(policy.wearing==='no-body-armor')return hold('body-armor','仍实际穿戴身体护甲；停用其来源不会满足未着甲条件');
  if(policy.wearing==='body-armor-prohibited-held'||policy.wearing==='body-armor-no-benefit-held')return hold('tortle-body-armor','此来源不允许身体护甲或声明其不提供好处；非法穿戴分支尚未执行，新的基础 17 暂缓，不自动脱甲');
  if(policy.wearing!=='natural-if-worn-lower')return hold('wearing-policy','身体护甲条件尚未核实');
  const row=body[0],raw=row.entry.raw;
  // Enchanted/attuned/variant comparisons are deliberately unqualified. Never
  // remove or reallocate bonusAc based on a scalar or another source's silence.
  if(raw.bonusAc!==undefined&&raw.bonusAc!==0&&raw.bonusAc!=='0'||raw.reqAttune||raw.rarity!==undefined&&raw.rarity!=='none'||raw._variantIdentity||raw.inherits||raw._copy||raw._unresolvedParent||raw.effects||row.entry.effects?.some(effect=>effect.op!=='proficiency'&&effect.target==='ac'))return hold('enchanted-body-armor','魔法、同调、变体或未知身体护甲的 AC 加值归属未核实，新的比较收益暂缓，不移除或叠加旧加值');
  if(!live.includes(row)||providedActive&&!providedActive.includes(row))return hold('body-source','实际穿戴护甲当前未获效果许可，不能猜测其与天生护甲的比较结果');
  const converted=armorRule(row),reported=context.armor?.rules.filter(rule=>rule.slot==='armor'),armor=converted.rule;
  if(!armor||converted.issues.length||armor.bonus!==0||armor.attunementRequired||!context.armor||reported?.length!==1||racialNaturalArmorSnapshot(reported[0])!==racialNaturalArmorSnapshot(armor))return hold('body-comparison','现有身体护甲计算不完整、未知或冲突，新的比较收益暂缓');
  const wornBase=armor.base+(armor.usesDex?Math.min(context.modifiers.dex,armor.dexCap??Infinity):0);
  if(!Number.isFinite(wornBase)||context.armor.base!==wornBase)return hold('body-comparison','当前身体护甲计算与实际派生调整值不一致，新的比较收益暂缓');
  if(value<=wornBase){out.trace.push(`${rule.name} · ${rule.source}：天生护甲基础 ${value} 不高于当前已核对的普通身体护甲 ${wornBase}，保留原计算；不叠加两种基础。`);return out;}
 }
 out.base=value;grant('alternative-base',value,policy.modifier as RacialNaturalArmorGrant['modifier']);
 out.trace.push(`${rule.name} · ${rule.source}：采用天生护甲基础 ${policy.constant}${policy.modifier==='none'?'（不计敏捷）':` + ${policy.modifier==='dex'?'敏捷':'体质'} ${modifier}`} = ${value}，替代而非叠加基础计算；盾牌只沿用既有护甲报告一次。`);
 if(rule.sourceProof.clauses.some(proof=>proof.role==='manual-hide'))out.trace.push('变色、躲藏动作、环境匹配和隐匿优势仍手工，不因 AC 计算自动授予。');
 return out;
}
