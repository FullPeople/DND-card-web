import type {Entry} from './model';
export const normalizeSearch=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/ü/g,'v');
export function matchesTextSearch(entry:Entry,query:string,sourceName=''):boolean {
 const text=normalizeSearch(`${entry.name} ${entry.english} ${entry.source} ${sourceName}`);
 return normalizeSearch(query).trim().split(/\s+/).filter(Boolean).every(term=>text.includes(term));
}
