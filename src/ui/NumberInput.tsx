import {useEffect,useState,type InputHTMLAttributes} from 'react';
export function NumberInput({value,onChange,onBlur,...props}:InputHTMLAttributes<HTMLInputElement>){
 const [draft,setDraft]=useState(String(value??'')),[focused,setFocused]=useState(false);
 useEffect(()=>{if(!focused)setDraft(String(value??''));},[value,focused]);
 return <input {...props} type="number" value={draft} onFocus={()=>setFocused(true)} onChange={e=>setDraft(e.target.value)} onBlur={e=>{setFocused(false);if(e.currentTarget.value.trim()!==''&&Number.isFinite(Number(e.currentTarget.value))){if(Number(e.currentTarget.value)!==Number(value))onChange?.(e);}else setDraft(String(value??''));onBlur?.(e);}} onKeyDown={e=>{props.onKeyDown?.(e);if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){e.currentTarget.value=String(value??'');setDraft(String(value??''));e.currentTarget.blur();}}}/>;
}
