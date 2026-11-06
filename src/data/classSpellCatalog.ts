import type {Raw} from '../core/model';
import metadata from './classSpellFilterSources.json' with {type:'json'};
const {abbreviations,nonstandardSources,nonstandardPrefixes,homebrewSources}=metadata;

export type ClassSpellFilterSource={source:string;abbreviation:string;nonstandard:boolean;registeredHomebrew:boolean}|{source:string;unresolved:true};
const text=(value:unknown):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=80&&!/[\r\n\0]/.test(value);
/** Catalog identity metadata only. Content origin is not source registration. */
export function classSpellFilterSource(body:Raw,source:string):ClassSpellFilterSource{
 const id=source.toUpperCase(),rows:Raw[]=(Array.isArray(body._meta?.sources)?body._meta.sources:[]).filter((row:Raw)=>text(row?.json)&&row.json.toUpperCase()===id);
 const registered=(homebrewSources as Record<string,{abbreviations:string[]}>)[id];
 const declared=new Set([...rows.map(row=>row.abbreviation).filter(text),...(registered?.abbreviations||[])]);
 if(new Set([...declared].map(value=>value.toLowerCase())).size>1)return {source:id,unresolved:true};
 const abbreviation=(abbreviations as Record<string,string>)[id]||[...declared][0];
 if(!text(abbreviation))return {source:id,unresolved:true};
 const registeredHomebrew=rows.length>0||!!registered;
 const nonstandard=registeredHomebrew||nonstandardSources.includes(id)||nonstandardPrefixes.some(prefix=>id.startsWith(prefix));
 return {source:id,abbreviation,nonstandard,registeredHomebrew};
}
