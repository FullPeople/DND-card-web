import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Keep a bounded DOM even when the catalog contains tens of thousands of rows. */
export function VirtualList<T>({items,rowHeight,renderRow,itemKey,header,className='',label,resetKey,empty,scrollToIndex,headerHeight=25,restoreScrollTop=0}: {items:T[];rowHeight:number;renderRow:(item:T,index:number)=>ReactNode;itemKey:(item:T)=>string;header?:ReactNode;className?:string;label?:string;resetKey?:string;empty?:ReactNode;scrollToIndex?:number;headerHeight?:number;restoreScrollTop?:number}) {
 const root=useRef<HTMLDivElement>(null),frame=useRef(0);
 const [viewport,setViewport]=useState({top:0,height:300});
 const update=()=>{const node=root.current;if(node?.isConnected){const top=node.scrollTop,height=node.clientHeight;setViewport(v=>v.top===top&&v.height===height?v:{top,height});}};
 useLayoutEffect(()=>{const node=root.current!;const observer=new ResizeObserver(update);observer.observe(node);return()=>{observer.disconnect();cancelAnimationFrame(frame.current);};},[]);
 // ResizeObserver supplies the initial size before paint. Do not force another
 // whole-page layout by reading it again while React commits a list reset.
 useLayoutEffect(()=>{const top=Math.max(0,restoreScrollTop);if(root.current)root.current.scrollTop=top;setViewport(v=>v.top!==top?{...v,top}:v);},[resetKey]);
 useLayoutEffect(()=>{if(scrollToIndex==null||scrollToIndex<0||!root.current)return;const node=root.current,top=scrollToIndex*rowHeight,bottom=top+rowHeight;if(top<node.scrollTop||bottom>node.scrollTop+node.clientHeight-(header?headerHeight:0)){node.scrollTop=top;update();}},[scrollToIndex,resetKey,rowHeight,headerHeight]);
 const overscan=8, start=Math.max(0,Math.min(Math.max(0,items.length-1),Math.floor((viewport.top-(header?headerHeight:0))/rowHeight)-overscan));
 const end=Math.min(items.length,start+Math.ceil(viewport.height/rowHeight)+overscan*2+2);
 return <div ref={root} className={`virtual-list ${className}`} aria-label={label} data-total-rows={items.length} onScroll={()=>{if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;update();});}}>
 {header}{!items.length?empty:<><div aria-hidden="true" style={{height:start*rowHeight,flex:'none'}}/>{items.slice(start,end).map((item,i)=><div className="virtual-row" style={{height:rowHeight}} key={itemKey(item)} data-row-index={start+i}>{renderRow(item,start+i)}</div>)}<div aria-hidden="true" style={{height:Math.max(0,items.length-end)*rowHeight,flex:'none'}}/></>}
 </div>;
}
