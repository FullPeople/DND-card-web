import type {Entry} from '../model';
import {itemChargeRule,itemChargeFamilyId} from './itemChargeDebitSource';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './chargedItemSpellEvidence.json' with {type:'json'};
import ordinary from './ordinarySpellCastingEvidence.json' with {type:'json'};

export type ChargedItemSpellStatistics={kind:'none'}|{kind:'fixed-dc';saveDC:number};
export type ChargedItemSpellRule=Omit<typeof evidence.rules[number],'branch'>&{branch:Omit<typeof evidence.rules[number]['branch'],'statistics'|'targetScope'|'sourceActionTiming'|'minAfter'|'cost'>&{statistics:ChargedItemSpellStatistics;targetScope:'self'|'spell';sourceActionTiming:'action'|'bonus-action'|'spell-default';minAfter:0|1;cost:1}};
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
export const chargedItemSpellSourceSnapshot=(value:unknown)=>sourceTextSha256(JSON.stringify(sorted(value)));
const immutable=(value:any):any=>{if(value&&typeof value==='object'){Object.values(value).forEach(immutable);Object.freeze(value);}return value;};
const canonical=new Set(ordinary.canonicalIds),rules=new Map<string,ChargedItemSpellRule>();
for(const input of evidence.rules){
 const {policySha256,...policy}=input;
 if(chargedItemSpellSourceSnapshot(policy)!==policySha256||input.branch.cost!==1||![0,1].includes(input.branch.minAfter)||!['none','fixed-dc'].includes(input.branch.statistics.kind))continue;
 rules.set(input.id,immutable(input)as unknown as ChargedItemSpellRule);
}
export const chargedItemSpellRules=()=>[...rules.values()];
export const chargedItemSpellPolicy=(id:string)=>rules.get(id);
export function chargedItemSpellFamilyId(entry:Entry):string|undefined{if(rules.has(entry.id))return entry.id;if(entry.kind!=='item')return;const id=itemChargeFamilyId(entry);return id&&rules.has(id)?id:undefined;}
/** Reuse, never relax, the existing canonical/full final-equipment pool proof. */
export function chargedItemSpellRule(entry:Entry):ChargedItemSpellRule|undefined{
 const pool=itemChargeRule(entry),rule=pool&&rules.get(pool.id);if(!pool?.supported||!rule||pool.fullNormalizedSnapshotSha256!==rule.fullNormalizedSnapshotSha256||pool.capacity!==rule.capacity||pool.action?.key!==rule.branch.key||pool.action.cost!==1||pool.action.minAfter!==rule.branch.minAfter||(pool.requiresAttunement===true)!==rule.requiresAttunement)return;
 try{const rebound=chargedItemSpellSourceSnapshot({...entry,id:rule.id,revision:rule.revision});return rule.ownerForms.some(form=>form.canonicalReboundFullSnapshotSha256===rebound)?rule:undefined;}catch{return;}
}
export function chargedItemSpellStoredRule(canonicalId:string,entryId:string,snapshotSha256:string,policySha256:string):ChargedItemSpellRule|undefined{
 const rule=rules.get(canonicalId);return rule&&rule.fullNormalizedSnapshotSha256===snapshotSha256&&rule.policySha256===policySha256&&(entryId===rule.id||!canonical.has(entryId))?rule:undefined;
}
/** Only the actual, completely hydrated target form is admitted. No flat-form,
 * name-only, missing-source or inferred-edition compatibility is invented. */
export function chargedItemSpellTargetRule(entry:Entry,targetId:string){
 const rule=[...rules.values()].find(row=>row.target.id===targetId),target=rule?.target;
 if(!entry||!target||entry.kind!=='spell'||entry.source!==target.source||entry.packId!==target.packId||entry.edition!==target.edition||entry.name!==target.name||entry.english!==target.english||(entry.page??null)!==target.page||typeof entry.id!=='string'||!entry.id.trim()||entry.id.length>2000||entry.id!==target.id&&canonical.has(entry.id)||typeof entry.revision!=='string'||!entry.revision.trim()||!entry.raw||typeof entry.raw!=='object'||Array.isArray(entry.raw)||entry.raw._copy||entry.raw._unresolvedParent)return;
 try{return chargedItemSpellSourceSnapshot({...entry,id:target.id,revision:target.revision})===target.fullNormalizedSnapshotSha256?target:undefined;}catch{return;}
}
