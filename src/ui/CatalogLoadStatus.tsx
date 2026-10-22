import {useSyncExternalStore} from 'react';
import type {CatalogProgressStore} from './catalogProgress';

export function CatalogLoadStatus({store,loading,entryCount,matchedCount,searchStatus,retry}:{store:CatalogProgressStore;loading:boolean;entryCount:number;matchedCount:number;searchStatus?:string;retry:(keys:readonly string[]|undefined)=>void}){
 const progress=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
 return <>
  <div className="catalog-status"><span>{loading || progress.paused ? `${progress.done}/${progress.total} 份资料${progress.paused?' · 已暂停':''}` : `${entryCount.toLocaleString()} 条资料`}{progress.cached > 0 ? ` · ${progress.cached} 份缓存` : ''}</span><span role={searchStatus?"status":undefined}>{searchStatus||`${matchedCount} 条符合筛选`}</span></div>
  {progress.paused && <p className="load-paused" role="status">{progress.paused}尚有资料未读。</p>}
  {(progress.failed.length > 0 || progress.paused) && <details className="load-errors"><summary>{progress.failed.length} 份资料读取异常 · 可重试</summary>{progress.failed.map((e, i) => <p key={i}>{e}</p>)}<button disabled={loading} onClick={() => retry(store.getSnapshot().retry)}>重试加载</button></details>}
 </>;
}
