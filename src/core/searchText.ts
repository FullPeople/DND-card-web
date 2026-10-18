import type {Entry} from './model';
export type SearchEntry=Pick<Entry,'name'|'english'|'source'>;
export const normalizeSearch=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/ü/g,'v');
const textCache=new WeakMap<SearchEntry,{key:string;text:string}>();
export function searchText(entry:SearchEntry,sourceName=''){
 const key=`${entry.name} ${entry.english} ${entry.source} ${sourceName}`,old=textCache.get(entry);
 if(old?.key===key)return old.text;
 const text=normalizeSearch(key);textCache.set(entry,{key,text});return text;
}
export const searchTerms=(query:string)=>normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
export function createTextMatcher(query:string){
 const terms=searchTerms(query);
 return (entry:SearchEntry,sourceName='')=>!terms.length||terms.every(term=>searchText(entry,sourceName).includes(term));
}
export function matchesTextSearch(entry:SearchEntry,query:string,sourceName=''):boolean {
 return createTextMatcher(query)(entry,sourceName);
}
