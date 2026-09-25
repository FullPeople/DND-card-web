import {hitPointLevels} from '../core/hitPoints';
import {evaluate} from '../core/engine';
import type {Character} from '../core/model';
import {NumberInput} from './NumberInput';

export function HitPointEditor({c,edit}:{c:Character;edit:(fn:(c:Character)=>void)=>void}){
 const mode=c.baseHp>0?'manual':c.hpProgression?.mode||'average',d=evaluate(c),rows=hitPointLevels(c,d.modifiers.con),diceTotal=rows.reduce((sum,r)=>sum+r.die,0),cardBonus=c.sheetBonuses?.hp||0;
 const other=d.maxHp-(mode==='manual'?c.baseHp:diceTotal+d.modifiers.con*rows.length)-cardBonus;
 return <section className="hp-editor"><div className="segmented">{([['average','固定平均值'],['rolled','逐级骰值'],['manual','填写基础上限']] as const).map(([key,label])=><button key={key} aria-pressed={mode===key} onClick={()=>edit(c=>{if(key==='manual')c.baseHp=rows.reduce((sum,r)=>sum+r.hp,0)||1;else{c.baseHp=0;c.hpProgression={mode:key,rolls:c.hpProgression?.rolls||{}};}c.adjustments=c.adjustments?.filter(a=>a.target!=='hp');})}>{label}</button>)}</div>
 {mode==='manual'?<label>基础生命值上限<NumberInput aria-label="基础生命值上限" type="number" min="1" max="99999" value={c.baseHp} onChange={e=>edit(c=>{c.baseHp=Math.max(1,Number(e.target.value)||1);})}/></label>:<><div className="hp-levels">{rows.map(r=><label key={`${r.id}:${r.level}`}><span>{r.name}<small>{r.level}级 · d{r.faces}</small></span>{mode==='rolled'&&!r.first?<NumberInput className="hp-level-value" aria-label={`${r.name}${r.level}级生命骰结果`} type="number" min="1" max={r.faces} value={r.die} onChange={e=>edit(c=>{const progression=c.hpProgression||={mode:'rolled',rolls:{}};const rolls=progression.rolls[r.id]||=[];rolls[r.level-1]=Math.max(1,Math.min(r.faces,Number(e.target.value)||1));})}/>:<b className="hp-level-value" aria-label={`${r.name}${r.level}级生命骰结果`}>{r.die}</b>}</label>)}</div></>}
 <div className="hp-calculation"><strong>当前生命值上限：{d.maxHp}</strong><p>{mode==='manual'?<>基础上限 <b>{c.baseHp}</b></>:<>以上加值 <b>{diceTotal}</b> ＋ 体质调整值（<b>{d.modifiers.con}</b>）× 等级（<b>{rows.length}</b>）</>} ＋ 卡面调整（<b>{cardBonus}</b>）{other!==0&&<> ＋ 其他修正（<b>{other}</b>）</>} ＝ <b>{d.maxHp}</b></p>{other!==0&&<small>{d.trace.hp.join('；')}</small>}</div></section>;
}
