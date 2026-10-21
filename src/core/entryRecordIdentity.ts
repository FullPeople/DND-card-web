import type {Entry,Raw} from './model';
import {sha256Hex} from './entryIdentityHash';

const key=(value:unknown)=>String(value??'').trim().toLowerCase();
export function canonicalRecordJson(value:unknown):string{
 if(Array.isArray(value))return `[${value.map(item=>canonicalRecordJson(item)).join(',')}]`;
 if(value&&typeof value==='object')return `{${Object.entries(value).filter(([,item])=>item!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([name,item])=>`${JSON.stringify(name)}:${canonicalRecordJson(item)}`).join(',')}}`;
 return JSON.stringify(value)??'null';
}
export const recordVersionIdentity=(declaration:Raw)=>sha256Hex(canonicalRecordJson(declaration));
export const legacyCatalogId=(entry:Entry)=>typeof entry.raw._catalogLegacyId==='string'?entry.raw._catalogLegacyId:entry.id;
export const hasRecordDiscriminator=(entry:Entry)=>!!(entry.raw._catalogLegacyId||entry.raw._versionBaseName||entry.raw._catalogConflict||entry.raw._catalogPresentationVariant);
function scope(entry:Entry):unknown[]{
 const raw=entry.raw;
 return [entry.kind,entry.source,entry.edition,raw._classEdition,raw._category,raw.className,raw.classSource,
  raw.subclassShortName,raw.subclassSource,raw.shortName,raw.level,raw.raceName,raw.raceSource,raw.pantheon,raw.charoptionType,
  [...(Array.isArray(raw.featureType)?raw.featureType:raw.featureType?[raw.featureType]:[])].map(key).sort().join(','),raw._variantIdentity].map(key);
}
function context(entry:Entry,version=true):string{
 return JSON.stringify([...scope(entry),...([entry.name,entry.english,entry.raw._versionBaseName,version?entry.raw._versionIdentity:undefined].map(key))]);
}
const annotations=new Set(['_versionIdentity','_copySource','_versions']);
function versionBody(entry:Entry):string{
 return canonicalRecordJson(Object.fromEntries(Object.entries(entry.raw).filter(([field])=>!field.startsWith('_catalog')&&!annotations.has(field))));
}
/** Old selections keep their own IDs and snapshots. An alias is evidence only
 * when its source, profile, ownership and authored definition also agree. */
export function sameCatalogRecord(a:Entry,b:Entry):boolean{
 if(a.id===b.id&&!hasRecordDiscriminator(a)&&!hasRecordDiscriminator(b))return context(a,false)===context(b,false);
 if(legacyCatalogId(a)!==legacyCatalogId(b)||context(a,false)!==context(b,false))return false;
 if(a.raw._catalogConflict||b.raw._catalogConflict||a.raw._catalogPresentationVariant||b.raw._catalogPresentationVariant)return versionBody(a)===versionBody(b);
 if(a.raw._versionBaseName||b.raw._versionBaseName){
  if(a.raw._versionIdentity&&b.raw._versionIdentity)return a.raw._versionIdentity===b.raw._versionIdentity;
  return versionBody(a)===versionBody(b);
 }
 return true;
}
/** Keep established IDs unless the actual batch proves a context collision.
 * A single unversioned base keeps its ID; declared versions get their own IDs. */
export function disambiguateCatalogRecords(entries:Entry[]):Entry[]{
 const groups=new Map<string,Entry[]>();
 for(const entry of entries){const group=groups.get(entry.id);if(group)group.push(entry);else groups.set(entry.id,[entry]);}
 return entries.map(entry=>{
  const group=groups.get(entry.id)!;
  if(group.length<2)return entry;
  const peers=group.filter(row=>context(row)===context(entry)),definitions=new Map(peers.map(row=>[sha256Hex(versionBody(row)),row]));
  if(definitions.size>1){
   const fields=[...new Set(peers.flatMap(row=>Object.keys(row.raw)))].filter(field=>!field.startsWith('_catalog')&&
    new Set(peers.map(row=>canonicalRecordJson(row.raw[field]))).size>1);
   const presentation=fields.every(field=>['fluff','tokenUrl','foundryImg','hasFluff','hasFluffImages'].includes(field));
   const digest=sha256Hex(versionBody(entry)),ordinal=[...definitions.keys()].sort().indexOf(digest)+1;
   return {...entry,id:`${entry.id}:definition:${digest}`,raw:{...entry.raw,_catalogLegacyId:entry.id,
    _catalogDefinitionOrdinal:ordinal,...(presentation?{_catalogPresentationVariant:true}:{_catalogConflict:true})}};
  }
  if(new Set(group.map(row=>context(row))).size===1)return entry;
  const bases=group.filter(row=>!row.raw._versionBaseName),baseContexts=new Set(bases.map(row=>context(row)));
  if(!entry.raw._versionBaseName&&baseContexts.size===1)return entry;
  const id=`${entry.id}:definition:${sha256Hex(context(entry))}`;
  return {...entry,id,raw:{...entry.raw,_catalogLegacyId:entry.id}};
 });
}
/** A declared version remains part of its original nonrepeatable rule family.
 * Existing snapshots can use the exact current alias as evidence of that family. */
export function catalogRuleKey(entry:Entry,known:Entry[]=[]):string{
 if(typeof entry.raw._catalogVersionFamilyKey==='string')return entry.raw._catalogVersionFamilyKey;
 if(entry.raw._versionBaseName){
  const current=known.find(row=>typeof row.raw._catalogVersionFamilyKey==='string'&&sameCatalogRecord(row,entry));
  if(current)return current.raw._catalogVersionFamilyKey;
  const parents=known.filter(row=>typeof row.raw._catalogVersionFamilyKey==='string'&&!row.raw._versionBaseName&&key(row.name)===key(entry.raw._versionBaseName)&&JSON.stringify(scope(row))===JSON.stringify(scope(entry)));
  const families=new Set(parents.map(row=>row.raw._catalogVersionFamilyKey));if(families.size===1)return [...families][0];
 }
 const base={...entry,name:entry.raw._versionBaseName||entry.name,raw:{...entry.raw,_versionBaseName:undefined,_versionIdentity:undefined}};
 return JSON.stringify([legacyCatalogId(entry),context(base,false)]);
}
/** Remove a superseded parsed alias at incremental catalog merge boundaries. */
export function mergeCatalogRecords(target:Map<string,Entry>,batch:Entry[]):void{
 const direct=new Set(batch.map(entry=>entry.id));
 for(const entry of batch){const old=entry.raw._catalogLegacyId;if(typeof old==='string'&&old!==entry.id&&!direct.has(old))target.delete(old);}
 for(const entry of batch)target.set(entry.id,entry);
}
export const recordNavigationKey=(entry:Entry)=>sha256Hex(entry.raw._catalogConflict||entry.raw._catalogPresentationVariant?JSON.stringify([context(entry),versionBody(entry)]):context(entry));
export function catalogIdCandidates(id:string,entries:Entry[]):Entry[]{
 const found:Entry[]=[];
 for(const entry of entries)if((entry.id===id||legacyCatalogId(entry)===id)&&!found.some(previous=>sameCatalogRecord(previous,entry)))found.push(entry);
 return found;
}
export function resolveCatalogId(id:string,entries:Entry[],definition?:string):Entry|undefined{
 const candidates=catalogIdCandidates(id,entries).filter(entry=>!definition||recordNavigationKey(entry)===definition);
 return candidates.length===1?candidates[0]:undefined;
}
