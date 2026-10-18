import {createContext,useContext,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {WIKI_COLUMNS_MIN_WIDTH} from './workspaceGeometry';
import {BookReader,readingRoute,readingUrl,type ReadingMode} from './BookReader';
import {useEffect} from 'react';
import './wikiReading.css';
import './interactionP1.css';
import {useCompactViewport} from './useCompactViewport';

export const WikiColumnsContext=createContext(false);
const WikiReaderContext=createContext<{compact:boolean;back:()=>void;fromSearch:()=>void}>({compact:false,back:()=>{},fromSearch:()=>{}});
export function WikiReaderBack({close}:{close:()=>void}){const reader=useContext(WikiReaderContext);return <button className="wiki-reader-back" aria-label={reader.compact?'返回资料列表':'收起正文'} onClick={reader.compact?reader.back:close}>{reader.compact?'← 返回列表':'×'}</button>;}
export function useWikiSearchOrigin(){return useContext(WikiReaderContext).fromSearch;}
export function WikiEmptyPrompt(){const columns=useContext(WikiColumnsContext);return <span>选择{columns?'左侧':'上方'}条目</span>;}

/** Change geometry without moving/remounting the catalog or the active document. */
export function WikiLayout({children,hasDetail=false,readingKey}:{children:ReactNode;hasDetail?:boolean;readingKey?:number}){
 const root=useRef<HTMLDivElement>(null),[columns,setColumns]=useState(false);
 const compact=useCompactViewport(),[reading,setReading]=useState(false),listPosition=useRef<number|undefined>(undefined),wasReading=useRef(false),pendingSearch=useRef(false),searchOrigin=useRef(false);
 useLayoutEffect(()=>{if(!hasDetail||root.current?.querySelector<HTMLElement>('.library-body')?.dataset.libraryTab==='custom'){pendingSearch.current=false;setReading(false);return;}if(readingKey!==undefined){searchOrigin.current=pendingSearch.current;pendingSearch.current=false;listPosition.current=root.current?.querySelector<HTMLElement>('.catalog-list')?.scrollTop;setReading(true);}},[hasDetail,readingKey]);
 useLayoutEffect(()=>{if(!reading&&wasReading.current&&listPosition.current!==undefined){const list=root.current?.querySelector<HTMLElement>('.catalog-list');if(list)list.scrollTop=listPosition.current;listPosition.current=undefined;}wasReading.current=reading;},[reading]);
 const [mode,setMode]=useState<ReadingMode>(()=>readingRoute().kind);
 useEffect(()=>{const pop=()=>setMode(readingRoute().kind);window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
 function choose(next:ReadingMode){setMode(next);history.pushState(null,'',readingUrl(next));}
 useLayoutEffect(()=>{
  if(!root.current)return;
  const node=root.current;
  const update=()=>{if(node.clientWidth>0)setColumns(node.clientWidth>=WIKI_COLUMNS_MIN_WIDTH);};
  update();const observer=new ResizeObserver(update);observer.observe(node);
  return()=>observer.disconnect();
 },[]);
 function returnToList(){setReading(false);requestAnimationFrame(()=>{root.current?.querySelector<HTMLElement>('.catalog-row.active')?.focus({preventScroll:true});root.current?.closest('.wiki-reading-root')?.dispatchEvent(new CustomEvent('wiki-reader-return',{detail:{fromSearch:searchOrigin.current}}));});}
 return <WikiReaderContext.Provider value={{compact,back:returnToList,fromSearch:()=>{pendingSearch.current=true;}}}><WikiColumnsContext.Provider value={columns}><div className={`wiki-reading-root ${compact&&hasDetail&&reading&&mode==='entry'?'wiki-mobile-reader':''}`} onKeyDown={event=>{if(event.key==='Escape'&&compact&&reading){event.preventDefault();returnToList();}if(event.key==='/'&&!(event.target as HTMLElement).matches('input,textarea,select,[contenteditable=true]')){event.preventDefault();if(compact)setReading(false);requestAnimationFrame(()=>root.current?.querySelector<HTMLInputElement>(mode==='entry'?'.global-search input':'.reading-volume-tools input')?.focus());}}}>
  <nav className="wiki-reading-nav" aria-label="阅读内容">{(['entry','book','adventure'] as const).map(value=><button key={value} aria-current={mode===value?'page':undefined} onClick={()=>choose(value)}>{({entry:'规则条目',book:'书籍',adventure:'冒险'})[value]}</button>)}<details><summary>快捷键</summary><p>/：搜索资料<br/>[／]：上一章／下一章</p></details></nav>
  <div className="wiki-reading-stage"><div ref={root} className={`wiki-layout ${columns?'wiki-columns':''}`} style={mode==='entry'?undefined:{visibility:'hidden'}}>{children}</div>{mode!=='entry'&&<div className="wiki-reading-layer"><BookReader key={mode} kind={mode}/></div>}</div>
 </div></WikiColumnsContext.Provider></WikiReaderContext.Provider>;
}
