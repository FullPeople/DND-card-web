import type {Entry} from '../model';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './itemChargeDebitEvidence.json';
import ordinary from './ordinarySpellCastingEvidence.json';
export type ItemChargeRule=typeof evidence.rules[number];
const rules=new Map(evidence.rules.map(r=>[r.id,r])),canonical=new Set(ordinary.canonicalIds);
const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sorted(v[k])])):v;
export const itemChargeSourceSnapshot=(entry:Entry)=>sourceTextSha256(JSON.stringify(sorted(entry)));
export function itemChargeFamilyId(entry:Entry):string|undefined{
 if(!entry)return;const exact=rules.get(entry.id);if(exact)return exact.id;
 const matches=evidence.rules.filter(r=>r.packId===entry.packId&&r.name===entry.name&&r.english===entry.english&&(r.source===entry.source||r.source===entry.raw?.source));return matches.length===1?matches[0].id:undefined;
}
export const itemChargeIdentity=(entry:Entry)=>!!itemChargeFamilyId(entry);
/** Transport revision is not rule authority. Never rewrite a selected snapshot. */
export function itemChargeRule(entry:Entry):ItemChargeRule|undefined{
 const id=itemChargeFamilyId(entry),r=id&&rules.get(id);if(!r||entry.kind!=='item'||typeof entry.id!=='string'||!entry.id.trim()||entry.id.length>2000||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==r.id&&canonical.has(entry.id)||entry.source!==r.source||entry.packId!==r.packId||entry.edition!==r.edition||entry.name!==r.name||entry.english!==r.english||(entry.page??null)!==r.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._copy||entry.raw._unresolvedParent||entry.raw._variantIdentity)return;
 try{if(itemChargeSourceSnapshot({...entry,id:r.id,revision:r.revision})===r.fullNormalizedSnapshotSha256)return r;}catch{/* Damaged or extra-field snapshots remain held. */}
}
export const itemChargeRules=()=>evidence.rules;
