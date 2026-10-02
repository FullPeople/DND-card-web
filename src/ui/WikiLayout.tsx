import {createContext,useContext,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {WIKI_COLUMNS_MIN_WIDTH} from './workspaceGeometry';

export const WikiColumnsContext=createContext(false);
export function WikiEmptyPrompt(){const columns=useContext(WikiColumnsContext);return <span>选择{columns?'左侧':'上方'}条目</span>;}

/** Change geometry without moving/remounting the catalog or the active document. */
export function WikiLayout({children}:{children:ReactNode}){
 const root=useRef<HTMLDivElement>(null),[columns,setColumns]=useState(false);
 useLayoutEffect(()=>{
  if(!root.current)return;
  const node=root.current;
  const update=()=>setColumns(node.clientWidth>=WIKI_COLUMNS_MIN_WIDTH);
  update();const observer=new ResizeObserver(update);observer.observe(node);
  return()=>observer.disconnect();
 },[]);
 return <WikiColumnsContext.Provider value={columns}><div ref={root} className={`wiki-layout ${columns?'wiki-columns':''}`}>{children}</div></WikiColumnsContext.Provider>;
}
