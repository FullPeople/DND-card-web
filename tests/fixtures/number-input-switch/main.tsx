import {Profiler,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {newCharacter,ABILITY_LABELS,type Ability,type Character} from '../../../src/core/model';
import {evaluate} from '../../../src/core/engine';
import {NumberInput} from '../../../src/ui/NumberInput';
import {ValueTraceProvider} from '../../../src/ui/ValueTrace';
import {InteractionFeedbackProvider} from '../../../src/ui/InteractionFeedback';

function prepare(id:string,offset:number){
 const c=newCharacter();c.id=id;c.name=id;c.runtime.hp=offset+3;c.runtime.tempHp=offset+1;
 (Object.keys(ABILITY_LABELS) as Ability[]).forEach((ability,index)=>{c.abilities[ability]=10+offset+index;});
 c.selections=[{id:`${id}:bonus`,level:1,quantity:1,equipped:false,entry:{id:'authored-bonus',name:'原创力量加值',english:'Authored Strength Bonus',kind:'feature',source:'XPHB',edition:'2024',packId:'fixture',revision:'1',raw:{},entries:[],effects:[{op:'add',target:'str',value:2}]}}];
 return {c,d:evaluate(c)};
}
const cards=[prepare('甲',0),prepare('乙',10)],samples:{id:string;phase:string}[]=[];
const fixture={samples,switch:(_index:number)=>{},publish:(_hp:number)=>{},state:()=>({} as {c:Character;edits:number}),clear:()=>{samples.length=0;}};
(window as any).numberInputSwitch=fixture;
function App(){
 const [view,setView]=useState(cards[0]),[edits,setEdits]=useState(0),[trace,setTrace]=useState(false),[readOnly,setReadOnly]=useState(false);
 fixture.switch=index=>flushSync(()=>setView(cards[index]));
 fixture.publish=hp=>flushSync(()=>setView(old=>{const c={...old.c,runtime:{...old.c.runtime,hp}};return {c,d:evaluate(c)};}));
 fixture.state=()=>({c:view.c,edits});
 const change=(action:(c:Character)=>void)=>{setEdits(n=>n+1);setView(old=>{const c=structuredClone(old.c);action(c);return {c,d:evaluate(c)};});};
 const {c,d}=view;
 return <main style={{fontFamily:'Arial',padding:30}}><h1>数字输入跨卡验收</h1><button onClick={()=>setTrace(value=>!value)}>切换追溯</button><button onClick={()=>setReadOnly(value=>!value)}>切换只读</button><button id="outside">其他区域</button><InteractionFeedbackProvider scope={c.id} saveLabel="已保存到本机" canUndo={false} undo={()=>{}}><ValueTraceProvider c={c} d={d} enabled={trace}>
  <section style={{display:'flex',gap:20,margin:'50px 0'}}>{(Object.keys(ABILITY_LABELS) as Ability[]).map(ability=><Profiler id={ability} key={ability} onRender={(id,phase)=>samples.push({id,phase})}><label>{ABILITY_LABELS[ability]}<NumberInput aria-label={`${ABILITY_LABELS[ability]}基础值`} value={c.abilities[ability]} displayValue={d.abilities[ability]} readOnly={readOnly} onChange={event=>change(next=>{next.abilities[ability]=Number(event.target.value);})}/></label></Profiler>)}</section>
  <Profiler id="hp" onRender={(id,phase)=>samples.push({id,phase})}><label>当前生命值<NumberInput aria-label="当前生命值" arithmetic value={c.runtime.hp} readOnly={readOnly} onChange={event=>change(next=>{next.runtime.hp=Number(event.target.value);})}/></label></Profiler>
  <Profiler id="tempHp" onRender={(id,phase)=>samples.push({id,phase})}><label>临时生命值<NumberInput aria-label="临时生命值" arithmetic value={c.runtime.tempHp} readOnly={readOnly} onChange={event=>change(next=>{next.runtime.tempHp=Number(event.target.value);})}/></label></Profiler>
 </ValueTraceProvider></InteractionFeedbackProvider><output id="active-card">{c.id}</output><pre id="data">{JSON.stringify({c,edits})}</pre></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
