import type {Entry} from '../model';
import {sourceTextSha256} from './sourceTextSha256';
import evidence from './reviewedObservantEvidence.json' with {type:'json'};
export interface ReviewedObservantRule {kind:'observant';reference:'Observant|PHB';page:168;abilities:('int'|'wis')[]}
export const sourceObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const sourceSame=(a:unknown,b:unknown):boolean=>{
 if(a===b)return true;
 if(!sourceObject(a)&&!Array.isArray(a)||!sourceObject(b)&&!Array.isArray(b)||Array.isArray(a)!==Array.isArray(b))return false;
 const left=a as Record<string,unknown>,right=b as Record<string,unknown>,keys=Object.keys(left);return keys.length===Object.keys(right).length&&keys.every(key=>Object.hasOwn(right,key)&&sourceSame(left[key],right[key]));
};
export const sourceEmpty=(v:unknown)=>v===undefined||Array.isArray(v)&&v.length===0;
const metadata=new Set(['name','ENG_name','source','page','edition','entries','additionalEntries','srd','basicRules','referenceSources','reprintedAs','hasFluff','hasFluffImages','translator','otherSources','additionalSources','_category']);
const mechanics=(raw:Entry['raw'])=>Object.fromEntries(Object.entries(raw).filter(([key])=>!metadata.has(key)));
function sourceHeader(entry:Entry,modern=false){const raw=entry.raw,p=modern?evidence.modern:evidence.feat;return entry.kind==='feat'&&entry.english==='Observant'&&raw.ENG_name==='Observant'&&entry.source===(modern?'XPHB':'PHB')&&raw.source===entry.source&&entry.edition===(modern?'2024':'2014')&&entry.packId==='kiwee'&&raw._category==='feat'&&entry.page===p.page&&raw.page===p.page&&sourceEmpty(entry.effects)&&sourceEmpty(entry.choices)&&sourceEmpty(entry.dependencies)&&Object.keys(raw).every(key=>key==='_category'||p.rawKeys.includes(key))&&sourceSame(mechanics(raw),p.mechanics)&&Array.isArray(entry.entries)&&entry.entries.length>0;}
/** Fixed passive mechanics live in the two source clauses, not raw fields.
 * Authenticate their exact UTF-8 hashes without bundling publisher prose. */
export function reviewedObservantRule(entry:Entry|undefined):ReviewedObservantRule|undefined{
 if(!entry||!sourceHeader(entry))return;
 const raw=entry.raw,list=Array.isArray(raw.entries)?raw.entries[1]:undefined;
 if(!Array.isArray(raw.entries)||raw.entries.length!==2||typeof raw.entries[0]!=='string'||!raw.entries[0].trim()||!sourceObject(list)||Object.keys(list).some(key=>!['type','items'].includes(key))||list.type!=='list'||!Array.isArray(list.items)||list.items.length!==2||!Array.from(list.items).every(item=>typeof item==='string'&&item.trim()))return;
 if(!sourceSame(raw.reprintedAs,['观察力|XPHB'])||sourceTextSha256(list.items[0])!==evidence.feat.clauses.lipReading.sha256||sourceTextSha256(list.items[1])!==evidence.feat.clauses.passives.sha256)return;
 return {kind:'observant',reference:'Observant|PHB',page:168,abilities:['int','wis']};
}
/** Compatibility exception only: keep the genuine modern skill-choice path;
 * it never authorizes PHB ability/passive effects. */
export function reviewedModernObservantRule(entry:Entry):boolean{
 if(entry.id===evidence.feat.entryId||!sourceHeader(entry,true))return false;
 const rows=entry.raw.entries;
 return Array.isArray(rows)&&sourceTextSha256(JSON.stringify(rows))===evidence.modern.entriesSha256&&rows.length===3&&typeof rows[0]==='string'&&!!rows[0].trim()&&rows.slice(1).every((row,index)=>sourceObject(row)&&Object.keys(row).every(key=>['ENG_name','name','type','entries'].includes(key))&&row.ENG_name===['Keen Observer','Quick Search'][index]&&typeof row.name==='string'&&!!row.name.trim()&&row.type==='entries'&&Array.isArray(row.entries)&&row.entries.length===1&&typeof row.entries[0]==='string'&&!!row.entries[0].trim());
}
/** Recognition denies generic execution; only the authenticated PHB adapter
 * may execute new bonuses. An edited ID/name/source cannot become modern. */
export function reviewedObservantIdentity(entry:Entry):boolean{
 if(entry.id!==evidence.feat.entryId&&entry.id!==evidence.modern.entryId&&entry.english!=='Observant'&&entry.raw.ENG_name!=='Observant')return false;
 return !reviewedModernObservantRule(entry);
}
