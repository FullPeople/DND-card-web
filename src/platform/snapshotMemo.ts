/** One mounted editor owns these immutable views. Recreate when its rule context changes. */
export function snapshotMemo(enabled=true){
 const scopes=new Map<string,WeakMap<object,unknown>>();
 return <T>(scope:string,snapshot:object,compute:()=>T):T=>{
  if(!enabled)return compute();
  let cache=scopes.get(scope);if(!cache){cache=new WeakMap();scopes.set(scope,cache);}
  if(cache.has(snapshot))return cache.get(snapshot) as T;
  const value=compute();cache.set(snapshot,value);return value;
 };
}
