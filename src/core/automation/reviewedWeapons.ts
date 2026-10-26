import {selectionEffectsAllowed,type Character,type Entry} from '../model';
import evidence from './reviewedWeaponEvidence.json' with {type:'json'};

const record=(reference:string)=>evidence.rules.find(row=>row.reference===reference);
const same=(a:unknown,b:unknown):boolean=>{
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&same((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key]));
};
const metadata=new Set(['name','ENG_name','source','page','edition','entries','additionalEntries','srd','basicRules','referenceSources','reprintedAs','hasFluff','hasFluffImages','translator','otherSources','_category']);
/** A source-qualified, reviewed mundane weapon KIND, not an inventory instance.
 * Exact mechanical shape and source identity prevent names or unknown fields
 * from laundering a magical/2024/custom record into the four choices. */
export function reviewedWeaponReference(entry:Entry):string|undefined{
 const rule=record(`${entry.english}|${entry.source}`),raw=entry.raw;
 if(!rule||entry.id!==rule.entryId||entry.kind!=='item'||entry.packId!=='kiwee'||entry.edition!==rule.edition||entry.page!==rule.page||raw.page!==rule.page||raw._category!=='baseitem'||raw.ENG_name!==rule.english||raw.source!==rule.rawSource||entry.effects?.length||entry.choices?.length||entry.dependencies?.length)return;
 if(raw.edition!==(rule.edition==='2014'?'classic':undefined)||Object.keys(raw).some(key=>!['_category','entries','additionalEntries'].includes(key)&&!rule.rawKeys.includes(key)))return;
 if(!same(Object.fromEntries(Object.entries(raw).filter(([key])=>!metadata.has(key))),rule.mechanics))return;
 return rule.reference;
}
function sourceEntry(reference:string):Entry|undefined{
 const rule=record(reference);if(!rule)return;
 return {id:rule.entryId,kind:'item',name:rule.name,english:rule.english,source:rule.source,edition:rule.edition as Entry['edition'],packId:'kiwee',revision:evidence.inputHash,page:rule.page,entries:[],raw:{}};
}
export function reviewedWeaponReferencesValid(value:unknown):value is string[]{
 return Array.isArray(value)&&value.length===4&&new Set(value).size===4&&value.every(ref=>typeof ref==='string'&&!!record(ref));
}
export function reviewedWeaponNeedsFirearmsConsent(references:string[]):boolean{return references.some(reference=>record(reference)?.mechanics.firearm===true);}
export function reviewedWeaponUnavailable(c:Character,references:string[]):string|undefined{
 if(!reviewedWeaponReferencesValid(references))return '请选择四种不同的、已核对来源身份的简易或军用武器。';
 const stopped=references.find(ref=>!selectionEffectsAllowed(c,sourceEntry(ref)!));
 return stopped?`${stopped} 的武器来源或条目当前未启用，四种训练及属性提升暂不生效。`:undefined;
}
export function reviewedWeaponOptions(c:Character,catalog:Entry[]):{value:string;label:string;entry:Entry;unavailable?:string}[]{
 const groups=new Map<string,Entry[]>();
 for(const entry of catalog){const key=`${entry.english}|${entry.source}`;if(record(key))groups.set(key,[...(groups.get(key)||[]),entry]);}
 return [...groups].flatMap(([reference,entries])=>{
  // Duplicate IDs from different loads are harmless only when all snapshots
  // independently match; a conflicting alias must never win by array order.
  if(entries.some(entry=>reviewedWeaponReference(entry)!==reference))return [];
  const entry=entries[0];return [{value:reference,label:`${entry.name} · ${entry.source}`,entry,unavailable:selectionEffectsAllowed(c,entry)?undefined:'此武器的来源或条目当前不可用，原选择保留。'}];
 });
}
/** Reviewed training uses canonical raw identities, never a renamed display
 * label. Magic variants may inherit only their actual explicit baseItem kind. */
export function reviewedWeaponTrainingMatches(entry:Entry,reference:string):boolean{
 const rule=record(reference),raw=entry.raw;
 if(!rule||entry.kind!=='item'||entry.english!==(raw.ENG_name||raw.name)||entry.source!==String(raw.source||'').toUpperCase()||raw._copy||raw._unresolvedParent||raw._unresolvedVariant)return false;
 // Match the actual normalizer's core-source/edition contract. An imported
 // XDMG item cannot launder its modern identity through a forged `both` label
 // or omitted raw edition, even when its baseItem points at an old PHB kind.
 if(['XPHB','XDMG','XMM'].includes(entry.source)||raw.edition!==undefined&&raw.edition!=='classic')return false;
 const expectedEdition=raw.edition==='classic'||['PHB','DMG','MM'].includes(entry.source)?'2014':'both';
 if(entry.edition!==expectedEdition)return false;
 if(reviewedWeaponReference(entry)===reference)return true;
 if(raw._category!=='item'||typeof raw.baseItem!=='string'||raw.weaponCategory!==rule.mechanics.weaponCategory||raw.type!==rule.mechanics.type)return false;
 const parts=raw.baseItem.split('|');if(parts.length!==2||!parts[0]||!parts[1])return false;
 return [rule.english,rule.name].some(name=>name.toLowerCase()===parts[0].toLowerCase())&&parts[1].toUpperCase()===rule.source;
}
