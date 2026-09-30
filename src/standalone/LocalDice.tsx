import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './localDice.css';
export function LocalDice(){
 const dialog=useRef<HTMLDialogElement>(null);
 const [roll,setRoll]=useState<{expression:string;label:string}>(),[result,setResult]=useState('');
 useEffect(()=>{const open=(e:Event)=>{setRoll((e as CustomEvent).detail);setResult('');};window.addEventListener('local-dice',open);return()=>window.removeEventListener('local-dice',open);},[]);
 const isOpen=!!roll;
 useLayoutEffect(()=>{
  const node=dialog.current;if(!isOpen||!node)return;
  const previous=document.activeElement;node.showModal();
  return()=>{if(node.open)node.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};
 },[isOpen]);
 function cast(){if(!roll)return;const formula=roll.expression.replace(/\s/g,'').toLowerCase();if(!/^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/.test(formula)){setResult('支持 1d20+5、2d6+3 等骰子表达式');return;}let sum=0;const values:string[]=[];for(const part of formula.match(/[+-]?[^+-]+/g)||[]){const sign=part.startsWith('-')?-1:1,plain=part.replace(/^[+-]/,'');if(plain.includes('d')){const [n,faces]=plain.split('d'),count=Number(n||1),sides=Number(faces);if(count>100||sides<1||sides>10000){setResult('骰子数量或面数超出范围');return;}const row=Array.from({length:count},()=>{const buffer=new Uint32Array(1),limit=Math.floor(4294967296/sides)*sides;do{crypto.getRandomValues(buffer);}while(buffer[0]>=limit);return buffer[0]%sides+1;});sum+=sign*row.reduce((a,b)=>a+b,0);values.push(`${part}: ${row.join(', ')}`);}else sum+=sign*Number(plain);}setResult(`${sum}  (${values.join('；')})`);}
 return roll?createPortal(<dialog ref={dialog} className="resource-editor-shade local-dice-dialog" aria-label="本地投骰" onCancel={e=>{e.preventDefault();e.stopPropagation();setRoll(undefined);}} onPointerDown={e=>{if(e.target===e.currentTarget){e.preventDefault();e.stopPropagation();setRoll(undefined);}}}><form className="resource-editor-form" onSubmit={e=>{e.preventDefault();cast();}}><strong>{roll.label}</strong><input aria-label="骰子表达式" value={roll.expression} onChange={e=>setRoll({...roll,expression:e.target.value})}/><p role="status">{result}</p><div className="dialog-actions"><button type="submit">投骰</button><button type="button" onClick={()=>setRoll(undefined)}>关闭</button></div></form></dialog>,document.body):null;
}
