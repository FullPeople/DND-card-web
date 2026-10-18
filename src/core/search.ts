import { pinyin } from 'pinyin-pro';
import {normalizeSearch as normalize,searchText,searchTerms,type SearchEntry} from './searchText';

type SearchIndex = { text:string; full:string; initials:string };
const cache=new WeakMap<SearchEntry,SearchIndex>();
/** Search names and provenance only. Index once per immutable entry, on demand. */
export function createEntryMatcher(query:string){
 const terms=searchTerms(query),latin=terms.some(term=>/[a-z]/.test(term));
 return (entry:SearchEntry,sourceName=''):boolean=>{
 if(!terms.length)return true;
 const text=searchText(entry,sourceName);
 if(terms.every(term=>text.includes(term)))return true;
 if(!latin)return false;
 let index=cache.get(entry);
 if(!index||index.text!==text){const syllables=pinyin(text,{toneType:'none',type:'array'}).map(normalize);index={text,full:syllables.join('').replace(/[^a-z0-9]/g,''),initials:syllables.map(s=>s[0]||'').join('').replace(/[^a-z0-9]/g,'')};cache.set(entry,index);}
 return terms.every(term=>text.includes(term)||index!.full.includes(term.replace(/['’-]/g,''))||index!.initials.includes(term));
 };
}
export function matchesEntrySearch(entry:SearchEntry,query:string,sourceName=''):boolean {
 return createEntryMatcher(query)(entry,sourceName);
}
