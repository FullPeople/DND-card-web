import {useLayoutEffect,useRef} from 'react';
export function AutoSheetName({value,readOnly,change}:{value:string;readOnly:boolean;change:(value:string)=>void}){
  const ref=useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(()=>{
    const node=ref.current!;let width=node.clientWidth;
    const fit=()=>{node.style.height='0px';node.style.height=`${Math.max(26,node.scrollHeight+2)}px`;width=node.clientWidth;};
    fit();const observer=new ResizeObserver(()=>{if(node.clientWidth!==width)fit();});observer.observe(node);return()=>observer.disconnect();
  },[value]);
  return <textarea ref={ref} className="screen-name-input" aria-label="角色姓名" rows={1} value={value} readOnly={readOnly} onChange={event=>change(event.target.value)}/>;
}
