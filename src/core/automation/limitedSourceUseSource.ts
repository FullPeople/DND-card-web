import type {Entry} from '../model';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './limitedSourceUseEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};
export type LimitedSourceRule=typeof evidence.rules[number];
export type LimitedSourcePool=LimitedSourceRule['pools'][number];
const canonical=new Set(ordinary.canonicalIds),rules=new Map(evidence.rules.map(rule=>[rule.id,rule]));
const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sorted(v[k])])):v;
export const limitedSourceSnapshot=(entry:Entry)=>sourceTextSha256(JSON.stringify(sorted({raw:entry.raw,entries:entry.entries,effects:entry.effects,choices:entry.choices,dependencies:entry.dependencies})));
/** Exact IDs stay reserved; aliases need the same pack, paired headers and source.
 * Edition changes do not escape quarantine. Foreign domains are not this family. */
export function limitedSourceFamilyId(entry:Entry):string|undefined{
 if(!entry)return;const exact=rules.get(entry.id);if(exact)return exact.id;
 const matches=evidence.rules.filter(r=>r.packId===entry.packId&&r.name===entry.name&&r.english===entry.english&&(r.source===entry.source||r.source===entry.raw?.source));return matches.length===1?matches[0].id:undefined;
}
export const limitedSourceIdentity=(entry:Entry)=>!!limitedSourceFamilyId(entry);
export function limitedSourceRule(entry:Entry):LimitedSourceRule|undefined{
 const id=limitedSourceFamilyId(entry),r=id&&rules.get(id);if(!r||entry.kind!=='feature'||typeof entry.id!=='string'||!entry.id||entry.id.length>2000||entry.id!==r.id&&canonical.has(entry.id)||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._copy||entry.raw._unresolvedParent||entry.source!==r.source||entry.packId!==r.packId||entry.edition!==r.edition||entry.name!==r.name||entry.english!==r.english||(entry.page??null)!==r.page)return;
 try{if(limitedSourceSnapshot(entry)===r.snapshotSha256)return r;}catch{/* Damaged snapshots stay visible but never execute. */}
}
export const limitedSourceRules=()=>evidence.rules;
export const limitedSourcePoolId=(rule:LimitedSourceRule,pool:LimitedSourcePool)=>JSON.stringify([rule.id,pool.id]);
