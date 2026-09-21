import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import seed from '../data/sourceRegistry.json';
export type SourceMeta = { name: string; date?: string };
export type SourceMode = 'full' | 'short' | 'both';
export const SOURCE_SEED: Record<string, SourceMeta> = seed;
const Context = createContext({ registry: SOURCE_SEED, mode: 'both' as SourceMode, setMode: (_:SourceMode)=>{}, merge: (_:Record<string,SourceMeta>)=>{}, format: (id:string)=>id });
export function SourceProvider({children}:{children:ReactNode}){
 const [registry,setRegistry]=useState(SOURCE_SEED),[mode,setMode]=useState<SourceMode>(()=>{try{const v=localStorage.getItem('dnd-source-display');return ['full','short','both'].includes(v||'')?v as SourceMode:'both';}catch{return 'both';}});
 useEffect(()=>{try{localStorage.setItem('dnd-source-display',mode);}catch{}},[mode]);
 const merge=useCallback((next:Record<string,SourceMeta>)=>setRegistry(old=>({...old,...Object.fromEntries(Object.entries(next).map(([id,meta])=>[id,{...old[id],...meta,name:SOURCE_SEED[id]?.name||meta.name}]))})),[]);
 const format=(id:string)=>{const name=registry[id]?.name||id;return mode==='short'?id:mode==='full'||name===id?name:`${name}（${id}）`;};
 return <Context.Provider value={{registry,mode,setMode,merge,format}}>{children}</Context.Provider>;
}
export const useSources=()=>useContext(Context);
export function SourceName({id}:{id:string}){const {format}=useSources();return <>{format(id)}</>;}
export function compareSources(a:string,b:string,registry:Record<string,SourceMeta>){
 const pinned=['PHB','XPHB','DMG','XDMG','MM','XMM','XGE','TCE'];const ai=pinned.indexOf(a),bi=pinned.indexOf(b);
 if(ai>=0||bi>=0)return (ai<0?999:ai)-(bi<0?999:bi);
 return (registry[a]?.date||'9999').localeCompare(registry[b]?.date||'9999')||a.localeCompare(b);
}
