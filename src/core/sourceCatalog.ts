import {entryEdition,type Entry,type Edition,type RuleProfile} from './model';

export const SOURCE_GROUPS=['三宝书','核心规则','模组内容','第三方','威世智每月更新'] as const;
export type SourceGroup=typeof SOURCE_GROUPS[number];
export type SourceMeta={name:string;date?:string;category?:SourceGroup};
export type SourceRegistry=Record<string,SourceMeta>;
export type ConflictSettings={mode:'latest'|'manual'|'all';selected:Record<string,string[]>};
const trilogy=new Set(['PHB','DMG','MM','XPHB','XDMG','XMM']);
export function sourceGroup(id:string,registry:SourceRegistry,entries:Entry[]=[]):SourceGroup{
 if(trilogy.has(id))return '三宝书';
 if(registry[id]?.category)return registry[id].category;
 if(entries.some(e=>e.raw._homebrew||e.raw._custom||!['kiwee','builtin'].includes(e.packId)))return '第三方';
 return '核心规则';
}
const key=(value:unknown)=>String(value||'').trim().toLocaleLowerCase();
/** A comparison group is not an entry identity. Keep every original ID/source.
 * Owner, level and variant prevent unrelated homonyms from hiding each other. */
export function conflictKey(e:Entry,edition:Edition):string{
 const scope=e.raw._classEdition||(['subclass','feature'].includes(e.kind)?entryEdition(e):e.edition);
 return JSON.stringify([scope==='both'?edition:scope,e.kind,key(e.english||e.name),e.raw._category||e.kind,key(e.raw.classEnglish||e.raw.classENG_name||e.raw.className),key(e.raw.subclassShortName),e.kind==='feature'?e.raw.level:null,key(e.raw.raceName),e.raw._variantIdentity||'',e.raw.pantheon||'']);
}
export function catalogEditionAllows(e:Entry,edition:Edition){
 const scope=e.raw._classEdition||(['subclass','feature'].includes(e.kind)?entryEdition(e):e.edition);
 return scope==='both'||scope===edition;
}
export type SourceConflict={key:string;name:string;kind:Entry['kind'];entries:Entry[];latest:string[];uncertain:boolean};
function publicationDate(e:Entry,registry:SourceRegistry){const date=registry[e.source]?.date;return date&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))?date:undefined;}
export function sourceConflicts(entries:Entry[],edition:Edition,registry:SourceRegistry):SourceConflict[]{
 const groups=new Map<string,Map<string,Entry>>();
 // Core books stay independently available, including adapted old subclasses.
 // Duplicate resolution is for expansion reprints, never PHB/DMG/MM editions.
 for(const e of entries){if(trilogy.has(e.source.toUpperCase())||!catalogEditionAllows(e,edition)||e.raw._custom)continue;const id=conflictKey(e,edition),group=groups.get(id)||new Map();group.set(e.id,e);groups.set(id,group);}
 return [...groups].flatMap(([id,group])=>{
  const rows=[...group.values()];if(new Set(rows.map(e=>e.source)).size<2)return [];
  rows.sort((a,b)=>(publicationDate(b,registry)||'').localeCompare(publicationDate(a,registry)||'')||a.id.localeCompare(b.id));
  const date=publicationDate(rows[0],registry),unknown=rows.some(e=>!publicationDate(e,registry));
  // Missing dates or ties cannot justify silently discarding a source.
  const latest=unknown?rows.map(e=>e.id):rows.filter(e=>publicationDate(e,registry)===date).map(e=>e.id);
  return [{key:id,name:rows[0].name,kind:rows[0].kind,entries:rows,latest,uncertain:unknown||latest.length>1}];
 }).sort((a,b)=>a.kind.localeCompare(b.kind)||a.name.localeCompare(b.name,'zh-CN'));
}
export function conflictSelection(group:SourceConflict,settings?:ConflictSettings):string[]{
 if(settings?.mode==='all')return group.entries.map(e=>e.id);
 const manual=settings?.mode==='manual'&&settings.selected[group.key];
 // A remembered manual decision applies to existing identities only.
 return manual?group.entries.filter(e=>manual.includes(e.id)).map(e=>e.id):group.latest;
}
export function hiddenConflictEntries(entries:Entry[],edition:Edition,registry:SourceRegistry,settings?:ConflictSettings):Set<string>{
 return new Set(sourceConflicts(entries,edition,registry).flatMap(group=>{const keep=new Set(conflictSelection(group,settings));return group.entries.filter(e=>!keep.has(e.id)).map(e=>e.id);}));
}
export function setSourceGroup(profile:RuleProfile,sources:string[],enabled:boolean){
 const selected=new Set(profile.enabledSources);for(const id of sources)if(enabled)selected.add(id);else selected.delete(id);
 profile.enabledSources=[...selected];
 if(profile.autoSourceDefaults)profile.autoSourceDefaults=[...new Set([...profile.autoSourceDefaults,...sources])];
}
