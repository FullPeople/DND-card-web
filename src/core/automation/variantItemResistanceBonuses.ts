import type {Character,Entry,Issue,Selection} from '../model';
import type {ItemResistanceType} from './itemResistanceBonuses';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {armorType} from './equipment';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './variantItemResistanceBonusEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};

export type VariantItemResistanceBonusRule=typeof evidence.rules[number];
const rules=new Map(evidence.rules.map(rule=>[rule.id,rule])),canonical=new Set(ordinary.canonicalIds);
const validIdentity=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=2000&&!value.includes('\0');
const validResistance=(value:unknown):value is ItemResistanceType=>['acid','cold','fire','force','lightning','necrotic','poison','psychic','radiant','thunder'].some(type=>type===value);
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
export const variantItemResistanceBonusSnapshot=(value:unknown)=>sourceTextSha256(JSON.stringify(sorted(value)));

/** Header recognition reserves an exact reviewed generated family. Neither
 * display names nor an arbitrary _variantIdentity grant mechanics. */
export function variantItemResistanceBonusFamilyId(entry:Entry):string|undefined{
 if(!entry||typeof entry!=='object')return;
 const exact=typeof entry.id==='string'&&rules.get(entry.id);if(exact)return exact.id;
 const matches=evidence.rules.filter(rule=>rule.packId===entry.packId&&rule.source===entry.source&&rule.name===entry.name&&rule.english===entry.english);return matches.length===1?matches[0].id:undefined;
}
/** Exact generated whole-entry proof, including original base/template merged
 * fields, prepared variant identity and the actual canonical/App full forms.
 * It does not remove the separate plain-item accessor's variant rejection. */
export function variantItemResistanceBonusRule(entry:Entry):VariantItemResistanceBonusRule|undefined{
 const id=variantItemResistanceBonusFamilyId(entry),rule=id&&rules.get(id),type=entry&&entry.raw&&typeof entry.raw==='object'&&!Array.isArray(entry.raw)?armorType(entry):undefined;
 if(!rule||entry.kind!=='item'||!validIdentity(entry.id)||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==rule.id&&canonical.has(entry.id)||entry.packId!==rule.packId||entry.source!==rule.source||entry.edition!==rule.edition||entry.name!==rule.name||entry.english!==rule.english||(entry.page??null)!==rule.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._category!=='item'||entry.raw._category!==rule.category||!type||type==='S'||entry.raw.type!==rule.type||entry.raw.armor!==true||entry.raw._variantIdentity!==rule.variantIdentity||!validIdentity(entry.raw._variantIdentity)||entry.raw.baseItem!==rule.baseItem||!validIdentity(entry.raw.baseItem)||entry.raw._copy||entry.raw._unresolvedParent||entry.raw._unresolvedVariant||entry.raw.reqAttune!==true||rule.requiresAttunement!==true||rule.sourceCondition!=='worn'||!validResistance(rule.resistance))return;
 try{const hash=variantItemResistanceBonusSnapshot({...entry,id:rule.id,revision:rule.revision});if(rule.forms.some(form=>form.canonicalReboundSnapshotSha256===hash))return rule;}catch{/* Unknown payloads are preserved, never repaired or rebound by name. */}
}
export interface VariantItemResistanceBonusGrant {selectionId:string;entryId:string;source:string;resistance:ItemResistanceType;snapshotSha256:string}
export interface VariantItemResistanceBonusProjection {resistances:ItemResistanceType[];trace:string[];issues:Issue[];grants:VariantItemResistanceBonusGrant[]}

/** Pure current worn/attuned fixed resistance. Base and template provenance is
 * proof only: it creates no extra source switch, separately owned base/template
 * record, transitive disabled-ID control, resource, action or persistent state. */
export function projectVariantItemResistanceBonuses(c:Character,providedActive?:readonly Selection[]):VariantItemResistanceBonusProjection{
 const out:VariantItemResistanceBonusProjection={resistances:[],trace:[],issues:[],grants:[]},live=activeEffectSelections(c);
 const warn=(row:Selection,code:string,message:string)=>out.issues.push({id:`variant-item-resistance-bonus:${code}:${row.id}`,selectionId:row.id,severity:'warning',message});
 for(const row of c.selections){
  const family=variantItemResistanceBonusFamilyId(row.entry);
  if(!family){
   if(row.entry?.kind==='item'&&(row.entry.raw?._variantIdentity||row.entry.raw?._category==='magicvariant'&&row.entry.raw.resist!==undefined))warn(row,'unproved','此派生物品或通用模板未通过完整具体护甲来源核对；不凭模板、名称或派生标记授予抗性。');
   continue;
  }
  if(!automationEnabled(c)){warn(row,'paused','派生护甲抗性暂停：自动化关闭或协议未知；原装备、手工值及资源保留。');continue;}
  const rule=variantItemResistanceBonusRule(row.entry);
  if(!rule){warn(row,'unproved','此具体护甲的完整来源、基础／模板合成、身份或版本未通过抗性核对；原记录保留。');continue;}
  if(!Object.hasOwn(row,'id')||!validIdentity(row.id)||row.quantity!==1||row.parentId!==undefined||row.grantKey!==undefined||row.requirementId!==undefined||c.selections.filter(other=>variantItemResistanceBonusFamilyId(other.entry)===rule.id).length!==1||!live.includes(row)||providedActive&&!providedActive.includes(row)){warn(row,'owner','物品不是唯一有效的单件实物根记录，或当前归属未生效；不复制或合并派生护甲抗性。');continue;}
  const disabled=c.profile.disabledEntries||[];
  // Preserve the concrete item's existing availability semantics. Provenance
  // sources/IDs are intentionally NOT added as hidden prerequisites here.
  if(!c.profile.enabledSources.includes(row.entry.source)||(row.entry.dependencies||[]).some(source=>!c.profile.enabledSources.includes(source))||disabled.includes(row.entry.id)||disabled.includes(rule.id)){warn(row,'source','具体物品当前来源、实际依赖或规范／别名身份已停用；派生抗性暂停，原记录保留。');continue;}
  if(!Object.hasOwn(row,'equipped')||row.equipped!==true||!Object.hasOwn(row,'attuned')||row.attuned!==true){warn(row,'equipment','此来源分支需要当前明确穿戴且同调；装备不被解释为持握，未满足时不计派生抗性。');continue;}
  // Same live/equipped/positive-quantity armor slot predicate as the current
  // armor and infusion evaluators. A supplied subset cannot hide a conflict.
  if(live.filter(other=>other.equipped&&other.quantity>0&&!!armorType(other.entry)&&armorType(other.entry)!=='S').length!==1){warn(row,'armor-conflict','当前护甲槽存在穿戴冲突；按既有护甲规则暂停派生抗性，不改写任何装备状态。');continue;}
  const resistance=rule.resistance;if(!validResistance(resistance))continue;
  if(!out.resistances.includes(resistance))out.resistances.push(resistance);
  out.trace.push(`${rule.name} · ${rule.source}：完整基础／模板合成已核对，当前穿戴且同调，${resistance} 伤害抗性；实际伤害结算与减免仍需手动处理。`);
  out.grants.push({selectionId:row.id,entryId:rule.id,source:rule.source,resistance,snapshotSha256:variantItemResistanceBonusSnapshot({...row.entry,id:rule.id,revision:rule.revision})});
 }
 return out;
}
