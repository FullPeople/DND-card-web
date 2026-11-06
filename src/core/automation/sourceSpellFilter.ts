import {editionAllows,type Edition,type Entry} from '../model';
import {projectClassSpellFilter,type ClassSpellFilterContext} from './classSpellFilter';

const key=(value:string)=>value.trim().toLowerCase();
type Result={supported:false;reason:string}|{supported:true;references:string[];ambiguous:boolean;contextEntries?:Entry[];incomplete?:boolean;reason?:string};
const referenceKey=(name:string,source:string)=>JSON.stringify([key(name),key(source||'PHB')]);
// Preserve legacy UID codes and the canonical declared sources validated by Data90.
const referenceSource=(source:string)=>source.length<=80&&(/^[a-z0-9_.-]+$/i.test(source)||/^[a-z0-9][a-z0-9_:&-]*(?: [a-z0-9_:&-]+)*$/i.test(source));
function referenceIndex(entries:readonly Entry[]){
 const index=new Map<string,Set<string>>();
 for(const entry of entries.filter(entry=>entry.kind==='spell'))for(const name of [entry.name,entry.english]){
  if(typeof name!=='string'||!name.trim())continue;
  const uid=referenceKey(name,entry.source),ids=index.get(uid)||new Set<string>();ids.add(entry.id);index.set(uid,ids);
 }
 return index;
}
/** Compare selected spells by their source-qualified identity, including aliases. */
export function sourceSpellIdentities(entries:readonly Entry[],includeCastLevel=false):(reference:string)=>string{
 const index=referenceIndex(entries),byId=includeCastLevel?new Map(entries.map(entry=>[entry.id,entry])):undefined;
 return reference=>{const [uidPart,suffix]=reference.split('#'),[name,source='PHB']=uidPart.split('|'),uid=referenceKey(name,source),ids=index.get(uid),id=ids?.size===1?ids.values().next().value:undefined,identity=id?`entry:${id}`:`uid:${uid}`;
  if(!includeCastLevel)return identity;
  const level=id?Number(byId?.get(id)?.raw.level):NaN,cast=suffix?(suffix.toLowerCase()==='c'?0:/^[1-9]$/.test(suffix)?Number(suffix):suffix):Number.isInteger(level)&&level>=0&&level<=9?level:'native';return JSON.stringify([identity,cast]);
 };
}
/** Positive filter clauses are ANDed; semicolon alternatives are ORed.
 * Grammar: tjliqy/5etools-cn@5cc0bbe, render.js getFilterSubhashes and
 * filter/filter-filter-generic.js. Never drop an unrecognized clause. */
export function sourceSpellFilter(expression:unknown,entries:readonly Entry[],edition:Edition,legacy=false,context:ClassSpellFilterContext={}):Result{
 const held=(reason='法术筛选条件尚未核验，保留手工选择；不会忽略未知条件。'):Result=>({supported:false,reason});
 if(typeof expression!=='string'||!expression.trim()||expression.length>2000)return held();
 const predicates:((entry:Entry)=>boolean)[]=[],seen=new Set<string>();let classTerms:string[]|undefined;
 for(const clause of expression.split('|')){
  const [name,values,...extra]=clause.split('='),field=key(name),terms=values?.split(';').map(key);
  if(extra.length||seen.has(field)||!terms?.length||terms.some(term=>!term||(field==='class'?/[!\r\n\0=]/:/[!\[\]:=]/).test(term))||new Set(terms).size!==terms.length)return held();
  seen.add(field);
  if(field==='level'){
   if(terms.some(term=>!/^\d$/.test(term)))return held();
   predicates.push(entry=>Number.isInteger(entry.raw.level)&&terms.includes(String(entry.raw.level)));
  }else if(field==='school'){
   if(terms.some(term=>!['a','c','d','e','v','i','n','t'].includes(term)))return held();
   predicates.push(entry=>typeof entry.raw.school==='string'&&terms.includes(key(entry.raw.school)));
  }else if(field==='subschool'){
   predicates.push(entry=>Array.isArray(entry.raw.subschools)&&entry.raw.subschools.some((value:unknown)=>typeof value==='string'&&terms.includes(key(value))));
  }else if(field==='components & miscellaneous'){
   if(terms.some(term=>!['ritual','仪式'].includes(term)))return held();
   predicates.push(entry=>entry.raw.meta?.ritual===true);
  }else if(field==='spell attack'){
   if(terms.some(term=>!['m','r','o'].includes(term)))return held();
   predicates.push(entry=>Array.isArray(entry.raw.spellAttack)&&entry.raw.spellAttack.some((value:unknown)=>typeof value==='string'&&terms.includes(key(value))));
  }else if(field==='class')classTerms=terms;
  else return held();
 }
 const spells=entries.filter(entry=>entry.kind==='spell'),identities=referenceIndex(spells);
 const projection=classTerms?projectClassSpellFilter(classTerms,entries,spells.filter(entry=>editionAllows(entry,edition,legacy)&&predicates.every(matches=>matches(entry))),edition,legacy,context):undefined;
 if(projection&&!projection.supported)return held(projection.reason);
 const references:string[]=[],used=new Set<string>();let ambiguous=false;
 for(const entry of spells){
  if(!editionAllows(entry,edition,legacy)||!predicates.every(matches=>matches(entry))||projection?.supported&&!projection.ids.has(entry.id))continue;
  const name=entry.english||entry.name,uid=`${name}|${entry.source}`;
  if(!name?.trim()||name.length>512||/[|#\r\n]/.test(name)||!referenceSource(entry.source)||identities.get(referenceKey(name,entry.source))?.size!==1){ambiguous=true;continue;}
  if(!used.has(key(uid))){references.push(uid);used.add(key(uid));}
 }
 return {supported:true,references:references.sort((a,b)=>a.localeCompare(b,'zh-CN')),ambiguous,...(projection?.supported?{contextEntries:projection.contextEntries,...(projection.incomplete?{incomplete:true,reason:projection.reason}:{})}:{})};
}
