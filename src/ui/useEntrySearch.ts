import {useCallback,useEffect,useMemo,useState} from 'react';
import type {Entry} from '../core/model';
import {entrySearchClient} from '../data/entrySearchClient';
import type {SearchRow} from '../data/entrySearchTask';
const emptyRows:SearchRow[]=[];

/** Send only searchable names/provenance, never rule bodies or character data. */
export function useEntrySearch(query:string,entries:Entry[],registry:Record<string,{name?:string}>){
 const active=!!query.trim();
 const rows=useMemo(()=>active?entries.map(({name,english,source})=>({name,english,source,sourceName:registry[source]?.name||''})):emptyRows,[active,entries,registry]);
 const client=useMemo(()=>entrySearchClient(rows),[rows]);
 const [result,setResult]=useState<{rows:typeof rows;query:string;found:WeakSet<Entry>}>();
 const [status,setStatus]=useState('');
 useEffect(()=>()=>client.dispose(),[client]);
 useEffect(()=>{
  if(!active){setStatus('');setResult(undefined);return;}
  const controller=new AbortController();setStatus('正在搜索…');
  void client.search(query,controller.signal).then(indices=>{if(!indices||controller.signal.aborted)return;setResult({rows,query,found:new WeakSet(indices.map(i=>entries[i]))});setStatus('');},()=>{if(!controller.signal.aborted){setResult({rows,query,found:new WeakSet<Entry>()});setStatus('搜索失败，请重新输入或刷新页面后重试。');}});
  return()=>controller.abort();
 },[client,query,rows,entries,active]);
 const blank=!active;
 const matches=useCallback((entry:Entry)=>blank||result?.rows===rows&&result.found.has(entry),[blank,result,rows]);
 return {matches,status,pending:active&&(result?.rows!==rows||result.query!==query)};
}
