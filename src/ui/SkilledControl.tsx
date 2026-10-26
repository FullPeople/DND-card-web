import {useEffect,useState} from 'react';
import {RetainedCardHideEffect,useRetainedCardActive} from './RetainedCardVisibility';
import {useInteractionStatus} from './InteractionFeedback';
import type {Character,Entry} from '../core/model';
import {evaluate} from '../core/engine';
import {reviewedSkilledOptions,reviewedSkilledStatus,setReviewedSkilledIntent} from '../core/automation/reviewedSkilled';

type Props={c:Character;catalog:Entry[];choiceId:string;entry:Entry;unavailable:boolean;writable:boolean;edit?:(action:(draft:Character)=>void)=>void};
const empty=()=>['','',''];
const manualState=(c:Character)=>JSON.stringify([c.abilities,c.proficiencies,c.expertise,c.skillBonuses,c.adjustments,c.training?.tools]);
/** One shared quota: skill and tool kinds are not equipment or manual bonuses. */
export function SkilledControl({c,catalog,choiceId,entry,unavailable,writable,edit}:Props){
 const active=useRetainedCardActive(),persistence=useInteractionStatus();
 const status=reviewedSkilledStatus(c,choiceId,entry.id),stored=status.binding?.intent,saved=JSON.stringify(stored||{}),options=reviewedSkilledOptions(c,catalog);
 const storedValues=()=>stored?stored.choices.map(choice=>`${choice.kind}:${choice.reference}`):empty();
 const [values,setValues]=useState<string[]>(storedValues),[confirmed,setConfirmed]=useState(false),[error,setError]=useState('');
 const manualBasis=manualState(c),basis=JSON.stringify([manualBasis,c.profile,c.automation?.enabled,options.map(option=>[option.value,option.unavailable])]);
 useEffect(()=>{setValues(storedValues());setConfirmed(false);setError('');},[c.id,choiceId,entry.id,saved]);
 useEffect(()=>setConfirmed(false),[basis,status.eligible,status.selectionId,unavailable,writable]);
 const known=!c.reviewedSkilled||c.reviewedSkilled.version===1,canEdit=known&&writable&&!!edit&&active;
 const blocked=!known?'此熟习记录版本尚未支持，原数据保留且不能修改。':!canEdit?'当前角色卡只读，不能修改熟习。':unavailable||!status.eligible?(status.reason||'此职业选择、等级或来源当前不可用，原记录保留。'):'';
 const selected=values.filter(Boolean),distinct=new Set(selected).size,duplicate=distinct!==selected.length;
 const valid=selected.length===3&&distinct===3&&selected.every(value=>options.some(option=>option.value===value&&!option.unavailable));
 const skills=evaluate(c).skills,label=(value:string)=>options.find(option=>option.value===value)?.label||value;
 function reset(){setValues(storedValues());setConfirmed(false);setError('');}
 function save(remove=false){
  if(!canEdit||!remove&&(!!blocked||!valid||!confirmed))return;
  const choices=values.map(value=>options.find(option=>option.value===value)?.choice);
  let applied=false;
  try{const owner=status.selectionId,previous=JSON.stringify(status.binding||null),characterId=c.id;edit!(draft=>{
   if(!remove&&manualState(draft)!==manualBasis)throw Error('手工技能、属性或工具熟练记录已变化，请重新核对确认。');
   const current=reviewedSkilledStatus(draft,choiceId,entry.id);
   if(draft.id!==characterId||!remove&&current.selectionId!==owner||JSON.stringify(current.binding||null)!==previous)throw Error('职业授予或确认记录已变化，请核对当前角色卡并重新确认。');
   setReviewedSkilledIntent(draft,choiceId,entry.id,remove?null:{kind:'skilled',choices:choices.map(choice=>({...choice!})),confirmed:true});applied=true;
  });if(applied)setConfirmed(false);setError(applied?'':'修改未提交，请查看卡面的只读或同步提示。');}
  catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
 }
 return <div className="reviewed-feat-control skilled-control" data-reviewed-feat-entry={entry.id} data-reviewed-feat-choice={choiceId} data-reviewed-feat-kind="skilled" style={{minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}}>
  <RetainedCardHideEffect hide={reset}/>
  <small>{status.binding?status.active?'熟习已生效':'熟习记录已保留，当前不生效':'尚未确认熟习'}</small>
  <small>PHB 2014 熟习：从技能与工具熟练中混合选择共 3 项，不是技能与工具各选三项。确认前不产生效果。</small>
  <small>当前支持已核对的 18 种技能和 39 种 PHB 工具熟练（含陆运、水运载具种类）；其他来源与特殊工具待适配，不代表完整“任意工具”范围。工具目录组不是一项可获得整组的熟练。</small>
  <small>已有熟练仍可选择，但熟练加值只计算一次，不增加专精或第四个名额。技能原有来源、手工最终值与额外调整保留；工具标签不创建物品，也不自动执行工具检定、制作或载具驾驶。</small>
  <small aria-live="polite">已选 {distinct}/3（技能与工具共享额度）{duplicate?'；重复选择不能确认':''}</small>
  {Array.from({length:3},(_,index)=><label key={index}>选择 {index+1} <select aria-label={`熟习选择 ${index+1}`} value={values[index]||''} disabled={!!blocked} onChange={event=>{setValues(current=>current.map((value,slot)=>slot===index?event.target.value:value));setConfirmed(false);setError('');}} style={{width:'100%',maxWidth:'100%',minWidth:0}}><option value="">请选择一种技能或工具熟练</option>{values[index]&&!options.some(option=>option.value===values[index])&&<option value={values[index]} disabled>{values[index]}（待核对，记录保留）</option>}{options.map(option=>{const repeated=values.some((value,slot)=>slot!==index&&value===option.value),overlap=option.choice.kind==='skill'&&skills[option.choice.reference]?.proficient;return <option key={option.value} value={option.value} disabled={!!option.unavailable||repeated}>{option.label}{option.unavailable?`（${option.unavailable}）`:repeated?'（已在另一格选择）':overlap?'（已有熟练，不叠加）':''}</option>;})}</select></label>)}
  {selected.flatMap(value=>{const option=options.find(row=>row.value===value),skill=option?.choice.kind==='skill'?skills[option.choice.reference]:undefined;return skill?.proficient?[<small key={value}>已选{option!.label}已有熟练来源：{skill.sources.join('；')||'手工记录'}。保留原来源，不增加熟练倍数。</small>]:[];})}
  <small>熟练来源：{entry.name} · {entry.source} · 本次职业属性提升选择；所选工具与已有同种熟练不叠加，也不自动补选。</small>
  {stored&&<small>当前确认记录：{stored.choices.map(choice=>label(`${choice.kind}:${choice.reference}`)).join('、')}。</small>}
  {c.training?.tools!==undefined&&<small>当前工具熟练由手工记录覆盖{c.training.tools===''?'（空记录）':''}；保留原文，不自动追加工具。合法技能选择仍可生效。</small>}
  <small data-testid="skilled-save-status">{persistence?.scope===c.id?persistence.saveLabel:'保存与同步结果请查看卡面状态'}</small>
  {status.reason&&<small>{status.reason}</small>}
  <small>旧版客户端不支持熟习派生；未知字段被保留不代表完整安全往返。若在旧版改过此专长或手工技能、工具记录，回到新版后请先撤回，核对后重新确认。</small>
  <label><input type="checkbox" aria-label="确认熟习这三项选择" checked={confirmed} disabled={!!blocked} onChange={event=>setConfirmed(event.target.checked)}/>已核对并确认这 3 项技能或工具熟练</label>
  <div className="feature-choice-actions"><button type="button" disabled={!!blocked||!valid||!confirmed} onClick={()=>save()}>确认熟习</button><button type="button" disabled={!canEdit} onClick={reset}>取消熟习编辑</button>{status.binding&&<button type="button" disabled={!canEdit} onClick={()=>save(true)}>撤回熟习</button>}</div>
  {blocked&&<small>{blocked}{status.binding&&canEdit?'仍可撤回此记录。':''}</small>}
  {error&&<small role="alert">{error}</small>}
 </div>;
}
