import {useEffect,useState} from 'react';
import {ABILITIES,ABILITY_LABELS,type Ability,type Character,type Entry} from '../core/model';
import {asiAllocationStatus,isSupportedAsiChoice,setAsiAllocation} from '../core/automation/asi';

type Props={c:Character;choiceId:string;entry:Entry;unavailable:boolean;writable:boolean;edit?:(action:(draft:Character)=>void)=>void};

/** Explicit opt-in keeps historical, manually allocated base scores unchanged. */
export function AsiAllocationControl({c,choiceId,entry,unavailable,writable,edit}:Props){
 const supported=isSupportedAsiChoice(c,choiceId,entry);
 const status=supported?asiAllocationStatus(c,choiceId):{eligible:false,active:false,binding:undefined,reason:undefined},allocation=status.binding?.allocation;
 const saved=JSON.stringify(allocation||{});
 const [mode,setMode]=useState<'single'|'split'>('single'),[first,setFirst]=useState<Ability|' '>(' '),[second,setSecond]=useState<Ability|' '>(' '),[confirmed,setConfirmed]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  const selected=ABILITIES.filter(a=>allocation?.[a]);
  setMode(selected.length===2?'split':'single');setFirst(selected[0]||' ');setSecond(selected[1]||' ');setConfirmed(false);setError('');
 },[c.id,choiceId,entry.id,saved]);
 if(!supported)return null;
 const known=!c.asiAllocations||c.asiAllocations.version===1;
 const canEdit=writable&&!!edit&&known;
 const blocked=!known?'此属性提升记录版本尚未支持，原数据保留且不能修改。':!canEdit?'当前角色卡只读，不能修改属性提升。':unavailable||!status.eligible?(status.reason||'此职业授予或来源当前不可用，原记录保留。'):'';
 const valid=first!==' '&&(mode==='single'||second!==' '&&first!==second);
 function resetConfirmation(){setConfirmed(false);setError('');}
 function save(remove=false){
  if(!canEdit||!remove&&(!!blocked||!valid||!confirmed))return;
  let applied=false;
  try{
   const next=remove?null:mode==='single'?{[first]:2}:{[first]:1,[second]:1};
   edit!(draft=>{setAsiAllocation(draft,choiceId,next);applied=true;});
   if(applied)setConfirmed(false);
   setError(applied?'':'修改未提交，请查看卡面的只读或同步提示。');
  }catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
 }
 const options=<><option value=" ">请选择属性</option>{ABILITIES.map(a=><option key={a} value={a}>{ABILITY_LABELS[a]}</option>)}</>;
 return <div className="asi-allocation-control" data-asi-choice={choiceId} style={{minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}}>
  <small>{status.binding?status.active?'属性提升已生效':'属性提升记录已保留，当前不生效':'尚未确认属性提升'}</small>
  <small>仅对本次已获得的 {choiceId.includes(':class-legacy-feat:')?'2014':'2024'} 属性值提升分配：一项 +2 或不同两项各 +1，上限 20。基础属性不改写；旧卡已经手工加过的部分请勿重复启用。</small>
  {status.binding&&<small>已保存：{ABILITIES.filter(a=>allocation?.[a]).map(a=>`${ABILITY_LABELS[a]} +${allocation![a]}`).join('、')}</small>}
  {status.reason&&<small>{status.reason}</small>}
  <div className="feature-choice-actions">
   <label>分配方式 <select aria-label="属性提升分配方式" value={mode} disabled={!!blocked} onChange={e=>{setMode(e.target.value as 'single'|'split');resetConfirmation();}}><option value="single">一项 +2</option><option value="split">两项各 +1</option></select></label>
   <label>第一项 <select aria-label="第一项提升属性" value={first} disabled={!!blocked} onChange={e=>{setFirst(e.target.value as Ability|' ');resetConfirmation();}}>{options}</select></label>
   {mode==='split'&&<label>第二项 <select aria-label="第二项提升属性" value={second} disabled={!!blocked} onChange={e=>{setSecond(e.target.value as Ability|' ');resetConfirmation();}}>{options}</select></label>}
  </div>
  <label><input type="checkbox" aria-label="确认本次提升未计入基础属性" checked={confirmed} disabled={!!blocked} onChange={e=>setConfirmed(e.target.checked)}/>本次提升尚未计入手工基础属性</label>
  <div className="feature-choice-actions"><button type="button" disabled={!!blocked||!valid||!confirmed} onClick={()=>save()}>确认属性提升</button>{status.binding&&<button type="button" disabled={!canEdit} onClick={()=>save(true)}>撤回属性提升</button>}</div>
  {blocked&&<small>{blocked}{status.binding&&canEdit?'仍可撤回此分配。':''}</small>}
  {error&&<small role="alert">{error}</small>}
 </div>;
}
