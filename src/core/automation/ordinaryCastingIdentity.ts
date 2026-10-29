import type {Character,Entry} from '../model';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './ordinarySpellCastingEvidence.json' with {type:'json'};
const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sorted(v[k])])):v;
export const ordinaryCastingSnapshot=(entry:Entry)=>sourceTextSha256(JSON.stringify(sorted({raw:entry.raw,entries:entry.entries,effects:entry.effects,choices:entry.choices,dependencies:entry.dependencies})));
const rules=new Map(evidence.rules.map(rule=>[rule.id,rule])),canonical=new Set(evidence.canonicalIds);
/** Full catalog snapshot proof, not a name, slot marker, cached grant or revision. */
export function ordinaryCastingRule(entry:Entry){
 if(!entry||!['spell','class','subclass'].includes(entry.kind)||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._copy||entry.raw._unresolvedParent||typeof entry.id!=='string'||!entry.id.trim()||entry.id.length>2000)return;
 const same=(r:typeof evidence.rules[number])=>r.kind===entry.kind&&r.source===entry.source&&r.packId===entry.packId&&r.edition===entry.edition&&r.name===entry.name&&r.english===entry.english&&r.page===(entry.page??null);
 const exact=rules.get(entry.id),matches=exact?[exact]:canonical.has(entry.id)?[]:evidence.rules.filter(same);
 const candidates=matches.filter(same);if(candidates.length!==1)return;const rule=candidates[0];if(rule.snapshotSha256!==ordinaryCastingSnapshot(entry))return;return rule;
}
/** Reserve source-qualified class identities before any legacy raw decoder.
 * A foreign same-name/source-pack domain is not this family. */
export function ordinaryCastingClassContextMalformed(c:Character):boolean{
 return c.selections.some(({entry})=>{
  if(!['class','subclass'].includes(entry.kind))return false;
  const known=rules.has(entry.id)||canonical.has(entry.id)||evidence.rules.some(r=>['class','subclass'].includes(r.kind)&&r.packId===entry.packId&&r.name===entry.name&&r.english===entry.english&&(r.source===entry.source||r.source===entry.raw?.source));
  return known&&!ordinaryCastingRule(entry);
 });
}
