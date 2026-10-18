import {useCallback,useEffect,useMemo,useState} from 'react';
import type {Entry} from '../core/model';
import {entrySearchClient} from '../data/entrySearchClient';

/** Send only searchable names/provenance, never rule bodies or character data. */
export function useEntrySearch(query:string,entries:Entry[],registry:Record<string,{name?:string}>){
 const rows=useMemo(()=>entries.map(({name,english,source})=>({name,english,source,sourceName:registry[source]?.name||''})),[entries,registry]);
 const client=useMemo(()=>entrySearchClient(rows),[rows]);
 const [result,setResult]=useState<{rows:typeof rows;found:WeakSet<Entry>}>();
 const [status,setStatus]=useState('');
 useEffect(()=>()=>client.dispose(),[client]);
 useEffect(()=>{
  if(!query.trim()){setStatus('');return;}
  const controller=new AbortController();setStatus('正在搜索…');
  void client.search(query,controller.signal).then(indices=>{if(!indices||controller.signal.aborted)return;setResult({rows,found:new WeakSet(indices.map(i=>entries[i]))});setStatus('');},()=>{if(!controller.signal.aborted)setStatus('搜索失败，请重新输入后重试。');});
  return()=>controller.abort();
 },[client,query,rows,entries]);
 const blank=!query.trim();
 const matches=useCallback((entry:Entry)=>blank||result?.rows===rows&&result.found.has(entry),[blank,result,rows]);
 return {matches,status};
}
