import {useState} from 'react';
export function diagnosticText(error:unknown){
 const e=error as {message?:string;diagnostic?:unknown;requestId?:string;stack?:string};
 return JSON.stringify({product:'Full Suite',at:new Date().toISOString(),message:e?.message||String(error),diagnostic:e?.diagnostic,requestId:e?.requestId,...(!e?.diagnostic?{stack:e?.stack?.split('\n').slice(0,6).join('\n')}: {})},null,2);
}
export function CopyDiagnostic({text}:{text:string}){
 const [copied,setCopied]=useState(false),[manual,setManual]=useState(false);
 return <><button className="copy-diagnostic" onClick={async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{setManual(true);}}}>{copied?'已复制':'复制同步诊断'}</button>{manual&&<textarea className="diagnostic-text" aria-label="同步诊断信息" readOnly value={text} onFocus={e=>e.currentTarget.select()}/>}</>;
}

export function reportWorkbenchError(error:unknown){window.dispatchEvent(new CustomEvent('workbench-error',{detail:{message:error instanceof Error?error.message:String(error),diagnostic:diagnosticText(error)}}));}
