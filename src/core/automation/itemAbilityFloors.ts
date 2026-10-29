import {ABILITY_LABELS,type Ability,type Character,type Entry,type Issue,type Selection} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './itemAbilityFloorEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};
export type ItemAbilityFloorRule=typeof evidence.rules[number];
const rules=new Map(evidence.rules.map(r=>[r.id,r])),canonical=new Set(ordinary.canonicalIds);
const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sorted(v[k])])):v;
export const itemAbilityFloorSnapshot=(entry:Entry)=>sourceTextSha256(JSON.stringify(sorted(entry)));
/** Header lookup reserves a specific pinned source domain, never a foreign
 * same-name item. Only a complete fingerprint can authorize a floor. */
export function itemAbilityFloorFamilyId(entry:Entry):string|undefined{
 if(!entry)return;const exact=rules.get(entry.id);if(exact)return exact.id;
 const matches=evidence.rules.filter(r=>r.packId===entry.packId&&r.source===entry.source&&r.name===entry.name&&r.english===entry.english);return matches.length===1?matches[0].id:undefined;
}
export function itemAbilityFloorRule(entry:Entry):ItemAbilityFloorRule|undefined{
 const id=itemAbilityFloorFamilyId(entry),r=id&&rules.get(id);
 if(!r||entry.kind!=='item'||typeof entry.id!=='string'||!entry.id.trim()||entry.id.length>2000||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==r.id&&canonical.has(entry.id)||entry.packId!==r.packId||entry.source!==r.source||entry.edition!==r.edition||entry.name!==r.name||entry.english!==r.english||(entry.page??null)!==r.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._category!==r.category||entry.raw._copy||entry.raw._unresolvedParent||entry.raw._variantIdentity||entry.raw.reqAttune!==true)return;
 try{if(itemAbilityFloorSnapshot({...entry,id:r.id,revision:r.revision})===r.fullNormalizedSnapshotSha256)return r;}catch{/* Unproved payload stays held, never repaired. */}
}
export interface ItemAbilityFloorProjection {floors:Partial<Record<Ability,number>>;grants:{selectionId:string;entryId:string;ability:Ability;floor:number;source:string}[];trace:Partial<Record<Ability,string[]>>;issues:Issue[]}
/** Pure current equipment projection. It has no advancement-cap, persistence,
 * consent, resource initialization, action, recovery or map ownership. */
export function projectItemAbilityFloors(c:Character,providedActive?:readonly Selection[]):ItemAbilityFloorProjection{
 const result:ItemAbilityFloorProjection={floors:{},grants:[],trace:{},issues:[]},live=activeEffectSelections(c);
 const warn=(row:Selection,code:string,message:string)=>result.issues.push({id:`item-ability-floor:${code}:${row.id}`,selectionId:row.id,severity:'warning',message});
 for(const row of c.selections){
  const family=itemAbilityFloorFamilyId(row.entry);
  if(!family){if(row.entry.kind==='item'&&row.entry.raw?.ability?.static)warn(row,'unproved','此物品的固定属性来源尚未受审；保留物品与手工值，不根据名称或标签猜测属性。');continue;}
  if(!automationEnabled(c)){warn(row,'paused','装备属性下限暂停：自动化关闭或协议未知，原物品和手工值保留。');continue;}
  const rule=itemAbilityFloorRule(row.entry);
  if(!rule){warn(row,'unproved','此物品的完整来源快照、版本或身份未通过固定属性核对；原记录保留，未自动授予属性下限。');continue;}
  if(row.parentId||row.quantity!==1||c.selections.filter(other=>itemAbilityFloorFamilyId(other.entry)===rule.id).length!==1||!live.includes(row)||providedActive&&!providedActive.includes(row)){warn(row,'owner','物品不是唯一有效的单件根记录，或当前归属未生效；装备属性下限暂停，原记录保留。');continue;}
  const disabled=c.profile.disabledEntries||[];
  // Saved effects follow the existing active-source policy across character
  // edition changes. Source entry edition is still part of the full proof.
  if(!c.profile.enabledSources.includes(rule.source)||(row.entry.dependencies||[]).some(source=>!c.profile.enabledSources.includes(source))||disabled.includes(row.entry.id)||disabled.includes(rule.id)){warn(row,'source','物品当前来源、版本或规范／别名身份已停用；保留原物品，暂不计装备属性下限。');continue;}
  if(row.equipped!==true||row.attuned!==true){warn(row,'equipment','此物品需要当前明确穿戴且同调；未满足时不计属性下限，原记录保留。');continue;}
  const ability=rule.ability as Ability;
  result.floors[ability]=Math.max(result.floors[ability]??0,rule.floor);
  result.grants.push({selectionId:row.id,entryId:rule.id,ability,floor:rule.floor,source:rule.source});
  (result.trace[ability]??=[]).push(`${rule.name} · ${rule.source}：当前穿戴且同调，${ABILITY_LABELS[ability]}下限 ${rule.floor}；不降低未用此物品时更高的属性。`);
 }
 return result;
}
