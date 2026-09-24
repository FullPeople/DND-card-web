import {sameValue} from './merge';
const ignored=new Set(['revision','updatedAt','parsed_at','_suiteStatusId']);
/** Confirm a lost acknowledgement from the changed fields, never a newer
 * revision alone: another player's unrelated edit can also advance revision. */
export function confirmedChanges(before:any,after:any,current:any):boolean{
 if(sameValue(before,after))return true;
 if(Array.isArray(before)&&Array.isArray(after)&&Array.isArray(current)&&[...before,...after,...current].every(v=>v&&typeof v.id==='string')){
  if(before.some(old=>!after.some(v=>v.id===old.id)&&current.some(v=>v.id===old.id)))return false;
  return after.every(row=>confirmedChanges(before.find(v=>v.id===row.id),row,current.find(v=>v.id===row.id)));
 }
 if(after&&typeof after==='object'&&!Array.isArray(after)){
  if(!current||typeof current!=='object'||Array.isArray(current))return false;
  return [...new Set([...Object.keys(before||{}),...Object.keys(after)])].filter(key=>!ignored.has(key)&&!['__proto__','constructor','prototype'].includes(key)).every(key=>confirmedChanges(before?.[key],after[key],current[key]));
 }
 return sameValue(after,current);
}
