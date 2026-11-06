import {editionAllows,type Edition,type Entry} from '../model';
import {classSpellFilterSource,type ClassSpellFilterSource} from '../../data/classSpellCatalog';

export interface ClassSpellFilterContext {
 entryAllowed?:(entry:Entry)=>boolean;
 sourceEnabled?:(source:string)=>boolean;
 sourceMetadata?:Readonly<Record<string,ClassSpellFilterSource>>;
 optionalMembership?:(spell:Entry,owner:Entry,definedInSources:readonly string[])=>{allowed:boolean;reason?:string};
}
type Projection={supported:false;reason:string}|{supported:true;ids:Set<string>;contextEntries:Entry[];incomplete:boolean;reason?:string};
const key=(value:string)=>value.trim().toLowerCase();
const plain=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const names=(entry:Entry)=>[...new Set([entry.name,entry.english,entry.raw.name,entry.raw.ENG_name].filter((name):name is string=>typeof name==='string'&&!!name.trim()).map(key))];
const tuple=(name:string,source:string)=>JSON.stringify([key(name),key(source)]);
/** Source-qualified class-list queries. Catalog metadata never extends a saved rule snapshot. */
export function projectClassSpellFilter(terms:readonly string[],entries:readonly Entry[],candidateSpells:readonly Entry[],edition:Edition,legacy=false,context:ClassSpellFilterContext={}):Projection{
 const reasons=new Set<string>(),note=(reason:string)=>{reasons.add(reason);};
 const allowed=(entry:Entry)=>editionAllows(entry,edition,legacy)&&context.entryAllowed?.(entry)!==false;
 const classes=entries.filter(entry=>entry.kind==='class'&&allowed(entry)),spells=entries.filter(entry=>entry.kind==='spell');
 const aliases=new Map<string,Entry[]>(),labels=new Map<string,Entry[]>(),spellIds=new Map<string,Set<string>>();
 for(const owner of classes){
  for(const name of names(owner)){const id=tuple(name,owner.source),rows=aliases.get(id)||[];if(!rows.some(row=>row.id===owner.id))rows.push(owner);aliases.set(id,rows);}
  const metadata=context.sourceMetadata?.[owner.source]||classSpellFilterSource({},owner.source);
  if('unresolved' in metadata||metadata.source!==owner.source||!metadata.abbreviation?.trim())continue;
  for(const name of names(owner)){
   const label=key(name.split('(')[0].trim()+(metadata.nonstandard?` (${metadata.abbreviation})`:'')),rows=labels.get(label)||[];
   if(!rows.some(row=>row.id===owner.id))rows.push(owner);labels.set(label,rows);
  }
 }
 const roots:Entry[]=[],ambiguousRoots=new Set<string>();
 for(const term of terms){
  const rows=labels.get(key(term));if(!rows?.length)return {supported:false,reason:'职业法表条件无法匹配当前版本、来源或已加载目录；请核对原文，原选择保留。'};
  for(const row of rows)if(rows.some(other=>other.id!==row.id&&key(other.source)===key(row.source)))ambiguousRoots.add(row.id);
  roots.push(...rows);
 }
 for(const spell of spells)for(const name of names(spell)){const id=tuple(name,spell.source),ids=spellIds.get(id)||new Set<string>();ids.add(spell.id);spellIds.set(id,ids);}
 const sourceEnabled=(source:string)=>context.sourceEnabled?.(source.toUpperCase())!==false;
 function matchesAlias(name:string,source:string,owner:Entry):boolean{
  if(key(source)!==key(owner.source)||!names(owner).includes(key(name)))return false;
  const rows=aliases.get(tuple(name,source));if(rows?.length===1&&rows[0].id===owner.id)return true;
  note('职业法表关联的来源身份不唯一，未按同名资料自动合并。');return false;
 }
 function definition(value:unknown):boolean{
  if(value===true)return true;
  if(!plain(value)||Object.keys(value).some(field=>field!=='definedInSources')||!Array.isArray(value.definedInSources)||!value.definedInSources.length||value.definedInSources.some(source=>typeof source!=='string'||!source.trim())){note('部分职业法表关联格式尚待核验，未自动加入这些候选。');return false;}
  if(value.definedInSources.some(source=>sourceEnabled(source as string)))return true;
  note('部分职业法表关联的来源当前停用，原选择保留。');return false;
 }
 function directMembership(spell:Entry,owner:Entry):boolean{
  const ownerNames=names(owner),matches=(row:Record<string,unknown>)=>typeof row.name==='string'&&matchesAlias(row.name,typeof row.source==='string'?row.source:'PHB',owner);
  let base=false;const optionalSources=new Set<string>();let hasOptional=false;
  const rawLists=spell.raw.classes;
  if(plain(rawLists)){
   for(const field of ['fromClassList','fromClassListVariant']){
    const rows=rawLists[field];if(rows===undefined)continue;if(!Array.isArray(rows)){note('部分法术的职业关联尚不完整，未按名称推断法表。');continue;}
    for(const row of rows){
     if(!plain(row)||!matches(row))continue;
     if(field==='fromClassList'){
      if(row.definedInSource!==undefined){if(typeof row.definedInSource!=='string'||!sourceEnabled(row.definedInSource)){note('部分职业法表关联的来源未知或停用。');continue;}}
      base=true;
     }else{hasOptional=true;if(typeof row.definedInSource==='string')optionalSources.add(row.definedInSource);}
    }
   }
  }
  const lookup=spell.raw._spellClasses??spell.raw._spellSources?.class;
  const variants=spell.raw._spellSources?.classVariant;
  for(const [value,variant] of [[lookup,false],[variants,true]] as const){
   if(!plain(value))continue;
   for(const [source,rows] of Object.entries(value)){
    if(key(source)!==key(owner.source)||!plain(rows))continue;
    for(const [name,relationship] of Object.entries(rows)){
     if(!ownerNames.includes(key(name))||!matchesAlias(name,source,owner))continue;
     if(!variant){base=definition(relationship)||base;continue;}
     hasOptional=true;
     if(plain(relationship)&&Array.isArray(relationship.definedInSources))for(const book of relationship.definedInSources)if(typeof book==='string')optionalSources.add(book);
    }
   }
  }
  if(base)return true;
  if(hasOptional){
   const sources=[...optionalSources];
   if(sources.length&&sources.every(sourceEnabled)){
    const decision=context.optionalMembership?.(spell,owner,sources);if(decision?.allowed)return true;
    note(decision?.reason||'部分候选仅属于可选职业法表，尚无有效授权；已核对的基础法表仍可选择。');
   }else note('部分可选职业法表的来源未知或停用，未自动加入候选。');
  }
  return false;
 }
 function uid(value:unknown):Set<string>{
  if(typeof value!=='string'||value.length>600){note('部分法表引用格式尚待核验。');return new Set();}
  const [name,source='PHB',...extra]=value.split('|');
  if(extra.length||!name.trim()||/[#\r\n\0]/.test(value)||!source.trim()){note('部分法表引用格式尚待核验。');return new Set();}
  const ids=spellIds.get(tuple(name,source));if(!ids?.size){note('部分法表引用尚未加载或无法匹配，原选择保留。');return new Set();}
  return ids;
 }
 const memo=new Map<string,Set<string>>(),visiting=new Set<string>(),contextEntries=new Map<string,Entry>();
 function resolve(owner:Entry):Set<string>{
  contextEntries.set(owner.id,owner);
  if(visiting.has(owner.id)){note('职业法表继承出现循环，未把循环分支视为完整法表。');return new Set();}
  const cached=memo.get(owner.id);if(cached)return cached;
  const result=new Set<string>();memo.set(owner.id,result);visiting.add(owner.id);
  if(ambiguousRoots.has(owner.id)){note('职业法表来源存在互相冲突的身份，未自动任选一份。');visiting.delete(owner.id);return result;}
  if(owner.raw._copy||owner.raw._unresolvedParent){note('职业来源继承尚未完成，未按同名条目补全。');visiting.delete(owner.id);return result;}
  for(const spell of candidateSpells)if(directMembership(spell,owner))result.add(spell.id);
  const additions=owner.raw.classSpells;
  if(additions!==undefined&&!Array.isArray(additions))note('职业扩展法表格式尚待核验。');
  for(const addition of Array.isArray(additions)?additions:[]){
   if(typeof addition==='string'){for(const id of uid(addition))result.add(id);continue;}
   if(!plain(addition)){note('职业扩展法表包含尚未核验的声明。');continue;}
   if(typeof addition.className==='string'&&Object.keys(addition).every(field=>['className','classSource'].includes(field))){
    const source=typeof addition.classSource==='string'?addition.classSource:'PHB',targets=aliases.get(tuple(addition.className,source));
    if(targets?.length!==1){note('职业法表引用的来源身份缺失、停用或不唯一。');continue;}
    for(const id of resolve(targets[0]))result.add(id);
   }else if(typeof addition.groupName==='string'&&Object.keys(addition).every(field=>['groupName','groupSource'].includes(field))){
    const source=typeof addition.groupSource==='string'?addition.groupSource:'',group=tuple(addition.groupName,source);let found=false;
    for(const spell of candidateSpells)if(Array.isArray(spell.raw.groups)&&spell.raw.groups.some((row:unknown)=>plain(row)&&typeof row.name==='string'&&tuple(row.name,typeof row.source==='string'?row.source:'')===group)){result.add(spell.id);found=true;}
    const groups=entries.filter(entry=>entry.raw._category==='spellList'&&allowed(entry)&&names(entry).some(name=>tuple(name,entry.raw.source||'')===group));
    if(groups.length>1)note('法术组存在多个来源身份，未自动任选一份。');
    else if(groups.length===1){found=true;contextEntries.set(groups[0].id,groups[0]);if(!Array.isArray(groups[0].raw.spells))note('法术组的内容格式尚待核验。');else for(const reference of groups[0].raw.spells)for(const id of uid(reference))result.add(id);}
    if(!found)note('扩展法术组尚未加载或无法匹配来源。');
   }else note('职业扩展法表的条件尚未核验，未省略附加条件。');
  }
  visiting.delete(owner.id);return result;
 }
 const ids=new Set<string>();for(const owner of roots)for(const id of resolve(owner))ids.add(id);
 return {supported:true,ids,contextEntries:[...contextEntries.values()],incomplete:reasons.size>0,...(reasons.size?{reason:[...reasons].join(' ')}:{})};
}
