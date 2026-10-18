import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {newCharacter,type Character,type Entry} from '../../../src/core/model';
import {exportCharacter} from '../../../src/core/export';
import {newAutomationState} from '../../../src/core/automation/state';
import {syncSourceSpells,planSourceSpells} from '../../../src/core/automation/sourceSpells';
import {SourceSpellActions} from '../../../src/ui/SourceSpellActions';
import {InteractionFeedbackProvider} from '../../../src/ui/InteractionFeedback';
import {LocalDice} from '../../../src/standalone/LocalDice';
import {Toast} from '../../../src/ui/Toast';
import '../../../src/ui/style.css';
import '../../../src/ui/interactionP1.css';
import '../../../src/ui/readabilityP2.css';

const entry=(id:string,kind:Entry['kind'],raw:Entry['raw']):Entry=>({id,name:id,english:id,kind,raw,source:'XPHB',edition:'2024',packId:'authored-p3',revision:'1',entries:['原创软件验收条目。']});
function initial(id:string){const c=newCharacter();c.id=id;c.name=id;c.automation=newAutomationState();c.selections=[{id:'owner',entry:entry('原创术式来源','race',{additionalSpells:[{ability:'cha',prepared:{'_':{daily:{'2':['原创术式|XPHB']}}}}]}),quantity:1,level:1,equipped:false}];const catalog=[entry('原创术式','spell',{level:1})];const choice=planSourceSpells(c,catalog).choices.find(row=>row.usageModes);if(choice)c.automation.spellUsageModes={[choice.key]:'shared'};syncSourceSpells(c,catalog);c.runtime.resources['spell-slot:1']={current:2,max:2};return c;}
function Harness(){
 const [c,setCard]=useState(()=>initial('原创演出 A')),[delayed,setDelayed]=useState(false),[reject,setReject]=useState(false),[pending,setPending]=useState<Character>(),[message,setMessage]=useState('');const previous=useRef<Character|undefined>(undefined);
 const downloadFixture=()=>{const card=initial('P3 本地验证'),url=URL.createObjectURL(new Blob([JSON.stringify(exportCharacter(card),null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='P3 本地验证.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const spell=c.selections.find(row=>row.entry.kind==='spell')!;
 const edit=(fn:(draft:Character)=>void)=>{if(reject)throw Error('角色只读，未提交');const next=structuredClone(c);fn(next);next.revision++;previous.current=c;if(delayed)setPending(next);else setCard(next);};
 return <InteractionFeedbackProvider scope={c.id} saveLabel={pending?'等待组件确认':'组件内存已更新，未写入存档'} canUndo={!!previous.current} undo={()=>{if(previous.current)setCard(previous.current);}}><main style={{maxWidth:650,margin:'30px auto',padding:20}}><h1>P3 本地组件验证</h1><p>仅临时内存，不读取、保存或上传角色档案。</p><h2>{c.name}</h2><nav style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={()=>{setCard(initial(c.id==='原创演出 A'?'原创演出 B':'原创演出 A'));setPending(undefined);}}>切换原创卡</button><button onClick={()=>setDelayed(!delayed)}>{delayed?'关闭延迟':'开启延迟'}</button><button onClick={()=>setReject(!reject)}>{reject?'解除只读':'模拟只读拒绝'}</button><button onClick={()=>window.dispatchEvent(new CustomEvent('local-dice',{detail:{expression:'2d6+3',label:'原创投骰'}}))}>打开本地投骰</button><button onClick={()=>setMessage('已填入原创测试条目')}>显示选择反馈</button><button onClick={downloadFixture}>下载原创测试卡</button></nav><hr/><SourceSpellActions key={c.id} c={c} id={spell.id} edit={edit}/><output style={{display:'block',overflowWrap:'anywhere',marginTop:12}} aria-label="实际资源">{Object.entries(c.runtime.resources).map(([id,r])=>`${id}: ${r.current}/${r.max}`).join('；')}</output>{pending&&<button onClick={()=>{if(pending.id===c.id)setCard(pending);setPending(undefined);}}>确认组件提交</button>}<LocalDice/>{message&&<Toast message={message} close={()=>setMessage('')}/>}</main></InteractionFeedbackProvider>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
