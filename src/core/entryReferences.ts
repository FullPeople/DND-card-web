import type {Entry} from './model';
const key=(value:unknown)=>String(value??'').trim().toLowerCase();
const same=(a:unknown,b:unknown)=>key(a)===key(b);
/** Source UIDs have independent defaults: omitted subclass source is PHB,
 * even when the parent class is XPHB. Feature source defaults to its owner. */
export function matchesReference(entry:Entry,reference:string):boolean{
 const p=reference.split('|');
 if(![entry.name,entry.english].some(n=>same(n,p[0])))return false;
 if(entry.kind!=='feature'||p.length<4)return !p[1]||same(entry.source,p[1]);
 const r=entry.raw,sub=p.length>=6,classSource=p[2]||'PHB',subSource=p[4]||'PHB';
 return [r.className,r.classEnglish].some(n=>same(n,p[1]))&&same(r.classSource||'PHB',classSource)&&
  same(r.level,sub?p[5]:p[3])&&same(entry.source,sub?p[6]||subSource:p[4]||classSource)&&
  (sub?[r.subclassShortName,r.subclassEnglish].some(n=>same(n,p[3]))&&same(r.subclassSource||'PHB',subSource):!r.subclassShortName);
}
export function resolveEntryReference(reference:string,entries:Entry[],kind?:Entry['kind']){
 return entries.find(e=>(!kind||e.kind===kind)&&matchesReference(e,reference));
}
export function ownsSubclassFeature(subclass:Entry,feature:Entry){
 const s=subclass.raw,f=feature.raw;
 return subclass.kind==='subclass'&&same(s.classSource||'PHB',f.classSource||'PHB')&&
  [s.className,s.classEnglish].some(n=>n&&[f.className,f.classEnglish].some(m=>m&&same(n,m)))&&
  same(subclass.source,f.subclassSource||'PHB')&&[s.shortName,s.ENG_shortName,subclass.name,subclass.english].some(n=>n&&same(n,f.subclassShortName));
}
