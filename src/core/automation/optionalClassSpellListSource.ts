import type {Entry} from '../model';
import {sourceTextSha256} from './sourceTextSha256';
import {directBaseClassList} from '../classSpellLists';
import evidence from './optionalClassSpellListEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};

export type OptionalClassListOwnerRule=typeof evidence.owners[number];
export type OptionalClassListTargetRule=typeof evidence.targets[number];
const canonical=new Set(ordinary.canonicalIds),owners=new Map(evidence.owners.map(row=>[row.id,row])),targets=new Map(evidence.targets.map(row=>[row.id,row]));
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
export const optionalClassListSnapshot=(entry:Entry)=>sourceTextSha256(JSON.stringify(sorted(entry)));
type Proof=OptionalClassListOwnerRule|OptionalClassListTargetRule;
function family<P extends Proof>(entry:Entry,rows:readonly P[]):P|undefined{
 if(!entry)return;const exact=rows.find(row=>row.id===entry.id);if(exact)return exact;const matches=rows.filter(row=>row.packId===entry.packId&&row.source===entry.source&&row.name===entry.name&&row.english===entry.english);return matches.length===1?matches[0]:undefined;
}
function full<P extends Proof>(entry:Entry,rule:P|undefined):P|undefined{
 if(!rule||entry.kind!==rule.kind||typeof entry.id!=='string'||!entry.id.trim()||entry.id.length>2000||entry.id!==rule.id&&canonical.has(entry.id)||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.packId!==rule.packId||entry.source!==rule.source||entry.edition!==rule.edition||entry.name!==rule.name||entry.english!==rule.english||(entry.page??null)!==rule.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||!Array.isArray(entry.entries)||entry.raw._category!==rule.category||entry.raw._copy||entry.raw._unresolvedParent)return;
 try{if(optionalClassListSnapshot({...entry,id:rule.id,revision:rule.revision})===rule.fullNormalizedSnapshotSha256)return rule;}catch{/* No raw repair, dropped fields or guessed transport forms. */}
}
export const optionalClassListOwnerFamily=(entry:Entry)=>family(entry,evidence.owners);
export const optionalClassListOwnerRule=(entry:Entry)=>full(entry,optionalClassListOwnerFamily(entry));
export const optionalClassListTargetFamily=(entry:Entry)=>family(entry,evidence.targets);
export const optionalClassListTargetRule=(entry:Entry)=>full(entry,optionalClassListTargetFamily(entry));
export const optionalClassListOwnerForId=(id:string)=>owners.get(id);
export const optionalClassListTargetForId=(id:string)=>targets.get(id);
export function optionalClassListRuleAnchor(rule:OptionalClassListOwnerRule):string{return sourceTextSha256(JSON.stringify(sorted([rule.id,rule.minLevel,rule.sideSource,evidence.associations.filter(row=>row.ownerId===rule.id)])));}
export function optionalClassListAssociation(owner:Entry,target:Entry){const ownerRule=optionalClassListOwnerFamily(owner),targetRule=optionalClassListTargetFamily(target);return ownerRule&&targetRule?evidence.associations.find(row=>row.ownerId===ownerRule.id&&row.targetId===targetRule.id):undefined;}
export function optionalClassListHeldOwner(entry:Entry){return evidence.holds.find(row=>entry.id===row.ownerId||entry.kind==='class'&&entry.packId==='kiwee'&&entry.source===row.source&&entry.english===row.ownerEnglish);}
/** Classification only: a held transport alias must not fall through to the
 * broad legacy lookup. Reserved canonical impersonation remains held too;
 * neither this family match nor its identity flag grants list access. */
export function optionalClassListHeldTargetFamily(entry:Entry,held:typeof evidence.holds[number]):{id:string;identityValid:boolean}|undefined{
 const rows=ordinary.rules.filter(row=>held.targetIds.includes(row.id)),same=(row:typeof ordinary.rules[number])=>row.kind===entry.kind&&row.source===entry.source&&row.packId===entry.packId&&row.edition===entry.edition&&row.name===entry.name&&row.english===entry.english&&row.page===(entry.page??null),exact=rows.find(row=>row.id===entry.id);
 if(exact)return {id:exact.id,identityValid:same(exact)};
 const matches=rows.filter(same);if(matches.length===1)return {id:matches[0].id,identityValid:!canonical.has(entry.id)};
}
export const optionalClassListTargetCount=(ownerId:string)=>evidence.associations.filter(row=>row.ownerId===ownerId).length;
/** Preserve existing held-class base access using the exact ordinary proof,
 * never turn a held optional association or a name-only definition into a grant. */
export function optionalClassListExistingBase(owner:Entry,target:Entry):boolean{
 const proof=(entry:Entry)=>{const exact=ordinary.rules.find(row=>row.id===entry.id),same=(row:typeof ordinary.rules[number])=>row.kind===entry.kind&&row.source===entry.source&&row.packId===entry.packId&&row.edition===entry.edition&&row.name===entry.name&&row.english===entry.english&&row.page===(entry.page??null);const matches=(exact?[exact]:canonical.has(entry.id)?[]:ordinary.rules.filter(same)).filter(same);if(matches.length!==1||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._copy||entry.raw._unresolvedParent)return false;return matches[0].snapshotSha256===sourceTextSha256(JSON.stringify(sorted({raw:entry.raw,entries:entry.entries,effects:entry.effects,choices:entry.choices,dependencies:entry.dependencies})));};
 return proof(owner)&&proof(target)&&directBaseClassList(target,owner);
}
