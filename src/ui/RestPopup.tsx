import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Character} from '../core/model';
import {evaluate} from '../core/engine';
import {isHitDieResource} from '../core/resources';
import {performRest,longRestHitDiceBudget,type HitDieRoll} from '../core/automation/rest';
import {resourceRestRecovery,restedResourceValue} from '../core/automation/featureResources';
import {NumberInput} from './NumberInput';
import './automationChoices.css';
export function RestPopup({c,kind,edit,close}:{c:Character;kind:'short'|'long';edit:(action:(c:Character)=>void)=>void;close:()=>void}){
 const ref=useRef<HTMLDivElement>(null),confirmed=useRef(false),[counts,setCounts]=useState<Record<string,number>>(()=>{let budget=longRestHitDiceBudget(c);return Object.fromEntries(Object.entries(c.runtime.resources).filter(([id])=>isHitDieResource(id)).map(([id,r])=>{const n=kind==='long'?Math.min(budget,r.max-r.current):0;budget-=n;return [id,n];}));}),[error,setError]=useState('');
 const d=evaluate(c),rows=Object.entries(c.runtime.resources).filter(([id])=>isHitDieResource(id)),sum=Object.values(counts).reduce((n,v)=>n+v,0);
 useEffect(()=>{ref.current?.querySelector<HTMLButtonElement>('button')?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[]);
 const confirm=()=>{if(confirmed.current)return;confirmed.current=true;try{
  const rolls:HitDieRoll[]=[];if(kind==='short')for(const [id,n] of Object.entries(counts)){const faces=Number(id.split(':')[1]);if(!Number.isInteger(n)||n<0||n>(c.runtime.resources[id]?.current||0))throw Error('请选择可用的生命骰数量。');for(let i=0;i<n;i++){const random=new Uint32Array(1),limit=Math.floor(4294967296/faces)*faces;do{crypto.getRandomValues(random);}while(random[0]>=limit);rolls.push({id,faces,value:random[0]%faces+1});}}
  const request={id:crypto.randomUUID(),revision:c.revision,sequence:c.runtime.rests?.sequence||0,kind,rolls,recover:kind==='long'?counts:{}};
  edit(draft=>performRest(draft,request));close();
 }catch(e){confirmed.current=false;setError(String(e));}};
 return createPortal(<div className="choice-shade" onPointerDown={e=>{if(e.target===e.currentTarget)close();}}><div className="choice-popup rest-popup" ref={ref} role="dialog" aria-modal="true" aria-label={kind==='short'?'短休':'长休'}><header><strong>{kind==='short'?'短休':'长休'}</strong><button aria-label="关闭休息" onClick={close}>×</button></header><div className="rest-body"><p>生命 {c.runtime.hp} / {d.maxHp}{kind==='long'?' → 回满':` · 体质调整 ${d.modifiers.con>=0?'+':''}${d.modifiers.con}`}</p><strong>{kind==='short'?'消耗生命骰':'恢复生命骰'}</strong>{rows.map(([id,r])=><label className="rest-die-choice" key={id}><span>d{id.split(':')[1]} · 剩余 {r.current}/{r.max}</span><NumberInput aria-label={`${kind==='short'?'消耗':'恢复'}d${id.split(':')[1]}生命骰`} type="number" min="0" max={kind==='short'?r.current:r.max-r.current} value={counts[id]||0} onChange={e=>setCounts({...counts,[id]:Math.max(0,Math.min(kind==='short'?r.current:r.max-r.current,Math.trunc(Number(e.target.value)||0)))})}/></label>)}{kind==='long'&&<p>恢复 {sum}/{longRestHitDiceBudget(c)} 个 · {c.edition==='2024'?'全部生命骰':'总生命骰的一半，最少 1 个'}</p>}<strong>资源恢复</strong><ul>{Object.entries(c.runtime.resources).filter(([id])=>resourceRestRecovery(c,id,kind)!==undefined).map(([id,r])=><li key={id}>{r.name}：{r.current} → {restedResourceValue(c,id,kind)}</li>)}</ul>{error&&<p role="alert">{error}</p>}</div><footer><button onClick={confirm} disabled={kind==='long'&&sum>longRestHitDiceBudget(c)}>确认{kind==='short'?'短休':'长休'}</button></footer></div></div>,[...document.querySelectorAll('dialog[open]')].at(-1)||document.body);
}
