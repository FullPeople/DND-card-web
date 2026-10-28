import type {Character,Entry,Issue,Selection} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './racialMovementEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};

export type RacialMovementMode='swim'|'climb';
export type RacialMovementRule=typeof evidence.rules[number];
export interface RacialMovementProjection {modes:Partial<Record<RacialMovementMode,number>>;grants:{selectionId:string;entryId:string;source:string;mode:RacialMovementMode;baseFeet:number}[];trace:string[];issues:Issue[]}
const rules=new Map(evidence.rules.map(rule=>[rule.id,rule])),canonical=new Set(ordinary.canonicalIds),held=new Map(evidence.held.map(row=>[row.id,row.holdCode]));
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
export const racialMovementSnapshot=(entry:Entry)=>sourceTextSha256(JSON.stringify(sorted(entry)));

/** Header lookup only locates a possible proof. It cannot grant movement. */
export function racialMovementFamilyId(entry:Entry):string|undefined{
 if(!entry)return;const exact=rules.get(entry.id);if(exact)return exact.id;
 const matches=evidence.rules.filter(rule=>rule.packId===entry.packId&&rule.source===entry.source&&rule.name===entry.name&&rule.english===entry.english);return matches.length===1?matches[0].id:undefined;
}
export function racialMovementRule(entry:Entry):RacialMovementRule|undefined{
 const id=racialMovementFamilyId(entry),rule=id&&rules.get(id);
 if(!rule||entry.kind!=='race'||typeof entry.id!=='string'||!entry.id.trim()||entry.id.length>2000||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==rule.id&&canonical.has(entry.id)||entry.packId!==rule.packId||entry.source!==rule.source||entry.edition!==rule.edition||entry.name!==rule.name||entry.english!==rule.english||(entry.page??null)!==rule.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._category!==rule.category||entry.raw._copy||entry.raw._unresolvedParent)return;
 try{if(racialMovementSnapshot({...entry,id:rule.id,revision:rule.revision})===rule.fullNormalizedSnapshotSha256)return rule;}catch{/* Unknown complete forms stay held; no raw repair or field dropping. */}
}

/** Source BASE modes only: no saved state, walking rewrite, global speed buff,
 * terrain/condition/armor inference, activation, resource or map ownership. */
export function projectRacialMovement(c:Character,providedActive?:readonly Selection[]):RacialMovementProjection{
 const result:RacialMovementProjection={modes:{},grants:[],trace:[],issues:[]},rows=c.selections.filter(row=>row.entry.kind==='race');
 if(!rows.length)return result;
 const warn=(row:Selection,code:string,message:string)=>{result.issues.push({id:`racial-movement:${code}:${row.id}`,selectionId:row.id,severity:'warning',message});result.trace.push(message);return result;};
 // Unrelated races without a nonwalking declaration do not acquire new warnings.
 const candidate=rows.find(row=>racialMovementFamilyId(row.entry)||held.has(row.entry.id)||row.entry.raw?.speed&&typeof row.entry.raw.speed==='object'&&['swim','climb','fly','burrow'].some(mode=>row.entry.raw.speed[mode]!==undefined));
 if(!candidate)return result;
 if(!automationEnabled(c))return warn(candidate,'paused','来源基础移动速度暂停：自动化关闭或协议未知；原种族、步行速度与手工记录保留。');
 if(rows.length!==1||candidate.parentId||candidate.quantity!==1)return warn(candidate,'owner','种族归属不唯一或不是单件完整根种族；不叠加来源基础移动速度，原记录保留。');
 const rule=racialMovementRule(candidate.entry);
 if(!rule){const hold=held.get(candidate.entry.id);return warn(candidate,hold?'held':'unproved',hold?`此种族非步行速度仍需手工核对（${hold}）；本批不根据数值标签、选择、护甲条件或动态关系授予速度。`:'此种族完整来源快照、身份或基础移动条款尚未通过核对；不根据名称、笔记或数值标签猜测速度。');}
 if(!['swim','climb'].includes(rule.mode)||!Number.isSafeInteger(rule.baseFeet)||rule.baseFeet<=0)return warn(candidate,'unproved','来源基础移动速度的模式或数值尚未通过核对；原记录保留。');
 const disabled=c.profile.disabledEntries||[];
 if(disabled.includes(candidate.entry.id)||disabled.includes(rule.id)||rule.requiredSources.some(source=>!c.profile.enabledSources.includes(source)))return warn(candidate,'source','种族或其继承／复制来源已停用；保留完整种族，暂停来源基础移动速度。');
 // A selected complete inherited race owns its source mechanics. Do not demand
 // independently selected parents or invent transitive parent-ID disable rules.
 const live=activeEffectSelections(c);
 if(!live.includes(candidate)||providedActive&&!providedActive.includes(candidate))return warn(candidate,'inactive','种族当前来源、依赖或归属未生效；来源基础移动速度暂停，手工记录保留。');
 const mode=rule.mode as RacialMovementMode;result.modes[mode]=rule.baseFeet;
 result.grants.push({selectionId:candidate.id,entryId:rule.id,source:rule.source,mode,baseFeet:rule.baseFeet});
 result.trace.push(`${rule.name} · ${rule.source}：来源基础${mode==='swim'?'游泳':'攀爬'}速度 ${rule.baseFeet} 尺。`,'仅列已核对的来源基础值，不是最终可移动距离；其他速度加减、减速、地形、条件、爆发移动与地图执行仍需手工裁定，步行及原手工值不变。');
 return result;
}
