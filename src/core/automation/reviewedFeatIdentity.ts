import type {Entry} from '../model';
import evidence from './reviewedFeatEvidence.json' with {type:'json'};

/** Deny-family recognition is not permission to execute. An edited kind, source
 * or edition must not let this known identity fall back to generic raw grants. */
export function reviewedArmorFeatIdentity(entry:Entry):boolean{
 return evidence.rules.some(rule=>'armorTraining' in rule&&(entry.english===rule.english||entry.raw.ENG_name===rule.english));
}
