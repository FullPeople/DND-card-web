import {ABILITY_LABELS,type Ability,type Character,type Entry,type Issue,type Selection} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {armorType} from './equipment';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './itemPassiveBonusEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};

export type ItemPassiveBonusRule=typeof evidence.rules[number];
const rules=new Map(evidence.rules.map(rule=>[rule.id,rule])),canonical=new Set(ordinary.canonicalIds);
const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(key=>v[key]!==undefined).map(key=>[key,sorted(v[key])])):v;
export const itemPassiveBonusSnapshot=(value:unknown)=>sourceTextSha256(JSON.stringify(sorted(value)));
/** Header recognition reserves a reviewed source domain; it never authorizes a
 * grant. Canonical and actual App forms still need their complete fingerprint. */
export function itemPassiveBonusFamilyId(entry:Entry):string|undefined{
 if(!entry||typeof entry!=='object')return;
 const exact=typeof entry.id==='string'&&rules.get(entry.id);if(exact)return exact.id;
 const matches=evidence.rules.filter(rule=>rule.packId===entry.packId&&rule.source===entry.source&&rule.name===entry.name&&rule.english===entry.english);return matches.length===1?matches[0].id:undefined;
}
export function itemPassiveBonusRule(entry:Entry):ItemPassiveBonusRule|undefined{
 const id=itemPassiveBonusFamilyId(entry),rule=id&&rules.get(id);
 if(!rule||entry.kind!=='item'||typeof entry.id!=='string'||!entry.id.trim()||entry.id.length>2000||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==rule.id&&canonical.has(entry.id)||entry.packId!==rule.packId||entry.source!==rule.source||entry.edition!==rule.edition||entry.name!==rule.name||entry.english!==rule.english||(entry.page??null)!==rule.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._category!==rule.category||entry.raw._copy||entry.raw._unresolvedParent||entry.raw._variantIdentity||entry.raw.reqAttune!==true)return;
 try{const snapshot=itemPassiveBonusSnapshot({...entry,id:rule.id,revision:rule.revision});if(rule.forms.some(form=>form.canonicalReboundSnapshotSha256===snapshot))return rule;}catch{/* Unknown full payload is preserved, never repaired. */}
}
export interface ItemPassiveBonusGrant {selectionId:string;entryId:string;source:string;sourceCondition:string;acBonus:number;saveBonuses:Partial<Record<Ability,number>>;snapshotSha256:string}
export interface ItemPassiveBonusProjection {acBonus:number;saveBonuses:Partial<Record<Ability,number>>;acTrace:string[];saveTrace:Partial<Record<Ability,string[]>>;issues:Issue[];grants:ItemPassiveBonusGrant[]}
/** Pure source-qualified flat projection. It never writes card state, mutates
 * ability scores, consumes/creates/refills resources or executes other branches.
 * Existing source-availability semantics remain independent of the new-entry
 * edition filter; each item's own edition is part of its full source proof. */
export function projectItemPassiveBonuses(c:Character,providedActive?:readonly Selection[]):ItemPassiveBonusProjection{
 const out:ItemPassiveBonusProjection={acBonus:0,saveBonuses:{},acTrace:[],saveTrace:{},issues:[],grants:[]},live=activeEffectSelections(c),eligible:{row:Selection;rule:ItemPassiveBonusRule}[]=[];
 const warn=(row:Selection,code:string,message:string)=>out.issues.push({id:`item-passive-bonus:${code}:${row.id}`,selectionId:row.id,severity:'warning',message});
 for(const row of c.selections){
  const family=itemPassiveBonusFamilyId(row.entry);
  if(!family){
   const raw=row.entry?.raw;if(row.entry?.kind==='item'&&raw&&(raw.bonusSavingThrow!==undefined||raw.bonusAbilityCheck!==undefined||raw.bonusSpellAttack!==undefined||raw.bonusAc!==undefined&&!armorType(row.entry)))warn(row,'unproved','此物品的被动加值分支尚未通过完整来源核对；保留物品和手工值，不根据数值字段或名称猜测自动效果。');
   continue;
  }
  if(!automationEnabled(c)){warn(row,'paused','装备被动加值暂停：自动化关闭或协议未知；原记录与手工值保留。');continue;}
  const rule=itemPassiveBonusRule(row.entry);
  if(!rule){warn(row,'unproved','此物品的完整来源快照、版本或身份未通过被动加值核对；未自动授予加值。');continue;}
  if(row.parentId!==undefined||row.grantKey!==undefined||row.requirementId!==undefined||row.quantity!==1||c.selections.filter(other=>itemPassiveBonusFamilyId(other.entry)===rule.id).length!==1||!live.includes(row)||providedActive&&!providedActive.includes(row)){warn(row,'owner','物品不是唯一有效的单件根记录，或当前归属未生效；被动加值暂停，原记录保留。');continue;}
  const disabled=c.profile.disabledEntries||[];
  if(!c.profile.enabledSources.includes(rule.source)||(row.entry.dependencies||[]).some(source=>!c.profile.enabledSources.includes(source))||disabled.includes(row.entry.id)||disabled.includes(rule.id)){warn(row,'source','物品当前来源或规范／别名身份已停用；原记录保留，暂不计被动加值。');continue;}
  if(!Object.hasOwn(row,'attuned')||row.attuned!==true){warn(row,'attunement','此来源分支需要当前明确同调；未满足时不计被动加值。');continue;}
  // AI components and Wrought-Iron Tower explicitly require attunement only.
  // Do not invent wearing, rank, incorporation or a held-state prerequisite.
  if(rule.sourceCondition!=='attuned-only'&&(!Object.hasOwn(row,'equipped')||row.equipped!==true)){warn(row,'equipment',rule.sourceCondition==='worn'?'此来源分支需要当前明确穿戴且同调；未满足时不计被动加值。':'此来源分支需要当前明确装备于身上且同调；未满足时不计被动加值。');continue;}
  eligible.push({row,rule});
 }
 for(const {row,rule}of eligible){
  const overlap=rule.projectionPolicy.overlapGroup;
  if(overlap&&eligible.some(other=>other.rule.id!==rule.id&&other.rule.projectionPolicy.overlapGroup===overlap)){
   // Explicit evidence-only policy for three reviewed edition pairs. IDs and
   // editions stay distinct. This is a held, unreviewed stacking policy, not a
   // publisher prohibition or a generic same-name/cross-edition classifier.
   warn(row,'overlap','同一受审配对的跨版本效果同时有效时，叠加政策尚未受审；这部分自动加值暂停，原物品与手工调整保留。');continue;
  }
  const condition=rule.sourceCondition==='attuned-only'?'当前同调':rule.sourceCondition==='worn'?'当前穿戴且同调':'当前装备于身上且同调',origin=`${rule.name} · ${rule.source}：${condition}`;
  if(rule.acBonus){out.acBonus+=rule.acBonus;out.acTrace.push(`${origin}，AC +${rule.acBonus}。`);}
  for(const [key,value]of Object.entries(rule.saveBonuses)){
   const ability=key as Ability;if(!value)continue;out.saveBonuses[ability]=(out.saveBonuses[ability]||0)+value;
   (out.saveTrace[ability]??=[]).push(`${origin}，${ABILITY_LABELS[ability]}豁免 +${value}。`);
  }
  out.grants.push({selectionId:row.id,entryId:rule.id,source:rule.source,sourceCondition:rule.sourceCondition,acBonus:rule.acBonus,saveBonuses:{...rule.saveBonuses},snapshotSha256:itemPassiveBonusSnapshot({...row.entry,id:rule.id,revision:rule.revision})});
 }
 return out;
}
