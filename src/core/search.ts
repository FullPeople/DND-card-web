import { pinyin } from 'pinyin-pro';
import type { Entry } from './model';

type SearchIndex = { text:string; full:string; initials:string };
const cache=new WeakMap<Entry,SearchIndex>();
const normalize=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/ü/g,'v');
/** Search names and provenance only. Index once per immutable entry, on demand. */
export function matchesEntrySearch(entry:Entry,query:string,sourceName=''):boolean {
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);if(!terms.length)return true;
 const text=normalize(`${entry.name} ${entry.english} ${entry.source} ${sourceName}`);
 if(terms.every(term=>text.includes(term)))return true;
 if(!terms.some(term=>/[a-z]/.test(term)))return false;
 let index=cache.get(entry);
 if(!index||index.text!==text){const syllables=pinyin(text,{toneType:'none',type:'array'}).map(normalize);index={text,full:syllables.join('').replace(/[^a-z0-9]/g,''),initials:syllables.map(s=>s[0]||'').join('').replace(/[^a-z0-9]/g,'')};cache.set(entry,index);}
 return terms.every(term=>text.includes(term)||index!.full.includes(term.replace(/['’-]/g,''))||index!.initials.includes(term));
}
