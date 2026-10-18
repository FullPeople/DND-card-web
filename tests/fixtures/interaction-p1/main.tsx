import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {newCharacter,type Character,type Entry} from '../../../src/core/model';
import {InteractionFeedbackProvider} from '../../../src/ui/InteractionFeedback';
import {NumberInput} from '../../../src/ui/NumberInput';
import {EntryApplyAction} from '../../../src/ui/EntryApplyAction';
import {QuickStart} from '../../../src/ui/QuickStart';
import '../../../src/ui/interactionP1.css';
const entry=(id:string):Entry=>({id,name:id,english:id,kind:'race',source:'PHB',edition:'2014',revision:'1',packId:'authored-p1',entries:[],raw:{}});
function initial(id:string,hp:number){const c=newCharacter('2014');c.id=id;c.name=id;c.runtime.hp=hp;c.selections=[{id:'old',entry:entry('原创建模种族'),level:1,quantity:1,equipped:false}];return c;}
function Harness(){
 const [c,setCard]=useState(()=>initial('原创卡 A',10)),[locked,setLocked]=useState(false),[editing,setEditing]=useState(false),[delayed,setDelayed]=useState(false),[pending,setPending]=useState<{id:string;value:number}>(),[saving,setSaving]=useState('已保存到本机'),[intro,setIntro]=useState(false),[lastStart,setLastStart]=useState('未开始');
 const previous=useRef<Character|undefined>(undefined);
 function commit(value:number){if(locked)return;if(delayed){setPending({id:c.id,value});setSaving('保存中…');return;}previous.current=c;setCard({...c,runtime:{...c.runtime,hp:value}});setSaving('已保存到本机');}
 return <InteractionFeedbackProvider scope={c.id} saveLabel={saving} canUndo={!!previous.current} undo={()=>{if(previous.current){setCard(previous.current);previous.current=undefined;}}}><main style={{maxWidth:600,margin:'30px auto',padding:20,fontFamily:'sans-serif'}}><h1>原创 P1 组件验证</h1><p>此页面使用临时内存，不读取或保存角色档案。</p><h2>{c.name}</h2><nav><button onClick={()=>{setCard(initial('原创卡 A',10));previous.current=undefined;}}>切到 A</button><button onClick={()=>{setCard(initial('原创卡 B',7));previous.current=undefined;}}>切到 B</button><button onClick={()=>setLocked(v=>!v)}>{locked?'解除只读':'设为只读'}</button><button onClick={()=>setDelayed(v=>!v)}>{delayed?'关闭延迟':'开启延迟'}</button></nav><label>当前生命值 <NumberInput aria-label="组件生命值" arithmetic readOnly={locked} value={c.runtime.hp} onChange={event=>commit(Number(event.target.value))}/></label><p role="status">{saving}</p>{pending&&<button onClick={()=>{if(pending.id===c.id){previous.current=c;setCard({...c,runtime:{...c.runtime,hp:pending.value}});}setPending(undefined);setSaving('已保存到本机');}}>确认待处理修改</button>}<EntryApplyAction key={c.id} entry={entry('原创候选种族')} character={c} disabledReason={locked?'角色只读':undefined} editing={editing} editReady enableEditing={()=>setEditing(true)} apply={()=>{previous.current=c;setCard({...c,selections:[{id:'new',entry:entry('原创候选种族'),level:1,quantity:1,equipped:false}]});}}/><output aria-label="当前种族">{c.selections[0].entry.name}</output><hr/><button onClick={()=>setIntro(v=>!v)}>重开首用界面</button>{intro&&<QuickStart edition={c.edition} locked={locked} start={async edition=>{setLastStart(edition);setIntro(false);}} importCard={()=>setLastStart('导入')} settings={()=>setLastStart('高级设置')}/>}<output aria-label="首用结果">{lastStart}</output></main></InteractionFeedbackProvider>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
