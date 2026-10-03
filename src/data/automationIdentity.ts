import {createIdentity,containsCjk,type Identity} from './automation/identity';
import type {Entry} from '../core/model';
const key=(value:unknown)=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function identityForAutomation(entry:Entry,catalog:readonly Entry[]):Identity|undefined{
 return automationIdentityResolver(catalog)(entry);
}
export function automationIdentityResolver(catalog:readonly Entry[]):(entry:Entry)=>Identity|undefined {
 const parents=new Map<string,Set<string>>(),parentKey=(pack:string,source:string,type:Entry['kind'],value:unknown)=>JSON.stringify([pack,source.toUpperCase(),type,key(value)]);
 for(const e of catalog)if(['class','subclass','race'].includes(e.kind)){
  const english=String(e.kind==='subclass'?e.raw.ENG_shortName||e.english:e.english);if(containsCjk(english))continue;
  for(const name of [e.name,e.english,e.raw.name,e.raw.ENG_name,e.raw.shortName,e.raw.ENG_shortName].filter(Boolean)){const k=parentKey(e.packId,e.source,e.kind,name);if(!parents.has(k))parents.set(k,new Set());parents.get(k)!.add(english);}
 }
 return entry=>{
 const raw=entry.raw,kind=String(raw._category||entry.kind),source=entry.source;
 const english=String(raw.ENG_name||entry.english||'');if(!english||containsCjk(english))return;
 const resolve=(value:unknown,type:Entry['kind'],book:string)=>{
  const names=[...(parents.get(parentKey(entry.packId,book,type,value))||[])];
  return names.length===1?String(names[0]):typeof value==='string'&&!containsCjk(value)?value:undefined;
 };
 const fields:any={kind,source,engName:english,packId:entry.packId};
 if(raw.className){fields.classSource=raw.classSource||'PHB';fields.classEngName=raw.classENG_name||raw.classEnglish||resolve(raw.className,'class',fields.classSource);}
 const sub=kind==='subclass'?raw.shortName:raw.subclassShortName;
 if(sub){fields.subclassSource=raw.subclassSource||source;fields.subclassEngShortName=raw.ENG_shortName||resolve(sub,'subclass',fields.subclassSource);}
 if(kind==='subrace'||raw.raceName){fields.raceSource=raw.raceSource||'PHB';fields.raceEngName=resolve(raw.raceName,'race',fields.raceSource);}
 if(['classFeature','subclassFeature'].includes(kind))fields.level=Number(raw.level)||0;
 if(raw._variantIdentity&&!containsCjk(raw._variantIdentity))fields.extra=raw._variantIdentity;
 try{return createIdentity(fields);}catch{return;}
 };
}
