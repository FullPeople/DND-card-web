import type {Entry} from '../model';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './itemChargeDebitEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};
import attuned from './attunedItemChargeDebitEvidence.json' with {type:'json'};
import forms from './itemChargeCatalogFormsEvidence.json' with {type:'json'};
export interface ItemChargeRule {id:string;kind:string;name:string;english:string;source:string;edition:string;packId:string;revision:string;page:number|null;fullNormalizedSnapshotSha256:string;capacity:number;supported:boolean;requiresAttunement?:boolean;action?:{key:string;cost:number;equipmentRequired:boolean;minAfter:number;manualBoundaries:string[];fixedUnits:Partial<Record<string,number|string>>|null;requiredSources:string[];requiredCardEdition:string|null}|null}
const allRules:ItemChargeRule[]=[...evidence.rules,...attuned.rules.map(r=>({...r,action:r.action?{...r.action,manualBoundaries:[...r.manualBoundaries,...r.mechanismGaps]}:null}))];
const compatibleForms=new Map(forms.rules.map(r=>[r.id,r]));
const rules=new Map(allRules.map(r=>[r.id,r])),canonical=new Set(ordinary.canonicalIds);
const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sorted(v[k])])):v;
export const itemChargeSourceSnapshot=(entry:Entry)=>sourceTextSha256(JSON.stringify(sorted(entry)));
export function itemChargeFamilyId(entry:Entry):string|undefined{
 if(!entry)return;const exact=rules.get(entry.id);if(exact)return exact.id;
 const matches=allRules.filter(r=>r.packId===entry.packId&&r.name===entry.name&&r.english===entry.english&&(r.source===entry.source||r.source===entry.raw?.source));return matches.length===1?matches[0].id:undefined;
}
export const itemChargeIdentity=(entry:Entry)=>!!itemChargeFamilyId(entry);
/** Transport revision is not rule authority. Never rewrite a selected snapshot. */
export function itemChargeRule(entry:Entry):ItemChargeRule|undefined{
 const id=itemChargeFamilyId(entry),r=id&&rules.get(id);if(!r||entry.kind!=='item'||typeof entry.id!=='string'||!entry.id.trim()||entry.id.length>2000||typeof entry.revision!=='string'||!entry.revision.trim()||entry.revision.length>4000||entry.id!==r.id&&canonical.has(entry.id)||entry.source!==r.source||entry.packId!==r.packId||entry.edition!==r.edition||entry.name!==r.name||entry.english!==r.english||(entry.page??null)!==r.page||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._copy||entry.raw._unresolvedParent||entry.raw._variantIdentity||r.requiresAttunement===true&&entry.raw.reqAttune!==true)return;
 try{const hash=itemChargeSourceSnapshot({...entry,id:r.id,revision:r.revision}),closed=compatibleForms.get(r.id);if(hash===r.fullNormalizedSnapshotSha256||closed?.canonicalProofAnchorSha256===r.fullNormalizedSnapshotSha256&&closed.compatibleFullSnapshotForms.some(form=>form.sha256===hash))return r;}catch{/* Damaged or extra-field snapshots remain held. */}
}
export const itemChargeRules=()=>allRules;
