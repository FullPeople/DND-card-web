import type {Entry} from '../model';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './itemAtWillEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};
export type ItemAtWillRule=typeof evidence.rules[number];
const rules=new Map(evidence.rules.map(r=>[r.id,r])),canonical=new Set(ordinary.canonicalIds);
const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sorted(v[k])])):v;
export const itemAtWillSnapshot=(entry:Entry)=>sourceTextSha256(JSON.stringify(sorted(entry)));
export function itemAtWillFamilyId(entry:Entry):string|undefined{
 if(!entry)return;const exact=rules.get(entry.id);if(exact)return exact.id;
 const matches=evidence.rules.filter(r=>r.packId===entry.packId&&r.name===entry.name&&r.english===entry.english&&(r.source===entry.source||r.source===entry.raw?.source));return matches.length===1?matches[0].id:undefined;
}
/** This reserves only this source domain, never a same-name foreign item. It
 * gates this casting adapter, not unrelated generic item benefits. */
export const itemAtWillIdentity=(entry:Entry)=>!!itemAtWillFamilyId(entry);
export function itemAtWillRule(entry:Entry):ItemAtWillRule|undefined{
 const id=itemAtWillFamilyId(entry),r=id&&rules.get(id);if(!r||entry.kind!=='item'||typeof entry.id!=='string'||!entry.id.trim()||entry.id.length>2000||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==r.id&&canonical.has(entry.id)||entry.source!==r.source||entry.packId!==r.packId||entry.edition!==r.edition||entry.name!==r.name||entry.english!==r.english||(entry.page??null)!==r.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._copy||entry.raw._unresolvedParent||entry.raw._variantIdentity||r.requiresAttunement&&entry.raw.reqAttune!==true)return;
 try{if(itemAtWillSnapshot({...entry,id:r.id,revision:r.revision})===r.fullNormalizedSnapshotSha256)return r;}catch{/* No guessed source refresh. */}
}
export const itemAtWillRules=()=>evidence.rules;

/** Only a known canonical proof anchor can acknowledge a retained intent. */
export function itemAtWillStoredRule(canonicalEntryId:string,entryId:string,snapshotSha256:string):ItemAtWillRule|undefined{const r=rules.get(canonicalEntryId);return r&&snapshotSha256===r.fullNormalizedSnapshotSha256&&(entryId===r.id||!canonical.has(entryId))?r:undefined;}

const spellRules=new Map(ordinary.rules.filter(r=>r.kind==='spell').map(r=>[r.id,r]));
/** Cheap exact declared target header prefilter; never replaces full proof. */
export function itemAtWillTargetHeader(entry:Entry,targetId:string):boolean{const r=spellRules.get(targetId);return !!r&&entry.kind==='spell'&&entry.source===r.source&&entry.packId===r.packId&&entry.edition===r.edition&&entry.name===r.name&&entry.english===r.english&&(entry.page??null)===r.page;}
