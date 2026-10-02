import {editionAllows,selectionAllowed,skillKey,type Character,type Entry} from '../core/model';
import type {ChoiceOption,SheetChoice} from '../core/automation/choices';
import {facetsFor,tabOf,type FacetSelection,type LibraryTab} from './libraryData';
const key=(s:unknown)=>String(s||'').trim().toLocaleLowerCase();
const identity=(entry:Entry)=>JSON.stringify([entry.kind,entry.source,key(entry.english||entry.name),...['className','classSource','level','_category'].map(k=>key(entry.raw[k]))]);
/** Resolve candidates in one catalog pass, including older saved entry aliases. */
export function choiceEntryMatcher(c:Character,choice:SheetChoice):(entry:Entry)=>ChoiceOption|undefined{
 const ids=new Map<string,number>(),identities=new Map<string,number>(),skills=new Map<string,ChoiceOption>();
 choice.options.forEach((option,index)=>{if(choice.channel==='skills'){if(!skills.has(option.value))skills.set(option.value,option);return;}if(option.entry.raw._choiceConcept||option.entry.raw._category==='inlineChoice'||option.entry.raw._custom)return;if(!ids.has(option.entry.id))ids.set(option.entry.id,index);const alias=identity(option.entry);if(!identities.has(alias))identities.set(alias,index);});
 return entry=>{
  if(!editionAllows(entry,c.edition)||!selectionAllowed(c,entry))return;
  if(choice.channel==='skills'){
   if(entry.kind!=='rule'||entry.raw._category!=='skill'||entry.source!==(c.edition==='2024'?'XPHB':'PHB'))return;
   // Preserve choice order when translated and English aliases identify different options.
   const matches=[entry.name,entry.english,entry.raw.ENG_name].flatMap(name=>typeof name==='string'?skills.get(skillKey(name))||[]:[]);
   return matches.reduce<ChoiceOption|undefined>((found,option)=>!found||choice.options.indexOf(option)<choice.options.indexOf(found)?option:found,undefined);
  }
  const direct=ids.get(entry.id),alias=identities.get(identity(entry)),index=direct===undefined?alias:alias===undefined?direct:Math.min(direct,alias);
  return index===undefined?undefined:choice.options[index];
 };
}
export function optionForEntry(c:Character,choice:SheetChoice,entry:Entry):ChoiceOption|undefined{
 if(!editionAllows(entry,c.edition)||!selectionAllowed(c,entry))return;
 if(choice.channel==='skills'){
  if(entry.kind!=='rule'||entry.raw._category!=='skill'||entry.source!==(c.edition==='2024'?'XPHB':'PHB'))return;
  return choice.options.find(o=>[entry.name,entry.english,entry.raw.ENG_name].some(n=>typeof n==='string'&&skillKey(n)===o.value));
 }
 return choice.options.find(o=>!o.entry.raw._choiceConcept&&o.entry.raw._category!=='inlineChoice'&&!o.entry.raw._custom&&(o.entry.id===entry.id||o.entry.kind===entry.kind&&o.entry.source===entry.source&&key(o.entry.english||o.entry.name)===key(entry.english||entry.name)&&['className','classSource','level','_category'].every(k=>key(o.entry.raw[k])===key(entry.raw[k]))));
}
export function choiceCatalog(c:Character,choice:SheetChoice,catalog:Entry[]):{wiki:boolean;tab:LibraryTab;entries:Entry[];filters:FacetSelection}{
 const match=choiceEntryMatcher(c,choice),matched=catalog.flatMap(entry=>{const option=match(entry);return option?[{entry,option}]:[]}),entries=matched.map(row=>row.entry),values=new Set(matched.map(row=>row.option.value)),wiki=['skills','spells'].includes(choice.channel)||choice.channel!=='equipment'&&choice.options.length>0&&choice.options.every(o=>o.unavailable==='引用资料尚未加载，不能确认此项。'||values.has(o.value));
 const tab:LibraryTab=choice.channel==='skills'?'rule':choice.channel==='spells'?'spell':entries[0]?tabOf(entries[0]):'class';
 const filters:FacetSelection={};
 if(wiki){const owner=c.selections.find(s=>s.id===choice.ownerId),phb=c.edition==='2024'?'XPHB':'PHB',sources=[...new Set(entries.map(e=>e.source))];filters.source={include:choice.channel==='skills'||choice.channel==='spells'&&(sources.includes(phb)||!sources.length)?[phb]:sources.includes(owner?.entry.source||'')?[owner!.entry.source]:sources,exclude:[]};
  if(choice.channel==='skills')filters.type={include:['技能'],exclude:[]};
  if(choice.channel==='spells'){filters.level={include:choice.spellKind==='cantrips'?['0']:[...new Set(entries.map(e=>String(e.raw.level)))],exclude:[]};const aliases=[owner?.entry.name,owner?.entry.english,owner?.entry.raw.ENG_name].filter(Boolean).map(key),facet=facetsFor('spell').find(f=>f.key==='classList'),classes=[...new Set(entries.flatMap(e=>facet?.values(e)||[]))].filter(name=>aliases.includes(key(name)));if(classes.length)filters.classList={include:classes,exclude:[]};}
 }
 return {wiki,tab,entries,filters};
}
