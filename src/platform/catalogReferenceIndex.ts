import type {Character,Entry} from '../core/model';
import {entryNameIndex} from '../core/entryNameIndex';
import {requirementMismatch} from '../core/engine';

export type CatalogReferenceIndex={names:ReturnType<typeof entryNameIndex>;ids:ReadonlyMap<string,readonly Entry[]>;subclasses:ReadonlyMap<string,readonly Entry[]>};
const indexes=new WeakMap<readonly Entry[],CatalogReferenceIndex>();
/** Immutable catalog order determines precedence. Keep duplicates and source /
 * edition identities separate, exactly as the original linear reader did. */
export function catalogReferenceIndex(entries:readonly Entry[],names?:ReturnType<typeof entryNameIndex>):CatalogReferenceIndex{
 const old=indexes.get(entries);if(old)return old;
 const ids=new Map<string,Entry[]>(),subclasses=new Map<string,Entry[]>();
 const add=(map:Map<string,Entry[]>,key:string,entry:Entry)=>{const group=map.get(key);if(group)group.push(entry);else map.set(key,[entry]);};
 for(const entry of entries){
  add(ids,entry.id,entry);
  if(entry.kind==='subclass')for(const name of new Set([entry.name,entry.english,entry.raw.shortName,entry.raw.ENG_shortName].filter((name):name is string=>typeof name==='string').map(name=>name.toLowerCase())))add(subclasses,name,entry);
 }
 const result={names:names||entryNameIndex(entries),ids,subclasses};indexes.set(entries,result);return result;
}

export function referenceKind(tag?:string){return ['quickref','variantrule','action','skill','sense','language','itemProperty','itemType','table','deity','facility'].includes(tag||'')?'rule':['optfeature','itemMastery','reward','charoption','psionic'].includes(tag||'')?'feature':['status','disease'].includes(tag||'')?'condition':tag==='creature'?'monster':tag;}
type Reading={index:CatalogReferenceIndex;character:Character|undefined;canRead:(entry:Entry)=>boolean;edition?:string;source?:string};
export function lookupCatalogReference({index,character,canRead,edition,source:detailSource}:Reading,reference:string,tag?:string):Entry|undefined{
 if(reference.startsWith('entry:')){const id=reference.slice(6);return character?.selections.find(row=>row.entry.id===id&&canRead(row.entry))?.entry||index.ids.get(id)?.find(canRead);}
 const [name,source]=reference.split('|'),kind=referenceKind(tag);
 const selected=character?.selections.map(row=>row.entry).filter(canRead)||[];
 if(tag==='class'){
  const parts=reference.split('|'),sub=parts[3],subSource=parts[4]||source||'PHB';
  if(sub){const candidates=[...(index.subclasses.get(sub.toLowerCase())||[]).filter(canRead),...selected];const target=candidates.find(entry=>entry.kind==='subclass'&&entry.source.toLowerCase()===subSource.toLowerCase()&&[entry.name,entry.english,entry.raw.shortName,entry.raw.ENG_shortName].some(value=>typeof value==='string'&&value.toLowerCase()===sub.toLowerCase())&&(entry.raw.classSource||'PHB').toLowerCase()===(source||'PHB').toLowerCase()&&[entry.raw.className,entry.raw.classEnglish].some(value=>typeof value==='string'&&value.toLowerCase()===name.toLowerCase()));if(target)return target;}
 }
 const matches=[...(index.names.get(name.toLowerCase())||[]).filter(canRead),...selected.filter(entry=>[entry.name,entry.english].some(value=>value.toLowerCase()===name.toLowerCase()))].filter(entry=>!kind||entry.kind===kind);
 return kind==='feature'?matches.find(entry=>!requirementMismatch(entry,{refs:[reference]})):source?matches.find(entry=>entry.source.toLowerCase()===source.toLowerCase()):matches.find(entry=>entry.edition===edition&&entry.source===(detailSource||'PHB'))||matches.find(entry=>entry.source==='PHB')||matches[0];
}
