import type {Character,Entry,Issue,Selection} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './racialDarkvisionEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};

export type RacialDarkvisionRule=typeof evidence.rules[number];
export interface RacialDarkvisionGrant {selectionId:string;entryId:string;source:string;rangeFeet:number}
export interface RacialDarkvisionProjection {darkvision?:number;grants:RacialDarkvisionGrant[];trace:string[];issues:Issue[]}
const rules=new Map(evidence.rules.map(r=>[r.id,r])),canonical=new Set(ordinary.canonicalIds);
const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sorted(v[k])])):v;
export const racialDarkvisionSnapshot=(entry:Entry)=>sourceTextSha256(JSON.stringify(sorted(entry)));

/** Header lookup locates a possible proof only; it never grants a sense. A
 * foreign same-name source is not this domain, and reserved IDs cannot alias. */
export function racialDarkvisionFamilyId(entry:Entry):string|undefined{
 if(!entry)return;const exact=rules.get(entry.id);if(exact)return exact.id;
 const matches=evidence.rules.filter(r=>r.packId===entry.packId&&r.source===entry.source&&r.name===entry.name&&r.english===entry.english);
 return matches.length===1?matches[0].id:undefined;
}
/** Complete source proof gates ONLY this projector. No generic racial effect,
 * saved snapshot, manual value, choice or runtime resource is rewritten. */
export function racialDarkvisionRule(entry:Entry):RacialDarkvisionRule|undefined{
 const id=racialDarkvisionFamilyId(entry),r=id&&rules.get(id);
 if(!r||entry.kind!=='race'||typeof entry.id!=='string'||!entry.id.trim()||entry.id.length>2000||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==r.id&&canonical.has(entry.id)||entry.packId!==r.packId||entry.source!==r.source||entry.edition!==r.edition||entry.name!==r.name||entry.english!==r.english||(entry.page??null)!==r.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._category!==r.category||entry.raw._copy||entry.raw._unresolvedParent)return;
 try{if(racialDarkvisionSnapshot({...entry,id:r.id,revision:r.revision})===r.fullNormalizedSnapshotSha256)return r;}catch{/* Unknown/extra/corrupt payload is held, never repaired. */}
}

/** Actual App race replacement stores one complete root racial snapshot,
 * including normalized subraces/selected versions. It is not an additive list
 * of independent parent and child grants. Parent definitions are authenticated
 * by the whole inherited proof and pinned SOURCE availability; they are not
 * independently selected owners. Only the selected canonical/alias entry IDs
 * have disable guards here; no parent-entry IDs or transitive catalog-disable
 * policy are inferred from names. No consent or saved state is needed. */
export function projectRacialDarkvision(c:Character,providedActive?:readonly Selection[]):RacialDarkvisionProjection{
 const result:RacialDarkvisionProjection={grants:[],trace:[],issues:[]};
 const rows=c.selections.filter(s=>s.entry.kind==='race');
 if(!rows.length)return result;
 const warn=(row:Selection,code:string,message:string)=>{result.issues.push({id:`racial-darkvision:${code}:${row.id}`,selectionId:row.id,severity:'warning',message});result.trace.push(message);return result;};
 if(!automationEnabled(c))return warn(rows[0],'paused','来源黑暗视觉投影暂停：自动化关闭或协议未知；原种族与手工记录保留。');
 if(rows.length!==1||rows[0].parentId||rows[0].quantity!==1)return warn(rows[0],'owner','种族归属不唯一或不是完整根种族记录；不合并或叠加黑暗视觉范围，原记录保留。');
 const owner=rows[0],rule=racialDarkvisionRule(owner.entry),family=racialDarkvisionFamilyId(owner.entry);
 if(!rule){
  if(family||owner.entry.raw?.darkvision!==undefined||owner.entry.raw?.blindsight!==undefined)return warn(owner,'unproved','此种族的感官来源或完整快照尚未通过固定黑暗视觉核对；保留原文与手工记录，不猜测范围。');
  return result;
 }
 const range=rule.rangeFeet;
 if(!rule.supported||typeof range!=='number'||!Number.isSafeInteger(range)||range<=0)return warn(owner,'held',`此种族感官含待核对的选择、条件、版本或数值冲突，未自动投影黑暗视觉（${rule.holdCodes.join('、')}）。`);
 const disabled=c.profile.disabledEntries||[];
 if(disabled.includes(owner.entry.id)||disabled.includes(rule.id)||rule.requiredSources.some(source=>!c.profile.enabledSources.includes(source)))return warn(owner,'source','种族或其继承来源已停用；保留完整种族记录，暂不计入来源黑暗视觉。');
 // A caller-provided subset may exclude effects, but cannot authorize an
 // inactive/missing/duplicate owner or substitute a same-ID object.
 const live=activeEffectSelections(c);
 if(!live.includes(owner)||providedActive&&!providedActive.includes(owner))return warn(owner,'inactive','种族当前来源、依赖或归属未生效；来源黑暗视觉暂停，手工记录保留。');
 result.darkvision=range;
 result.grants.push({selectionId:owner.id,entryId:rule.id,source:rule.source,rangeFeet:range});
 result.trace.push(`${rule.name} · ${rule.source}：来源黑暗视觉 ${range} 尺。`,'仅投影已核对的固定范围；光照、颜色、魔法黑暗、条件及其他种族能力仍需手工裁定。');
 return result;
}
