import type {Entry} from '../model';
import {sourceTextSha256} from './sourceTextSha256';
import {sourceObject as object,sourceSame as same,sourceEmpty as empty} from './reviewedObservantSource';
import evidence from './reviewedAlertEvidence.json' with {type:'json'};
export interface ReviewedAlertRule {kind:'alert';reference:'Alert|PHB';page:165;initiativeBonus:5}
const metadata=new Set(['name','ENG_name','source','page','edition','entries','additionalEntries','srd','basicRules','referenceSources','reprintedAs','hasFluff','hasFluffImages','translator','otherSources','additionalSources','_category']);
const mechanics=(raw:Entry['raw'])=>Object.fromEntries(Object.entries(raw).filter(([key])=>!metadata.has(key)));
function sourceHeader(entry:Entry,modern=false){
 const raw=entry.raw,p=modern?evidence.modern:evidence.feat;
 return object(raw)&&entry.kind==='feat'&&entry.english==='Alert'&&raw.ENG_name==='Alert'&&entry.source===(modern?'XPHB':'PHB')&&raw.source===entry.source&&entry.edition===(modern?'2024':'2014')&&entry.packId==='kiwee'&&raw._category==='feat'&&entry.page===p.page&&raw.page===p.page&&empty(entry.effects)&&empty(entry.choices)&&empty(entry.dependencies)&&Object.keys(raw).every(key=>key==='_category'||p.rawKeys.includes(key))&&same(mechanics(raw),p.mechanics)&&Array.isArray(entry.entries)&&entry.entries.length>0&&same(entry.entries,raw.entries);
}
/** Authenticate the three actual PHB clauses without publishing their prose.
 * Only the first clause is automated; this is not a general text-rule engine. */
export function reviewedAlertRule(entry:Entry|undefined):ReviewedAlertRule|undefined{
 if(!entry||entry.id===evidence.modern.entryId||!sourceHeader(entry))return;
 const raw=entry.raw,list=Array.isArray(raw.entries)?raw.entries[1]:undefined;
 if(!Array.isArray(raw.entries)||raw.entries.length!==2||typeof raw.entries[0]!=='string'||!raw.entries[0].trim()||!object(list)||Object.keys(list).some(key=>!['type','items'].includes(key))||list.type!=='list'||!Array.isArray(list.items)||list.items.length!==3||!Array.from(list.items).every(item=>typeof item==='string'&&item.trim()))return;
 const items=list.items;
 if(!same(raw.reprintedAs,['警觉|XPHB'])||Object.values(evidence.feat.clauses).some(clause=>sourceTextSha256(items[clause.index])!==clause.sha256))return;
 return {kind:'alert',reference:'Alert|PHB',page:165,initiativeBonus:5};
}
/** Compatibility only: genuine XPHB Origin Alert retains its previous manual
 * PB/swap behavior. It never authorizes the distinct PHB fixed +5. */
export function reviewedModernAlertRule(entry:Entry):boolean{
 if(entry.id===evidence.feat.entryId||!sourceHeader(entry,true))return false;
 const rows=entry.raw.entries;
 return Array.isArray(rows)&&rows.length===3&&sourceTextSha256(JSON.stringify(rows))===evidence.modern.entriesSha256;
}
/** Recognition denies generic execution; names or IDs alone grant nothing. */
export function reviewedAlertIdentity(entry:Entry):boolean{
 if(entry.id!==evidence.feat.entryId&&entry.id!==evidence.modern.entryId&&entry.english!=='Alert'&&entry.raw.ENG_name!=='Alert')return false;
 return !reviewedModernAlertRule(entry);
}
