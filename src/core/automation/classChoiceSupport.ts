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
export function optionalChoiceSupport(owner:Entry,types:string[],count:number,at:number):ClassChoiceSupport{
 const keys=types.map(value=>value.trim().toLowerCase());
 const row=evidence.optionalProgressions.find(row=>matchesReference(owner,row.owner)&&row.featureType.some(type=>keys.includes(type.toLowerCase())));
 const expected=row?.progression[at-1],matches=expected===count;
 // The full EI tables were checked. The legacy AI guide establishes only
 // the opening learned quota; later source totals are not official proof.
 const verified=matches&&!!row&&(keys.includes('ei')||keys.includes('ai')&&at===2&&count===4);
 return {rule:verified?'verified':'source-declared',execution:'record-only',publication:'unverified',reason:verified?'已核对此来源的学习数量；具体效果和替换限制仍手动处理。':'数量取自来源声明，尚不代表完整规则核对；只保存学习记录。'};
}
export const legacyRecordSupport:ClassChoiceSupport={rule:'verified',execution:'record-only',publication:'unverified',reason:'2014 ASI 与可选专长替代规则已核对；这里只保存方案，不自动改属性或激活专长效果。'};
