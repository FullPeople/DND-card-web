import {useEffect,useState} from 'react';
import {selectionEffectsAllowed,type Character,type Entry} from '../core/model';
import {selectionActive} from '../core/automation/choices';
import {canActivateInfusion,infusionRule,infusionTargets,setInfusionTarget,setInfusionHeld} from '../core/automation/infusions';
import {automationEnabled} from '../core/automation/state';

type Props={c:Character;choiceId:string;ownerId:string;entry:Entry;unavailable:boolean;writable:boolean;edit?:(action:(draft:Character)=>void)=>void};

/** Learning, choosing a target and equipping it are separate player actions. */
export function InfusionControl({c,choiceId,ownerId,entry,unavailable,writable,edit}:Props){
 const supportedState=!c.infusions||c.infusions.version===1;
 const binding=supportedState?c.infusions?.bindings.find(row=>row.choiceId===choiceId&&row.entryId===entry.id):undefined;
 const [targetId,setTargetId]=useState(binding?.targetId||''),[error,setError]=useState('');
 useEffect(()=>{setTargetId(binding?.targetId||'');setError('');},[c.id,choiceId,entry.id,binding?.targetId]);
 const rule=infusionRule(entry);if(!rule)return null;
 const targets=infusionTargets(c,entry),owner=c.selections.find(row=>row.id===ownerId),target=c.selections.find(row=>row.id===binding?.targetId);
 const canEdit=writable&&!!edit&&supportedState;
 const blocked=!supportedState?'此灌注记录版本尚未支持，原数据保留且不能修改。':!canEdit?'当前角色卡只读，不能修改灌注。':!automationEnabled(c)?'自动计算当前不可用，原灌注记录保留。':unavailable||!owner||!selectionActive(c,owner)||!selectionEffectsAllowed(c,entry)||!canActivateInfusion(c,choiceId,entry.id)?'此已学选项或来源当前不可用，原灌注记录保留。':'';
 const focus=rule.mechanism==='spell-attack-bonus';
 const targetStatus=focus?(!target?.equipped?'未装备，法术攻击加值未生效':!target.attuned?'未同调，法术攻击加值未生效':!binding?.held?'未确认当前持握，法术攻击加值未生效':'已装备、已同调并确认持握'):target?.equipped?'已装备':rule.mechanism==='weapon-bonus'?'未装备，不生成自动攻击':'未装备，不计 AC';
 const canApply=!blocked&&!!targetId&&targets.some(row=>row.id===targetId)&&binding?.targetId!==targetId;
 function save(next:string|null){
  if(!canEdit||next!==null&&!canApply)return;
  let applied=false;
  try{
   edit!(draft=>{setInfusionTarget(draft,choiceId,entry.id,next);applied=true;});
   setError(applied?'':'修改未提交，请查看卡面的只读或同步提示。');
  }catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
 }
 function hold(held:boolean){
  if(!canEdit||held&&(!!blocked||!target?.equipped||!target.attuned))return;
  let applied=false;
  try{edit!(draft=>{setInfusionHeld(draft,choiceId,entry.id,held);applied=true;});setError(applied?'':'修改未提交，请查看卡面的只读或同步提示。');}
  catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
 }
 return <div className="infusion-control" data-infusion-entry={entry.id} data-infusion-choice={choiceId} style={{minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}}>
  <small>{!supportedState?'已有灌注记录待核对':binding?`已指定灌注目标：${target?.entry.name||'原目标已不存在'}${target?`（${targetStatus}）`:''}`:'尚未指定灌注目标'}</small>
  <small>学习不等于激活。确认灌注只绑定物品，不会自动装备或同调；未支持的其他能力仍手动处理。</small>
  <small>请在完成长休并触及物品后确认；死亡后的失效时点仍需手动撤回。</small>
  {rule.mechanism==='weapon-bonus'&&<small>仅为可解析伤害的近战／远程简易或军用武器追加自动命中与伤害加值；手写公式、无伤害武器及法器类兼用武器仍手动处理。{rule.magicBoundary}</small>}
  {rule.requiredProperties?.includes('T')&&<small>目标必须具有明确记录的投掷属性；持握或掷出动作本身不会改变灌注绑定。</small>}
  {focus&&<small>仅支持已核对的 PHB 权杖、法杖、魔杖；其他法器与自制物品仍手动处理。必须已装备、已同调，并明确确认当前持握才增加法术攻击；装备不等于持握；手部占用与同调总数仍需手动核对。本网页角色卡内取消装备或同调、换目标后需重新确认持握；外部背包流转不在本批完整生命周期范围内。</small>}
  {focus&&binding&&<label><input type="checkbox" aria-label="确认当前持握此法器" checked={binding.held===true} disabled={!canEdit||!binding.held&&(!!blocked||!target?.equipped||!target.attuned)} onChange={event=>hold(event.target.checked)}/>确认当前持握此法器</label>}
  {rule.manualBoundary&&<small>{rule.manualBoundary}</small>}
  <div className="feature-choice-actions">
   <label style={{minWidth:0,maxWidth:'100%'}}>灌注目标 <select style={{maxWidth:'100%'}} aria-label={`${entry.name}灌注目标`} value={targetId} disabled={!!blocked} onChange={event=>{setTargetId(event.target.value);setError('');}}>
    <option value="">请选择已有物品</option>
    {targetId&&!targets.some(row=>row.id===targetId)&&<option value={targetId} disabled>{c.selections.find(row=>row.id===targetId)?.entry.name||'原目标已不存在'}（当前不可用）</option>}
    {targets.map((row,index)=><option key={row.id} value={row.id}>{index+1}. {row.entry.name} · {row.entry.source}{row.equipped?'（已装备）':'（未装备）'}</option>)}
   </select></label>
   <button type="button" disabled={!canApply} aria-label={`确认${entry.name}灌注`} onClick={()=>save(targetId)}>确认灌注</button>
   {binding&&<button type="button" disabled={!canEdit} aria-label={`撤回${entry.name}灌注`} onClick={()=>save(null)}>撤回灌注</button>}
  </div>
  {blocked&&<small>{blocked}{binding&&canEdit?'仍可撤回此灌注。':''}</small>}
  {!targets.length&&!blocked&&<small>当前没有可用目标，请先在背包加入符合条件的物品。</small>}
  {error&&<small role="alert">{error}</small>}
 </div>;
}
