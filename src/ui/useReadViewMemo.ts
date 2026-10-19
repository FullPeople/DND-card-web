import {useMemo,useRef} from 'react';

/** Keep a few already-open read projections; never retain an unbounded query history. */
export function readViewMemo(limit=4){
 const rows:{deps:readonly unknown[];value:unknown}[]=[];
 return <T>(deps:readonly unknown[],compute:()=>T):T=>{
  const at=rows.findIndex(row=>row.deps.length===deps.length&&row.deps.every((value,index)=>Object.is(value,deps[index])));
  if(at>=0){const [row]=rows.splice(at,1);rows.unshift(row);return row.value as T;}
  const value=compute();rows.unshift({deps:[...deps],value});rows.length=Math.min(rows.length,limit);return value;
 };
}

export function useReadViewMemo<T>(enabled:boolean,compute:()=>T,deps:readonly unknown[]):T{
 const cache=useRef<ReturnType<typeof readViewMemo>|undefined>(undefined);
 if(!cache.current)cache.current=readViewMemo();
 return useMemo(()=>enabled?cache.current!(deps,compute):compute(),[enabled,...deps]);
}
