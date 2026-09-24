import type {Character, Entry, Selection} from './model';

const key=(value:unknown)=>String(value??'').trim().toLowerCase();
const aliases=(e:Entry)=>[e.name,e.english,e.raw.name,e.raw.ENG_name].map(key).filter(Boolean);
const classNames=(e:Entry)=>[e.raw.className,e.raw.classEnglish,e.raw.classENG_name].map(key).filter(Boolean);
export function classMatches(child:Entry,parent:Entry){
 return parent.kind==='class'&&classNames(child).some(name=>aliases(parent).includes(name))&&key(child.raw.classSource||'PHB')===key(parent.source);
}
export function parentClass(c:Character,row:Selection){
 return c.selections.find(parent=>parent.entry.kind==='class'&&(row.parentId?parent.id===row.parentId&&classMatches(row.entry,parent.entry):classMatches(row.entry,parent.entry)));
}
/** A subclass never has an independent advancement track. */
export function selectionLevel(c:Character,row:Selection){return row.entry.kind==='subclass'?parentClass(c,row)?.level??row.level:row.level;}
export function featureOwner(c:Character,row:Selection,seen=new Set<string>()):Selection|undefined{
 if(seen.has(row.id))return undefined;seen.add(row.id);
 const explicit=c.selections.find(parent=>parent.id===row.parentId||row.requirementId?.startsWith(`${parent.id}:`));
 const raw=row.entry.raw;
 if(raw.subclassShortName||raw.subclassName){
  const names=[raw.subclassShortName,raw.subclassName,raw.subclassEnglish].map(key).filter(Boolean);
  // Source and parent class qualify short names; translated display text alone
  // cannot distinguish subclasses shared by different editions or classes.
  const subclass=c.selections.find(parent=>parent.entry.kind==='subclass'&&
   names.some(name=>[...aliases(parent.entry),key(parent.entry.raw.shortName),key(parent.entry.raw.ENG_shortName)].includes(name))&&
   key(raw.subclassSource||raw.classSource||'PHB')===key(parent.entry.source)&&
   (parentClass(c,parent)?classMatches(row.entry,parentClass(c,parent)!.entry):classNames(row.entry).some(name=>classNames(parent.entry).includes(name)))&&
   key(raw.classSource||'PHB')===key(parent.entry.raw.classSource||'PHB'));
  if(subclass)return subclass;
  // Do not label an unbound subclass feature as a main-class feature.
  return explicit?.entry.kind==='subclass'?explicit:undefined;
 }
 if(explicit)return explicit;
 const inline=c.selections.find(parent=>parent.entry.id===raw._inlineOwner);
 if(inline)return inline.entry.kind==='feature'?featureOwner(c,inline,seen):inline;
 return c.selections.find(parent=>classMatches(row.entry,parent.entry));
}
