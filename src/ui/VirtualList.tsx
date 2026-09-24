import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Keep a bounded DOM even when the catalog contains tens of thousands of rows. */
export function VirtualList<T>({items,rowHeight,renderRow,itemKey,header,className='',label,resetKey,empty,scrollToIndex}: {items:T[];rowHeight:number;renderRow:(item:T,index:number)=>ReactNode;itemKey:(item:T)=>string;header?:ReactNode;className?:string;label?:string;resetKey?:string;empty?:ReactNode;scrollToIndex?:number}) {
 const root=useRef<HTMLDivElement>(null),frame=useRef(0);
 const [viewport,setViewport]=useState({top:0,height:300});
 const update=()=>{const node=root.current;if(node)setViewport(v=>v.top===node.scrollTop&&v.height===node.clientHeight?v:{top:node.scrollTop,height:node.clientHeight});};
 useLayoutEffect(()=>{const node=root.current!;const observer=new ResizeObserver(update);observer.observe(node);update();return()=>{observer.disconnect();cancelAnimationFrame(frame.current);};},[]);
 useLayoutEffect(()=>{if(root.current)root.current.scrollTop=0;update();},[resetKey]);
 useLayoutEffect(()=>{if(scrollToIndex==null||scrollToIndex<0||!root.current)return;const node=root.current,top=scrollToIndex*rowHeight,bottom=top+rowHeight;if(top<node.scrollTop||bottom>node.scrollTop+node.clientHeight-(header?25:0)){node.scrollTop=top;update();}},[scrollToIndex]);
 const overscan=8, start=Math.max(0,Math.min(Math.max(0,items.length-1),Math.floor((viewport.top-(header?25:0))/rowHeight)-overscan));
 const end=Math.min(items.length,start+Math.ceil(viewport.height/rowHeight)+overscan*2+2);
 return <div ref={root} className={`virtual-list ${className}`} aria-label={label} data-total-rows={items.length} onScroll={()=>{if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;update();});}}>
 {header}{!items.length?empty:<><div aria-hidden="true" style={{height:start*rowHeight,flex:'none'}}/>{items.slice(start,end).map((item,i)=><div className="virtual-row" style={{height:rowHeight}} key={itemKey(item)} data-row-index={start+i}>{renderRow(item,start+i)}</div>)}<div aria-hidden="true" style={{height:Math.max(0,items.length-end)*rowHeight,flex:'none'}}/></>}
 </div>;
}
