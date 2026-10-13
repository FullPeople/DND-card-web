import {createContext,useContext,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {WIKI_COLUMNS_MIN_WIDTH} from './workspaceGeometry';
import {BookReader,readingRoute,readingUrl,type ReadingMode} from './BookReader';
import {useEffect} from 'react';
import './wikiReading.css';

export const WikiColumnsContext=createContext(false);
export function WikiEmptyPrompt(){const columns=useContext(WikiColumnsContext);return <span>选择{columns?'左侧':'上方'}条目</span>;}

/** Change geometry without moving/remounting the catalog or the active document. */
export function WikiLayout({children}:{children:ReactNode}){
 const root=useRef<HTMLDivElement>(null),[columns,setColumns]=useState(false);
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
 return <WikiColumnsContext.Provider value={columns}><div className="wiki-reading-root" onKeyDown={event=>{if(event.key==='/'&&!(event.target as HTMLElement).matches('input,textarea,select,[contenteditable=true]')){event.preventDefault();event.currentTarget.querySelector<HTMLInputElement>(mode==='entry'?'.global-search input':'.reading-volume-tools input')?.focus();}}}>
  <nav className="wiki-reading-nav" aria-label="阅读内容">{(['entry','book','adventure'] as const).map(value=><button key={value} aria-current={mode===value?'page':undefined} onClick={()=>choose(value)}>{({entry:'规则条目',book:'书籍',adventure:'冒险'})[value]}</button>)}<details><summary>快捷键</summary><p>/：搜索资料<br/>[／]：上一章／下一章</p></details></nav>
  <div className="wiki-reading-stage"><div ref={root} className={`wiki-layout ${columns?'wiki-columns':''}`} style={mode==='entry'?undefined:{visibility:'hidden'}}>{children}</div>{mode!=='entry'&&<div className="wiki-reading-layer"><BookReader key={mode} kind={mode}/></div>}</div>
 </div></WikiColumnsContext.Provider>;
}
