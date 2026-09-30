import {useRef,type FocusEventHandler} from 'react';
import './searchControls.css';
export function ClearableSearch({value,change,label,placeholder='',className='',clearLabel='清空'+label,onFocus,inputRole='searchbox'}:{value:string;change:(value:string)=>void;label:string;placeholder?:string;className?:string;clearLabel?:string;onFocus?:FocusEventHandler<HTMLInputElement>;inputRole?:'textbox'|'searchbox'}){
 const input=useRef<HTMLInputElement>(null),selecting=useRef(false);
 return <span className={'clearable-search '+className}><input ref={input} type="text" role={inputRole} aria-label={label} value={value} placeholder={placeholder} onPointerDown={e=>{selecting.current=document.activeElement!==e.currentTarget;}} onFocus={e=>{e.currentTarget.select();onFocus?.(e);}} onMouseUp={e=>{if(selecting.current){e.preventDefault();selecting.current=false;}}} onChange={e=>change(e.target.value)}/>{value&&<button type="button" className="search-clear" aria-label={clearLabel} title={clearLabel} onPointerDown={e=>e.preventDefault()} onClick={()=>{change('');input.current?.focus();}}>×</button>}</span>;
}
