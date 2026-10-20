import {useEffect,useRef,useState} from 'react';
import {ABILITIES,ABILITY_LABELS,type Character} from '../core/model';
import {POINT_BUY_BUDGET,POINT_BUY_SCORES,pointBuyCost,pointBuySpent,pointBuyValues,rollAbilityScores,d6FromRandomByte,assignedAbilityValues,replaceBaseAbilities,type AbilityValues,type AbilityRoll} from '../core/abilityGeneration';
import {CloseIcon} from './icons';
import './abilityGeneration.css';

export function AbilityGenerationDialog({c,edit,close}:{c:Character;edit:(action:(draft:Character)=>void,key?:string)=>void;close:()=>void}){
 const modal=useRef<HTMLDialogElement>(null);
 const [baseline,setBaseline]=useState(()=>({id:c.id,abilities:{...c.abilities}}));
 const [method,setMethod]=useState<'points'|'random'>('points');
 const [points,setPoints]=useState<AbilityValues>(()=>Object.fromEntries(ABILITIES.map(ability=>[ability,8])) as AbilityValues);
 const [rolls,setRolls]=useState<AbilityRoll[]>([]),[order,setOrder]=useState([0,1,2,3,4,5]),[error,setError]=useState('');
 useEffect(()=>{const dialog=modal.current;dialog?.showModal();return()=>dialog?.close();},[]);
 useEffect(()=>{if(c.id!==baseline.id)close();},[c.id,baseline.id,close]);
 const stale=c.id!==baseline.id||ABILITIES.some(ability=>c.abilities[ability]!==baseline.abilities[ability]);
 const spent=pointBuySpent(points),preview=method==='points'?points:rolls.length===6?assignedAbilityValues(rolls,order):undefined;
 const ready=!stale&&!!preview&&(method==='random'||spent===POINT_BUY_BUDGET);
 function roll(){
  try{
   const next=rollAbilityScores(()=>d6FromRandomByte(()=>crypto.getRandomValues(new Uint8Array(1))[0]));
   setRolls(next);setOrder([0,1,2,3,4,5]);setError('');
  }catch(failure){setError(`无法生成随机属性：${String(failure)}`);}
 }
 function assign(index:number,next:number){
  const previous=order[index],other=order.indexOf(next);if(other<0)return;
  const values=[...order];values[index]=next;values[other]=previous;setOrder(values);
 }
 function apply(){
  if(!ready||!preview)return;
  try{
   const values=method==='points'?pointBuyValues(points):assignedAbilityValues(rolls,order);let accepted=false;
   edit(draft=>{replaceBaseAbilities(draft,values,baseline);accepted=true;},'ability-generation');
   if(accepted)close();else setError('当前角色无法修改，请核对编辑权限后重试。');
  }catch(failure){setError(String(failure));}
 }
 if(c.id!==baseline.id)return null;
 return <dialog ref={modal} className="dialog ability-generation-dialog" aria-label="生成基础属性" aria-describedby="ability-generation-help" onCancel={event=>{event.preventDefault();event.stopPropagation();close();}} onClick={event=>{event.stopPropagation();if(event.target===event.currentTarget)close();}}>
  <header className="dialog-head"><h2>生成基础属性</h2><button type="button" aria-label="关闭属性生成" onClick={close}><CloseIcon/></button></header>
  <div className="dialog-body">
   <p id="ability-generation-help">先预览，再替换六项基础值。现有来源、加值选择和已消耗资源记录保留。</p>
   <div className="ability-generation-methods"><button type="button" aria-pressed={method==='points'} onClick={()=>{setMethod('points');setError('');}}>27 点购点</button><button type="button" aria-pressed={method==='random'} onClick={()=>{setMethod('random');setError('');}}>随机掷骰</button></div>
   {method==='points'?<p role="status">剩余 {POINT_BUY_BUDGET-spent} / 27 点 · 每项 8–15</p>:<><p role="status">{rolls.length?'六组结果已生成，选择另一组时会交换分配。':'每组投四枚 d6，去掉一枚最低值，共投六组。'}</p><button type="button" onClick={roll}>{rolls.length?'再投六组':'投掷六组'}</button></>}
   <table className="ability-generation-values"><thead><tr><th>属性</th><th>现基础值</th><th>{method==='points'?'购点预览':'分配结果'}</th></tr></thead><tbody>{ABILITIES.map((ability,index)=><tr key={ability}><th scope="row">{ABILITY_LABELS[ability]}</th><td>{c.abilities[ability]}</td><td>{method==='points'?<select aria-label={`${ABILITY_LABELS[ability]}购点值`} value={points[ability]} onChange={event=>{const value=Number(event.target.value);if(POINT_BUY_SCORES.includes(value as typeof POINT_BUY_SCORES[number]))setPoints({...points,[ability]:value});}}>{POINT_BUY_SCORES.map(value=><option key={value} value={value} disabled={spent-pointBuyCost(points[ability])+pointBuyCost(value)>POINT_BUY_BUDGET}>{value} · {pointBuyCost(value)} 点</option>)}</select>:rolls.length===6?<select aria-label={`${ABILITY_LABELS[ability]}随机分配`} value={order[index]} onChange={event=>assign(index,Number(event.target.value))}>{rolls.map((roll,i)=><option value={i} key={i}>第 {i+1} 组 · {roll.score}</option>)}</select>:<span>—</span>}</td></tr>)}</tbody></table>
   {method==='random'&&rolls.length>0&&<ol className="ability-generation-rolls">{rolls.map((roll,index)=><li key={index} data-generated-roll={index}><span>第 {index+1} 组：<strong>{roll.score}</strong></span><div aria-label={`第 ${index+1} 组骰子`}>{roll.dice.map((value,i)=>i===roll.dropped?<s key={i} title="去掉的最低值">{value}</s>:<span key={i}>{value}</span>)}</div></li>)}</ol>}
   {(stale||error)&&<p className="inline-error" role="alert">{stale?'基础属性已变化，请核对当前值后再应用。':error}</p>}
   {stale&&<button type="button" onClick={()=>{setBaseline({id:c.id,abilities:{...c.abilities}});setError('');}}>已核对当前基础值</button>}
   <footer className="dialog-actions"><button type="button" onClick={close}>取消</button><button type="button" disabled={!ready} onClick={apply}>应用基础值</button></footer>
  </div>
 </dialog>;
}
