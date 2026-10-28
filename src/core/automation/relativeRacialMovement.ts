import type {Character,Entry,Issue,Selection} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './relativeRacialMovementEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};

export type RelativeRacialMovementMode='swim'|'climb';
export type RelativeRacialMovementRule=typeof evidence.rules[number];
export interface RelativeRacialMovementGrant {selectionId:string;entryId:string;source:string;mode:RelativeRacialMovementMode;walkingSpeed:number;feet:number;relation:'equal-current-walking'}
export interface RelativeRacialMovementProjection {modes:Partial<Record<RelativeRacialMovementMode,number>>;trace:string[];issues:Issue[];grants:RelativeRacialMovementGrant[]}
const rules=new Map(evidence.rules.map(rule=>[rule.id,rule])),canonical=new Set(ordinary.canonicalIds);
const validIdentity=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=2000&&!value.includes('\0');
const validMode=(value:unknown):value is RelativeRacialMovementMode=>value==='swim'||value==='climb';
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
export const relativeRacialMovementSnapshot=(value:unknown)=>sourceTextSha256(JSON.stringify(sorted(value)));

/** Header recognition locates possible complete source proof, never a grant. */
export function relativeRacialMovementFamilyId(entry:Entry):string|undefined{
 if(!entry||typeof entry!=='object')return;
 const exact=typeof entry.id==='string'&&rules.get(entry.id);if(exact)return exact.id;
 const matches=evidence.rules.filter(rule=>rule.packId===entry.packId&&rule.source===entry.source&&rule.name===entry.name&&rule.english===entry.english);return matches.length===1?matches[0].id:undefined;
}
/** Complete canonical and actual App proofs retain parent-composed race fields.
 * Only transport ID/revision can be rebound for coherent unreserved aliases. */
export function relativeRacialMovementRule(entry:Entry):RelativeRacialMovementRule|undefined{
 const id=relativeRacialMovementFamilyId(entry),rule=id&&rules.get(id);
 if(!rule||entry.kind!=='race'||!validIdentity(entry.id)||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==rule.id&&canonical.has(entry.id)||entry.packId!==rule.packId||entry.source!==rule.source||entry.edition!==rule.edition||entry.name!==rule.name||entry.english!==rule.english||(entry.page??null)!==rule.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._category!==rule.category||entry.raw._copy||entry.raw._unresolvedParent||rule.relation!=='equal-current-walking'||!validMode(rule.mode))return;
 try{const hash=relativeRacialMovementSnapshot({...entry,id:rule.id,revision:rule.revision});if(rule.forms.some(form=>form.canonicalReboundSnapshotSha256===hash))return rule;}catch{/* Unknown full payloads remain untouched and unproved. */}
}

/** The caller supplies its ACTUAL final walking value after existing effects,
 * manual final override and sheet offset. This pure relation neither computes
 * nor repairs walking, and does not grant ancestry transfer, hands-free wall
 * movement, flight, armor policies, turn state or world/map execution. */
export function projectRelativeRacialMovement(c:Character,walkingSpeed:number,providedActive?:readonly Selection[]):RelativeRacialMovementProjection{
 const out:RelativeRacialMovementProjection={modes:{},trace:[],issues:[],grants:[]},rows=c.selections.filter(row=>row.entry.kind==='race');
 const candidate=rows.find(row=>relativeRacialMovementFamilyId(row.entry)||evidence.holds.some(hold=>hold.id===row.entry.id)||row.entry.raw?.speed&&typeof row.entry.raw.speed==='object'&&(row.entry.raw.speed.swim===true||row.entry.raw.speed.climb===true));
 if(!candidate)return out;
 const warn=(code:string,message:string)=>{out.issues.push({id:`relative-racial-movement:${code}:${candidate.id}`,selectionId:candidate.id,severity:'warning',message});out.trace.push(message);return out;};
 if(!automationEnabled(c))return warn('paused','步行关联移动暂停：自动化关闭或协议未知；原种族、步行、手工记录及资源保留。');
 if(rows.length!==1||!Object.hasOwn(candidate,'id')||!validIdentity(candidate.id)||candidate.quantity!==1||candidate.parentId!==undefined||candidate.grantKey!==undefined||candidate.requirementId!==undefined)return warn('owner','种族不是唯一有效的完整根记录；不合并其他种族或祖先速度，原记录保留。');
 const rule=relativeRacialMovementRule(candidate.entry);
 if(!rule){
  const held=evidence.holds.find(hold=>hold.id===candidate.entry.id);
  return warn(held?'held':'unproved',held?.reasonCode==='linked-speed-reference-not-explicit-walking'?'此来源链接的速度术语尚未核实为步行速度；保留原种族，不凭布尔字段推定关联速度。':held?'此来源缺少已核对的天生关联移动条款；保留原种族，不凭布尔字段授予速度。':'完整种族快照、版本或关联移动条款未通过核对；不根据名称、笔记或布尔字段猜测速度。');
 }
 const disabled=c.profile.disabledEntries||[];
 if(disabled.includes(candidate.entry.id)||disabled.includes(rule.id)||rule.requiredSources.some(source=>!c.profile.enabledSources.includes(source)))return warn('source','种族的来源、依赖或规范／别名身份已停用；原记录和步行值保留，关联速度暂停。');
 const live=activeEffectSelections(c);
 if(!live.includes(candidate)||providedActive&&!providedActive.includes(candidate))return warn('inactive','种族当前归属未生效或已被排除；外部列表不能代替当前真实归属。');
 if(typeof walkingSpeed!=='number'||!Number.isFinite(walkingSpeed)||walkingSpeed<0)return warn('walking-context','当前步行结果缺失、无效或为负；关联速度暂停，不修补步行，也不退回来源基础速度。');
 const mode=rule.mode;if(!validMode(mode))return warn('unproved','来源移动模式尚未通过核对；未推定其他移动权限。');
 out.modes[mode]=walkingSpeed;
 out.grants.push({selectionId:candidate.id,entryId:rule.id,source:rule.source,mode,walkingSpeed,feet:walkingSpeed,relation:'equal-current-walking'});
 out.trace.push(`${rule.name} · ${rule.source}：来源明确关联当前步行速度，${mode==='swim'?'游泳':'攀爬'}速度为 ${walkingSpeed} 尺（含当前有效的步行计算与手工调整）。`,'仅投影已核对的关联数值；祖先速度转移、免手攀爬、地形、临时爆发与地图移动仍需手工核对，不改写步行、资源或角色记录。');
 return out;
}
