import {editionAllows,type Edition,type Entry} from '../model';

const key=(value:string)=>value.trim().toLowerCase();
type Result={supported:false;reason:string}|{supported:true;references:string[];ambiguous:boolean};
const referenceKey=(name:string,source:string)=>JSON.stringify([key(name),key(source||'PHB')]);
function referenceIndex(entries:readonly Entry[]){
 const index=new Map<string,Set<string>>();
 for(const entry of entries.filter(entry=>entry.kind==='spell'))for(const name of [entry.name,entry.english]){
  if(typeof name!=='string'||!name.trim())continue;
  const uid=referenceKey(name,entry.source),ids=index.get(uid)||new Set<string>();ids.add(entry.id);index.set(uid,ids);
 }
 return index;
}
/** Compare selected spells by their source-qualified identity, including aliases. */
export function sourceSpellIdentities(entries:readonly Entry[]):(reference:string)=>string{
 const index=referenceIndex(entries);
 return reference=>{const [name,source='PHB']=reference.split('#')[0].split('|'),uid=referenceKey(name,source),ids=index.get(uid);return ids?.size===1?`entry:${ids.values().next().value}`:`uid:${uid}`;};
}
/** Positive filter clauses are ANDed; semicolon alternatives are ORed.
 * Grammar: tjliqy/5etools-cn@5cc0bbe, render.js getFilterSubhashes and
 * filter/filter-filter-generic.js. Never drop an unrecognized clause. */
export function sourceSpellFilter(expression:unknown,entries:readonly Entry[],edition:Edition,legacy=false):Result{
 const held=(reason='法术筛选条件尚未核验，保留手工选择；不会忽略未知条件。'):Result=>({supported:false,reason});
 if(typeof expression!=='string'||!expression.trim()||expression.length>2000)return held();
 const predicates:((entry:Entry)=>boolean)[]=[],seen=new Set<string>();
 for(const clause of expression.split('|')){
  const [name,values,...extra]=clause.split('='),field=key(name),terms=values?.split(';').map(key);
  if(extra.length||seen.has(field)||!terms?.length||terms.some(term=>!term||/[!\[\]:=]/.test(term))||new Set(terms).size!==terms.length)return held();
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
  }else if(field==='class')return held('职业法表筛选尚待独立核验，请按原文手动选择；不会省略职业条件。');
  else return held();
 }
 const spells=entries.filter(entry=>entry.kind==='spell'),identities=referenceIndex(spells);
 const references:string[]=[],used=new Set<string>();let ambiguous=false;
 for(const entry of spells){
  if(!editionAllows(entry,edition,legacy)||!predicates.every(matches=>matches(entry)))continue;
  const name=entry.english||entry.name,uid=`${name}|${entry.source}`;
  if(!name?.trim()||name.length>512||/[|#\r\n]/.test(name)||!(/^[a-z0-9_.-]{1,80}$/i.test(entry.source))||identities.get(referenceKey(name,entry.source))?.size!==1){ambiguous=true;continue;}
  if(!used.has(key(uid))){references.push(uid);used.add(key(uid));}
 }
 return {supported:true,references:references.sort((a,b)=>a.localeCompare(b,'zh-CN')),ambiguous};
}
