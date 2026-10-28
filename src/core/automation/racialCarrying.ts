import type {Character,Entry,Selection,Size} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './racialCarryingEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};

export type RacialCarryingRule=typeof evidence.rules[number];
export interface RacialCarryingGrant {selectionId:string;entryId:string;source:string;fromSize:Size;effectiveSize:Size;sizeIncrement:1;snapshotSha256:string}
export interface RacialCarryingProjection {effectiveSize?:Size;sourceNotes:string[];grants:RacialCarryingGrant[]}
const rules=new Map(evidence.rules.map(rule=>[rule.id,rule])),canonical=new Set(ordinary.canonicalIds);
const sizeOrder:readonly Size[]=['T','S','M','L','H','G'];
const validIdentity=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=2000&&!value.includes('\0');
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
export const racialCarryingSnapshot=(value:unknown)=>sourceTextSha256(JSON.stringify(sorted(value)));

/** Source/header recognition locates a proof only. It cannot grant capacity. */
export function racialCarryingFamilyId(entry:Entry):string|undefined{
 if(!entry||typeof entry!=='object')return;
 const exact=typeof entry.id==='string'&&rules.get(entry.id);if(exact)return exact.id;
 const matches=evidence.rules.filter(rule=>rule.packId===entry.packId&&rule.source===entry.source&&rule.name===entry.name&&rule.english===entry.english&&rule.category===entry.raw?._category);return matches.length===1?matches[0].id:undefined;
}
export function racialCarryingRule(entry:Entry):RacialCarryingRule|undefined{
 const id=racialCarryingFamilyId(entry),rule=id&&rules.get(id);
 if(!rule||entry.kind!=='race'||!validIdentity(entry.id)||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==rule.id&&canonical.has(entry.id)||entry.packId!==rule.packId||entry.source!==rule.source||entry.edition!==rule.edition||entry.name!==rule.name||entry.english!==rule.english||(entry.page??null)!==rule.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._category!==rule.category||rule.category!=='race'||Object.hasOwn(entry.raw,'_copy')||entry.raw._unresolvedParent||rule.sizeIncrement!==1||rule.scope!=='carrying-capacity-only')return;
 try{const hash=racialCarryingSnapshot({...entry,id:rule.id,revision:rule.revision});if(rule.forms.some(form=>form.canonicalReboundSnapshotSha256===hash))return rule;}catch{/* Unknown complete snapshots are held, never repaired. */}
}

/** Select only the next carrying-table size. Actual size, derived Strength,
 * formulas and card resources remain owned by their existing mechanisms. */
export function projectRacialCarrying(c:Character,providedActive?:readonly Selection[]):RacialCarryingProjection{
 const out:RacialCarryingProjection={sourceNotes:[],grants:[]},rows=c.selections.filter(row=>row.entry.kind==='race'),candidate=rows.find(row=>racialCarryingFamilyId(row.entry));
 if(!candidate)return out;
 const hold=(reason:string)=>{out.sourceNotes.push(`${candidate.entry.name}：${reason}；原体型、力量、负重公式和资源保留。`);return out;};
 if(!automationEnabled(c))return hold('来源负重效果暂停：自动化关闭或协议未知');
 // A race is a single source root, not an equipped/attuned inventory stack.
 if(rows.length!==1||!Object.hasOwn(candidate,'id')||!validIdentity(candidate.id)||candidate.parentId!==undefined||candidate.grantKey!==undefined||candidate.requirementId!==undefined)return hold('种族归属不是唯一有效的完整根记录，不合并重复种族或别名');
 const rule=racialCarryingRule(candidate.entry);if(!rule)return hold('完整来源、版本、条款或快照未通过核对，不凭名称或标签推定负重能力');
 const disabled=c.profile.disabledEntries||[];
 if(disabled.includes(candidate.entry.id)||disabled.includes(rule.id)||rule.requiredSources.some(source=>!c.profile.enabledSources.includes(source)))return hold('当前来源、实际依赖或规范／别名身份已停用');
 const live=activeEffectSelections(c);if(!live.includes(candidate)||providedActive&&!providedActive.includes(candidate))return hold('当前真实来源归属未生效或已被排除，外部列表不能代替当前归属');
 const adjustment=c.inventory?.capacityAdjustment;
 if(typeof adjustment==='string'&&adjustment.trim())return hold('已有手工负重调整，可能已补偿此效果，自动体型加成暂缓；请显式清空或修改原调整后重新核对');
 const index=sizeOrder.findIndex(size=>size===c.size);
 if(index<0)return hold('当前体型未知，未推定或修补负重体型');
 if(index===sizeOrder.length-1)return hold('当前体型已到既有负重表上界，更大一档尚未定义');
 const fromSize=sizeOrder[index],effectiveSize=sizeOrder[index+1];out.effectiveSize=effectiveSize;
 out.grants.push({selectionId:candidate.id,entryId:rule.id,source:rule.source,fromSize,effectiveSize,sizeIncrement:1,snapshotSha256:racialCarryingSnapshot(candidate.entry)});
 out.sourceNotes.push(`${rule.name} · ${rule.source}：仅计算携带容量时按体型表提高一档（${fromSize} → ${effectiveSize}），实际体型和当前力量不变。`,'推、拖、举重、擒抱、攀爬、伤害和其他能力仍需手工核对；不改写负重调整或补发资源。');
 return out;
}
