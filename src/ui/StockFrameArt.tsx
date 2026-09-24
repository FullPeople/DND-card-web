import {useLayoutEffect,useRef,useState} from 'react';
import {CellArt} from './CellArt';
/** Stock frames share the sheet's status layers without changing their layout. */
export function StockFrameArt(){
 const ref=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:0,height:0});
 useLayoutEffect(()=>{const node=ref.current;if(!node)return;const measure=()=>{const width=node.clientWidth,height=node.clientHeight;setSize(old=>old.width===width&&old.height===height?old:{width,height});};measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[]);
 const {width:w,height:h}=size;
 return <div ref={ref} className="stock-frame-art" aria-hidden="true"><svg preserveAspectRatio="none" className="stock-outline" viewBox={`0 0 ${w} ${h}`}><path d={`M8.6 1.5H${w-8.6}L${w-1.5} 8.6V${h-8.6}L${w-8.6} ${h-1.5}H8.6L1.5 ${h-8.6}V8.6Z`}/></svg><CellArt {...size} missing={false}/></div>;
}
