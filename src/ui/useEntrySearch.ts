import {useEffect,useState} from 'react';
import {matchesTextSearch,normalizeSearch} from '../core/searchText';
type Matcher=typeof matchesTextSearch;
let loaded:Matcher|undefined,pending:Promise<Matcher>|undefined;
function loadMatcher(){
 return pending??=import('../core/search').then(module=>loaded=module.matchesEntrySearch).catch(error=>{pending=undefined;throw error;});
}
/** The large pronunciation dictionary is needed only for Latin search input. */
export function useEntrySearch(query:string){
 const [matcher,setMatcher]=useState<Matcher>(()=>loaded??matchesTextSearch);
 const [status,setStatus]=useState('');
 useEffect(()=>{
  if(!/[a-z]/.test(normalizeSearch(query))){setStatus('');return;}
  let active=true;
  if(loaded){setMatcher(()=>loaded!);setStatus('');return;}
  setStatus('正在加载拼音搜索…');
  loadMatcher().then(next=>{if(active){setMatcher(()=>next);setStatus('');}},()=>{if(active)setStatus('拼音搜索加载失败，重新加载后可重试；中文和英文搜索仍可用。');});
  return()=>{active=false;};
 },[query]);
 return {matches:matcher,status};
}
