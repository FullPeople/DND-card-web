import {useLayoutEffect,useRef} from 'react';
export function AutoSheetName({value,readOnly,change}:{value:string;readOnly:boolean;change:(value:string)=>void}){
  const ref=useRef<HTMLTextAreaElement>(null);
  const fit=()=>{const node=ref.current;if(!node)return;node.style.height='0px';node.style.height=`${Math.max(26,node.scrollHeight+2)}px`;};
  useLayoutEffect(()=>{fit();},[value]);
  // Keep one observer per mounted field; typing only refits the changed value.
  useLayoutEffect(()=>{
    const node=ref.current!;let width=node.clientWidth;
    const observer=new ResizeObserver(()=>{const next=node.clientWidth;if(next!==width){width=next;fit();}});
    observer.observe(node);return()=>observer.disconnect();
  },[]);
  return <textarea ref={ref} className="screen-name-input" aria-label="角色姓名" rows={1} value={value} readOnly={readOnly} onChange={event=>change(event.target.value)}/>;
}
