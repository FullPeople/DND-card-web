import type {Entry} from './model';
/** Built for an immutable catalog snapshot; callers rebuild when that snapshot changes. */
export function entryNameIndex(entries:readonly Entry[]):ReadonlyMap<string,readonly Entry[]>{
 const index=new Map<string,Entry[]>();
 for(const entry of entries)for(const name of new Set([entry.name.toLowerCase(),entry.english.toLowerCase()])){
  const group=index.get(name);if(group)group.push(entry);else index.set(name,[entry]);
 }
 return index;
}
