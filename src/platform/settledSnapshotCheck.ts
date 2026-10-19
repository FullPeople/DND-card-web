/** Only a completed, unchanged check can be skipped for this immutable snapshot. */
export function settledSnapshotCheck(enabled:boolean){
 const settled=new WeakSet<object>();
 return (snapshot:object,check:()=>boolean):boolean=>{
  if(enabled&&settled.has(snapshot))return false;
  const changed=check();
  if(enabled&&!changed)settled.add(snapshot);
  return changed;
 };
}
