import {createTextMatcher,normalizeSearch,type SearchEntry} from '../core/searchText';
export type SearchRow=SearchEntry&{sourceName:string};
/** Shared by the worker and CSP fallback. Yield even on a cold pinyin index. */
export async function searchEntryRows(rows:readonly SearchRow[],query:string,cancelled=()=>false,yieldControl=()=>new Promise<void>(resolve=>setTimeout(resolve,0))){
 if(cancelled())return;
 const matcher=/[a-z]/.test(normalizeSearch(query))?(await import('../core/search')).createEntryMatcher(query):createTextMatcher(query);
 const found:number[]=[];let deadline=performance.now()+4;
 for(let i=0;i<rows.length;i++){
  if(cancelled())return;
  if(matcher(rows[i],rows[i].sourceName))found.push(i);
  if((i+1)%64===0&&performance.now()>=deadline){await yieldControl();if(cancelled())return;deadline=performance.now()+4;}
 }
 return cancelled()?undefined:found;
}
