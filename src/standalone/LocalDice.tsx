import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useInteractionStatus} from '../ui/InteractionFeedback';
import {localRoll,randomLocalFace,type LocalRollResult} from './localRoll';
import {createRollPresentation} from './rollPresentation';
import './localDice.css';

function DieMark(){return <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 3 94 27 94 73 50 97 6 73 6 27ZM50 3 73 40 94 27M73 40 94 73 50 66 6 73 27 40 6 27M27 40 50 3M27 40 73 40 50 66ZM50 66V97"/></svg>;}
export function LocalDice(){
 const dialog=useRef<HTMLDialogElement>(null),field=useRef<HTMLInputElement>(null),status=useInteractionStatus(),scope=useRef(status?.scope);scope.current=status?.scope;
 const [roll,setRoll]=useState<{expression:string;label:string;scope?:string}>(),[result,setResult]=useState<LocalRollResult>(),[phase,setPhase]=useState<'ready'|'rolling'|'result'|'error'>('ready'),[error,setError]=useState('');
 const presentation=useRef<ReturnType<typeof createRollPresentation<LocalRollResult>>|undefined>(undefined);
 if(!presentation.current)presentation.current=createRollPresentation({rolling:()=>{setResult(undefined);setError('');setPhase('rolling');},reveal:value=>{setResult(value);setPhase('result');},error:message=>{setResult(undefined);setError(message);setPhase('error');},reduced:()=>matchMedia('(prefers-reduced-motion: reduce)').matches});
 const close=()=>{presentation.current!.cancel();setRoll(undefined);setResult(undefined);setPhase('ready');};
 useEffect(()=>{
  const open=(event:Event)=>{const detail=(event as CustomEvent).detail;if(!detail||typeof detail.expression!=='string')return;presentation.current!.cancel();setRoll({expression:detail.expression,label:typeof detail.label==='string'?detail.label:'投骰',scope:scope.current});setResult(undefined);setError('');setPhase('ready');};
  window.addEventListener('local-dice',open);
  const media=matchMedia('(prefers-reduced-motion: reduce)'),reduce=()=>{if(media.matches)presentation.current!.reveal();};media.addEventListener('change',reduce);
  return()=>{window.removeEventListener('local-dice',open);media.removeEventListener('change',reduce);presentation.current!.cancel();};
 },[]);
 useEffect(()=>{close();},[status?.scope]);
 const isOpen=!!roll&&roll.scope===status?.scope;
 useLayoutEffect(()=>{
  const node=dialog.current;if(!isOpen||!node)return;
  const previous=document.activeElement;node.showModal();field.current?.focus();field.current?.select();
  return()=>{if(node.open)node.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};
 },[isOpen]);
 return isOpen&&roll?createPortal(<dialog ref={dialog} className="local-dice-dialog" aria-label="本地投骰" onCancel={event=>{event.preventDefault();event.stopPropagation();close();}} onPointerDown={event=>{if(event.target===event.currentTarget){event.preventDefault();event.stopPropagation();close();}}}>
  <form className="local-roll-console" data-phase={phase} onSubmit={event=>{event.preventDefault();presentation.current!.start(()=>localRoll(roll.expression,randomLocalFace));}}>
   <header><div><small>本地投骰</small><h2>{roll.label||'投骰'}</h2></div><button type="button" aria-label="关闭投骰" onClick={close}>×</button></header>
   <label className="local-roll-expression">表达式<input ref={field} autoFocus aria-label="骰子表达式" readOnly={phase==='rolling'} value={roll.expression} onChange={event=>{setRoll({...roll,expression:event.target.value});setResult(undefined);setError('');setPhase('ready');}}/></label>
   <div className="local-roll-stage" aria-busy={phase==='rolling'}>
    <div className="local-roll-mark" aria-hidden="true"><DieMark/></div>
    <output className="local-roll-result" role="status" aria-label="投骰结果">{phase==='rolling'?<span className="local-roll-pending">投掷中…</span>:result?<><small>合计 · {result.formula}</small><strong key={result.formula+':'+result.total}>{result.total}</strong></>:<span className="local-roll-ready">等待投掷</span>}</output>
   </div>
   {error&&<p className="inline-error" role="alert">{error}</p>}
   {result&&<div className="local-roll-breakdown" aria-label="骰子明细">{result.groups.map((group,index)=><div key={index}><small>{group.sign<0?'− ':''}{group.values.length}d{group.sides}</small><div>{group.values.map((value,i)=><b key={i}>{value}</b>)}</div></div>)}{result.modifier!==0&&<div><small>调整</small><strong>{result.modifier>0?'+':''}{result.modifier}</strong></div>}</div>}
   <footer><span>仅本机 · 不修改角色数值</span><button type="submit" className="primary" disabled={phase==='rolling'}>{phase==='rolling'?'正在投掷':result?'再次投掷':'投骰'}</button></footer>
  </form>
 </dialog>,document.body):null;
}
