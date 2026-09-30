import {type Entry,type RuleProfile} from './model';

export const SOURCE_GROUPS=['三宝书','核心规则','模组内容','第三方','威世智每月更新'] as const;
export type SourceGroup=typeof SOURCE_GROUPS[number];
export type SourceMeta={name:string;date?:string;category?:SourceGroup};
export type SourceRegistry=Record<string,SourceMeta>;
/** Deprecated storage only. Old backups remain readable; these choices never filter the library. */
export type ConflictSettings={mode:'latest'|'manual'|'all';selected:Record<string,string[]>};
const trilogy=new Set(['PHB','DMG','MM','XPHB','XDMG','XMM']);
export function sourceGroup(id:string,registry:SourceRegistry,entries:Entry[]=[]):SourceGroup{
 if(trilogy.has(id))return '三宝书';
 if(registry[id]?.category)return registry[id].category;
 if(entries.some(e=>e.raw._homebrew||e.raw._custom||!['kiwee','builtin'].includes(e.packId)))return '第三方';
 return '核心规则';
}
export function setSourceGroup(profile:RuleProfile,sources:string[],enabled:boolean){
 const selected=new Set(profile.enabledSources);for(const id of sources)if(enabled)selected.add(id);else selected.delete(id);
 profile.enabledSources=[...selected];
 if(profile.autoSourceDefaults)profile.autoSourceDefaults=[...new Set([...profile.autoSourceDefaults,...sources])];
}
