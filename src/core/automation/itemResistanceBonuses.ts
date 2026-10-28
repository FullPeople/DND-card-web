import type {Character,Entry,Issue,Selection} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {armorType} from './equipment';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './itemResistanceBonusEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};

export const ITEM_RESISTANCE_TYPES=['acid','cold','fire','force','lightning','necrotic','poison','psychic','radiant','thunder']as const;
export type ItemResistanceType=typeof ITEM_RESISTANCE_TYPES[number];
export type ItemResistanceBonusRule=typeof evidence.rules[number];
const rules=new Map(evidence.rules.map(rule=>[rule.id,rule])),canonical=new Set(ordinary.canonicalIds);
const validResistance=(value:unknown):value is ItemResistanceType=>ITEM_RESISTANCE_TYPES.some(type=>type===value);
const validIdentity=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=2000&&!value.includes('\0');
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
export const itemResistanceBonusSnapshot=(value:unknown)=>sourceTextSha256(JSON.stringify(sorted(value)));

/** Recognition reserves the reviewed identity domain, never a numeric grant.
 * Coherent aliases still require the entire canonical or actual App payload. */
export function itemResistanceBonusFamilyId(entry:Entry):string|undefined{
 if(!entry||typeof entry!=='object')return;
 const exact=typeof entry.id==='string'&&rules.get(entry.id);if(exact)return exact.id;
 const matches=evidence.rules.filter(rule=>rule.packId===entry.packId&&rule.source===entry.source&&rule.name===entry.name&&rule.english===entry.english);return matches.length===1?matches[0].id:undefined;
}
export function itemResistanceBonusRule(entry:Entry):ItemResistanceBonusRule|undefined{
 const id=itemResistanceBonusFamilyId(entry),rule=id&&rules.get(id);
 if(!rule||entry.kind!=='item'||!validIdentity(entry.id)||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==rule.id&&canonical.has(entry.id)||entry.packId!==rule.packId||entry.source!==rule.source||entry.edition!==rule.edition||entry.name!==rule.name||entry.english!==rule.english||(entry.page??null)!==rule.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._category!==rule.category||entry.raw._copy||entry.raw._unresolvedParent||entry.raw._variantIdentity||entry.raw.reqAttune!==true||!validResistance(rule.resistance)||rule.requiresAttunement!==true||rule.sourceCondition!=='worn')return;
 try{const snapshot=itemResistanceBonusSnapshot({...entry,id:rule.id,revision:rule.revision});if(rule.forms.some(form=>form.canonicalReboundSnapshotSha256===snapshot))return rule;}catch{/* Unknown payloads are preserved and never repaired. */}
}
export interface ItemResistanceBonusGrant {selectionId:string;entryId:string;source:string;resistance:ItemResistanceType;snapshotSha256:string}
export interface ItemResistanceBonusProjection {resistances:ItemResistanceType[];trace:string[];issues:Issue[];grants:ItemResistanceBonusGrant[]}

/** Pure fixed-type resistance projection, not a damage/HP calculator. It does
 * not add a holding flag, choose a generic ring's type, persist state or execute
 * detection, advantage, immunity, activation, curse or resource branches. */
export function projectItemResistanceBonuses(c:Character,providedActive?:readonly Selection[]):ItemResistanceBonusProjection{
 const out:ItemResistanceBonusProjection={resistances:[],trace:[],issues:[],grants:[]},live=activeEffectSelections(c);
 const warn=(row:Selection,code:string,message:string)=>out.issues.push({id:`item-resistance-bonus:${code}:${row.id}`,selectionId:row.id,severity:'warning',message});
 for(const row of c.selections){
  const family=itemResistanceBonusFamilyId(row.entry);
  if(!family){
   const entry=row.entry,held=evidence.holds.some(hold=>entry&&entry.kind===hold.kind&&entry.packId===hold.packId&&entry.source===hold.source&&entry.edition===hold.edition&&entry.name===hold.name&&entry.english===hold.english);
   if(held)warn(row,'condition-unresolved','此版本抗性戒指的同调条件尚未由来源核实；元数据缺项不代表不需同调，手动勾选同调也不解除暂停。');
   else if(entry?.kind==='item'&&entry.raw?.resist!==undefined)warn(row,'unproved','此物品的抗性分支尚未通过完整来源及条件核对；不根据名称或伤害标签猜测自动效果。');
   continue;
  }
  if(!automationEnabled(c)){warn(row,'paused','装备抗性暂停：自动化关闭或协议未知；原物品、手工值及资源保留。');continue;}
  const rule=itemResistanceBonusRule(row.entry);
  if(!rule){warn(row,'unproved','此物品的完整来源快照、身份或版本未通过抗性核对；原记录保留，未自动授予抗性。');continue;}
  if(!Object.hasOwn(row,'id')||!validIdentity(row.id)||row.parentId!==undefined||row.grantKey!==undefined||row.requirementId!==undefined||row.quantity!==1||c.selections.filter(other=>itemResistanceBonusFamilyId(other.entry)===rule.id).length!==1||!live.includes(row)||providedActive&&!providedActive.includes(row)){warn(row,'owner','物品不是唯一有效的单件实物根记录，或当前归属未生效；装备抗性暂停，原记录保留。');continue;}
  const disabled=c.profile.disabledEntries||[];
  if(!c.profile.enabledSources.includes(rule.source)||(row.entry.dependencies||[]).some(source=>!c.profile.enabledSources.includes(source))||disabled.includes(row.entry.id)||disabled.includes(rule.id)){warn(row,'source','物品当前来源或规范／别名身份已停用；原记录保留，暂不计装备抗性。');continue;}
  if(!Object.hasOwn(row,'equipped')||row.equipped!==true||!Object.hasOwn(row,'attuned')||row.attuned!==true){warn(row,'equipment','此受审抗性分支需要当前明确穿戴且同调；装备不被解释为持握，未满足时不计抗性。');continue;}
  if(armorType(row.entry)){
   // Same active, equipped, positive-quantity slot predicate as evaluateArmor
   // and evaluateInfusions. A supplied subset cannot hide a current conflict.
   const shield=armorType(row.entry)==='S';
   if(live.filter(other=>other.equipped&&other.quantity>0&&!!armorType(other.entry)&&(armorType(other.entry)==='S')===shield).length!==1){warn(row,'armor-conflict','当前护甲槽存在穿戴冲突；按既有护甲规则暂停该护甲的抗性，不改写任何装备状态。');continue;}
  }
  const resistance=rule.resistance;if(!validResistance(resistance))continue;
  if(!out.resistances.includes(resistance))out.resistances.push(resistance);
  out.trace.push(`${rule.name} · ${rule.source}：当前穿戴且同调，${resistance} 伤害抗性；实际伤害结算与减免仍需手动处理。`);
  out.grants.push({selectionId:row.id,entryId:rule.id,source:rule.source,resistance,snapshotSha256:itemResistanceBonusSnapshot({...row.entry,id:rule.id,revision:rule.revision})});
 }
 return out;
}
