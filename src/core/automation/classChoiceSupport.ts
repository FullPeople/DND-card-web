import evidence from './classChoiceEvidence.json' with {type:'json'};
import {matchesReference} from '../entryReferences';
import type {Entry} from '../model';

export type ClassChoiceSupport={rule:'verified'|'source-declared'|'pending';execution:'record-only'|'existing-grants'|'unavailable';publication:'unverified';reason:string};
/** Match reviewed source-qualified references, never branch on feature names. */
export function legacyFeatEvidence(owner:Entry,feature:Entry){
 return evidence.legacyFeatChoices.find(row=>matchesReference(owner,row.owner)&&matchesReference(feature,row.feature)&&feature.raw.level===row.level);
}
export function modernFeatEvidence(owner:Entry,feature:Entry){
 return evidence.modernFeatChoices.find(row=>matchesReference(owner,row.owner)&&matchesReference(feature,row.feature)&&feature.raw.level===row.level);
}
export function fightingStylePrerequisiteEvidence(owner:Entry,feature:Entry){
 return evidence.fightingStylePrerequisites.find(row=>matchesReference(owner,row.owner)&&matchesReference(feature,row.feature)&&feature.raw.level===row.level);
}
export function fightingStyleAlternativeEvidence(owner:Entry,feature:Entry,feat:Entry){
 return evidence.fightingStyleAlternatives.find(row=>matchesReference(owner,row.owner)&&matchesReference(feature,row.feature)&&matchesReference(feat,row.feat)&&feature.raw.level===row.level&&String(feat.raw.category).trim().toLowerCase()===row.category);
}
/** Array quotas declare every class level; holes and partial tables stay unknown. */
export function completeOptionalProgression(value:unknown):value is number[]{
 if(!Array.isArray(value)||value.length!==20)return false;
 for(const count of value)if(!Number.isSafeInteger(count)||count<0||count>100)return false;
 return true;
}
export function optionalChoiceSupport(owner:Entry,types:string[],count:number|undefined,at:number,progression:unknown):ClassChoiceSupport{
 if(count===undefined||!Number.isSafeInteger(count)||count<0||count>100||!Number.isSafeInteger(at)||at<1||at>20||Array.isArray(progression)&&!completeOptionalProgression(progression))
  return {rule:'pending',execution:'unavailable',publication:'unverified',reason:'此来源的进度结构尚未核对；已有记录保留。'};
 const keys=types.map(value=>value.trim().toLowerCase());
 const row=evidence.optionalProgressions.find(row=>matchesReference(owner,row.owner)&&row.featureType.some(type=>keys.includes(type.toLowerCase())));
 const matches=!!row&&completeOptionalProgression(progression)&&progression.every((value,index)=>value===row.progression[index])&&row.progression[at-1]===count;
 // The full EI tables were checked. The legacy AI guide establishes only
 // the opening learned quota; later source totals are not official proof.
 const verified=matches&&!!row&&(keys.includes('ei')||keys.includes('ai')&&at===2&&count===4);
 return {rule:verified?'verified':'source-declared',execution:'record-only',publication:'unverified',reason:verified?'已核对此来源的学习数量；具体效果和替换限制仍手动处理。':'数量取自来源声明，尚不代表完整规则核对；只保存学习记录。'};
}
export const legacyRecordSupport:ClassChoiceSupport={rule:'verified',execution:'record-only',publication:'unverified',reason:'2014 ASI 与可选专长替代规则已核对；保存方案不等于加点。已核对的职业 ASI 需另行明确分配，已适配替代专长需另行明确确认，其他专长效果仍手动。'};
