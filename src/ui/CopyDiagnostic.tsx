import {useEffect,useMemo,useState} from 'react';
import {safeWorkbenchDiagnostic,type WorkbenchDiagnosticContext} from '../platform/workbenchDiagnostic';
export function diagnosticText(error:unknown,context?:WorkbenchDiagnosticContext){return JSON.stringify(safeWorkbenchDiagnostic(error,context),null,2);}
export function CopyDiagnostic({text,label='复制同步诊断',ariaLabel='同步诊断信息'}:{text:string;label?:string;ariaLabel?:string}){
 const [copied,setCopied]=useState(false),[manual,setManual]=useState(false);
 // Defend the final clipboard boundary too, including legacy callers supplying
 // a raw JSON transport summary instead of diagnosticText(error).
 const safeText=useMemo(()=>{try{return diagnosticText(JSON.parse(text));}catch{return diagnosticText(undefined);}},[text]);
 useEffect(()=>{setCopied(false);setManual(false);},[safeText]);
 useEffect(()=>{if(!copied)return;const timer=setTimeout(()=>setCopied(false),1800);return()=>clearTimeout(timer);},[copied]);
 return <><button className="copy-diagnostic" onClick={async()=>{try{await navigator.clipboard.writeText(safeText);setCopied(true);setManual(false);}catch{setManual(true);}}}>{copied?'已复制':label}</button>{manual&&<textarea className="diagnostic-text" aria-label={ariaLabel} readOnly value={safeText} onFocus={e=>e.currentTarget.select()}/>}</>;
}

export function reportWorkbenchError(error:unknown){window.dispatchEvent(new CustomEvent('workbench-error',{detail:{message:error instanceof Error?error.message:String(error),diagnostic:diagnosticText(error)}}));}
