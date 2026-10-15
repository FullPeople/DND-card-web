import {confirmedChanges} from './syncRecovery';

export type FailedChanges<T>={before:T;after:T};
/** The latest explicit draft replaces older desired values, without replaying
 * them. Callers must keep unknown request outcomes separate from known failures. */
export function advanceFailedChanges<T extends {revision:number}>(failed:FailedChanges<T>|undefined,before:T,after:T):FailedChanges<T>{
 return {before:failed?.before||before,after:failed&&failed.after.revision>after.revision?failed.after:after};
}

const safe=(key:string)=>!['__proto__','constructor','prototype'].includes(key);
const object=(value:any)=>value&&typeof value==='object'&&!Array.isArray(value);
/** Retire only the portions proven by this body. Keeping already-confirmed
 * fields in the failure would later mistake another player's edit for our loss. */
function confirmedBefore(before:any,after:any,current:any):any {
 if(confirmedChanges(before,after,current))return after;
 if([before,after,current].every(Array.isArray)&&[...before,...after,...current].every(row=>row&&typeof row.id==='string')){
  const result=before.filter((row:any)=>after.some((next:any)=>next.id===row.id)||current.some((live:any)=>live.id===row.id));
  for(const row of after){
   const at=result.findIndex((old:any)=>old.id===row.id),old=before.find((value:any)=>value.id===row.id),live=current.find((value:any)=>value.id===row.id);
   const confirmed=confirmedBefore(old,row,live);
   if(confirmed===undefined)continue;
   if(at<0)result.push(confirmed);else result[at]=confirmed;
  }
  return result;
 }
 if(object(after)&&object(current)){
  const result={...(object(before)?before:{})};
  for(const key of new Set([...Object.keys(before||{}),...Object.keys(after)]))if(safe(key)){
   const confirmed=confirmedBefore(before?.[key],after[key],current[key]);
   if(confirmed===undefined)delete result[key];else result[key]=confirmed;
  }
  return result;
 }
 return before;
}

/** A receipt/body may prove some failed fields while other drafts remain local.
 * This never infers success from a revision alone and never changes the draft. */
export function settleFailedChanges<T>(failed:FailedChanges<T>,current:any):FailedChanges<T>|undefined {
 if(!current)return failed;
 if(confirmedChanges(failed.before,failed.after,current))return;
 return {...failed,before:confirmedBefore(failed.before,failed.after,current)};
}
