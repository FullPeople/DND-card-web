import type {Entry} from '../core/model';
const indexes=new WeakMap<readonly Entry[],ReadonlyMap<string,readonly Entry[]>>();

/** Preserve source order and both labels without copying each growing group. */
export function catalogTrainingIndex(catalog:readonly Entry[]){
 const previous=indexes.get(catalog);if(previous)return previous;
 const map=new Map<string,Entry[]>();
 for(const entry of catalog)if(entry.kind==='item'||entry.raw._category==='language'){
  for(const name of [entry.name,entry.english]){
   const key=name.toLowerCase(),rows=map.get(key);
   if(rows)rows.push(entry);else map.set(key,[entry]);
  }
 }
 indexes.set(catalog,map);return map as ReadonlyMap<string,readonly Entry[]>;
}
