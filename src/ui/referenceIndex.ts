import type {Entry} from '../core/model';
import {matchesReference} from '../core/entryReferences';
import {entryNameIndex} from '../core/entryNameIndex';

/** Retain catalog order and identity; an index never chooses between rule editions. */
export class ReferenceIndex {
 private names:ReadonlyMap<string,readonly Entry[]>;
 private ids=new Map<string,Entry>();
 private kinds=new Map<string,Entry[]>();
 constructor(entries:readonly Entry[]){
  this.names=entryNameIndex(entries);
  for(const entry of entries){
   if(!this.ids.has(entry.id))this.ids.set(entry.id,entry);
   const kind=this.kinds.get(entry.kind)||[];kind.push(entry);this.kinds.set(entry.kind,kind);
  }
 }
 byId(id:string){return this.ids.get(id);}
 byKind(kind:string){return this.kinds.get(kind)||[];}
 named(name:string,kind?:string){const rows=this.names.get(name.toLowerCase())||[];return kind?rows.filter(entry=>entry.kind===kind):rows;}
}
export function referenceKind(tag?:string){return ['quickref','variantrule','action','skill','sense','language','itemProperty','itemType','table','deity','facility'].includes(tag||'')?'rule':['optfeature','itemMastery','reward','charoption','psionic'].includes(tag||'')?'feature':['status','disease'].includes(tag||'')?'condition':tag==='creature'?'monster':tag;}
export function indexedReference(index:ReferenceIndex,selected:readonly Entry[],reference:string,tag?:string,detail?:Pick<Entry,'edition'|'source'>){
 if(reference.startsWith('entry:'))return selected.find(entry=>entry.id===reference.slice(6))||index.byId(reference.slice(6));
 const [name,source]=reference.split('|'),kind=referenceKind(tag),lower=name.toLowerCase();
 if(tag==='class'){
  const parts=reference.split('|'),sub=parts[3],subSource=parts[4]||source||'PHB';
  if(sub){const target=[...index.byKind('subclass'),...selected.filter(entry=>entry.kind==='subclass')].find(entry=>entry.source.toLowerCase()===subSource.toLowerCase()&&[entry.name,entry.english,entry.raw.shortName,entry.raw.ENG_shortName].some(value=>typeof value==='string'&&value.toLowerCase()===sub.toLowerCase())&&(entry.raw.classSource||'PHB').toLowerCase()===(source||'PHB').toLowerCase()&&[entry.raw.className,entry.raw.classEnglish].some(value=>typeof value==='string'&&value.toLowerCase()===lower));if(target)return target;}
 }
 const matches=[...index.named(name,kind),...selected.filter(entry=>(!kind||entry.kind===kind)&&[entry.name,entry.english].some(value=>value.toLowerCase()===lower))];
 return kind==='feature'?matches.find(entry=>matchesReference(entry,reference)):source?matches.find(entry=>entry.source.toLowerCase()===source.toLowerCase()):matches.find(entry=>entry.edition===detail?.edition&&entry.source===(detail?.source||'PHB'))||matches.find(entry=>entry.source==='PHB')||matches[0];
}
