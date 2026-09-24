import {useLayoutEffect,useRef,useState} from 'react';
const KEY='dnd-card:workspace-split';
export function WorkspaceSplitter(){
 const ref=useRef<HTMLDivElement>(null),start=useRef<number|undefined>(undefined),[ratio,setRatio]=useState(()=>{try{return Math.min(.7,Math.max(.3,Number(localStorage.getItem(KEY))||.48));}catch{return .48;}});
 useLayoutEffect(()=>{ref.current?.parentElement?.style.setProperty('--sheet-share',`${ratio*100}%`);try{localStorage.setItem(KEY,String(ratio));}catch{}},[ratio]);
 function update(x:number){const box=ref.current!.parentElement!.getBoundingClientRect();setRatio(Math.max(.3,Math.min(.7,(x-box.left)/box.width)));}
 return <div ref={ref} className="workspace-splitter" role="separator" aria-label="调整角色卡与规则资料宽度" aria-orientation="vertical" aria-valuenow={Math.round(ratio*100)} tabIndex={0} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();start.current=ratio;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(start.current!==undefined)update(e.clientX);}} onPointerUp={()=>{start.current=undefined;}} onPointerCancel={()=>{if(start.current!==undefined)setRatio(start.current);start.current=undefined;}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setRatio(v=>Math.max(.3,Math.min(.7,v+(e.key==='ArrowRight'?.02:-.02))));}if(e.key==='Home')setRatio(.48);}}><span/></div>;
}
