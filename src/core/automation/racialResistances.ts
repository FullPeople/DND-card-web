import type {Character,Entry,Issue,Selection} from '../model';
import {activeEffectSelections} from './active';
import {automationEnabled} from './state';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './racialResistanceEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};

export type RacialResistance='acid'|'cold'|'fire'|'force'|'lightning'|'necrotic'|'poison'|'psychic'|'radiant'|'thunder';
export type RacialResistanceRule=typeof evidence.rules[number];
export interface RacialResistanceGrant {selectionId:string;entryId:string;source:string;resistances:RacialResistance[];snapshotSha256:string}
export interface RacialResistanceProjection {resistances:RacialResistance[];trace:string[];issues:Issue[];grants:RacialResistanceGrant[]}
const rules=new Map(evidence.rules.map(rule=>[rule.id,rule])),canonical=new Set(ordinary.canonicalIds);
const validIdentity=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=2000&&!value.includes('\0');
const validType=(value:unknown):value is RacialResistance=>typeof value==='string'&&['acid','cold','fire','force','lightning','necrotic','poison','psychic','radiant','thunder'].includes(value);
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
export const racialResistanceSnapshot=(value:unknown)=>sourceTextSha256(JSON.stringify(sorted(value)));

/** Header recognition locates a possible proof, never a resistance grant. */
export function racialResistanceFamilyId(entry:Entry):string|undefined{
 if(!entry||typeof entry!=='object')return;
 const exact=typeof entry.id==='string'&&rules.get(entry.id);if(exact)return exact.id;
 const matches=evidence.rules.filter(rule=>rule.packId===entry.packId&&rule.source===entry.source&&rule.name===entry.name&&rule.english===entry.english);return matches.length===1?matches[0].id:undefined;
}
/** Complete source and actual App snapshots authenticate their own explicit
 * fixed clauses. Only coherent unreserved transport ID/revision may rebound;
 * original localized raw fields are neither repaired nor used as a dispatcher. */
export function racialResistanceRule(entry:Entry):RacialResistanceRule|undefined{
 const id=racialResistanceFamilyId(entry),rule=id&&rules.get(id);
 if(!rule||entry.kind!=='race'||!validIdentity(entry.id)||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==rule.id&&canonical.has(entry.id)||entry.packId!==rule.packId||entry.source!==rule.source||entry.edition!==rule.edition||entry.name!==rule.name||entry.english!==rule.english||(entry.page??null)!==rule.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._category!==rule.category||!['race','subrace'].includes(rule.category)||entry.raw._copy||entry.raw._unresolvedParent||!rule.resistances.length||rule.resistances.some(type=>!validType(type)))return;
 try{const hash=racialResistanceSnapshot({...entry,id:rule.id,revision:rule.revision});if(rule.forms.some(form=>form.canonicalReboundSnapshotSha256===hash))return rule;}catch{/* Unknown complete payloads remain untouched and unproved. */}
}

/** A selected complete race/subrace is one root, not an inventory stack or a
 * second separately-owned ancestry. This pure type union does not apply HP
 * damage, immunity, advantage, choices, conditions or runtime resources. */
export function projectRacialResistances(c:Character,providedActive?:readonly Selection[]):RacialResistanceProjection{
 const out:RacialResistanceProjection={resistances:[],trace:[],issues:[],grants:[]},rows=c.selections.filter(row=>row.entry.kind==='race');
 const candidate=rows.find(row=>racialResistanceFamilyId(row.entry)||evidence.held.some(hold=>'id'in hold&&hold.id===row.entry.id)||row.entry.raw?.resist!==undefined);
 if(!candidate)return out;
 const warn=(code:string,message:string)=>{out.issues.push({id:`racial-resistance:${code}:${candidate.id}`,selectionId:candidate.id,severity:'warning',message});out.trace.push(message);return out;};
 if(!automationEnabled(c))return warn('paused','种族抗性投影暂停：自动化关闭或协议未知；原归属、手工记录与资源保留。');
 // Race ownership follows the saved source/root semantics, not physical-item
 // quantity, wearing, attunement, class levels or the display-edition filter.
 if(rows.length!==1||!Object.hasOwn(candidate,'id')||!validIdentity(candidate.id)||candidate.parentId!==undefined||candidate.grantKey!==undefined||candidate.requirementId!==undefined)return warn('owner','种族不是唯一有效的完整根记录；不合并其他种族、祖先或重复别名的抗性。');
 const rule=racialResistanceRule(candidate.entry);
 if(!rule)return warn('unproved','此种族完整快照或固定抗性条款／继承组合尚未通过核对；保留原归属，不凭名称、原始标签、选择或笔记推定抗性。');
 const disabled=c.profile.disabledEntries||[];
 if(disabled.includes(candidate.entry.id)||disabled.includes(rule.id)||rule.requiredSources.some(source=>!c.profile.enabledSources.includes(source)))return warn('source','种族的来源、实际声明依赖或规范／别名身份已停用；原记录保留，固定抗性暂停。');
 // Parent provenance is in the complete proof. It is not a newly invented
 // independently-owned parent row or transitive disabled-parent-ID policy.
 const live=activeEffectSelections(c);
 if(!live.includes(candidate)||providedActive&&!providedActive.includes(candidate))return warn('inactive','种族当前归属未生效或已被排除；外部列表不能代替当前真实来源归属。');
 const types=rule.resistances.filter(validType) as RacialResistance[];types.sort();out.resistances=[...new Set(types)];
 out.grants.push({selectionId:candidate.id,entryId:rule.id,source:rule.source,resistances:[...out.resistances],snapshotSha256:racialResistanceSnapshot(candidate.entry)});
 out.trace.push(`${rule.name} · ${rule.source}：已核对的固定伤害抗性 ${out.resistances.join('、')}。`,'仅列来源伤害类型；伤害结算、HP、免疫、豁免优势、临时抗性与祖先／类型选择仍需手工处理，不改写角色或资源。');
 return out;
}
