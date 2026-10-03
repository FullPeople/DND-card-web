import {useContext,useLayoutEffect,useState,type InputHTMLAttributes} from 'react';
import {flushSync} from 'react-dom';
import {ValueTraceContext,traceForInput} from './ValueTrace';
import {numericExpression} from '../core/numericExpression';
export function NumberInput({value,displayValue,onChange,onBlur,arithmetic=false,...props}:InputHTMLAttributes<HTMLInputElement>&{arithmetic?:boolean;displayValue?:number}){
 const context=useContext(ValueTraceContext);
 // Derived totals are presentation only. Focus, edits and trace inputs always
 // use the stored value, so a displayed bonus can never become a new base.
 const display=displayValue??value;
 const [draft,setDraft]=useState(String(display??'')),[focused,setFocused]=useState(false);
 useLayoutEffect(()=>{if(!focused)setDraft(String(display??''));},[display,focused]);
 const trace=(input:HTMLInputElement)=>{
  if(!context)return;
  const model=traceForInput(context,String(props['aria-label']||''),Number(value),n=>{input.value=String(n);onChange?.({target:input,currentTarget:input} as any);});
  return model&&props.readOnly?{...model,change:undefined}:model;
 };
 return <input {...props} onPointerDown={event=>{
  props.onPointerDown?.(event);if(event.defaultPrevented||event.button!==0)return;
  const model=trace(event.currentTarget);if(!model)return;
  // Take over before the browser focuses/selects the displayed total. The first
  // editable field painted is the overlay's stored base, already selected.
  event.preventDefault();flushSync(()=>context!.open(event.currentTarget,model));
 }} onClick={event=>{props.onClick?.(event);if(event.defaultPrevented)return;const model=trace(event.currentTarget);if(model)context!.open(event.currentTarget,model);}} type={arithmetic?'text':'number'} inputMode={arithmetic?'text':props.inputMode} title={props.title||(arithmetic?'支持 + - * / 和括号；-5 扣除 5，=20 设为 20。':undefined)} value={draft} onFocus={event=>{
  if(!props.readOnly){
   // Keyboard/programmatic focus has no pointerdown. Replace the DOM value in
   // this event before native selection, then mount/focus the trace before paint.
   if(displayValue!==undefined){event.currentTarget.value=String(value??'');setDraft(String(value??''));}
   setFocused(true);const model=displayValue!==undefined?trace(event.currentTarget):undefined;if(model)context!.open(event.currentTarget,model);
  }
  props.onFocus?.(event);
 }} onChange={e=>{e.currentTarget.setCustomValidity('');setDraft(e.target.value);}} onBlur={e=>{setFocused(false);if(props.readOnly){setDraft(String(display??''));onBlur?.(e);return;}let next=Number(e.currentTarget.value);if(arithmetic&&e.currentTarget.value.trim())try{next=Math.floor(numericExpression(e.currentTarget.value,Number(value)||0).value);e.currentTarget.value=String(next);}catch(error){e.currentTarget.setCustomValidity(String(error instanceof Error?error.message:error));e.currentTarget.reportValidity();setDraft(String(value??''));onBlur?.(e);return;}if(e.currentTarget.value.trim()!==''&&Number.isFinite(next)){if(next!==Number(value))onChange?.(e);setDraft(String(next));}else setDraft(String(value??''));onBlur?.(e);}} onKeyDown={e=>{props.onKeyDown?.(e);if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){e.currentTarget.value=String(value??'');setDraft(String(value??''));e.currentTarget.setCustomValidity('');e.currentTarget.blur();}}}/>;
}
