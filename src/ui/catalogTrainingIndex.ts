import type {Entry} from '../core/model';

/** Preserve source order and both labels without copying each growing group. */
export function catalogTrainingIndex(catalog:readonly Entry[]){
 const map=new Map<string,Entry[]>();
 for(const entry of catalog)if(entry.kind==='item'||entry.raw._category==='language'){
  for(const name of [entry.name,entry.english]){
   const key=name.toLowerCase(),rows=map.get(key);
   if(rows)rows.push(entry);else map.set(key,[entry]);
  }
 }
 return map;
}
