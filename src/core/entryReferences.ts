import type {Entry} from './model';
import {sameCatalogRecord} from './entryRecordIdentity';
const key=(value:unknown)=>String(value??'').trim().toLowerCase();
const same=(a:unknown,b:unknown)=>key(a)===key(b);
const tagKinds:Record<string,Entry['kind']>={classfeature:'feature',subclassfeature:'feature',optfeature:'feature',optionalfeature:'feature',reward:'feature',charoption:'feature',psionic:'feature',boon:'feature',itemmastery:'feature',quickref:'rule',variantrule:'rule',action:'rule',skill:'rule',sense:'rule',language:'rule',itemproperty:'rule',itemtype:'rule',table:'rule',tablegroup:'rule',deity:'rule',cult:'rule',facility:'rule',status:'condition',disease:'condition',creature:'monster',baseitem:'item',itemgroup:'item',magicvariant:'item'};
const tagCategories:Record<string,string>={classfeature:'classFeature',subclassfeature:'subclassFeature',optfeature:'optionalfeature',optionalfeature:'optionalfeature',reward:'reward',charoption:'charoption',psionic:'psionic',boon:'boon',itemmastery:'itemMastery',variantrule:'variantrule',action:'action',skill:'skill',sense:'sense',language:'language',itemproperty:'itemProperty',itemtype:'itemType',table:'table',tablegroup:'tableGroup',deity:'deity',cult:'cult',facility:'facility',status:'status',disease:'disease',itemgroup:'itemGroup',magicvariant:'magicvariant'};
export const referenceEntryKind=(tag?:string):Entry['kind']|undefined=>tag?(tagKinds[key(tag)]||key(tag) as Entry['kind']):undefined;
export const referenceEntryCategory=(tag?:string):string|undefined=>tag?tagCategories[key(tag)]:undefined;
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
export function entryReferenceCandidates(reference:string,entries:Entry[],kind?:Entry['kind'],category?:string):Entry[]{
 let candidates=entries.filter(e=>(!kind||e.kind===kind)&&(!category||!e.raw._category||same(e.raw._category,category))&&matchesReference(e,reference));
 const authored=candidates.filter(entry=>same(entry.name,reference.split('|')[0]));
 if(authored.length)candidates=authored;
 const bases=candidates.filter(entry=>!entry.raw._versionBaseName);
 if(bases.length)candidates=bases;
 const distinct:Entry[]=[];
 for(const entry of candidates)if(!distinct.some(previous=>sameCatalogRecord(previous,entry)))distinct.push(entry);
 return distinct;
}
export function resolveEntryReference(reference:string,entries:Entry[],kind?:Entry['kind'],category?:string){
 const candidates=entryReferenceCandidates(reference,entries,kind,category);
 return candidates.length===1?candidates[0]:undefined;
}
export type EntryReferenceResolver=(reference:string,kind?:Entry['kind'],category?:string)=>Entry|undefined;
/** Build once for a single immutable planning snapshot. No global cache survives
 * an edit or refresh; all source/owner/ambiguity checks still run on candidates. */
export function entryReferenceResolver(entries:readonly Entry[]):EntryReferenceResolver{
 const names=new Map<string,Entry[]>();
 for(const entry of entries)for(const name of new Set([key(entry.name),key(entry.english)])){
  const group=names.get(name);if(group)group.push(entry);else names.set(name,[entry]);
 }
 return (reference,kind,category)=>resolveEntryReference(reference,names.get(key(reference.split('|')[0]))||[],kind,category);
}
export function ownsSubclassFeature(subclass:Entry,feature:Entry){
 const s=subclass.raw,f=feature.raw;
 return subclass.kind==='subclass'&&same(s.classSource||'PHB',f.classSource||'PHB')&&
  [s.className,s.classEnglish].some(n=>n&&[f.className,f.classEnglish].some(m=>m&&same(n,m)))&&
  same(subclass.source,f.subclassSource||'PHB')&&[s.shortName,s.ENG_shortName,subclass.name,subclass.english].some(n=>n&&same(n,f.subclassShortName));
}
