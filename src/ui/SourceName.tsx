import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import seed from '../data/sourceRegistry.json';
import type {SourceMeta} from '../core/sourceCatalog';
export type {SourceMeta} from '../core/sourceCatalog';
export type SourceMode = 'full' | 'short' | 'both';
export const SOURCE_SEED = seed as Record<string, SourceMeta>;
export function mergeSourceRegistry(registry:Record<string,SourceMeta>,next:Record<string,SourceMeta>):Record<string,SourceMeta>{
 const changed:[string,SourceMeta][]=[];
 for(const [id,meta] of Object.entries(next)){
  const previous=registry[id],merged={...previous,...meta,category:SOURCE_SEED[id]?.category||(previous?.category==='模组内容'?'模组内容':meta.category||previous?.category),name:SOURCE_SEED[id]?.name||meta.name};
  const keys=Object.keys(merged) as (keyof SourceMeta)[];
  if(previous&&Object.keys(previous).length===keys.length&&keys.every(key=>Object.is(previous[key],merged[key])))continue;
  changed.push([id,merged]);
 }
 return changed.length?{...registry,...Object.fromEntries(changed)}:registry;
}
const Context = createContext({ registry: SOURCE_SEED, mode: 'both' as SourceMode, setMode: (_:SourceMode)=>{}, merge: (_:Record<string,SourceMeta>)=>{}, format: (id:string)=>id });
export function SourceProvider({children}:{children:ReactNode}){
 const [registry,setRegistry]=useState(SOURCE_SEED),[mode,setMode]=useState<SourceMode>(()=>{try{const v=localStorage.getItem('dnd-source-display');return ['full','short','both'].includes(v||'')?v as SourceMode:'both';}catch{return 'both';}});
 useEffect(()=>{try{localStorage.setItem('dnd-source-display',mode);}catch{}},[mode]);
 const merge=useCallback((next:Record<string,SourceMeta>)=>setRegistry(old=>mergeSourceRegistry(old,next)),[]);
 const format=useCallback((id:string)=>{const name=registry[id]?.name||id;return mode==='short'?id:mode==='full'||name===id?name:`${name}（${id}）`;},[registry,mode]);
 const value=useMemo(()=>({registry,mode,setMode,merge,format}),[registry,mode,merge,format]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useSources=()=>useContext(Context);
export function SourceName({id}:{id:string}){const {format}=useSources();return <>{format(id)}</>;}
export function compareSources(a:string,b:string,registry:Record<string,SourceMeta>){
 const pinned=['PHB','XPHB','DMG','XDMG','MM','XMM','XGE','TCE'];const ai=pinned.indexOf(a),bi=pinned.indexOf(b);
 if(ai>=0||bi>=0)return (ai<0?999:ai)-(bi<0?999:bi);
 return (registry[a]?.date||'9999').localeCompare(registry[b]?.date||'9999')||a.localeCompare(b);
}
